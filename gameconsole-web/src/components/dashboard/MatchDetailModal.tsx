import React, { useEffect } from 'react';
import { MatchReport } from '../../types/contracts';
import { PixelIcon } from '../pixel/PixelIcon';

interface MatchDetailModalProps {
  match: MatchReport | null;
  isOpen: boolean;
  onClose: () => void;
}

const ModalPatternMedal: React.FC<{ type: 'DEADLY_STREAK' | 'COMEBACK' | 'OTHER' }> = ({ type }) => {
  if (type === 'DEADLY_STREAK') {
    return (
      <svg
        width={24}
        height={24}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        <rect x="4" y="1" width="3" height="4" fill="#9f1239" />
        <rect x="9" y="1" width="3" height="4" fill="#9f1239" />
        <rect x="6" y="1" width="4" height="3" fill="#f43f5e" />
        <rect x="4" y="5" width="8" height="1" fill="#fb7185" />
        <rect x="3" y="6" width="10" height="7" fill="#e11d48" />
        <rect x="4" y="13" width="8" height="2" fill="#9f1239" />
        <rect x="5" y="7" width="6" height="5" fill="#0b0f19" />
        <rect x="6" y="8" width="4" height="2" fill="#f43f5e" />
        <rect x="7" y="10" width="2" height="2" fill="#fde047" />
      </svg>
    );
  }
  if (type === 'COMEBACK') {
    return (
      <svg
        width={24}
        height={24}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        <rect x="4" y="1" width="3" height="4" fill="#0e7490" />
        <rect x="9" y="1" width="3" height="4" fill="#0e7490" />
        <rect x="6" y="1" width="4" height="3" fill="#06b6d4" />
        <rect x="4" y="5" width="8" height="1" fill="#fde047" />
        <rect x="3" y="6" width="10" height="7" fill="#f59e0b" />
        <rect x="4" y="13" width="8" height="2" fill="#b45309" />
        <rect x="5" y="7" width="6" height="5" fill="#0b0f19" />
        <rect x="6" y="8" width="4" height="2" fill="#fde047" />
        <rect x="7" y="10" width="2" height="2" fill="#f59e0b" />
      </svg>
    );
  }
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className="pixelated shrink-0"
      aria-hidden="true"
    >
      <rect x="5" y="1" width="6" height="4" fill="#0e7490" />
      <rect x="4" y="5" width="8" height="1" fill="#67e8f9" />
      <rect x="3" y="6" width="10" height="7" fill="#06b6d4" />
      <rect x="4" y="13" width="8" height="2" fill="#155e75" />
      <rect x="5" y="7" width="6" height="5" fill="#0b0f19" />
      <rect x="7" y="8" width="2" height="3" fill="#67e8f9" />
      <rect x="6" y="9" width="4" height="1" fill="#67e8f9" />
    </svg>
  );
};

