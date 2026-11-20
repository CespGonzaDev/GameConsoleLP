import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  GameStatsServiceStats,
  InvalidEventRecord,
  MatchReport,
  MatchSummary,
} from '../../types/contracts';
import { gameStatsClient } from '../../services/GameStatsClient';
import { eventDispatcher, DispatcherStatus } from '../../services/EventDispatcher';
import { useServiceHealth, ServiceState } from '../../services/useServiceHealth';
import { MetricsCards } from './MetricsCards';
import { PatternsList, EnrichedPatternItem } from './PatternsList';
import { InvalidEventsViewer } from './InvalidEventsViewer';
import { MatchDetailModal } from './MatchDetailModal';
import { PixelIcon } from '../pixel/PixelIcon';

type DashboardTab = 'OVERVIEW' | 'MATCHES' | 'PATTERNS' | 'INVALID';

/**
 * Mini 14x14 crisp-edges pixel medal for inline High-Score Table pattern badges.
 */
const MiniPixelMedal: React.FC<{ kind: 'DEADLY_STREAK' | 'COMEBACK' | 'OTHER' }> = ({ kind }) => {
  if (kind === 'DEADLY_STREAK') {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        <rect x="5" y="1" width="6" height="3" fill="#f43f5e" />
        <rect x="3" y="4" width="10" height="8" fill="#e11d48" />
        <rect x="5" y="12" width="6" height="2" fill="#9f1239" />
        <rect x="6" y="6" width="4" height="4" fill="#fde047" />
      </svg>
    );
  }
  if (kind === 'COMEBACK') {
    return (
      <svg
        width={14}
        height={14}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        <rect x="5" y="1" width="6" height="3" fill="#06b6d4" />
        <rect x="3" y="4" width="10" height="8" fill="#f59e0b" />
        <rect x="5" y="12" width="6" height="2" fill="#b45309" />
        <rect x="6" y="6" width="4" height="4" fill="#fde047" />
      </svg>
    );
  }
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixelated shrink-0"
      aria-hidden="true"
    >
      <rect x="5" y="1" width="6" height="3" fill="#0e7490" />
      <rect x="3" y="4" width="10" height="8" fill="#06b6d4" />
      <rect x="5" y="12" width="6" height="2" fill="#155e75" />
      <rect x="6" y="6" width="4" height="4" fill="#cffafe" />
    </svg>
  );
};

const errMsg = (reason: unknown): string =>
  reason instanceof Error ? reason.message : String(reason);

/** Pastilla de estado de un servicio (Go / Prolog) */
const HealthPill: React.FC<{ label: string; state: ServiceState; detail?: string | null }> = ({
  label,
  state,
  detail,
}) => {
  const color =
    state === 'online'
      ? 'text-arcade-accent border-emerald-700'
      : state === 'offline'
      ? 'text-arcade-rose border-rose-700'
      : 'text-arcade-cyan border-cyan-700';
  const text = state === 'online' ? 'OK' : state === 'offline' ? 'DOWN' : '...';
  return (
    <div
      className={`flex items-center space-x-1.5 px-2.5 py-1.5 bg-arcade-bg border-2 ${color}`}
      title={detail ? `${label}: ${detail}` : label}
    >
      <span
        className={`inline-block w-2 h-2 ${
          state === 'online' ? 'bg-emerald-400' : state === 'offline' ? 'bg-rose-500' : 'bg-cyan-400 animate-pulse'
        }`}
      />
      <span className="font-arcade text-[10px]">
        {label} {text}
      </span>
    </div>
  );
};

