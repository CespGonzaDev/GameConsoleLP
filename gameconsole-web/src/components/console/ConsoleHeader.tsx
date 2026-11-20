import React, { useEffect, useState } from 'react';
import { PixelIcon } from '../pixel/PixelIcon';
import { eventDispatcher, DispatcherStatus } from '../../services/EventDispatcher';
import { useServiceHealth } from '../../services/useServiceHealth';

export type NavigationTab = 'lobby' | 'dock' | 'telemetry';

interface ConsoleHeaderProps {
  currentTab: NavigationTab;
  onTabChange: (tab: NavigationTab) => void;
  activeCount: number;
  scanlineActive: boolean;
  onToggleScanline: () => void;
}

export const ConsoleHeader: React.FC<ConsoleHeaderProps> = ({
  currentTab,
  onTabChange,
  activeCount,
  scanlineActive,
  onToggleScanline
}) => {
  const [txStatus, setTxStatus] = useState<DispatcherStatus>(() => eventDispatcher.getStatus());
  const health = useServiceHealth(10000);

  useEffect(() => {
    const unsubscribe = eventDispatcher.subscribe((status) => {
      setTxStatus(status);
    });
    return unsubscribe;
  }, []);

  // Pixelated LED state: green pulse when sending, amber when pending, rose on errors, emerald steady when ready
  const ledState = txStatus.isSending
    ? {
        bg: 'bg-emerald-500',
        border: 'border-[#0f172a]',
        glow: 'shadow-[0_0_0_2px_rgba(16,185,129,0.35)]',
        pulse: 'animate-ping',
        label: 'TX SENDING',
        text: 'text-emerald-700'
      }
    : txStatus.pendingCount > 0
    ? {
        bg: 'bg-amber-400',
        border: 'border-[#0f172a]',
        glow: 'shadow-[0_0_0_2px_rgba(245,158,11,0.35)]',
        pulse: 'animate-pulse',
        label: `QUEUE:${txStatus.pendingCount}`,
        text: 'text-amber-700'
      }
    : txStatus.consecutiveErrors > 0
    ? {
        bg: 'bg-rose-500',
        border: 'border-[#0f172a]',
        glow: 'shadow-[0_0_0_2px_rgba(244,63,94,0.35)]',
        pulse: 'animate-pulse',
        label: 'TX RETRY',
        text: 'text-rose-700'
      }
    : {
        bg: 'bg-emerald-500',
        border: 'border-[#0f172a]',
        glow: '',
        pulse: '',
        label: 'GAMESTATS LINK',
        text: 'text-emerald-800'
      };

  return (
    <header className="bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] border-t-4 border-t-[#facc15] border-b-4 border-b-[#0f172a] shadow-[0_4px_0_0_#0f172a] sticky top-0 z-40 select-none">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Cheerful 16-Bit Console Brand & Pixel Telemetry LED */}
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-[#1e3a8a] text-[#facc15] flex items-center justify-center border-[3px] border-[#facc15] shadow-[3px_3px_0_0_#0f172a]">
            <PixelIcon name="gamepad" size={24} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-arcade text-xs sm:text-sm text-white tracking-wider [text-shadow:2px_2px_0_#0f172a]">
                GAME CONSOLE
              </span>
              <span className="text-[9px] font-arcade px-1.5 py-0.5 bg-[#facc15] text-[#0f172a] border-2 border-[#0f172a] shadow-[2px_2px_0_0_#0f172a]">
                16-BIT
              </span>
            </div>

            <div className="flex items-center space-x-2 text-[10px] font-pixel mt-1">
              {/* Pixelated LED */}
              <span className="inline-flex items-center space-x-1.5 bg-[#fffbeb] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 shadow-[2px_2px_0_0_#0f172a]">
                <span className="relative inline-flex w-2.5 h-2.5">
                  {ledState.pulse && (
                    <span
                      className={`absolute inset-0 ${ledState.bg} ${ledState.pulse} opacity-75`}
                    />
                  )}
                  <span
                    className={`relative inline-block w-2.5 h-2.5 ${ledState.bg} border ${ledState.border} ${ledState.glow}`}
                  />
                </span>
                <span className={`${ledState.text} font-bold tracking-wide`}>
                  {ledState.label}
                </span>
                {txStatus.totalSent > 0 && (
                  <span className="text-slate-700 border-l-2 border-[#0f172a]/20 pl-1.5 font-bold">
                    TX:{txStatus.totalSent}
                  </span>
                )}
              </span>

              <span
                title={health.prologEngine ? `Engine: ${health.prologEngine}` : 'Prolog AI service'}
                className="hidden md:inline-flex items-center space-x-1 bg-[#e0f2fe] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 shadow-[2px_2px_0_0_#0f172a] font-bold"
              >
                <PixelIcon name="cpu" size={11} className="text-[#0284c7]" />
                <span>PROLOG AI</span>
                <span
                  className={`inline-block w-2 h-2 border border-[#0f172a] ${
                    health.prolog === 'online'
                      ? 'bg-emerald-500'
                      : health.prolog === 'offline'
                      ? 'bg-rose-500'
                      : 'bg-amber-400 animate-pulse'
                  }`}
                />
                <span className="text-[9px]">
                  {health.prolog === 'online' ? 'ON' : health.prolog === 'offline' ? 'OFF (local)' : '...'}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Handheld Console Cartridge/Mode Tabs */}
        <nav className="flex items-center space-x-1.5 sm:space-x-2">
          <button
            onClick={() => onTabChange('lobby')}
            className={`px-3 py-2 text-[10px] sm:text-xs font-arcade uppercase flex items-center space-x-2 border-[#0f172a] pixel-btn ${
              currentTab === 'lobby'
                ? 'bg-[#facc15] text-[#0f172a]'
                : 'bg-[#fffbeb] text-[#0f172a] hover:bg-[#fef3c7]'
            }`}
          >
            <PixelIcon
              name="gamepad"
              size={14}
              className={currentTab === 'lobby' ? 'text-[#1d4ed8]' : 'text-[#059669]'}
            />
            <span className="hidden sm:inline">LOBBY</span>
          </button>

          <button
            onClick={() => onTabChange('dock')}
            className={`px-3 py-2 text-[10px] sm:text-xs font-arcade uppercase flex items-center space-x-2 border-[#0f172a] pixel-btn ${
              currentTab === 'dock'
                ? 'bg-[#facc15] text-[#0f172a]'
                : 'bg-[#fffbeb] text-[#0f172a] hover:bg-[#fef3c7]'
            }`}
          >
            <PixelIcon name="layers" size={14} className="text-[#0284c7]" />
            <span className="hidden sm:inline">DOCK</span>
            {activeCount > 0 && (
              <span
                className={`px-1.5 py-0.5 text-[9px] font-arcade border border-[#0f172a] ${
                  currentTab === 'dock'
                    ? 'bg-[#0f172a] text-[#facc15]'
                    : 'bg-[#22c55e] text-[#0f172a]'
                }`}
              >
                {activeCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange('telemetry')}
            className={`px-3 py-2 text-[10px] sm:text-xs font-arcade uppercase flex items-center space-x-2 border-[#0f172a] pixel-btn ${
              currentTab === 'telemetry'
                ? 'bg-[#facc15] text-[#0f172a]'
                : 'bg-[#fffbeb] text-[#0f172a] hover:bg-[#fef3c7]'
            }`}
          >
            <PixelIcon name="activity" size={14} className="text-[#ea580c]" />
            <span className="hidden sm:inline">STATS</span>
          </button>
        </nav>

        {/* Console CRT FX Switch */}
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleScanline}
            title={scanlineActive ? 'Disable CRT Scanlines' : 'Enable CRT Scanlines'}
            className={`px-2.5 py-2 text-[10px] font-arcade flex items-center space-x-1.5 border-[#0f172a] pixel-btn ${
              scanlineActive
                ? 'bg-[#facc15] text-[#0f172a]'
                : 'bg-[#fffbeb] text-[#0f172a] hover:bg-[#fef3c7]'
            }`}
          >
            <PixelIcon
              name="monitor"
              size={14}
              className={scanlineActive ? 'text-[#1d4ed8]' : 'text-[#475569]'}
            />
            <span className="hidden md:inline">CRT:{scanlineActive ? 'ON' : 'OFF'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
