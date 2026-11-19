/**
 * EventDispatcher.ts - Despachador asíncrono no bloqueante de eventos GameStats
 *
 * Características clave:
 * 1. Cola FIFO asíncrona no bloqueante.
 * 2. Serialización estricta de los 9 campos del sobre canónico (Go DisallowUnknownFields).
 * 3. Procesamiento por lotes (batching) con intervalo y tamaño máximo.
 * 4. Reintentos con backoff exponencial sin duplicar eventos ni alterar el orden cronológico.
 * 5. Vaciado confiable en cierre de pestaña mediante window 'pagehide' con fetch keepalive: true.
 */

import { GameStatsEventEnvelope } from '../types/contracts';

export interface IEventDispatcher {
  /** Encola un evento para despacho asíncrono */
  dispatch<T = Record<string, unknown>>(event: GameStatsEventEnvelope<T>): void;
  /** Fuerza el vaciado inmediato de la cola pendiente */
  flush(): Promise<void>;
  /** Retorna la cantidad de eventos en cola pendientes */
  getPendingCount(): number;
  /** Suscribe un callback a cambios de estado del despachador */
  subscribe(callback: (status: DispatcherStatus) => void): () => void;
}

export interface DispatcherStatus {
  pendingCount: number;
  isSending: boolean;
  totalSent: number;
  totalFailed: number;
  consecutiveErrors: number;
  lastError: string | null;
  lastSuccessTimestamp: string | null;
}

export interface EventDispatcherOptions {
  endpoint?: string;
  maxBatchSize?: number;
  flushIntervalMs?: number;
  baseRetryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxQueueSize?: number;
}

/**
 * Filtra estrictamente el sobre a los 9 campos reconocidos por el JSON Schema de Go
 * evitando que propiedades auxiliares de frontend causen error en Go DisallowUnknownFields.
 */
export function sanitizeEnvelope<T>(env: GameStatsEventEnvelope<T>): GameStatsEventEnvelope<T> {
  return {
    eventId: String(env.eventId),
    timestamp: String(env.timestamp),
    gameId: env.gameId,
    gameVersion: String(env.gameVersion),
    matchId: String(env.matchId),
    playerId: String(env.playerId),
    type: env.type,
    action: String(env.action),
    data: (env.data && typeof env.data === 'object' && !Array.isArray(env.data) ? env.data : {}) as T,
  };
}

export class EventDispatcher implements IEventDispatcher {
  private queue: GameStatsEventEnvelope[] = [];
  private inFlightBatch: GameStatsEventEnvelope[] | null = null;
  private isProcessing = false;
  private timerId: ReturnType<typeof setTimeout> | null = null;

  private consecutiveErrors = 0;
  private totalSent = 0;
  private totalFailed = 0;
  private lastError: string | null = null;
  private lastSuccessTimestamp: string | null = null;

  private listeners: Set<(status: DispatcherStatus) => void> = new Set();

  private readonly endpoint: string;
  private readonly maxBatchSize: number;
  private readonly flushIntervalMs: number;
  private readonly baseRetryDelayMs: number;
  private readonly maxRetryDelayMs: number;
  private readonly maxQueueSize: number;

  constructor(options: EventDispatcherOptions = {}) {
    this.endpoint = options.endpoint || '/api/gamestats/events';
    this.maxBatchSize = options.maxBatchSize || 25;
    this.flushIntervalMs = options.flushIntervalMs || 1000;
    this.baseRetryDelayMs = options.baseRetryDelayMs || 1000;
    this.maxRetryDelayMs = options.maxRetryDelayMs || 30000;
    this.maxQueueSize = options.maxQueueSize || 5000;

    this.setupPageLifecycleHandlers();
    this.scheduleNextFlush(this.flushIntervalMs);
  }

