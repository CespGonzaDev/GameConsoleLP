import React, { useState, useEffect } from 'react';
import { GameId } from './types/contracts';
import { ActiveSession, GameSessionManager } from './core/GameSessionManager';
import { ConsoleHeader, NavigationTab } from './components/console/ConsoleHeader';
import { ArcadeLobby } from './components/console/ArcadeLobby';
import { MultiInstanceDock } from './components/console/MultiInstanceDock';
import { GameViewModal } from './components/console/GameViewModal';
import { GameInstanceView } from './components/console/GameInstanceView';
import { GameStatsDashboard } from './components/dashboard/GameStatsDashboard';
import { PixelIcon } from './components/pixel/PixelIcon';

export const App: React.FC = () => {
  const [currentTab, setCurrentTab] = useState<NavigationTab>('lobby');
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [modalSession, setModalSession] = useState<ActiveSession | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [scanlineActive, setScanlineActive] = useState<boolean>(false);

  // Standalone play mode (?tab=play&game=...&matchId=...)
  const [standaloneSession, setStandaloneSession] = useState<ActiveSession | null>(null);
  const [isStandaloneMode, setIsStandaloneMode] = useState<boolean>(false);

  // 1. Detect URL standalone mode on load
  useEffect(() => {
    const urlParams = GameSessionManager.parseUrlParams();
    if (urlParams.isStandalonePlay && urlParams.game) {
      setIsStandaloneMode(true);
      const manager = GameSessionManager.getInstance();
      const existing = urlParams.matchId ? manager.getSession(urlParams.matchId) : undefined;

      if (existing) {
        setStandaloneSession(existing);
      } else {
        const newSession = manager.createSession(
          urlParams.game,
          urlParams.player || 'Player1',
          urlParams.mode || 'SOLO',
          {
            existingMatchId: urlParams.matchId,
            player2Id: urlParams.player2
          }
        );
        setStandaloneSession(newSession);
      }
    }
  }, []);

  // 2. Subscribe to session changes
  useEffect(() => {
    const manager = GameSessionManager.getInstance();
    const unsubscribe = manager.subscribe((updatedSessions) => {
      setSessions([...updatedSessions]);
    });
    return unsubscribe;
  }, []);

  // Launch handler from Lobby
  const handleLaunchGame = (
    gameId: GameId,
    mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO',
    playerName: string,
    player2Name?: string
  ) => {
    const manager = GameSessionManager.getInstance();
    const session = manager.createSession(gameId, playerName, mode, {
      player2Id: player2Name
    });

    // Abrir en modal enfocado para inmersión arcade inmediata
    setModalSession(session);
    setIsModalOpen(true);
  };

  const handleCloseSession = (matchId: string) => {
    GameSessionManager.getInstance().terminateSession(matchId);
    if (modalSession && modalSession.matchId === matchId) {
      setIsModalOpen(false);
      setModalSession(null);
    }
  };

  const handleRestartSession = (session: ActiveSession): ActiveSession => {
    const manager = GameSessionManager.getInstance();
    const { gameId, playerId, player2Id, mode, matchId } = session;
    manager.terminateSession(matchId, 'USER_RESTART');
    const newSession = manager.createSession(
      gameId,
      playerId,
      mode,
      player2Id ? { player2Id } : undefined
    );
    if (modalSession?.matchId === matchId) {
      setModalSession(newSession);
    }
    if (standaloneSession?.matchId === matchId) {
      setStandaloneSession(newSession);
    }
    return newSession;
  };

  // --- Render Standalone Window Mode ---
  if (isStandaloneMode && standaloneSession) {
    return (
      <main
        className={`w-screen h-screen bg-[#e0f2fe] text-[#0f172a] flex flex-col overflow-hidden arcade-grid-bg ${
          scanlineActive ? 'scanline' : ''
        }`}
      >
        <header className="bg-gradient-to-b from-[#2563eb] to-[#1d4ed8] border-t-4 border-t-[#facc15] border-b-4 border-b-[#0f172a] px-4 py-2 flex items-center justify-between text-xs font-pixel select-none">
          <div className="flex items-center space-x-2.5">
            <span className="relative inline-flex w-2.5 h-2.5">
              <span className="absolute inset-0 bg-[#facc15] animate-ping opacity-75" />
              <span className="relative inline-block w-2.5 h-2.5 bg-[#facc15] border border-[#0f172a]" />
            </span>
            <PixelIcon name="gamepad" size={16} className="text-[#facc15]" />
            <span className="font-arcade text-[10px] sm:text-xs text-white [text-shadow:2px_2px_0_#0f172a]">
              STANDALONE ARCADE WINDOW
            </span>
            <span className="text-[#0f172a] text-[10px] font-bold bg-[#facc15] border-2 border-[#0f172a] px-1.5 py-0.5">
              [{standaloneSession.gameId.toUpperCase()}]
            </span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setScanlineActive(!scanlineActive)}
              className={`px-2 py-1 text-[9px] font-arcade border-[#0f172a] pixel-btn ${
                scanlineActive
                  ? 'bg-[#facc15] text-[#0f172a]'
                  : 'bg-[#fffbeb] text-[#0f172a] hover:bg-[#fef3c7]'
              }`}
            >
              CRT:{scanlineActive ? 'ON' : 'OFF'}
            </button>
            <div className="text-[11px] bg-[#fffbeb] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 font-pixel">
              MATCH: <strong className="text-[#1d4ed8]">#{standaloneSession.matchId.substring(0, 8)}</strong>
            </div>
          </div>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden p-2">
          <GameInstanceView
            session={standaloneSession}
            onClose={() => window.close()}
            onRestart={handleRestartSession}
            scanlineActive={scanlineActive}
          />
        </div>
      </main>
    );
  }

  // --- Render Console Standard App ---
  return (
    <div
      className={`min-h-screen bg-[#e0f2fe] text-[#0f172a] flex flex-col arcade-grid-bg ${
        scanlineActive ? 'scanline' : ''
      }`}
    >
      {/* Header */}
      <ConsoleHeader
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        activeCount={sessions.length}
        scanlineActive={scanlineActive}
        onToggleScanline={() => setScanlineActive(!scanlineActive)}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentTab === 'lobby' && (
          <ArcadeLobby onLaunchGame={handleLaunchGame} activeSessions={sessions} />
        )}

        {currentTab === 'dock' && (
          <MultiInstanceDock
            sessions={sessions}
            onCloseSession={handleCloseSession}
            onRestartSession={handleRestartSession}
            onOpenLobby={() => setCurrentTab('lobby')}
            scanlineActive={scanlineActive}
          />
        )}

        {currentTab === 'telemetry' && (
          <div className="space-y-4">
            <GameStatsDashboard />
          </div>
        )}
      </main>

      {/* Arcade Cabinet Modal View */}
      <GameViewModal
        session={modalSession}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          // Si quedan sesiones activas, sugerir ir al Dock
          if (sessions.length > 0) {
            setCurrentTab('dock');
          }
        }}
        onRestart={handleRestartSession}
        scanlineActive={scanlineActive}
      />

      {/* Cheerful 16-Bit Console Bottom Bar */}
      <footer className="bg-[#1d4ed8] border-t-4 border-[#0f172a] text-[11px] font-pixel text-[#eff6ff] py-3 mt-auto select-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-arcade text-[10px] text-[#facc15] [text-shadow:1px_1px_0_#0f172a]">
              GAME CONSOLE ARCADE
            </span>
            <span className="text-[#93c5fd]">•</span>
            <span className="text-white font-bold">REACT 19 + TYPESCRIPT + TAILWIND</span>
            <span className="text-[#93c5fd]">•</span>
            <span className="text-[#fde047] font-bold">PROLOG SWI AI</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="inline-flex items-center bg-[#fffbeb] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 font-bold shadow-[2px_2px_0_0_#0f172a]">
              <span className="w-2 h-2 bg-[#10b981] border border-[#0f172a] mr-1.5 inline-block" />
              INGESTOR: localhost:8080
            </span>
            <span className="inline-flex items-center bg-[#fffbeb] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 font-bold shadow-[2px_2px_0_0_#0f172a]">
              <span className="w-2 h-2 bg-[#0284c7] border border-[#0f172a] mr-1.5 inline-block" />
              AI SERVICE: localhost:5000
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
