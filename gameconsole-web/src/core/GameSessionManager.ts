import { GameId, GameSessionInfo, GameSessionStatus } from '../types/contracts';
import { BaseGame, BaseGameOptions, IEventDispatcher } from './BaseGame';

export interface ActiveSession {
  matchId: string;
  gameId: GameId;
  playerId: string;
  player2Id?: string;
  mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO';
  status: GameSessionStatus;
  startedAt: string;
  gameInstance: BaseGame;
  score: number;
}

export interface SessionCreateOptions extends BaseGameOptions {
  player2Id?: string;
}

export type GameFactory = (
  playerId: string,
  dispatcher: IEventDispatcher,
  options?: BaseGameOptions
) => BaseGame;

/**
 * Fallback procedural stub game when concrete games are being loaded or developed
 */
export class StubDemoGame extends BaseGame {
  private timer: number = 0;
  private animationFrameId: number | null = null;
  private isRunning: boolean = false;
  private canvas: HTMLCanvasElement | null = null;

  constructor(gameId: GameId, playerId: string, dispatcher: IEventDispatcher, options?: BaseGameOptions) {
    super(gameId, playerId, dispatcher, options);
  }

  public update(deltaTime: number): void {
    this.timer += deltaTime;
    // Simulación de puntos para telemetría
    if (Math.random() < 0.05) {
      this.currentScore += 10;
    }
  }

  public render(target: HTMLElement | HTMLCanvasElement): void {
    let ctx: CanvasRenderingContext2D | null = null;
    if (target instanceof HTMLCanvasElement) {
      this.canvas = target;
      ctx = target.getContext('2d');
    } else {
      let canvas = target.querySelector('canvas');
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = target.clientWidth || 600;
        canvas.height = target.clientHeight || 400;
        canvas.className = 'w-full h-full block';
        target.appendChild(canvas);
      }
      this.canvas = canvas;
      ctx = canvas.getContext('2d');
    }

    if (!ctx || !this.canvas) return;

    const w = this.canvas.width;
    const h = this.canvas.height;

    // Fondo neo-brutalista
    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(0, 0, w, h);

    // Rejilla arcade
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 30) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Marco neón
    ctx.strokeStyle = this.gameId === 'snake' ? '#10b981' : this.gameId === 'battleship' ? '#06b6d4' : '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, w - 20, h - 20);

    // Texto de información
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 16px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`[GAME ENGINE INITIALIZED: ${this.gameId.toUpperCase()}]`, w / 2, h / 2 - 30);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.fillText(`MATCH ID: ${this.matchId.substring(0, 18)}...`, w / 2, h / 2);
    ctx.fillText(`PLAYER: ${this.playerId} | SCORE: ${this.currentScore}`, w / 2, h / 2 + 25);
    ctx.fillText(`STATUS: ${this.status} | DURATION: ${this.getDurationSeconds()}s`, w / 2, h / 2 + 50);

    // Pulso animado
    const pulse = Math.sin(this.timer * 4) * 5;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 90, 8 + Math.max(0, pulse), 0, Math.PI * 2);
    ctx.fill();
  }

  public destroy(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.status === 'PLAYING') {
      this.finish(this.playerId, this.currentScore, 'GAME_DESTROYED');
    }
  }
}

/**
 * Default fallback dispatcher que envía a consola si el despachador de red aún no está disponible
 */
export const defaultFallbackDispatcher: IEventDispatcher = {
  dispatch: (event) => {
    console.log(`[EventDispatcher:Telemetry] -> [${event.type}:${event.action}]`, event);
    return true;
  }
};

/**
 * Gestor Central de Sesiones para soportar multi-instancia en paralelo sin colisiones
 */
export class GameSessionManager {
  private static instance: GameSessionManager;
  private sessions: Map<string, ActiveSession> = new Map();
  private gameFactories: Map<GameId, GameFactory> = new Map();
  private dispatcher: IEventDispatcher = defaultFallbackDispatcher;
  private listeners: Set<(sessions: ActiveSession[]) => void> = new Set();

  private constructor() {}

  public static getInstance(): GameSessionManager {
    if (!GameSessionManager.instance) {
      GameSessionManager.instance = new GameSessionManager();
    }
    return GameSessionManager.instance;
  }

  /**
   * Configura el despachador de eventos real (ej: Carril D EventDispatcher)
   */
  public setDispatcher(dispatcher: IEventDispatcher): void {
    this.dispatcher = dispatcher;
  }

  public getDispatcher(): IEventDispatcher {
    return this.dispatcher;
  }

  /**
   * Registra la factoría de un juego concreto
   */
  public registerGame(gameId: GameId, factory: GameFactory): void {
    this.gameFactories.set(gameId, factory);
  }