  /**
   * Encola un evento de telemetría de manera no bloqueante.
   */
  public dispatch<T = Record<string, unknown>>(event: GameStatsEventEnvelope<T>): void {
    // Si la cola supera el límite máximo por desconexión prolongada, descartamos los más viejos
    // para preservar memoria, aunque en condiciones normales nunca se alcanza.
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`[EventDispatcher] Cola llena (${this.queue.length}). Descartando evento más antiguo.`);
      this.queue.shift();
    }

    const clean = sanitizeEnvelope(event);
    this.queue.push(clean as GameStatsEventEnvelope);
    this.notifyStatus();

    // Si alcanzamos el tamaño de lote deseado, intentamos despachar rápido
    if (this.queue.length >= this.maxBatchSize && !this.isProcessing) {
      this.scheduleNextFlush(0);
    }
  }

  /**
   * Retorna el número de eventos pendientes en cola (incluye lote en vuelo si lo hay).
   */
  public getPendingCount(): number {
    return this.queue.length + (this.inFlightBatch ? this.inFlightBatch.length : 0);
  }

  /**
   * Suscribe a cambios de métricas y estado del despachador.
   */
  public subscribe(callback: (status: DispatcherStatus) => void): () => void {
    this.listeners.add(callback);
    callback(this.getStatus());
    return () => {
      this.listeners.delete(callback);
    };
  }

  public getStatus(): DispatcherStatus {
    return {
      pendingCount: this.getPendingCount(),
      isSending: this.isProcessing,
      totalSent: this.totalSent,
      totalFailed: this.totalFailed,
      consecutiveErrors: this.consecutiveErrors,
      lastError: this.lastError,
      lastSuccessTimestamp: this.lastSuccessTimestamp,
    };
  }

  private notifyStatus(): void {
    if (this.listeners.size === 0) return;
    const status = this.getStatus();
    this.listeners.forEach((cb) => {
      try {
        cb(status);
      } catch (err) {
        console.error('[EventDispatcher] Error en listener de estado:', err);
      }
    });
  }

  /**
   * Programa la siguiente ejecución del bucle de vaciado.
   */
  private scheduleNextFlush(delayMs: number): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    this.timerId = setTimeout(() => {
      this.timerId = null;
      void this.processQueue();
    }, delayMs);
  }

  /**
   * Procesa la cola de eventos respetando el orden FIFO y backoff exponencial.
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing) return;
    if (this.queue.length === 0) {
      this.scheduleNextFlush(this.flushIntervalMs);
      return;
    }

    this.isProcessing = true;
    this.notifyStatus();

    // Extraemos el lote del frente de la cola (FIFO)
    const batch = this.queue.splice(0, this.maxBatchSize);
    this.inFlightBatch = batch;

    let success = false;
    try {
      success = await this.sendBatch(batch);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = errorMsg;
      success = false;
    }

    if (success) {
      this.totalSent += batch.length;
      this.consecutiveErrors = 0;
      this.lastError = null;
      this.lastSuccessTimestamp = new Date().toISOString();
      this.inFlightBatch = null;
      this.isProcessing = false;
      this.notifyStatus();

      // Si aún hay elementos en cola, despachar el siguiente lote de inmediato
      if (this.queue.length > 0) {
        this.scheduleNextFlush(0);
      } else {
        this.scheduleNextFlush(this.flushIntervalMs);
      }
    } else {
      // En caso de fallo, reinsertamos el lote AL INICIO de la cola (sin invertir el orden interno)
      // para garantizar que ningún evento se pierda ni se altere el orden cronológico.
      this.queue.unshift(...batch);
      this.inFlightBatch = null;
      this.consecutiveErrors++;
      this.totalFailed += batch.length;
      this.isProcessing = false;
      this.notifyStatus();

      // Cálculo de backoff exponencial: base * 2^(errores - 1) con jitter aleatorio
      const exponential = this.baseRetryDelayMs * Math.pow(2, Math.min(this.consecutiveErrors - 1, 6));
      const jitter = Math.floor(Math.random() * 200);
      const delay = Math.min(exponential + jitter, this.maxRetryDelayMs);

      console.warn(
        `[EventDispatcher] Fallo al enviar lote de ${batch.length} eventos (intento ${this.consecutiveErrors}). Reintentando en ${delay}ms...`
      );
      this.scheduleNextFlush(delay);
    }
  }

  /**
   * Envía un lote JSON array [...] mediante fetch HTTP.
   */
  private async sendBatch(batch: GameStatsEventEnvelope[]): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
      });

      if (res.status === 202 || res.status === 200) {
        return true;
      }

      const responseText = await res.text().catch(() => '');
      this.lastError = `HTTP ${res.status}: ${responseText || res.statusText}`;
      return false;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.lastError = `NetworkError: ${errorMsg}`;
      return false;
    }
  }

  /**
   * Fuerza el vaciado completo de la cola actual de manera asíncrona.
   */
  public async flush(): Promise<void> {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }

    while (this.queue.length > 0) {
      await this.processQueue();
      if (this.consecutiveErrors > 0) {
        // Si hay error de red, no hacemos bucle infinito en flush
        break;
      }
    }
  }

  /**
   * Configura los manejadores del ciclo de vida de la ventana / pestaña (pagehide, beforeunload)
   * utilizando fetch con keepalive: true para asegurar la entrega de eventos pendientes.
   */
  private setupPageLifecycleHandlers(): void {
    if (typeof window === 'undefined') return;

    const handleExit = () => {
      // Reclamamos todos los eventos pendientes
      const remaining: GameStatsEventEnvelope[] = [];
      if (this.inFlightBatch && this.inFlightBatch.length > 0) {
        remaining.push(...this.inFlightBatch);
        this.inFlightBatch = null;
      }
      if (this.queue.length > 0) {
        remaining.push(...this.queue);
        this.queue = [];
      }

      if (remaining.length === 0) return;

      try {
        const payload = JSON.stringify(remaining);
        // keepalive: true permite que la petición sobreviva al cierre del documento
        void fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: payload,
          keepalive: true,
        });
      } catch (e) {
        console.error('[EventDispatcher] Error en vaciado de emergencia pagehide:', e);
      }
    };

    window.addEventListener('pagehide', handleExit);
    window.addEventListener('beforeunload', handleExit);
  }

  /**
   * Limpia temporizadores y referencias si el despachador es destruido.
   */
  public destroy(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.listeners.clear();
  }
}

/** Instancia singleton global compartida */
export const eventDispatcher = new EventDispatcher();