export const GameStatsDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('OVERVIEW');
  const health = useServiceHealth(5000);

  // Errores visibles (los datos previos se conservan cuando una consulta falla)
  const [fetchErrors, setFetchErrors] = useState<string[]>([]);
  const [detailError, setDetailError] = useState<string | null>(null);
  const inFlightRef = useRef(false);

  // Reportes de Scala por partida, para la pestaña PATTERNS
  const [patternReports, setPatternReports] = useState<Record<string, MatchReport>>({});
  const requestedReports = useRef<Set<string>>(new Set());

  // Datos del backend
  const [stats, setStats] = useState<GameStatsServiceStats | null>(null);
  const [matches, setMatches] = useState<MatchSummary[]>([]);
  const [invalidEvents, setInvalidEvents] = useState<InvalidEventRecord[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchReport | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados de control y red
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean | null>(null);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(5000); // 5s por defecto
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  // Estado del EventDispatcher local (telemetría de cliente)
  const [dispatcherStatus, setDispatcherStatus] = useState<DispatcherStatus>(
    eventDispatcher.getStatus()
  );

  // Filtros de partidas
  const [gameFilter, setGameFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [patternFilter, setPatternFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Suscripción a eventos del despachador
  useEffect(() => {
    const unsubscribe = eventDispatcher.subscribe((newStatus) => {
      setDispatcherStatus(newStatus);
    });
    return unsubscribe;
  }, []);

  // Carga de datos centralizada
  // Un fallo de red NO borra los datos ya mostrados: se conservan y se avisa con un banner.
  const fetchData = useCallback(async () => {
    if (inFlightRef.current) return; // evita consultas solapadas
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const [statsRes, matchesRes, invalidRes] = await Promise.allSettled([
        gameStatsClient.getStats(),
        gameStatsClient.getMatches(),
        gameStatsClient.getInvalidEvents(100),
      ]);

      const errors: string[] = [];
      if (statsRes.status === 'fulfilled') {
        setStats(statsRes.value);
        setIsOnline(true);
      } else {
        setIsOnline(false);
        errors.push(`GameStats no responde (/stats): ${errMsg(statsRes.reason)}`);
      }
      if (matchesRes.status === 'fulfilled') {
        setMatches(matchesRes.value);
      } else if (statsRes.status === 'fulfilled') {
        errors.push(`Fallo al listar partidas (/matches): ${errMsg(matchesRes.reason)}`);
      }
      if (invalidRes.status === 'fulfilled') {
        setInvalidEvents(invalidRes.value);
      } else if (statsRes.status === 'fulfilled') {
        errors.push(`Fallo al leer eventos inválidos (/invalid): ${errMsg(invalidRes.reason)}`);
      }

      setFetchErrors(errors);
      if (statsRes.status === 'fulfilled' || matchesRes.status === 'fulfilled') {
        setLastRefreshedAt(new Date());
      }
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, []);

  // Intervalo de auto-refresco (se pausa con la pestaña oculta y se refresca al volver)
  useEffect(() => {
    void fetchData();
    const onVisible = () => {
      if (!document.hidden) void fetchData();
    };
    document.addEventListener('visibilitychange', onVisible);

    let interval: ReturnType<typeof setInterval> | undefined;
    if (autoRefreshInterval > 0) {
      interval = setInterval(() => {
        if (!document.hidden) void fetchData();
      }, autoRefreshInterval);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (interval) clearInterval(interval);
    };
  }, [fetchData, autoRefreshInterval]);

  // Carga (una vez por partida/actualización) del reporte de Scala de las partidas con patrones
  useEffect(() => {
    const pending = matches
      .filter((m) => m.patterns.length > 0 && !requestedReports.current.has(`${m.matchId}@${m.updatedAt}`))
      .slice(0, 20);
    pending.forEach((m) => {
      const key = `${m.matchId}@${m.updatedAt}`;
      requestedReports.current.add(key);
      gameStatsClient
        .getMatchById(m.matchId)
        .then((report) => {
          if (report) setPatternReports((prev) => ({ ...prev, [m.matchId]: report }));
        })
        .catch(() => requestedReports.current.delete(key)); // error de red: reintentar luego
    });
  }, [matches]);

  // Selección e inspección profunda de partida (reporte completo calculado por Scala)
  const handleSelectMatch = async (matchId: string) => {
    setDetailError(null);
    try {
      setIsLoading(true);
      const detail = await gameStatsClient.getMatchById(matchId);
      if (detail) {
        setSelectedMatch(detail);
        setIsModalOpen(true);
      } else {
        setDetailError(
          `El reporte de Scala para ${matchId} aún no está disponible (partida en curso o análisis en cola). Inténtalo de nuevo en unos segundos.`
        );
      }
    } catch (err) {
      setDetailError(`No se pudo cargar el detalle de ${matchId}: ${errMsg(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Filtrado reactivo de partidas
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      const matchesGame =
        gameFilter === 'ALL' || m.gameId.toLowerCase() === gameFilter.toLowerCase();
      const matchesStatus =
        statusFilter === 'ALL' || m.status.toUpperCase() === statusFilter.toUpperCase();
      const matchesPattern =
        patternFilter === 'ALL' ||
        (Array.isArray(m.patterns) &&
          m.patterns.some((p) => p.toUpperCase().includes(patternFilter.toUpperCase())));
      const matchesSearch =
        !searchQuery ||
        m.matchId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.gameId.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesGame && matchesStatus && matchesPattern && matchesSearch;
    });
  }, [matches, gameFilter, statusFilter, patternFilter, searchQuery]);

  // Consolidado de patrones para la pestaña PATTERNS
  const enrichedPatterns: EnrichedPatternItem[] = useMemo(() => {
    const list: EnrichedPatternItem[] = [];
    matches.forEach((m) => {
      if (!Array.isArray(m.patterns) || m.patterns.length === 0) return;
      const report = patternReports[m.matchId];
      if (report && report.patterns.length > 0) {
        // Datos reales calculados por Scala (jugador, ventana temporal, detalles)
        report.patterns.forEach((pattern) =>
          list.push({ matchId: m.matchId, gameId: m.gameId, pattern })
        );
      } else {
        // Reporte aún no cargado: solo lo que /matches informa, sin inventar jugador
        m.patterns.forEach((p) =>
          list.push({
            matchId: m.matchId,
            gameId: m.gameId,
            pattern: {
              pattern: p,
              playerId: '—',
              startedAt: m.updatedAt,
              endedAt: m.updatedAt,
              eventIds: [],
              description: `Patrón ${p} detectado por Scala (cargando reporte detallado...)`,
              details: {},
            },
          })
        );
      }
    });
    return list;
  }, [matches, patternReports]);

  const maxMatchEvents = useMemo(() => {
    return matches.reduce((max, m) => Math.max(max, m.eventCount), 1);
  }, [matches]);

  const snakeCount = matches.filter((m) => m.gameId.toLowerCase() === 'snake').length;
  const battleshipCount = matches.filter((m) => m.gameId.toLowerCase() === 'battleship').length;
  const footballCount = matches.filter((m) => m.gameId.toLowerCase() === 'head_football').length;
  const totalMatchCount = Math.max(matches.length, 1);

  return (
    <div className="min-h-screen bg-arcade-bg arcade-grid-bg text-slate-100 font-pixel p-3 sm:p-6 flex flex-col space-y-6">
      {/* Top Banner & Control Bar */}
      <header className="bg-arcade-surface pixel-box-emerald p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-arcade-accent text-arcade-bg border-2 border-emerald-200 flex items-center justify-center font-arcade text-sm shadow-brutal-sm">
            GS
          </div>
          <div>
            <h1 className="font-arcade text-sm sm:text-base tracking-wider text-white">
              GAMESTATS LIVE
            </h1>
            <p className="text-xs font-pixel text-slate-400">
              Pipeline de Ingesta Go + Analítica Scala + Prolog IA
              {lastRefreshedAt && (
                <span className="ml-2 text-slate-500">
                  • Sync {lastRefreshedAt.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Salud real de los servicios (GET /health de Go y de Prolog) */}
          <HealthPill label="GO" state={health.go} detail="GameStats Ingestion (GET /health)" />
          <HealthPill label="PROLOG" state={health.prolog} detail={health.prologEngine} />

          {/* Health indicator (/stats) */}
          <div className="flex items-center space-x-2 px-3 py-1.5 bg-arcade-bg pixel-box text-xs">
            {isOnline === true ? (
              <>
                <PixelIcon name="wifi" size={14} className="text-arcade-accent animate-pulse" />
                <span className="font-arcade text-[10px] text-arcade-accent">ONLINE</span>
              </>
            ) : isOnline === false ? (
              <>
                <PixelIcon name="wifi-off" size={14} className="text-arcade-rose" />
                <span className="font-arcade text-[10px] text-arcade-rose">OFFLINE</span>
              </>
            ) : (
              <>
                <PixelIcon name="refresh" size={14} className="text-arcade-cyan animate-spin" />
                <span className="font-arcade text-[10px] text-arcade-cyan">CONNECTING</span>
              </>
            )}
          </div>

          {/* Auto refresh dropdown */}
          <div className="flex items-center space-x-1.5 bg-arcade-bg pixel-box px-2.5 py-1.5 text-xs">
            <PixelIcon name="clock" size={14} className="text-slate-400" />
            <select
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
              className="bg-transparent font-pixel text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value={2000}>2s (Ultra)</option>
              <option value={5000}>5s (Normal)</option>
              <option value={10000}>10s (Eco)</option>
              <option value={0}>Pausado</option>
            </select>
          </div>

          {/* Manual Refresh button */}
          <button
            onClick={() => void fetchData()}
            disabled={isLoading}
            className="pixel-btn px-3 py-1.5 bg-arcade-accent hover:bg-emerald-400 border-emerald-200 text-arcade-bg font-arcade text-[11px] flex items-center space-x-1.5 disabled:opacity-50"
          >
            <PixelIcon
              name="refresh"
              size={14}
              className={isLoading ? 'animate-spin' : ''}
            />
            <span>SYNC</span>
          </button>
        </div>
      </header>

      {/* Errores de red / detalle (los datos anteriores se conservan en pantalla) */}
      {(fetchErrors.length > 0 || detailError) && (
        <div role="alert" className="bg-rose-950/60 border-2 border-rose-500 p-3 text-xs text-rose-200 space-y-1">
          {fetchErrors.map((e) => (
            <p key={e}>⚠ {e}</p>
          ))}
          {fetchErrors.length > 0 && stats && (
            <p className="text-rose-300/80">Mostrando los últimos datos conocidos.</p>
          )}
          {detailError && (
            <p className="flex items-start justify-between gap-3">
              <span>⚠ {detailError}</span>
              <button
                onClick={() => setDetailError(null)}
                className="font-arcade text-[10px] text-rose-300 hover:text-white shrink-0"
              >
                CERRAR
              </button>
            </p>
          )}
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="flex flex-wrap gap-2.5 border-b-2 border-arcade-border pb-3">
        <button
          onClick={() => setActiveTab('OVERVIEW')}
          className={`pixel-btn px-4 py-2 text-[11px] font-arcade tracking-wider ${
            activeTab === 'OVERVIEW'
              ? 'bg-arcade-accent text-arcade-bg border-emerald-200'
              : 'bg-arcade-surface text-slate-300 border-arcade-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <PixelIcon name="activity" size={14} />
            <span>OVERVIEW &amp; RUNTIME</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('MATCHES')}
          className={`pixel-btn px-4 py-2 text-[11px] font-arcade tracking-wider ${
            activeTab === 'MATCHES'
              ? 'bg-arcade-cyan text-arcade-bg border-cyan-200'
              : 'bg-arcade-surface text-slate-300 border-arcade-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <PixelIcon name="layers" size={14} />
            <span>MATCHES ({matches.length})</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('PATTERNS')}
          className={`pixel-btn px-4 py-2 text-[11px] font-arcade tracking-wider ${
            activeTab === 'PATTERNS'
              ? 'bg-arcade-amber text-arcade-bg border-amber-200'
              : 'bg-arcade-surface text-slate-300 border-arcade-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <PixelIcon name="sparkles" size={14} />
            <span>PATTERNS ({enrichedPatterns.length})</span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('INVALID')}
          className={`pixel-btn px-4 py-2 text-[11px] font-arcade tracking-wider ${
            activeTab === 'INVALID'
              ? 'bg-arcade-rose text-arcade-bg border-rose-200'
              : 'bg-arcade-surface text-slate-300 border-arcade-border hover:border-slate-400'
          }`}
        >
          <div className="flex items-center space-x-2">
            <PixelIcon name="alert" size={14} />
            <span>INVALID AUDIT ({invalidEvents.length})</span>
          </div>
        </button>
      </nav>

      {/* Local Client EventDispatcher Status Bar */}
      <div className="bg-arcade-surface pixel-box p-3 flex flex-wrap items-center justify-between gap-2 text-xs font-pixel text-slate-300">
        <div className="flex flex-wrap items-center gap-2">
          <PixelIcon name="send" size={14} className="text-arcade-cyan" />
          <span className="font-arcade text-[10px] text-slate-200">
            BROWSER EVENT DISPATCHER:
          </span>
          <span>
            Pendientes en cola:{' '}
            <strong className="text-arcade-amber">{dispatcherStatus.pendingCount}</strong>
          </span>
          <span className="text-slate-600">|</span>
          <span>
            Total despachados:{' '}
            <strong className="text-arcade-accent">{dispatcherStatus.totalSent}</strong>
          </span>
          {dispatcherStatus.consecutiveErrors > 0 && (
            <>
              <span className="text-slate-600">|</span>
              <span className="text-arcade-rose font-bold">
                Reintentando ({dispatcherStatus.consecutiveErrors})
              </span>
            </>
          )}
        </div>

        <div className="text-[11px] text-slate-400">
          {dispatcherStatus.lastSuccessTimestamp ? (
            <span>
              Último batch: {new Date(dispatcherStatus.lastSuccessTimestamp).toLocaleTimeString()}
            </span>
          ) : (
            <span>Esperando eventos de juego...</span>
          )}
        </div>
      </div>

      {/* Main Tab Views */}
      <main className="space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            <MetricsCards stats={stats} isLoading={isLoading} />

            {/* Quick Games Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Snake Card */}
              <div className="bg-arcade-surface pixel-box-emerald p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2 border-b-2 border-emerald-900/60 pb-2">
                    <div className="flex items-center space-x-2">
                      <PixelIcon name="gamepad" size={16} className="text-emerald-400" />
                      <h3 className="font-arcade text-xs text-emerald-300 tracking-wider">
                        SNAKE POO
                      </h3>
                    </div>
                    <span className="text-[10px] font-arcade bg-emerald-950 text-emerald-400 border border-emerald-700 px-2 py-0.5">
                      {snakeCount} Partidas
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p>Motor Canvas 2D 60 FPS con estela neón y partículas.</p>
                    <p className="text-[11px] text-slate-400">
                      Telemetría: EAT_FOOD, CHANGE_DIRECTION, COLLISION.
                    </p>
                  </div>
                </div>
                <div className="pixel-progress-track h-2.5 w-full">
                  <div
                    className="pixel-progress-fill text-emerald-400"
                    style={{ width: `${Math.round((snakeCount / totalMatchCount) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Battleship Card */}
              <div className="bg-arcade-surface pixel-box-cyan p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2 border-b-2 border-cyan-900/60 pb-2">
                    <div className="flex items-center space-x-2">
                      <PixelIcon name="crosshair" size={16} className="text-cyan-400" />
                      <h3 className="font-arcade text-xs text-cyan-300 tracking-wider">
                        BATTLESHIP + PROLOG
                      </h3>
                    </div>
                    <span className="text-[10px] font-arcade bg-cyan-950 text-cyan-400 border border-cyan-700 px-2 py-0.5">
                      {battleshipCount} Partidas
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p>Radar táctico con SVG, 5 barcos y búsqueda por paridad.</p>
                    <p className="text-[11px] text-slate-400">
                      Telemetría: FIRE_SHOT, AI_DECISION (HUNT / TARGET).
                    </p>
                  </div>
                </div>
                <div className="pixel-progress-track h-2.5 w-full">
                  <div
                    className="pixel-progress-fill text-cyan-400"
                    style={{ width: `${Math.round((battleshipCount / totalMatchCount) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Head Football Card */}
              <div className="bg-arcade-surface pixel-box-amber p-4 flex flex-col justify-between space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-2 border-b-2 border-amber-900/60 pb-2">
                    <div className="flex items-center space-x-2">
                      <PixelIcon name="trophy" size={16} className="text-amber-400" />
                      <h3 className="font-arcade text-xs text-amber-300 tracking-wider">
                        HEAD FOOTBALL
                      </h3>
                    </div>
                    <span className="text-[10px] font-arcade bg-amber-950 text-amber-400 border border-amber-700 px-2 py-0.5">
                      {footballCount} Partidas
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 space-y-1">
                    <p>Física 2D de rebotes, saltos, cabezazos y remontadas.</p>
                    <p className="text-[11px] text-slate-400">
                      Telemetría: KICK, GOAL con detección de COMEBACK.
                    </p>
                  </div>
                </div>
                <div className="pixel-progress-track h-2.5 w-full">
                  <div
                    className="pixel-progress-fill text-amber-400"
                    style={{ width: `${Math.round((footballCount / totalMatchCount) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Recent Matches High-Score Stream in Overview */}
            <div className="bg-arcade-surface pixel-box p-4 space-y-3">
              <div className="flex items-center justify-between border-b-2 border-arcade-border pb-2.5">
                <h3 className="font-arcade text-xs text-slate-100 tracking-wider flex items-center space-x-2">
                  <PixelIcon name="trophy" size={16} className="text-arcade-amber" />
                  <span>HIGH-SCORE STREAM: RECENT MATCHES ({matches.slice(0, 5).length})</span>
                </h3>
                <button
                  onClick={() => setActiveTab('MATCHES')}
                  className="pixel-btn px-2.5 py-1 bg-arcade-card border-arcade-cyan text-[10px] font-arcade text-arcade-cyan"
                >
                  VIEW ALL &rarr;
                </button>
              </div>

              {matches.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs border-2 border-dashed border-arcade-border bg-arcade-bg/50">
                  No hay partidas registradas aún. ¡Inicia una partida en el Arcade Lobby!
                </div>
              ) : (
                <div className="divide-y-2 divide-slate-800 bg-arcade-bg border-2 border-arcade-border">
                  {matches.slice(0, 5).map((m, idx) => {
                    const rank = `#${String(idx + 1).padStart(2, '0')}`;
                    const barWidth = Math.max(8, Math.round((m.eventCount / maxMatchEvents) * 100));
                    return (
                      <div
                        key={m.matchId}
                        onClick={() => void handleSelectMatch(m.matchId)}
                        className="py-2.5 px-3 hover:bg-arcade-card/60 flex flex-wrap items-center justify-between gap-3 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <span className="font-arcade text-[10px] text-arcade-amber w-8">
                            {rank}
                          </span>
                          <span
                            className={`text-[10px] font-arcade px-2 py-0.5 border ${
                              m.gameId.toLowerCase() === 'snake'
                                ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40'
                                : m.gameId.toLowerCase() === 'battleship'
                                ? 'border-cyan-500 text-cyan-400 bg-cyan-950/40'
                                : 'border-amber-500 text-amber-400 bg-amber-950/40'
                            }`}
                          >
                            {m.gameId.toUpperCase()}
                          </span>
                          <span className="text-xs font-bold text-slate-200">{m.matchId}</span>
                        </div>

                        <div className="flex items-center space-x-3 text-xs">
                          {/* Patterns medals */}
                          {m.patterns && m.patterns.includes('DEADLY_STREAK') && (
                            <span className="flex items-center space-x-1 text-[9px] font-arcade bg-rose-950 text-rose-300 border border-rose-500 px-1.5 py-0.5">
                              <MiniPixelMedal kind="DEADLY_STREAK" />
                              <span>DEADLY_STREAK</span>
                            </span>
                          )}
                          {m.patterns && m.patterns.includes('COMEBACK') && (
                            <span className="flex items-center space-x-1 text-[9px] font-arcade bg-amber-950 text-amber-300 border border-amber-500 px-1.5 py-0.5">
                              <MiniPixelMedal kind="COMEBACK" />
                              <span>COMEBACK</span>
                            </span>
                          )}

                          <div className="hidden sm:flex items-center space-x-2 w-28">
                            <div className="pixel-progress-track h-2 flex-1">
                              <div
                                className="pixel-progress-fill text-arcade-cyan"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>

                          <span className="text-slate-300 font-arcade text-[10px] tabular-nums">
                            {m.eventCount} EV
                          </span>
                          <span
                            className={`text-[9px] font-arcade px-2 py-0.5 border ${
                              m.status === 'FINISHED'
                                ? 'text-emerald-300 bg-emerald-950 border-emerald-700'
                                : 'text-amber-300 bg-amber-950 border-amber-700'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MATCHES HIGH-SCORE ANALYTICS TABLE */}
        {activeTab === 'MATCHES' && (
          <div className="bg-arcade-surface pixel-box-cyan p-4 space-y-4">
            <div className="flex items-center justify-between border-b-2 border-arcade-border pb-3">
              <div className="flex items-center space-x-2">
                <PixelIcon name="trophy" size={18} className="text-arcade-cyan" />
                <h3 className="font-arcade text-xs sm:text-sm text-slate-100 tracking-wider">
                  HIGH-SCORE TABLE: MATCHES LEADERBOARD ({filteredMatches.length})
                </h3>
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Search */}
              <div className="flex items-center space-x-2 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1.5 focus-within:border-arcade-cyan">
                <PixelIcon name="search" size={14} className="text-slate-400" />
                <input
                  type="text"
                  placeholder="Search match ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-transparent text-xs font-pixel text-slate-200 placeholder-slate-500 focus:outline-none w-full"
                />
              </div>

              {/* Game filter */}
              <div className="flex items-center space-x-2 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1.5">
                <PixelIcon name="filter" size={14} className="text-slate-400" />
                <select
                  value={gameFilter}
                  onChange={(e) => setGameFilter(e.target.value)}
                  className="bg-transparent text-xs font-pixel text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="ALL">ALL GAMES</option>
                  <option value="snake">SNAKE</option>
                  <option value="battleship">BATTLESHIP</option>
                  <option value="head_football">HEAD FOOTBALL</option>
                </select>
              </div>

              {/* Status filter */}
              <div className="flex items-center space-x-2 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1.5">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs font-pixel text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="ALL">ALL STATUSES</option>
                  <option value="FINISHED">FINISHED</option>
                  <option value="IN_PROGRESS">IN_PROGRESS</option>
                </select>
              </div>

              {/* Pattern filter */}
              <div className="flex items-center space-x-2 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1.5">
                <select
                  value={patternFilter}
                  onChange={(e) => setPatternFilter(e.target.value)}
                  className="bg-transparent text-xs font-pixel text-slate-200 focus:outline-none w-full cursor-pointer"
                >
                  <option value="ALL">ALL PATTERNS</option>
                  <option value="DEADLY_STREAK">DEADLY_STREAK</option>
                  <option value="COMEBACK">COMEBACK</option>
                </select>
              </div>
            </div>

            {/* Matches Table */}
            {filteredMatches.length === 0 ? (
              <div className="py-12 text-center text-slate-500 text-xs border-2 border-dashed border-arcade-border bg-arcade-bg/50">
                No se encontraron partidas con los filtros seleccionados.
              </div>
            ) : (
              <div className="overflow-x-auto pixel-box bg-arcade-bg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-arcade-card border-b-2 border-arcade-border text-slate-300 font-arcade text-[10px] uppercase tracking-wider">
                    <tr>
                      <th className="p-3">Rank</th>
                      <th className="p-3">Juego</th>
                      <th className="p-3">Match ID</th>
                      <th className="p-3">Estado</th>
                      <th className="p-3">Eventos</th>
                      <th className="p-3">Medallas / Patrones</th>
                      <th className="p-3">Actualización</th>
                      <th className="p-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-800 bg-arcade-bg">
                    {filteredMatches.map((m, idx) => {
                      const rank = `#${String(idx + 1).padStart(2, '0')}`;
                      const barWidth = Math.max(
                        6,
                        Math.round((m.eventCount / maxMatchEvents) * 100)
                      );
                      return (
                        <tr
                          key={m.matchId}
                          className="hover:bg-arcade-card/50 transition-colors cursor-pointer"
                          onClick={() => void handleSelectMatch(m.matchId)}
                        >
                          <td className="p-3 font-arcade text-[10px] text-arcade-amber">
                            {rank}
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 text-[10px] font-arcade border ${
                                m.gameId.toLowerCase() === 'snake'
                                  ? 'border-emerald-500 text-emerald-400 bg-emerald-950/40'
                                  : m.gameId.toLowerCase() === 'battleship'
                                  ? 'border-cyan-500 text-cyan-400 bg-cyan-950/40'
                                  : 'border-amber-500 text-amber-400 bg-amber-950/40'
                              }`}
                            >
                              {m.gameId.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 font-pixel font-bold text-slate-200">{m.matchId}</td>
                          <td className="p-3">
                            <span
                              className={`text-[9px] font-arcade px-2 py-0.5 border ${
                                m.status === 'FINISHED'
                                  ? 'text-emerald-300 bg-emerald-950 border-emerald-700'
                                  : 'text-amber-300 bg-amber-950 border-amber-700'
                              }`}
                            >
                              {m.status}
                            </span>
                          </td>
                          <td className="p-3">
                            <div className="flex items-center space-x-2">
                              <span className="tabular-nums font-arcade text-[11px] text-white w-10">
                                {m.eventCount}
                              </span>
                              <div className="pixel-progress-track h-2 w-16 hidden sm:block">
                                <div
                                  className="pixel-progress-fill text-arcade-cyan"
                                  style={{ width: `${barWidth}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-1.5">
                              {m.patterns && m.patterns.length > 0 ? (
                                m.patterns.map((pat, pIdx) => {
                                  const kind =
                                    pat === 'DEADLY_STREAK'
                                      ? 'DEADLY_STREAK'
                                      : pat === 'COMEBACK'
                                      ? 'COMEBACK'
                                      : 'OTHER';
                                  return (
                                    <span
                                      key={pIdx}
                                      className={`flex items-center space-x-1 text-[9px] font-arcade px-1.5 py-0.5 border ${
                                        pat === 'DEADLY_STREAK'
                                          ? 'bg-rose-950 text-rose-300 border-rose-500'
                                          : pat === 'COMEBACK'
                                          ? 'bg-amber-950 text-amber-300 border-amber-500'
                                          : 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                      }`}
                                    >
                                      <MiniPixelMedal kind={kind} />
                                      <span>{pat}</span>
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-slate-500 text-[10px]">Ninguno</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-[11px] text-slate-400">
                            {m.updatedAt ? new Date(m.updatedAt).toLocaleTimeString() : 'N/A'}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleSelectMatch(m.matchId);
                              }}
                              className="pixel-btn px-2.5 py-1 bg-arcade-card border-arcade-cyan text-[10px] font-arcade text-arcade-cyan inline-flex items-center space-x-1"
                            >
                              <PixelIcon name="eye" size={12} />
                              <span>INSPECT</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PATTERNS */}
        {activeTab === 'PATTERNS' && (
          <PatternsList
            items={enrichedPatterns}
            onSelectMatch={(id) => void handleSelectMatch(id)}
          />
        )}

        {/* TAB 4: INVALID EVENTS AUDIT */}
        {activeTab === 'INVALID' && (
          <InvalidEventsViewer
            invalidEvents={invalidEvents}
            isLoading={isLoading}
            onRefresh={() => void fetchData()}
          />
        )}
      </main>

      {/* Match Detail Modal for Deep Scala Report Inspection */}
      <MatchDetailModal
        match={selectedMatch}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedMatch(null);
        }}
      />
    </div>
  );
};
