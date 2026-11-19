/**
 * GameConsole - Contratos e Interfaces Compartidas Congeladas
 * Alineado al 100% con GameStats (Go + Scala) y el microservicio de Prolog.
 */

// ==========================================
// 1. GAMESTATS ENVELOPE (Go Ingestion Contract)
// Validado estrictamente por Go con DisallowUnknownFields
// ==========================================

export type GameId = 'snake' | 'battleship' | 'head_football' | (string & {});
export type EventCategory = 'LIFECYCLE' | 'INPUT' | 'ACTION' | 'INTERACTION';

export interface GameStatsEventEnvelope<T = Record<string, unknown>> {
  /** UUID v4 válido */
  eventId: string;
  /** ISO-8601 / RFC 3339 en UTC (ej: 2026-11-17T19:30:00.000Z) */
  timestamp: string;
  /** Identificador del juego (ej: snake, battleship, head_football) */
  gameId: GameId;
  /** Versión del juego (ej: 1.0.0) */
  gameVersion: string;
  /** Identificador único de la partida (UUID v4) */
  matchId: string;
  /** ID del jugador que emite el evento, o 'SYSTEM' para eventos de ciclo de vida */
  playerId: string;
  /** Categoría general del evento */
  type: EventCategory;
  /** Acción concreta del evento (ej: MATCH_STARTED, FIRE_SHOT, KICK, etc.) */
  action: string;
  /** Contenido específico de la acción. Debe ser un objeto JSON (puede ser {}) */
  data: T;
}

// ==========================================
// 2. LIFECYCLE PAYLOADS (Universales)
// Emitidos por playerId: 'SYSTEM' (excepto PLAYER_JOINED por el jugador)
// ==========================================

export interface PlayerJoinedPayload {
  displayName: string;
}

export interface MatchStartedPayload {
  players: string[];
  gameMode?: string;
  configuration?: Record<string, unknown>;
}

export interface MatchFinishedPayload {
  winnerId?: string;
  finalScore?: number;
  durationSeconds?: number;
  reason?: string;
}

export interface PlayerLeftPayload {
  reason?: string;
}

// ==========================================
// 3. PAYLOADS ESPECÍFICOS POR JUEGO (Scala Analyzers)
// ==========================================

// --- SNAKE ---
export interface SnakeChangeDirectionPayload {
  from: string; // ej: "RIGHT"
  to: string;   // ej: "UP"
}

export interface SnakeEatFoodPayload {
  foodType: string; // ej: "APPLE"
  points: number;   // ej: 10
  currentLength?: number;
  coords?: { x: number; y: number };
}

export interface SnakeCollisionPayload {
  collisionWith?: 'WALL' | 'SELF' | (string & {});
  finalScore?: number;
}

// --- BATTLESHIP ---
export interface BattleshipCoord {
  row: string; // "A" - "J"
  col: number; // 1 - 10
}

export interface BattleshipFireShotPayload {
  coord: BattleshipCoord;
  turn: number;
  result: 'HIT' | 'MISS';
  /** Nombre del barco hundido con este disparo o null si no hundió barco */
  shipSunk: string | null;
}

export interface BattleshipAiDecisionPayload {
  turn: number;
  mode: 'HUNT' | 'TARGET';
  coord: BattleshipCoord;
  heuristic: string;
}

// --- HEAD FOOTBALL ---
export interface HeadFootballKickPayload {
  shotType: 'GROUND' | 'LOB' | 'HEADER' | (string & {});
  ballSpeed?: number;
  power?: number;
}

export interface HeadFootballGoalPayload {
  scorerId: string;
  minute?: number;
  currentScore?: Record<string, number>;
}

// ==========================================
// 4. MICROSERVICIO PROLOG (Battleship IA Contract)
// Endpoint: POST /api/ai/battleship/next-move
// ==========================================

export interface PrologShotHistoryItem {
  row: number; // 0-9
  col: number; // 0-9
  result: 'HIT' | 'MISS';
  shipSunk: string | null;
}

export interface PrologMoveRequest {
  matchId: string;
  difficulty?: 'easy' | 'tactical' | 'hard';
  boardDimensions?: { rows: number; cols: number };
  shotsHistory: PrologShotHistoryItem[];
  remainingShipsLengths: number[];
}

export interface PrologMoveResponse {
  decision: { row: number; col: number }; // 0-9
  mode: 'HUNT' | 'TARGET';
  heuristic: string;
  inferenceTimeMs: number;
}

export interface PrologHealthResponse {
  status: 'ok' | 'error';
  service: string;
  prologEngine: string;
}

// ==========================================
// 5. GAMESTATS RESPONSES (Go & Scala Endpoints)
// GET /stats, GET /matches, GET /matches/{id}, GET /invalid
// ==========================================

export interface RuntimeStats {
  goroutines: number;
  heapAllocBytes: number;
  heapSysBytes: number;
  numGC: number;
}

export interface GameStatsServiceStats {
  uptime: string;
  receivedEvents: number;
  validEvents: number;
  invalidEvents: number;
  batchesDispatched: number;
  matchesCompleted: number;
  activeMatches: number;
  scalaCalls: number;
  scalaErrors: number;
  totalMatchesSaved: number;
  runtime: RuntimeStats;
}

export interface MatchSummary {
  matchId: string;
  gameId: string;
  status: 'FINISHED' | 'IN_PROGRESS' | 'UNKNOWN';
  patterns: string[];
  eventCount: number;
  updatedAt: string;
}

export interface InvalidEventRecord {
  timestamp: string;
  raw: string;
  reason: string;
}

export interface MetricsMap {
  [metricName: string]: number;
}

export interface PlayerReport {
  playerId: string;
  metrics: MetricsMap;
  distributions: Record<string, Record<string, number>>;
  crossEventMetrics: MetricsMap;
}

export interface PatternDetection {
  pattern: 'DEADLY_STREAK' | 'COMEBACK' | (string & {});
  playerId: string;
  startedAt: string;
  endedAt: string;
  eventIds: string[];
  description: string;
  details: MetricsMap;
}

export interface MatchReport {
  matchId: string;
  gameId: string;
  gameVersion: string;
  status: 'FINISHED' | 'IN_PROGRESS' | 'UNKNOWN';
  startedAt?: string;
  finishedAt?: string;
  eventCount: number;
  duplicatesDropped: number;
  actionCounts: Record<string, number>;
  matchMetrics: MetricsMap;
  players: PlayerReport[];
  patterns: PatternDetection[];
  warnings: string[];
}

export interface AnalysisOutput {
  schemaVersion: string;
  matches: MatchReport[];
  invalidEvents: Array<{ source: string; reason: string }>;
}

// ==========================================
// 6. GESTIÓN INTERNA DE SESIONES DE CONSOLA
// ==========================================

export type GameSessionStatus = 'INITIALIZING' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'ABORTED';

export interface GameSessionInfo {
  sessionId: string; // matchId
  gameId: GameId;
  playerId: string;
  mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO';
  status: GameSessionStatus;
  startedAt: string;
  finishedAt?: string;
  score?: number;
}
