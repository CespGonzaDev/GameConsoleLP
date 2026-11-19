import {
  GameId,
  EventCategory,
  GameStatsEventEnvelope,
  PlayerJoinedPayload,
  MatchStartedPayload,
  MatchFinishedPayload,
  GameSessionStatus
} from '../types/contracts';

export interface IEventDispatcher {
  dispatch<T = Record<string, unknown>>(event: GameStatsEventEnvelope<T>): Promise<boolean> | boolean | void;
}

export interface BaseGameOptions {
  gameVersion?: string;
  additionalPlayers?: string[];
  gameMode?: string;
  configuration?: Record<string, unknown>;
  existingMatchId?: string;
}

/**
 * Clase base abstracta para todos los juegos de la consola.
 * Gestiona el ciclo de vida, la asignación de matchId y la telemetría Go/Scala.
 */
export abstract class BaseGame {
  public readonly matchId: string;
  public readonly gameId: GameId;
  public readonly playerId: string;
  public readonly players: string[];
  public readonly gameVersion: string;
  public readonly gameMode: string;
  public readonly configuration: Record<string, unknown>;

  protected dispatcher: IEventDispatcher;
  protected status: GameSessionStatus = 'INITIALIZING';
  protected startTime: number = 0;
  protected finishTime: number = 0;
  protected currentScore: number = 0;

  constructor(
    gameId: GameId,
    playerId: string,
    dispatcher: IEventDispatcher,
    options: BaseGameOptions = {}
  ) {
    this.gameId = gameId;
    this.playerId = playerId || 'Player1';
    this.dispatcher = dispatcher;
    this.gameVersion = options.gameVersion || '1.0.0';
    this.gameMode = options.gameMode || 'SOLO';
    this.configuration = options.configuration || {};
    
    // Si se pasa un matchId existente (por ejemplo, al compartir URL), se reutiliza; de lo contrario, se genera UUID v4
    this.matchId = options.existingMatchId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : this.generateUUIDFallback());

    this.players = [this.playerId, ...(options.additionalPlayers || [])];
  }

  /**
   * Generador de UUID v4 de respaldo para entornos donde crypto.randomUUID no esté disponible
   */
  private generateUUIDFallback(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Inicia la partida emitiendo PLAYER_JOINED por cada jugador y MATCH_STARTED con playerId 'SYSTEM'.
   */
  public start(): void {
    if (this.status === 'PLAYING') return;

    this.startTime = Date.now();
    this.status = 'PLAYING';

    // 1. Emitir PLAYER_JOINED por cada jugador participante
    for (const pId of this.players) {
      this.emit<PlayerJoinedPayload>(
        'LIFECYCLE',
        'PLAYER_JOINED',
        { displayName: pId },
        pId
      );
    }

    // 2. Emitir MATCH_STARTED por parte de SYSTEM
    this.emit<MatchStartedPayload>(
      'LIFECYCLE',
      'MATCH_STARTED',
      {
        players: this.players,
        gameMode: this.gameMode,
        configuration: this.configuration
      },
      'SYSTEM'
    );

    this.onStart();
  }

  /**
   * Finaliza la partida emitiendo MATCH_FINISHED con playerId 'SYSTEM'.
   */
  public finish(winnerId?: string, finalScore?: number, reason: string = 'NORMAL_END'): void {
    if (this.status === 'FINISHED' || this.status === 'ABORTED') return;

    this.finishTime = Date.now();
    this.status = 'FINISHED';
    if (typeof finalScore === 'number') {
      this.currentScore = finalScore;
    }

    const durationSeconds = this.startTime > 0 
      ? Math.round((this.finishTime - this.startTime) / 1000)
      : 0;

    const payload: MatchFinishedPayload = {
      winnerId: winnerId || this.playerId,
      finalScore: this.currentScore,
      durationSeconds,
      reason
    };

    this.emit<MatchFinishedPayload>(
      'LIFECYCLE',
      'MATCH_FINISHED',
      payload,
      'SYSTEM'
    );

    this.onFinish(winnerId, finalScore, reason);
  }

  /**
   * Pausa o reanuda la partida localmente
   */
  public pause(): void {
    if (this.status === 'PLAYING') {
      this.status = 'PAUSED';
      this.onPause();
    }
  }

  public resume(): void {
    if (this.status === 'PAUSED') {
      this.status = 'PLAYING';
      this.onResume();
    }
  }

  /**
   * Aborta la sesión si se cierra abruptamente
   */
  public abort(reason: string = 'USER_ABORT'): void {
    if (this.status === 'FINISHED' || this.status === 'ABORTED') return;
    this.status = 'ABORTED';
    this.finish(undefined, this.currentScore, reason);
  }

  /**
   * Envía un evento con estructura válida para el ingestor Go de GameStats.
   */
  public emit<T = Record<string, unknown>>(
    type: EventCategory,
    action: string,
    data: T,
    customPlayerId?: string
  ): void {
    const envelope: GameStatsEventEnvelope<T> = {
      eventId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : this.generateUUIDFallback(),
      timestamp: new Date().toISOString(),
      gameId: this.gameId,
      gameVersion: this.gameVersion,
      matchId: this.matchId,
      playerId: customPlayerId || this.playerId,
      type,
      action,
      data: (data && typeof data === 'object') ? data : ({} as T)
    };

    try {
      this.dispatcher.dispatch(envelope);
    } catch (err) {
      console.error(`[BaseGame] Error al despachar evento ${action}:`, err);
    }
  }

  // --- Getters ---
  public getStatus(): GameSessionStatus {
    return this.status;
  }

  public getScore(): number {
    return this.currentScore;
  }

  public getDurationSeconds(): number {
    if (this.startTime === 0) return 0;
    const end = this.finishTime > 0 ? this.finishTime : Date.now();
    return Math.round((end - this.startTime) / 1000);
  }

  // --- Ciclo de vida y Renderizado abstracto ---
  public abstract update(deltaTime: number): void;
  public abstract render(target: HTMLElement | HTMLCanvasElement): void;
  public abstract destroy(): void;

  // Hooks opcionales
  protected onStart(): void {}
  protected onFinish(winnerId?: string, finalScore?: number, reason?: string): void {}
  protected onPause(): void {}
  protected onResume(): void {}
}
