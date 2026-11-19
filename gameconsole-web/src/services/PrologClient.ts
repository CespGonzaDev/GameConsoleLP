/**
 * PrologClient.ts - Cliente HTTP para el microservicio de IA de Battleship en Prolog
 *
 * Se comunica con:
 * - POST /api/ai/battleship/next-move
 * - GET  /api/ai/health
 *
 * Incluye fallback heurístico local para que el videojuego Battleship nunca se bloquee
 * en caso de que el contenedor de Prolog esté iniciando o haya latencia de red.
 */

import {
  PrologHealthResponse,
  PrologMoveRequest,
  PrologMoveResponse,
  PrologShotHistoryItem,
} from '../types/contracts';

export class PrologServiceError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'PrologServiceError';
    this.status = status;
  }
}

export class PrologClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/api/ai') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * Consulta el siguiente disparo a realizar por la IA de Prolog.
   * Si el microservicio no está disponible, aplica un fallback heurístico local
   * garantizando que el juego continúe con fluidez sin congelarse.
   */
  public async getNextMove(request: PrologMoveRequest): Promise<PrologMoveResponse> {
    const startTime = performance.now();
    try {
      const res = await fetch(`${this.baseUrl}/battleship/next-move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!res.ok) {
        throw new PrologServiceError(`Prolog service returned status ${res.status}: ${res.statusText}`, res.status);
      }

      const data = (await res.json()) as PrologMoveResponse;
      if (!data.decision || typeof data.decision.row !== 'number' || typeof data.decision.col !== 'number') {
        throw new PrologServiceError('Respuesta malformada de Prolog: decision faltante');
      }

      return data;
    } catch (err: unknown) {
      console.warn('[PrologClient] Error consultando servicio Prolog, ejecutando fallback táctico:', err);
      const fallbackDecision = this.calculateLocalTacticalMove(request);
      const elapsed = Math.round(performance.now() - startTime);

      return {
        decision: fallbackDecision.coord,
        mode: fallbackDecision.mode,
        heuristic: `LOCAL_TACTICAL_FALLBACK: ${fallbackDecision.heuristic}`,
        inferenceTimeMs: elapsed,
      };
    }
  }

  /**
   * Consulta el estado de salud del servicio Prolog.
   */
  public async getHealth(): Promise<PrologHealthResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return {
          status: 'error',
          service: 'gameconsole-prolog-ai',
          prologEngine: 'unavailable',
        };
      }

      return (await res.json()) as PrologHealthResponse;
    } catch {
      return {
        status: 'error',
        service: 'gameconsole-prolog-ai',
        prologEngine: 'unreachable',
      };
    }
  }

  /**
   * Heurística local de respaldo (HUNT por paridad + TARGET en impactos sin hundir).
   */
  private calculateLocalTacticalMove(request: PrologMoveRequest): {
    coord: { row: number; col: number };
    mode: 'HUNT' | 'TARGET';
    heuristic: string;
  } {
    const rows = request.boardDimensions?.rows ?? 10;
    const cols = request.boardDimensions?.cols ?? 10;

    // Matriz de disparos previos
    const fired = new Set<string>();
    const unsunkHits: PrologShotHistoryItem[] = [];

    for (const shot of request.shotsHistory) {
      fired.add(`${shot.row},${shot.col}`);
      if (shot.result === 'HIT' && !shot.shipSunk) {
        unsunkHits.push(shot);
      }
    }

    // Modo TARGET: Si hay impactos sin hundir, disparar a casillas ortogonales
    if (unsunkHits.length > 0) {
      const neighbors: Array<{ row: number; col: number }> = [];
      const directions = [
        { dr: -1, dc: 0 },
        { dr: 1, dc: 0 },
        { dr: 0, dc: -1 },
        { dr: 0, dc: 1 },
      ];

      for (const hit of unsunkHits) {
        for (const dir of directions) {
          const nr = hit.row + dir.dr;
          const nc = hit.col + dir.dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && !fired.has(`${nr},${nc}`)) {
            neighbors.push({ row: nr, col: nc });
          }
        }
      }

      if (neighbors.length > 0) {
        // Seleccionar el primer vecino ortogonal no disparado
        return {
          coord: neighbors[0],
          mode: 'TARGET',
          heuristic: 'target_orthogonal_unsunk_hit',
        };
      }
    }

    // Modo HUNT: Tablero de ajedrez / paridad (row + col % 2 === 0)
    const parityCandidates: Array<{ row: number; col: number }> = [];
    const allRemaining: Array<{ row: number; col: number }> = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!fired.has(`${r},${c}`)) {
          allRemaining.push({ row: r, col: c });
          if ((r + c) % 2 === 0) {
            parityCandidates.push({ row: r, col: c });
          }
        }
      }
    }

    if (parityCandidates.length > 0) {
      const choice = parityCandidates[Math.floor(Math.random() * parityCandidates.length)];
      return {
        coord: choice,
        mode: 'HUNT',
        heuristic: 'hunt_parity_checkerboard',
      };
    }

    if (allRemaining.length > 0) {
      const choice = allRemaining[Math.floor(Math.random() * allRemaining.length)];
      return {
        coord: choice,
        mode: 'HUNT',
        heuristic: 'hunt_random_remaining',
      };
    }

    // Caso extremo: tablero completo
    return {
      coord: { row: 0, col: 0 },
      mode: 'HUNT',
      heuristic: 'hunt_exhausted',
    };
  }
}

/** Instancia singleton de PrologClient */
export const prologClient = new PrologClient();
