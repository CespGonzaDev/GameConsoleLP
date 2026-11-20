/**
 * PrologClient.ts - Salud del microservicio de IA en Prolog.
 *
 * Las jugadas de Battleship se piden en games/battleship/BattleshipAi.ts
 * (POST /api/ai/battleship/next-move, con fallback táctico local); aquí solo se
 * consulta GET /api/ai/health para mostrar el estado real del servicio.
 */

import { PrologHealthResponse } from '../types/contracts';

export class PrologClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/api/ai') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  /**
   * GET /api/ai/health. Nunca lanza: si el servicio no responde devuelve status 'error'.
   */
  public async getHealth(): Promise<PrologHealthResponse> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return { status: 'error', service: 'gameconsole-prolog-ai', prologEngine: `HTTP ${res.status}` };
      }

      const data = (await res.json()) as Partial<PrologHealthResponse>;
      return {
        status: data.status === 'ok' ? 'ok' : 'error',
        service: data.service || 'gameconsole-prolog-ai',
        prologEngine: data.prologEngine || 'unknown',
      };
    } catch {
      return { status: 'error', service: 'gameconsole-prolog-ai', prologEngine: 'unreachable' };
    }
  }
}

/** Instancia singleton de PrologClient */
export const prologClient = new PrologClient();
