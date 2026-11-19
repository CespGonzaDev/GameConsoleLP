import React, { useState } from 'react';
import { ActiveSession, GameSessionManager } from '../../core/GameSessionManager';
import { GameInstanceView } from './GameInstanceView';
import { PixelIcon } from '../pixel/PixelIcon';

interface MultiInstanceDockProps {
  sessions: ActiveSession[];
  onCloseSession: (matchId: string) => void;
  onRestartSession?: (session: ActiveSession) => ActiveSession;
  onOpenLobby: () => void;
  scanlineActive?: boolean;
}

type DockLayout = 'auto' | 'split' | 'grid' | 'single';

export const MultiInstanceDock: React.FC<MultiInstanceDockProps> = ({
  sessions,
  onCloseSession,
  onRestartSession,
  onOpenLobby,
  scanlineActive = false
}) => {
  const [layout, setLayout] = useState<DockLayout>('auto');
  const [activeFocusedId, setActiveFocusedId] = useState<string | null>(
    sessions.length > 0 ? sessions[0].matchId : null
  );

  const activeSessions = sessions.filter((s) => s.status !== 'ABORTED');

  const handlePauseAll = () => {
    activeSessions.forEach((s) => {
      GameSessionManager.getInstance().pauseSession(s.matchId);
    });
  };

  const handleResumeAll = () => {
    activeSessions.forEach((s) => {
      GameSessionManager.getInstance().resumeSession(s.matchId);
    });
  };

  const handleTerminateAll = () => {
    if (window.confirm('¿Deseas cerrar todas las partidas activas?')) {
      GameSessionManager.getInstance().terminateAll();
    }
  };

  const handleRestart = (session: ActiveSession) => {
    if (onRestartSession) {
      const nextSession = onRestartSession(session);
      if (activeFocusedId === session.matchId) {
        setActiveFocusedId(nextSession.matchId);
      }
      return;
    }
    const manager = GameSessionManager.getInstance();
    const { gameId, playerId, mode, matchId } = session;
    manager.terminateSession(matchId, 'USER_RESTART');
    const nextSession = manager.createSession(gameId, playerId, mode);
    if (activeFocusedId === matchId) {
      setActiveFocusedId(nextSession.matchId);
    }
  };

  if (activeSessions.length === 0) {
    return (
      <div className="bg-[#131b2e] pixel-box p-10 text-center max-w-2xl mx-auto my-12">
        <div className="w-16 h-16 bg-[#0b0f19] border-[3px] border-slate-600 text-slate-400 mx-auto flex items-center justify-center shadow-[3px_3px_0_0_#020617] mb-5">
          <PixelIcon name="gamepad" size={32} />
        </div>
        <h2 className="font-arcade text-base sm:text-lg text-white uppercase tracking-wider">
          NO SESSIONS IN DOCK
        </h2>
        <p className="mt-3 text-xs sm:text-sm font-pixel text-slate-400 leading-relaxed">
          No hay instancias activas en ejecución. Inicia una o varias partidas simultáneas desde el Arcade Lobby.
        </p>
        <button
          onClick={onOpenLobby}
          className="mt-6 px-6 py-3 bg-emerald-500 text-black font-arcade text-[11px] uppercase border-emerald-200 pixel-btn inline-flex items-center space-x-2"
        >
          <PixelIcon name="play" size={14} />
          <span>IR AL ARCADE LOBBY</span>
        </button>
      </div>
    );
  }

  // Determine dynamic grid classes based on layout and session count
  const getGridClasses = () => {
    if (layout === 'single') {
      return 'grid grid-cols-1';
    }
    if (layout === 'split') {
      return 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    }
    if (layout === 'grid') {
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
    }

    // Auto layout
    if (activeSessions.length === 1) return 'grid grid-cols-1';
    if (activeSessions.length === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-4';
    return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4';
  };

  return (
    <div className="space-y-4 pb-12">
      {/* Handheld Multi-Slot Dock Control Bar */}
      <div className="bg-[#131b2e] pixel-box-cyan p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <PixelIcon name="layers" size={16} className="text-cyan-400" />
            <span className="font-arcade text-[11px] sm:text-xs text-cyan-400 uppercase">
              MULTI-DOCK
            </span>
            <span className="bg-[#0b0f19] text-cyan-300 border-2 border-cyan-500 px-2 py-0.5 text-[10px] font-arcade">
              {activeSessions.length} {activeSessions.length === 1 ? 'SLOT' : 'SLOTS'}
            </span>
          </div>

          <div className="hidden lg:flex items-center text-[11px] font-pixel text-slate-400 border-l-2 border-slate-700 pl-3">
            <span>AISLAMIENTO ESTRICTO: <strong className="text-emerald-400">MATCH-ID ÚNICO</strong></span>
          </div>
        </div>

        {/* Global instance actions and layout buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout switchers */}
          <div className="bg-[#0b0f19] border-2 border-slate-700 p-0.5 flex space-x-1">
            <button
              onClick={() => setLayout('single')}
              title="1-UP Solo Foco"
              className={`px-2 py-1 text-[10px] font-arcade flex items-center space-x-1 ${
                layout === 'single' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PixelIcon name="maximize" size={12} />
              <span className="hidden xl:inline">1P</span>
            </button>
            <button
              onClick={() => setLayout('split')}
              title="Split 50/50"
              className={`px-2 py-1 text-[10px] font-arcade flex items-center space-x-1 ${
                layout === 'split' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PixelIcon name="layers" size={12} />
              <span className="hidden xl:inline">2P</span>
            </button>
            <button
              onClick={() => setLayout('grid')}
              title="Multi-Grid"
              className={`px-2 py-1 text-[10px] font-arcade flex items-center space-x-1 ${
                layout === 'grid' ? 'bg-cyan-500 text-black' : 'text-slate-400 hover:text-white'
              }`}
            >
              <PixelIcon name="monitor" size={12} />
              <span className="hidden xl:inline">GRID</span>
            </button>
          </div>

          <button
            onClick={handlePauseAll}
            title="Pausar todas las instancias"
            className="px-2.5 py-1.5 bg-[#0b0f19] hover:bg-slate-800 text-amber-300 text-[10px] font-arcade border-slate-600 flex items-center space-x-1.5 pixel-btn"
          >
            <PixelIcon name="pause" size={12} />
            <span className="hidden md:inline">PAUSAR</span>
          </button>

          <button
            onClick={handleResumeAll}
            title="Reanudar todas las instancias"
            className="px-2.5 py-1.5 bg-[#0b0f19] hover:bg-slate-800 text-emerald-300 text-[10px] font-arcade border-slate-600 flex items-center space-x-1.5 pixel-btn"
          >
            <PixelIcon name="play" size={12} />
            <span className="hidden md:inline">REANUDAR</span>
          </button>

          <button
            onClick={onOpenLobby}
            className="px-2.5 py-1.5 bg-emerald-500 text-black text-[10px] font-arcade border-emerald-200 flex items-center space-x-1.5 pixel-btn"
          >
            <PixelIcon name="gamepad" size={12} />
            <span className="hidden sm:inline">NUEVA</span>
          </button>

          <button
            onClick={handleTerminateAll}
            title="Terminar todas las instancias"
            className="p-1.5 bg-rose-950 hover:bg-rose-800 text-rose-200 border-rose-600 pixel-btn"
          >
            <PixelIcon name="close" size={13} />
          </button>
        </div>
      </div>

      {/* Handheld Cartridge Slot Strip (Quick Switcher) */}
      {activeSessions.length > 1 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          {activeSessions.map((s) => {
            const isFocused =
              layout === 'single' &&
              (s.matchId === activeFocusedId ||
                (!activeSessions.some((item) => item.matchId === activeFocusedId) &&
                  s.matchId === activeSessions[0].matchId));
            return (
              <button
                key={s.matchId}
                onClick={() => {
                  setActiveFocusedId(s.matchId);
                  setLayout('single');
                }}
                className={`px-3 py-1.5 text-[10px] font-pixel flex items-center space-x-2 shrink-0 pixel-btn ${
                  isFocused
                    ? 'bg-cyan-500 text-black font-bold border-cyan-200'
                    : 'bg-[#131b2e] text-slate-300 border-slate-700 hover:border-cyan-500/70'
                }`}
              >
                <span className="font-arcade text-[9px] uppercase">{s.gameId}</span>
                <span className="opacity-80">#{s.matchId.substring(0, 6)}</span>
                <span
                  className={`w-2 h-2 inline-block ${
                    s.status === 'PLAYING'
                      ? 'bg-emerald-400'
                      : s.status === 'PAUSED'
                      ? 'bg-amber-400'
                      : 'bg-rose-400'
                  }`}
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Dock Viewport Grid */}
      <div className={getGridClasses()}>
        {layout === 'single' ? (
          <div>
            {(() => {
              const focusedSession =
                activeSessions.find((s) => s.matchId === activeFocusedId) || activeSessions[0];
              return (
                <div className="h-[600px]">
                  <GameInstanceView
                    session={focusedSession}
                    onClose={onCloseSession}
                    onRestart={handleRestart}
                    scanlineActive={scanlineActive}
                  />
                </div>
              );
            })()}
          </div>
        ) : (
          activeSessions.map((session) => (
            <div key={session.matchId} className="h-[460px]">
              <GameInstanceView
                session={session}
                onClose={onCloseSession}
                onRestart={handleRestart}
                onMaximize={(mId) => {
                  setActiveFocusedId(mId);
                  setLayout('single');
                }}
                scanlineActive={scanlineActive}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
