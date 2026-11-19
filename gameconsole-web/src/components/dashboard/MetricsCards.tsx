import React from 'react';
import { GameStatsServiceStats } from '../../types/contracts';
import { PixelIcon, PixelIconName } from '../pixel/PixelIcon';

interface MetricsCardsProps {
  stats: GameStatsServiceStats | null;
  isLoading: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface MetricCardConfig {
  code: string;
  label: string;
  value: string;
  sub: string;
  icon: PixelIconName;
  boxClass: string;
  accentColor: string;
  barPercent?: number;
  barColor?: string;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ stats, isLoading }) => {
  if (!stats && isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 bg-arcade-surface pixel-box" />
        ))}
      </div>
    );
  }

  const validPercentNum =
    stats && stats.receivedEvents > 0
      ? (stats.validEvents / stats.receivedEvents) * 100
      : 100;
  const validPercent =
    stats && stats.receivedEvents > 0 ? validPercentNum.toFixed(1) : '100';

  const invalidPercentNum =
    stats && stats.receivedEvents > 0
      ? Math.min(100, (stats.invalidEvents / stats.receivedEvents) * 100)
      : 0;

  const heapPercentNum =
    stats && stats.runtime.heapSysBytes > 0
      ? Math.min(100, (stats.runtime.heapAllocBytes / stats.runtime.heapSysBytes) * 100)
      : 0;

  const scalaOkPercentNum =
    stats && stats.scalaCalls > 0
      ? Math.max(0, Math.min(100, ((stats.scalaCalls - stats.scalaErrors) / stats.scalaCalls) * 100))
      : 100;

  const cards: MetricCardConfig[] = [
    {
      code: 'HI-01',
      label: 'TOTAL EVENTS',
      value: stats ? stats.receivedEvents.toLocaleString() : '0',
      sub: `${stats ? stats.batchesDispatched : 0} batches despachados`,
      icon: 'activity',
      boxClass: 'pixel-box-emerald',
      accentColor: 'text-arcade-accent',
    },
    {
      code: 'HI-02',
      label: 'VALID / HEALTHY',
      value: stats ? stats.validEvents.toLocaleString() : '0',
      sub: `${validPercent}% tasa de validez`,
      icon: 'zap',
      boxClass: 'pixel-box-emerald',
      accentColor: 'text-emerald-400',
      barPercent: validPercentNum,
      barColor: 'text-emerald-400',
    },
    {
      code: 'ERR-03',
      label: 'INVALID / DROPPED',
      value: stats ? stats.invalidEvents.toLocaleString() : '0',
      sub: stats && stats.invalidEvents > 0 ? 'Auditar en visor' : 'Cero descartados',
      icon: 'alert',
      boxClass: stats && stats.invalidEvents > 0 ? 'pixel-box-rose' : 'pixel-box',
      accentColor: stats && stats.invalidEvents > 0 ? 'text-arcade-rose' : 'text-slate-400',
      barPercent: invalidPercentNum,
      barColor: 'text-arcade-rose',
    },
    {
      code: 'LIVE-04',
      label: 'ACTIVE MATCHES',
      value: stats ? stats.activeMatches.toString() : '0',
      sub: `${stats ? stats.matchesCompleted : 0} completadas`,
      icon: 'layers',
      boxClass: 'pixel-box-cyan',
      accentColor: 'text-arcade-cyan',
    },
    {
      code: 'SCA-05',
      label: 'SCALA CALLS / ERR',
      value: `${stats ? stats.scalaCalls : 0} / ${stats ? stats.scalaErrors : 0}`,
      sub: stats?.scalaErrors ? 'Atención a errores' : 'Pipeline síncrono OK',
      icon: 'terminal',
      boxClass: stats?.scalaErrors ? 'pixel-box-amber' : 'pixel-box',
      accentColor: stats?.scalaErrors ? 'text-arcade-amber' : 'text-slate-200',
      barPercent: scalaOkPercentNum,
      barColor: stats?.scalaErrors ? 'text-arcade-amber' : 'text-arcade-cyan',
    },
    {
      code: 'GO-06',
      label: 'GO GOROUTINES',
      value: stats ? stats.runtime.goroutines.toString() : '0',
      sub: 'Hilos ligeros en Go',
      icon: 'cpu',
      boxClass: 'pixel-box-cyan',
      accentColor: 'text-arcade-cyan',
    },
    {
      code: 'MEM-07',
      label: 'HEAP ALLOCATED',
      value: stats ? formatBytes(stats.runtime.heapAllocBytes) : '0 B',
      sub: `Sys: ${stats ? formatBytes(stats.runtime.heapSysBytes) : '0 B'} | GC: ${stats?.runtime.numGC ?? 0}`,
      icon: 'monitor',
      boxClass: 'pixel-box',
      accentColor: 'text-slate-100',
      barPercent: heapPercentNum,
      barColor: 'text-arcade-amber',
    },
    {
      code: 'SYS-08',
      label: 'SYSTEM UPTIME',
      value: stats ? stats.uptime : '0s',
      sub: 'Servicio Go Ingestion',
      icon: 'clock',
      boxClass: 'pixel-box',
      accentColor: 'text-arcade-accent',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((c, idx) => (
        <div
          key={idx}
          className={`bg-arcade-surface ${c.boxClass} p-4 flex flex-col justify-between transition-transform hover:-translate-y-0.5`}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[9px] font-arcade px-1.5 py-0.5 bg-arcade-bg border border-arcade-border text-slate-400 shrink-0">
                {c.code}
              </span>
              <span className="text-[11px] font-pixel tracking-wider font-bold text-slate-300 truncate">
                {c.label}
              </span>
            </div>
            <PixelIcon name={c.icon} size={16} className={c.accentColor} />
          </div>

          <div>
            <div className={`text-lg sm:text-xl font-arcade ${c.accentColor} tabular-nums leading-tight`}>
              {c.value}
            </div>

            {typeof c.barPercent === 'number' && (
              <div className="pixel-progress-track h-2.5 w-full mt-2">
                <div
                  className={`pixel-progress-fill ${c.barColor ?? 'text-arcade-accent'}`}
                  style={{ width: `${Math.max(0, Math.min(100, c.barPercent))}%` }}
                />
              </div>
            )}

            <div className="text-[11px] font-pixel text-slate-400 mt-1.5 truncate">
              {c.sub}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