  /**
   * Suscribe a los cambios en la lista de sesiones activas (para React)
   */
  public subscribe(listener: (sessions: ActiveSession[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.getAllSessions());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const list = this.getAllSessions();
    this.listeners.forEach((listener) => listener(list));
  }

  /**
   * Crea e inicia una nueva sesión de juego independiente
   */
  public createSession(
    gameId: GameId,
    playerId: string,
    mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO' = 'SOLO',
    options?: SessionCreateOptions
  ): ActiveSession {
    const factory = this.gameFactories.get(gameId);
    const resolvedP2 =
      mode === 'TWO_PLAYERS_LOCAL'
        ? (options?.player2Id?.trim() || options?.additionalPlayers?.[0] || 'Player2')
        : options?.player2Id;

    const mergedAdditionalPlayers =
      mode === 'TWO_PLAYERS_LOCAL'
        ? Array.from(new Set([resolvedP2!, ...(options?.additionalPlayers || [])]))
        : options?.additionalPlayers;

    const gameOptions: BaseGameOptions = {
      ...options,
      gameMode: mode,
      ...(mergedAdditionalPlayers ? { additionalPlayers: mergedAdditionalPlayers } : {}),
    };

    let gameInstance: BaseGame;

    if (factory) {
      gameInstance = factory(playerId, this.dispatcher, gameOptions);
    } else {
      // Usar stub procedural mientras se monta el juego concreto
      gameInstance = new StubDemoGame(gameId, playerId, this.dispatcher, gameOptions);
    }

    const session: ActiveSession = {
      matchId: gameInstance.matchId,
      gameId,
      playerId,
      ...(resolvedP2 ? { player2Id: resolvedP2 } : {}),
      mode,
      status: 'INITIALIZING',
      startedAt: new Date().toISOString(),
      gameInstance,
      score: 0
    };

    this.sessions.set(session.matchId, session);

    // Iniciar el juego
    gameInstance.start();
    session.status = gameInstance.getStatus();

    this.notify();
    return session;
  }

  public getSession(matchId: string): ActiveSession | undefined {
    return this.sessions.get(matchId);
  }

  public getAllSessions(): ActiveSession[] {
    return Array.from(this.sessions.values());
  }

  public getActiveSessions(): ActiveSession[] {
    return this.getAllSessions().filter(
      (s) => s.status === 'PLAYING' || s.status === 'PAUSED' || s.status === 'INITIALIZING'
    );
  }

  public pauseSession(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (session && session.status === 'PLAYING') {
      session.gameInstance.pause();
      session.status = session.gameInstance.getStatus();
      this.notify();
    }
  }

  public resumeSession(matchId: string): void {
    const session = this.sessions.get(matchId);
    if (session && session.status === 'PAUSED') {
      session.gameInstance.resume();
      session.status = session.gameInstance.getStatus();
      this.notify();
    }
  }

  public terminateSession(matchId: string, reason: string = 'USER_CLOSED'): void {
    const session = this.sessions.get(matchId);
    if (session) {
      session.gameInstance.finish(session.playerId, session.score, reason);
      session.gameInstance.destroy();
      session.status = 'FINISHED';
      this.sessions.delete(matchId);
      this.notify();
    }
  }

  public terminateAll(): void {
    for (const [matchId] of this.sessions) {
      this.terminateSession(matchId, 'CONSOLE_SHUTDOWN');
    }
  }

  // --- Helpers de URL para ventanas / pestañas independientes ---

  /**
   * Extrae los search params para saber si la ventana actual es una pestaña standalone
   * Ej: ?tab=play&game=snake&matchId=...&mode=SOLO&player=Player1
   */
  public static parseUrlParams(): {
    isStandalonePlay: boolean;
    tab?: string;
    game?: GameId;
    matchId?: string;
    mode?: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO';
    player?: string;
    player2?: string;
  } {
    if (typeof window === 'undefined') {
      return { isStandalonePlay: false };
    }

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || undefined;
    const game = (params.get('game') as GameId) || undefined;
    const matchId = params.get('matchId') || undefined;
    const mode = (params.get('mode') as 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO') || undefined;
    const player = params.get('player') || undefined;
    const player2 = params.get('player2') || undefined;

    const isStandalonePlay = tab === 'play' && !!game;

    return {
      isStandalonePlay,
      tab,
      game,
      matchId,
      mode,
      player,
      player2
    };
  }

  /**
   * Genera el URL completo para abrir una sesión en una pestaña independiente
   */
  public static getStandaloneUrl(
    gameId: GameId,
    matchId?: string,
    mode: string = 'SOLO',
    player: string = 'Player1',
    player2?: string
  ): string {
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const params = new URLSearchParams({
      tab: 'play',
      game: gameId,
      mode,
      player,
      ...(player2 ? { player2 } : {}),
      ...(matchId ? { matchId } : {})
    });
    return `${currentOrigin}/?${params.toString()}`;
  }

  /**
   * Abre la partida en una nueva pestaña
   */
  public static openInNewTab(
    gameId: GameId,
    matchId?: string,
    mode: string = 'SOLO',
    player: string = 'Player1',
    player2?: string
  ): Window | null {
    const url = GameSessionManager.getStandaloneUrl(gameId, matchId, mode, player, player2);
    return window.open(url, '_blank');
  }
}
