import { useEffect, useState } from 'react';
import { gameStatsClient } from './GameStatsClient';
import { prologClient } from './PrologClient';

export type ServiceState = 'checking' | 'online' | 'offline';

export interface ServiceHealth {
  /** GET /api/gamestats/health (ingestión Go) */
  go: ServiceState;
  /** GET /api/ai/health (FastAPI + SWI-Prolog) */
  prolog: ServiceState;
  prologEngine: string | null;
}

/**
 * Consulta periódicamente la salud real de Go y de Prolog.
 * Se pausa mientras la pestaña está oculta y evita solapar consultas.
 */
export function useServiceHealth(intervalMs: number = 5000): ServiceHealth {
  const [health, setHealth] = useState<ServiceHealth>({
    go: 'checking',
    prolog: 'checking',
    prologEngine: null,
  });

  useEffect(() => {
    let cancelled = false;
    let inFlight = false;

    const check = async () => {
      if (inFlight || (typeof document !== 'undefined' && document.hidden)) return;
      inFlight = true;
      const [go, prolog] = await Promise.allSettled([
        gameStatsClient.getHealth(),
        prologClient.getHealth(),
      ]);
      inFlight = false;
      if (cancelled) return;

      setHealth({
        go: go.status === 'fulfilled' && go.value.status === 'ok' ? 'online' : 'offline',
        prolog: prolog.status === 'fulfilled' && prolog.value.status === 'ok' ? 'online' : 'offline',
        prologEngine: prolog.status === 'fulfilled' && prolog.value.status === 'ok' ? prolog.value.prologEngine : null,
      });
    };

    void check();
    const timer = setInterval(() => void check(), intervalMs);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [intervalMs]);

  return health;
}
