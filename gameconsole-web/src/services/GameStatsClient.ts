/**
 * GameStatsClient.ts - Cliente HTTP tipado para el servicio GameStats (Go + Scala)
 *
 * Expone métodos para:
 * - GET /api/gamestats/stats (Métricas de runtime y contadores de Go)
 * - GET /api/gamestats/matches (Listado de resúmenes de partidas)
 * - GET /api/gamestats/matches/{id} (Análisis detallado de Scala desempaquetado de AnalysisOutput)
 * - GET /api/gamestats/invalid (Eventos descartados para auditoría)
 * - GET /api/gamestats/health (Salud del servicio de ingesta)
 */

import {
  AnalysisOutput,
  GameStatsServiceStats,
  InvalidEventRecord,
  MatchReport,
  MatchSummary,
  PlayerReport,
} from '../types/contracts';

export class GameStatsError extends Error {
  public status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GameStatsError';
    this.status = status;
  }
}

function normalizePlayerReport(player: Partial<PlayerReport>): PlayerReport {
  return {
    playerId: player.playerId || 'UNKNOWN',
    metrics: player.metrics || {},
    distributions: player.distributions || {},
    crossEventMetrics: player.crossEventMetrics || {},
  };
}

/**
 * Normaliza un MatchReport deserializado de Scala garantizando valores por defecto
 * seguros para campos opcionales o nulos.
 */
export function normalizeMatchReport(raw: Partial<MatchReport>): MatchReport {
  return {
    matchId: raw.matchId || '',
    gameId: raw.gameId || 'unknown',
    gameVersion: raw.gameVersion || '1.0.0',
    status: raw.status || 'UNKNOWN',
    startedAt: raw.startedAt,
    finishedAt: raw.finishedAt,
    eventCount: typeof raw.eventCount === 'number' ? raw.eventCount : 0,
    duplicatesDropped: typeof raw.duplicatesDropped === 'number' ? raw.duplicatesDropped : 0,
    actionCounts: raw.actionCounts || {},
    matchMetrics: raw.matchMetrics || {},
    players: Array.isArray(raw.players) ? raw.players.map(normalizePlayerReport) : [],
    patterns: Array.isArray(raw.patterns) ? raw.patterns : [],
    warnings: Array.isArray(raw.warnings) ? raw.warnings : [],
  };
}

export class GameStatsClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = '/api/gamestats') {
    // Asegurar que no tenga barra final
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!res.ok) {
        let errorDetails = '';
        try {
          const errJson = await res.json();
          errorDetails = errJson.error || errJson.message || JSON.stringify(errJson);
        } catch {
          errorDetails = await res.text().catch(() => res.statusText);
        }
        throw new GameStatsError(`Error en GameStats (${res.status}): ${errorDetails}`, res.status);
      }

      return (await res.json()) as T;
    } catch (err: unknown) {
      if (err instanceof GameStatsError) {
        throw err;
      }
      const msg = err instanceof Error ? err.message : String(err);
      throw new GameStatsError(`Fallo de conexión con GameStats: ${msg}`);
    }
  }

  /**
   * Obtiene las métricas operativas del servicio Go (goroutines, memoria, eventos procesados, llamadas Scala).
   */
  public async getStats(): Promise<GameStatsServiceStats> {
    const data = await this.request<Partial<GameStatsServiceStats>>('/stats');
    return {
      uptime: data.uptime || '0s',
      receivedEvents: data.receivedEvents ?? 0,
      validEvents: data.validEvents ?? 0,
      invalidEvents: data.invalidEvents ?? 0,
      batchesDispatched: data.batchesDispatched ?? 0,
      matchesCompleted: data.matchesCompleted ?? 0,
      activeMatches: data.activeMatches ?? 0,
      scalaCalls: data.scalaCalls ?? 0,
      scalaErrors: data.scalaErrors ?? 0,
      totalMatchesSaved: data.totalMatchesSaved ?? 0,
      runtime: {
        goroutines: data.runtime?.goroutines ?? 0,
        heapAllocBytes: data.runtime?.heapAllocBytes ?? 0,
        heapSysBytes: data.runtime?.heapSysBytes ?? 0,
        numGC: data.runtime?.numGC ?? 0,
      },
    };
  }

  /**
   * Obtiene la lista resumida de todas las partidas procesadas y almacenadas en Go.
   */
  public async getMatches(): Promise<MatchSummary[]> {
    const data = await this.request<MatchSummary[]>('/matches');
    if (!Array.isArray(data)) return [];
    return data.map((m) => ({
      matchId: m.matchId || '',
      gameId: m.gameId || '',
      status: m.status || 'UNKNOWN',
      patterns: Array.isArray(m.patterns) ? m.patterns : [],
      eventCount: m.eventCount ?? 0,
      updatedAt: m.updatedAt || '',
    }));
  }

  /**
   * Obtiene el análisis analítico detallado de Scala para una partida específica.
   *
   * Nota crítica: Go devuelve el payload AnalysisOutput producido por Scala:
   * { schemaVersion: string, matches: [MatchReport], invalidEvents: [...] }
   * Este método desempaqueta de forma segura matches[0] y normaliza sus campos opcionales.
   */
  public async getMatchById(matchId: string): Promise<MatchReport | null> {
    if (!matchId) return null;
    try {
      const data = await this.request<AnalysisOutput | MatchReport | { error: string }>(
        `/matches/${encodeURIComponent(matchId)}`
      );

      if (!data) return null;

      // Caso 1: Estructura canónica de Scala (AnalysisOutput con arreglo matches)
      if ('matches' in data && Array.isArray((data as AnalysisOutput).matches)) {
        const matchesArr = (data as AnalysisOutput).matches;
        if (matchesArr.length === 0) return null;
        return normalizeMatchReport(matchesArr[0]);
      }

      // Caso 2: Objeto MatchReport directo
      if ('matchId' in data && (data as MatchReport).matchId) {
        return normalizeMatchReport(data as Partial<MatchReport>);
      }

      return null;
    } catch (err: unknown) {
      if (err instanceof GameStatsError && err.status === 404) {
        return null;
      }
      throw err;
    }
  }

  /**
   * Consulta los últimos eventos descartados por Go con el motivo exacto de rechazo.
   */
  public async getInvalidEvents(limit: number = 50): Promise<InvalidEventRecord[]> {
    const data = await this.request<InvalidEventRecord[]>(`/invalid?limit=${encodeURIComponent(limit)}`);
    if (!Array.isArray(data)) return [];
    return data.map((rec) => ({
      timestamp: rec.timestamp || '',
      raw: typeof rec.raw === 'string' ? rec.raw : JSON.stringify(rec.raw),
      reason: rec.reason || 'Desconocido',
    }));
  }

  /**
   * Verifica la salud y disponibilidad de GameStats Ingestion (Go).
   */
  public async getHealth(): Promise<{ status: string; uptime?: string; [key: string]: unknown }> {
    return this.request<{ status: string; uptime?: string }>('/health');
  }
}

/** Instancia singleton exportada por defecto */
export const gameStatsClient = new GameStatsClient();
