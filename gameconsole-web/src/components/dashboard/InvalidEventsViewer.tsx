import React, { useState } from 'react';
import { InvalidEventRecord } from '../../types/contracts';
import { PixelIcon } from '../pixel/PixelIcon';

interface InvalidEventsViewerProps {
  invalidEvents: InvalidEventRecord[];
  isLoading: boolean;
  onRefresh?: () => void;
}

export const InvalidEventsViewer: React.FC<InvalidEventsViewerProps> = ({
  invalidEvents,
  isLoading,
  onRefresh,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<InvalidEventRecord | null>(null);
  const [copied, setCopied] = useState(false);

  const filtered = invalidEvents.filter((item) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return item.reason.toLowerCase().includes(q) || item.raw.toLowerCase().includes(q);
  });

  const handleCopyRaw = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-arcade-surface pixel-box-rose p-4 flex flex-col space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-arcade-border pb-3">
        <div className="flex items-center space-x-2.5">
          <PixelIcon name="alert" size={20} className="text-arcade-rose" />
          <div>
            <h3 className="font-arcade text-xs sm:text-sm text-slate-100 tracking-wider">
              INVALID EVENTS AUDIT LOG ({invalidEvents.length})
            </h3>
            <p className="text-[11px] font-pixel text-slate-400">
              Eventos rechazados por el pipeline de Go (DisallowUnknownFields o Schema inválido)
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center space-x-1.5 bg-arcade-bg border-2 border-arcade-border px-2.5 py-1 focus-within:border-arcade-cyan">
            <PixelIcon name="search" size={14} className="text-slate-400" />
            <input
              type="text"
              placeholder="Filter by reason or content..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-transparent text-xs font-pixel text-slate-200 placeholder-slate-500 focus:outline-none w-48 sm:w-64"
            />
          </div>

          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="pixel-btn px-3 py-1 bg-arcade-card border-arcade-cyan text-xs font-arcade text-arcade-cyan flex items-center space-x-1.5 disabled:opacity-50"
            >
              <PixelIcon
                name="refresh"
                size={14}
                className={isLoading ? 'animate-spin' : ''}
              />
              <span>RELOAD</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Layout */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 font-pixel text-xs border-2 border-dashed border-arcade-border bg-arcade-bg/50">
          {invalidEvents.length === 0
            ? 'Excelente: No hay eventos descartados. Todos los eventos han sido 100% compatibles.'
            : 'No hay eventos que coincidan con la búsqueda.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Table / List */}
          <div className="pixel-box overflow-y-auto max-h-[460px] bg-arcade-bg divide-y-2 divide-slate-800">
            {filtered.map((item, idx) => {
              const isSelected = selectedEvent === item;
              return (
                <div
                  key={idx}
                  onClick={() => setSelectedEvent(item)}
                  className={`p-3 cursor-pointer transition-colors text-left font-pixel ${
                    isSelected
                      ? 'bg-rose-950/40 border-l-4 border-l-arcade-rose'
                      : 'hover:bg-arcade-card/50'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-arcade text-[9px] px-1.5 py-0.5 bg-rose-950 border border-rose-600 text-arcade-rose uppercase">
                        RECHAZADO
                      </span>
                      <span className="text-slate-500">#{String(idx + 1).padStart(2, '0')}</span>
                    </div>
                    <span>
                      {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A'}
                    </span>
                  </div>
                  <div className="text-xs text-rose-300 font-bold mb-1 line-clamp-2">
                    {item.reason}
                  </div>
                  <div className="text-[11px] text-slate-500 font-pixel truncate">
                    {item.raw}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raw Event Detail Inspector */}
          <div className="pixel-box bg-arcade-bg p-3 flex flex-col justify-between font-pixel">
            {selectedEvent ? (
              <div className="flex flex-col h-full space-y-3">
                <div className="flex items-center justify-between border-b-2 border-arcade-border pb-2">
                  <div className="flex items-center space-x-2 text-xs text-slate-200">
                    <PixelIcon name="terminal" size={16} className="text-arcade-cyan" />
                    <span className="font-arcade text-[11px]">PAYLOAD AUDIT DETAIL</span>
                  </div>
                  <button
                    onClick={() => handleCopyRaw(selectedEvent.raw)}
                    className="pixel-btn flex items-center space-x-1.5 text-[10px] font-arcade text-slate-200 border-arcade-border hover:border-arcade-cyan hover:text-arcade-cyan px-2.5 py-1 bg-arcade-card"
                  >
                    {copied ? (
                      <>
                        <PixelIcon name="check" size={12} className="text-arcade-accent" />
                        <span className="text-arcade-accent">COPIED!</span>
                      </>
                    ) : (
                      <>
                        <PixelIcon name="copy" size={12} />
                        <span>COPY RAW</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-rose-950/30 pixel-box-rose p-2.5">
                  <div className="text-[10px] font-arcade text-rose-400 uppercase tracking-wider mb-1">
                    Razón de descarte:
                  </div>
                  <div className="text-xs text-rose-200 font-bold">
                    {selectedEvent.reason}
                  </div>
                </div>

                <div className="flex-1 min-h-[220px]">
                  <div className="text-[10px] font-arcade text-slate-400 uppercase tracking-wider mb-1.5">
                    Raw JSON String:
                  </div>
                  <pre className="bg-black/85 border-2 border-slate-800 p-3 text-[11px] font-pixel text-emerald-400 overflow-x-auto whitespace-pre-wrap break-all max-h-[280px]">
                    {formatRawJson(selectedEvent.raw)}
                  </pre>
                </div>

                <div className="text-[10px] text-slate-500 border-t-2 border-slate-800 pt-2 flex justify-between">
                  <span>Timestamp: {selectedEvent.timestamp}</span>
                  <span>Longitud: {selectedEvent.raw.length} bytes</span>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center text-slate-500 text-xs space-y-2">
                <PixelIcon name="terminal" size={32} className="text-slate-600" />
                <span>Selecciona un evento de la lista izquierda para inspeccionar su payload exacto.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatRawJson(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
}
