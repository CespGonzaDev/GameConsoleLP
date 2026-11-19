import React, { useState } from 'react';
import { PatternDetection } from '../../types/contracts';
import { PixelIcon } from '../pixel/PixelIcon';

export interface EnrichedPatternItem {
  matchId: string;
  gameId: string;
  pattern: PatternDetection;
}

interface PatternsListProps {
  items: EnrichedPatternItem[];
  onSelectMatch?: (matchId: string) => void;
}

/**
 * 24x24 crisp-edges Pixel Art Medal SVG for arcade pattern achievements.
 */
const PatternMedalSvg: React.FC<{ type: 'DEADLY_STREAK' | 'COMEBACK' | 'OTHER' }> = ({ type }) => {
  if (type === 'DEADLY_STREAK') {
    return (
      <svg
        width={32}
        height={32}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        {/* Ribbon */}
        <rect x="4" y="1" width="3" height="4" fill="#9f1239" />
        <rect x="9" y="1" width="3" height="4" fill="#9f1239" />
        <rect x="6" y="1" width="4" height="3" fill="#f43f5e" />
        {/* Medal outer ring */}
        <rect x="4" y="5" width="8" height="1" fill="#fb7185" />
        <rect x="3" y="6" width="10" height="7" fill="#e11d48" />
        <rect x="4" y="13" width="8" height="2" fill="#9f1239" />
        {/* Inner flame/skull emblem */}
        <rect x="5" y="7" width="6" height="5" fill="#0b0f19" />
        <rect x="7" y="7" width="2" height="1" fill="#fda4af" />
        <rect x="6" y="8" width="4" height="2" fill="#f43f5e" />
        <rect x="7" y="10" width="2" height="2" fill="#fde047" />
      </svg>
    );
  }

  if (type === 'COMEBACK') {
    return (
      <svg
        width={32}
        height={32}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        className="pixelated shrink-0"
        aria-hidden="true"
      >
        {/* Ribbon */}
        <rect x="4" y="1" width="3" height="4" fill="#0e7490" />
        <rect x="9" y="1" width="3" height="4" fill="#0e7490" />
        <rect x="6" y="1" width="4" height="3" fill="#06b6d4" />
        {/* Gold Medal */}
        <rect x="4" y="5" width="8" height="1" fill="#fde047" />
        <rect x="3" y="6" width="10" height="7" fill="#f59e0b" />
        <rect x="4" y="13" width="8" height="2" fill="#b45309" />
        {/* Inner Trophy / Star */}
        <rect x="5" y="7" width="6" height="5" fill="#0b0f19" />
        <rect x="6" y="8" width="4" height="2" fill="#fde047" />
        <rect x="7" y="10" width="2" height="2" fill="#f59e0b" />
        <rect x="5" y="8" width="1" height="1" fill="#f59e0b" />
        <rect x="10" y="8" width="1" height="1" fill="#f59e0b" />
      </svg>
    );
  }

  return (
    <svg
      width={32}
      height={32}
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

export const PatternsList: React.FC<PatternsListProps> = ({ items, onSelectMatch }) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchPlayer, setSearchPlayer] = useState<string>('');

  const filtered = items.filter((item) => {
    const matchesType =
      filterType === 'ALL' || item.pattern.pattern.toUpperCase() === filterType.toUpperCase();
    const matchesPlayer =
      !searchPlayer ||
      item.pattern.playerId.toLowerCase().includes(searchPlayer.toLowerCase()) ||
      item.matchId.toLowerCase().includes(searchPlayer.toLowerCase());
    return matchesType && matchesPlayer;
  });

  return (
    <div className="bg-arcade-surface pixel-box-amber p-4 flex flex-col space-y-4">
      {/* Header con filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-arcade-border pb-3">
        <div className="flex items-center space-x-2.5">
          <PixelIcon name="sparkles" size={20} className="text-arcade-amber" />
          <div>
            <h3 className="font-arcade text-xs sm:text-sm text-slate-100 tracking-wider">
              MEDAL HALL: COMPLEX PATTERNS ({filtered.length})
            </h3>
            <p className="font-pixel text-[11px] text-slate-400">
              DEADLY_STREAK &amp; COMEBACK — Logros detectados por Scala
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1">
            <PixelIcon name="filter" size={14} className="text-slate-400" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-transparent text-xs font-pixel text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">ALL PATTERNS</option>
              <option value="DEADLY_STREAK">DEADLY_STREAK</option>
              <option value="COMEBACK">COMEBACK</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1 focus-within:border-arcade-cyan">
            <PixelIcon name="search" size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Filter player or matchId..."
              value={searchPlayer}
              onChange={(e) => setSearchPlayer(e.target.value)}
              className="bg-transparent text-xs font-pixel text-slate-200 placeholder-slate-500 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Lista de patrones */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 font-pixel text-xs border-2 border-dashed border-arcade-border bg-arcade-bg/50">
          No complex patterns found matching current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[540px] overflow-y-auto pr-1">
          {filtered.map((item, idx) => {
            const patUpper = item.pattern.pattern.toUpperCase();
            const isDeadly = patUpper === 'DEADLY_STREAK';
            const isComeback = patUpper === 'COMEBACK';
            const rankLabel = `#${String(idx + 1).padStart(2, '0')}`;

            return (
              <div
                key={`${item.matchId}-${idx}`}
                className={`bg-arcade-bg ${
                  isDeadly
                    ? 'pixel-box-rose'
                    : isComeback
                    ? 'pixel-box-amber'
                    : 'pixel-box-cyan'
                } p-3.5 flex flex-col justify-between space-y-3 relative overflow-hidden`}
              >
                {/* Banner superior con Medalla Pixel Art */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-2.5">
                    <PatternMedalSvg
                      type={isDeadly ? 'DEADLY_STREAK' : isComeback ? 'COMEBACK' : 'OTHER'}
                    />
                    <div className="flex flex-col space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-arcade text-[9px] px-1.5 py-0.5 bg-slate-900 border border-slate-700 text-slate-300">
                          {rankLabel}
                        </span>
                        {isDeadly && (
                          <span className="flex items-center space-x-1 bg-rose-950/90 text-arcade-rose border-2 border-rose-500 px-2 py-0.5 text-[10px] font-arcade tracking-wider uppercase">
                            <PixelIcon name="flame" size={12} className="text-arcade-rose" />
                            <span>DEADLY STREAK</span>
                          </span>
                        )}
                        {isComeback && (
                          <span className="flex items-center space-x-1 bg-amber-950/90 text-arcade-amber border-2 border-amber-500 px-2 py-0.5 text-[10px] font-arcade tracking-wider uppercase">
                            <PixelIcon name="trophy" size={12} className="text-arcade-amber" />
                            <span>COMEBACK</span>
                          </span>
                        )}
                        {!isDeadly && !isComeback && (
                          <span className="flex items-center space-x-1 bg-cyan-950/90 text-arcade-cyan border-2 border-cyan-500 px-2 py-0.5 text-[10px] font-arcade tracking-wider uppercase">
                            <PixelIcon name="sparkles" size={12} className="text-arcade-cyan" />
                            <span>{item.pattern.pattern}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-pixel uppercase px-1.5 py-0.5 bg-slate-800 text-slate-300 border border-slate-700">
                          {item.gameId}
                        </span>
                        <span className="text-[10px] font-pixel text-slate-400 truncate max-w-[160px]">
                          {item.matchId}
                        </span>
                      </div>
                    </div>
                  </div>

                  {onSelectMatch && (
                    <button
                      onClick={() => onSelectMatch(item.matchId)}
                      className="pixel-btn bg-arcade-card border-arcade-cyan text-arcade-cyan px-2 py-1 text-[10px] font-arcade flex items-center space-x-1 shrink-0"
                    >
                      <PixelIcon name="eye" size={12} />
                      <span>MATCH</span>
                    </button>
                  )}
                </div>

                {/* Descripción */}
                <div className="text-xs font-pixel text-slate-200 leading-relaxed">
                  {item.pattern.description || 'Patrón detectado por motor analítico de Scala.'}
                </div>

                {/* Métricas específicas del detalle */}
                {item.pattern.details && Object.keys(item.pattern.details).length > 0 && (
                  <div className="bg-arcade-surface/80 border-2 border-arcade-border p-2 grid grid-cols-2 gap-2 text-[11px] font-pixel">
                    {Object.entries(item.pattern.details).map(([key, val]) => (
                      <div key={key} className="flex justify-between gap-2">
                        <span className="text-slate-400 capitalize truncate">{key}:</span>
                        <span className="text-slate-100 font-bold tabular-nums">{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadatos inferiores */}
                <div className="flex items-center justify-between text-[10px] font-pixel text-slate-400 border-t-2 border-slate-800 pt-2">
                  <div className="flex items-center space-x-1.5 truncate max-w-[170px]">
                    <PixelIcon name="user" size={12} className="text-slate-500" />
                    <span className="truncate">{item.pattern.playerId}</span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <PixelIcon name="clock" size={12} className="text-slate-500" />
                    <span>
                      {item.pattern.startedAt
                        ? new Date(item.pattern.startedAt).toLocaleTimeString()
                        : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