export const MatchDetailModal: React.FC<MatchDetailModalProps> = ({
  match,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !match) return null;

  const handleCopyId = () => {
    navigator.clipboard?.writeText(match.matchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isFinished = match.status === 'FINISHED';
  const game = match.gameId.toLowerCase();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-arcade-surface pixel-box-emerald w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden font-pixel text-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="bg-arcade-card border-b-2 border-arcade-border p-4 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <PixelIcon name="gamepad" size={18} className="text-arcade-accent" />
            <span
              className={`px-2.5 py-0.5 text-xs font-arcade tracking-wider border-2 ${
                game === 'snake'
                  ? 'bg-emerald-950 text-arcade-accent border-arcade-accent'
                  : game === 'battleship'
                  ? 'bg-cyan-950 text-arcade-cyan border-arcade-cyan'
                  : 'bg-amber-950 text-arcade-amber border-arcade-amber'
              }`}
            >
              {match.gameId.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">v{match.gameVersion}</span>
            <span
              className={`text-[10px] font-arcade px-2 py-0.5 border ${
                isFinished
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                  : 'bg-amber-950 text-amber-300 border-amber-600'
              }`}
            >
              {match.status}
            </span>
          </div>

          <button
            onClick={onClose}
            className="pixel-btn p-1.5 bg-arcade-bg border-arcade-border hover:border-arcade-rose text-slate-400 hover:text-arcade-rose"
            aria-label="Cerrar"
          >
            <PixelIcon name="close" size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 arcade-grid-bg">
          {/* Match ID Bar */}
          <div className="bg-arcade-bg pixel-box p-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <span className="text-[11px] font-arcade text-slate-400">MATCH ID:</span>
              <span className="text-xs font-bold text-arcade-cyan select-all">{match.matchId}</span>
            </div>
            <button
              onClick={handleCopyId}
              className="pixel-btn flex items-center space-x-1.5 text-[10px] font-arcade px-2.5 py-1 bg-arcade-card border-arcade-border hover:border-arcade-cyan text-slate-200"
            >
              {copied ? (
                <>
                  <PixelIcon name="check" size={12} className="text-arcade-accent" />
                  <span className="text-arcade-accent">COPIED</span>
                </>
              ) : (
                <>
                  <PixelIcon name="copy" size={12} />
                  <span>COPY ID</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-arcade-bg pixel-box-cyan p-3">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Total Eventos</span>
                <PixelIcon name="activity" size={12} className="text-arcade-cyan" />
              </div>
              <div className="text-lg font-arcade text-slate-100 tabular-nums mt-1">
                {match.eventCount}
              </div>
            </div>
            <div className="bg-arcade-bg pixel-box p-3">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Duplicados</span>
                <PixelIcon name="layers" size={12} className="text-slate-400" />
              </div>
              <div className="text-lg font-arcade text-slate-100 tabular-nums mt-1">
                {match.duplicatesDropped}
              </div>
            </div>
            <div className="bg-arcade-bg pixel-box p-3">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Inicio</span>
                <PixelIcon name="clock" size={12} className="text-slate-400" />
              </div>
              <div className="text-xs font-bold text-slate-200 truncate mt-1.5">
                {match.startedAt ? new Date(match.startedAt).toLocaleTimeString() : 'N/A'}
              </div>
            </div>
            <div className="bg-arcade-bg pixel-box p-3">
              <div className="text-[10px] text-slate-400 uppercase flex items-center justify-between">
                <span>Fin / Duración</span>
                <PixelIcon name="clock" size={12} className="text-arcade-accent" />
              </div>
              <div className="text-xs font-bold text-slate-200 truncate mt-1.5">
                {match.finishedAt ? new Date(match.finishedAt).toLocaleTimeString() : 'En curso'}
              </div>
            </div>
          </div>

          {/* Complex Patterns Section (DEADLY_STREAK & COMEBACK) */}
          {match.patterns && match.patterns.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-arcade text-arcade-amber tracking-wider flex items-center space-x-2">
                <PixelIcon name="trophy" size={16} className="text-arcade-amber" />
                <span>PATRONES COMPLEJOS DETECTADOS POR SCALA ({match.patterns.length})</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {match.patterns.map((p, idx) => {
                  const patUpper = p.pattern.toUpperCase();
                  const isDeadly = patUpper === 'DEADLY_STREAK';
                  const isComeback = patUpper === 'COMEBACK';
                  return (
                    <div
                      key={idx}
                      className={`p-3.5 ${
                        isDeadly
                          ? 'pixel-box-rose bg-rose-950/25'
                          : isComeback
                          ? 'pixel-box-amber bg-amber-950/25'
                          : 'pixel-box-cyan bg-cyan-950/25'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center space-x-2">
                          <ModalPatternMedal
                            type={isDeadly ? 'DEADLY_STREAK' : isComeback ? 'COMEBACK' : 'OTHER'}
                          />
                          <span
                            className={`text-[10px] font-arcade px-2 py-0.5 border-2 ${
                              isDeadly
                                ? 'bg-arcade-rose text-black border-rose-300'
                                : isComeback
                                ? 'bg-arcade-amber text-black border-amber-300'
                                : 'bg-arcade-cyan text-black border-cyan-300'
                            }`}
                          >
                            {p.pattern}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-300 truncate">
                          Jugador: {p.playerId}
                        </span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed font-semibold">
                        {p.description}
                      </p>
                      {p.details && Object.keys(p.details).length > 0 && (
                        <div className="mt-2 pt-2 border-t-2 border-slate-800 flex flex-wrap gap-2 text-[11px]">
                          {Object.entries(p.details).map(([k, v]) => (
                            <span key={k} className="bg-slate-900 border border-slate-700 px-2 py-0.5 text-slate-300">
                              {k}: <strong className="text-white">{v}</strong>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Game-Specific Metrics Section */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-arcade text-slate-200 tracking-wider flex items-center space-x-2">
              <PixelIcon name="activity" size={16} className="text-arcade-cyan" />
              <span>MÉTRICAS ANALÍTICAS DE PARTIDA ({match.gameId.toUpperCase()})</span>
            </h4>

            {match.matchMetrics && Object.keys(match.matchMetrics).length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                {Object.entries(match.matchMetrics).map(([metricName, value]) => (
                  <div key={metricName} className="bg-arcade-bg pixel-box p-2.5">
                    <div className="text-[10px] text-slate-400 uppercase truncate" title={metricName}>
                      {metricName.replace(/_/g, ' ')}
                    </div>
                    <div className="text-base font-arcade text-arcade-cyan tabular-nums mt-1">
                      {typeof value === 'number' ? value.toLocaleString() : value}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-arcade-bg border-2 border-dashed border-arcade-border p-3 text-xs text-slate-500">
                No hay métricas agregadas globales para esta partida.
              </div>
            )}
          </div>

          {/* Players Breakdown */}
          {match.players && match.players.length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-arcade text-slate-200 tracking-wider flex items-center space-x-2">
                <PixelIcon name="shield" size={16} className="text-arcade-accent" />
                <span>RENDIMIENTO DE JUGADORES ({match.players.length})</span>
              </h4>

              <div className="space-y-3">
                {match.players.map((player) => (
                  <div key={player.playerId} className="bg-arcade-bg pixel-box-emerald p-3">
                    <div className="flex items-center justify-between border-b-2 border-slate-800 pb-2 mb-2">
                      <span className="text-xs font-arcade text-arcade-accent flex items-center space-x-1.5">
                        <PixelIcon name="user" size={14} />
                        <span>PLAYER: {player.playerId}</span>
                      </span>
                    </div>

                    {player.metrics && Object.keys(player.metrics).length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        {Object.entries(player.metrics).map(([mk, mv]) => (
                          <div key={mk} className="bg-arcade-card border border-arcade-border p-1.5 text-[11px]">
                            <span className="text-slate-400 block truncate">{mk}</span>
                            <span className="text-slate-100 font-bold tabular-nums">{mv}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {player.crossEventMetrics && Object.keys(player.crossEventMetrics).length > 0 && (
                      <div className="mt-2 text-[11px] text-slate-400">
                        <span className="font-bold text-slate-300">Cross-Event Metrics: </span>
                        {Object.entries(player.crossEventMetrics).map(([k, v]) => (
                          <span key={k} className="mr-3">
                            {k}: <strong className="text-arcade-cyan">{v}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions Breakdown */}
          {match.actionCounts && Object.keys(match.actionCounts).length > 0 && (
            <div className="space-y-2.5">
              <h4 className="text-xs font-arcade text-slate-200 tracking-wider flex items-center space-x-2">
                <PixelIcon name="layers" size={16} className="text-slate-400" />
                <span>DESGLOSE DE ACCIONES ({Object.keys(match.actionCounts).length})</span>
              </h4>

              <div className="flex flex-wrap gap-2">
                {Object.entries(match.actionCounts).map(([action, count]) => (
                  <div
                    key={action}
                    className="bg-arcade-bg pixel-box px-2.5 py-1.5 text-xs flex items-center space-x-2"
                  >
                    <span className="text-slate-400">{action}:</span>
                    <span className="font-arcade text-[11px] text-white tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Scala Warnings if any */}
          {match.warnings && match.warnings.length > 0 && (
            <div className="bg-amber-950/30 pixel-box-amber p-3 space-y-1.5">
              <div className="text-xs font-arcade text-arcade-amber flex items-center space-x-1.5">
                <PixelIcon name="alert" size={14} />
                <span>ADVERTENCIAS DE ANÁLISIS DE SCALA ({match.warnings.length})</span>
              </div>
              <ul className="list-disc list-inside text-xs text-amber-200 space-y-0.5">
                {match.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-arcade-card border-t-2 border-arcade-border p-3 flex justify-end">
          <button
            onClick={onClose}
            className="pixel-btn px-4 py-1.5 bg-arcade-border hover:bg-slate-700 border-slate-500 text-xs font-arcade tracking-wider uppercase text-white"
          >
            Cerrar Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
