import React, { useEffect, useRef, useState } from 'react';
import { ActiveSession, GameSessionManager } from '../../core/GameSessionManager';
import { BattleshipGame } from '../../games/BattleshipGame';
import { BattleshipBoard } from '../../games/BattleshipBoard';
import { PixelIcon } from '../pixel/PixelIcon';
import { eventDispatcher, DispatcherStatus } from '../../services/EventDispatcher';

interface GameInstanceViewProps {
  session: ActiveSession;
  onClose: (matchId: string) => void;
  onRestart?: (session: ActiveSession) => void;
  onMaximize?: (matchId: string) => void;
  isMaximized?: boolean;
  scanlineActive?: boolean;
}

export const GameInstanceView: React.FC<GameInstanceViewProps> = ({
  session,
  onClose,
  onRestart,
  onMaximize,
  scanlineActive = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [status, setStatus] = useState(session.status);
  const [txStatus, setTxStatus] = useState<DispatcherStatus>(() => eventDispatcher.getStatus());

  // Subscribe to EventDispatcher for live GameStats LED
  useEffect(() => {
    const unsubscribe = eventDispatcher.subscribe((nextStatus) => {
      setTxStatus(nextStatus);
    });
    return unsubscribe;
  }, []);

  // Gameloop animation frame for canvas-based games
  useEffect(() => {
    if (session.gameId === 'battleship') return;

    let animId: number;
    let lastTime = performance.now();

    const loop = (currentTime: number) => {
      const dt = Math.min((currentTime - lastTime) / 1000, 0.1); // cap dt
      lastTime = currentTime;

      // Update game
      if (session.gameInstance.getStatus() === 'PLAYING') {
        session.gameInstance.update(dt);
        setScore(session.gameInstance.getScore());
      }

      // Render game to canvas or container
      const target = canvasRef.current || containerRef.current;
      if (target) {
        session.gameInstance.render(target);
      }

      setStatus(session.gameInstance.getStatus());
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [session]);

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(session.gameInstance.getDurationSeconds());
      if (session.gameId === 'battleship') {
        setStatus(session.gameInstance.getStatus());
        setScore(session.gameInstance.getScore());
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  const handleCopyMatchId = () => {
    navigator.clipboard.writeText(session.matchId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTogglePause = () => {
    if (status === 'PLAYING') {
      GameSessionManager.getInstance().pauseSession(session.matchId);
      setStatus('PAUSED');
    } else if (status === 'PAUSED') {
      GameSessionManager.getInstance().resumeSession(session.matchId);
      setStatus('PLAYING');
    }
  };

  const handleRestartMatch = () => {
    if (onRestart) {
      onRestart(session);
      return;
    }
    const manager = GameSessionManager.getInstance();
    const { gameId, playerId, player2Id, mode, matchId } = session;
    manager.terminateSession(matchId, 'USER_RESTART');
    manager.createSession(
      gameId,
      playerId,
      mode,
      player2Id ? { player2Id } : undefined
    );
  };

  const handleOpenStandalone = () => {
    // Pass undefined matchId so the new browser tab generates its own independent matchId
    GameSessionManager.openInNewTab(
      session.gameId,
      undefined,
      session.mode,
      session.playerId,
      session.player2Id
    );
  };

  const getPixelBoxClass = () => {
    switch (session.gameId) {
      case 'snake':
        return 'pixel-box-emerald';
      case 'battleship':
        return 'pixel-box-cyan';
      case 'head_football':
        return 'pixel-box-amber';
      default:
        return 'pixel-box';
    }
  };

  const getBadgeColor = () => {
    switch (session.gameId) {
      case 'snake':
        return 'bg-emerald-500 text-black border-emerald-200';
      case 'battleship':
        return 'bg-cyan-500 text-black border-cyan-200';
      case 'head_football':
        return 'bg-amber-500 text-black border-amber-200';
      default:
        return 'bg-slate-700 text-white border-slate-500';
    }
  };

  const isBattleship =
    session.gameId === 'battleship' && session.gameInstance instanceof BattleshipGame;

  const shortMatchId = session.matchId.substring(0, 8);

  // Pixelated LED state for GameStats transmission
  const ledConfig = txStatus.isSending
    ? {
        bg: 'bg-emerald-400',
        border: 'border-emerald-200',
        pulse: 'animate-ping',
        text: 'text-emerald-300',
        label: 'TX:SENDING'
      }
    : txStatus.pendingCount > 0
    ? {
        bg: 'bg-amber-400',
        border: 'border-amber-200',
        pulse: 'animate-pulse',
        text: 'text-amber-300',
        label: `TX:PENDING(${txStatus.pendingCount})`
      }
    : txStatus.consecutiveErrors > 0
    ? {
        bg: 'bg-rose-500',
        border: 'border-rose-300',
        pulse: 'animate-pulse',
        text: 'text-rose-300',
        label: 'TX:RETRY'
      }
    : {
        bg: 'bg-emerald-500',
        border: 'border-emerald-300',
        pulse: '',
        text: 'text-emerald-400',
        label: `TX:SYNC(${txStatus.totalSent})`
      };

  return (
    <div
      className={`bg-[#0b0f19] ${getPixelBoxClass()} flex flex-col h-full min-h-0 overflow-hidden relative select-none`}
    >
      {/* Handheld Console Top Bezel */}
      <div className="bg-[#131b2e] border-b-[3px] border-slate-700 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-pixel shrink-0">
        <div className="flex items-center space-x-2">
          <span className={`px-2 py-0.5 text-[10px] font-arcade uppercase border ${getBadgeColor()}`}>
            {session.gameId}
          </span>
          <span className="bg-[#0b0f19] border border-slate-700 px-1.5 py-0.5 text-[10px] text-cyan-300 font-pixel">
            #{shortMatchId}
          </span>
          <span className="text-slate-300 hidden md:inline text-[11px]">
            [{session.mode}]
          </span>
          <span className="text-slate-400 hidden sm:inline text-[11px]">
            P1:<strong className="text-white ml-1">{session.playerId}</strong>
            {session.mode === 'TWO_PLAYERS_LOCAL' && session.player2Id && (
              <>
                <span className="text-amber-400 mx-1">vs</span>
                P2:<strong className="text-cyan-300 ml-1">{session.player2Id}</strong>
              </>
            )}
          </span>
        </div>

        {/* Status & Score LCD */}
        <div className="flex items-center space-x-2.5 bg-[#0b0f19] border-2 border-slate-800 px-2 py-0.5">
          <div className="flex items-center text-slate-200 text-[11px]">
            <PixelIcon name="trophy" size={12} className="text-amber-400 mr-1" />
            <span>
              <strong className="font-arcade text-[10px] text-white">{score}</strong>
            </span>
          </div>

          <div className="hidden sm:flex items-center text-slate-400 text-[11px] border-l border-slate-700 pl-2">
            <PixelIcon name="clock" size={12} className="text-cyan-400 mr-1" />
            <span>{duration}s</span>
          </div>

          <span
            className={`px-1.5 py-0.5 text-[9px] font-arcade uppercase border ${
              status === 'PLAYING'
                ? 'bg-emerald-950 text-emerald-400 border-emerald-500'
                : status === 'PAUSED'
                ? 'bg-amber-950 text-amber-400 border-amber-500'
                : 'bg-rose-950 text-rose-400 border-rose-500'
            }`}
          >
            {status}
          </span>
        </div>

        {/* Quick Handheld Controls */}
        <div className="flex items-center space-x-1">
          <button
            onClick={handleCopyMatchId}
            title={`Copiar matchId: ${session.matchId}`}
            className="p-1 bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border-2 border-slate-600 pixel-btn"
          >
            {copied ? (
              <PixelIcon name="check" size={13} className="text-emerald-400" />
            ) : (
              <PixelIcon name="copy" size={13} />
            )}
          </button>

          {!isBattleship && (
            <button
              onClick={handleTogglePause}
              title={status === 'PLAYING' ? 'Pausar Partida' : 'Reanudar Partida'}
              className="p-1 bg-[#0b0f19] hover:bg-slate-800 text-amber-300 border-2 border-slate-600 pixel-btn"
            >
              {status === 'PLAYING' ? (
                <PixelIcon name="pause" size={13} />
              ) : (
                <PixelIcon name="play" size={13} />
              )}
            </button>
          )}

          <button
            onClick={handleRestartMatch}
            title="Reiniciar Partida (Nueva Instancia)"
            className="p-1 bg-[#0b0f19] hover:bg-slate-800 text-cyan-300 border-2 border-slate-600 pixel-btn"
          >
            <PixelIcon name="refresh" size={13} />
          </button>

          {onMaximize && (
            <button
              onClick={() => onMaximize(session.matchId)}
              title="Maximizar / Modo Foco"
              className="p-1 bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border-2 border-slate-600 pixel-btn"
            >
              <PixelIcon name="maximize" size={13} />
            </button>
          )}

          <button
            onClick={handleOpenStandalone}
            title="Abrir en pestaña independiente (?tab=play)"
            className="p-1 bg-[#0b0f19] hover:bg-slate-800 text-emerald-300 border-2 border-slate-600 pixel-btn"
          >
            <PixelIcon name="external-link" size={13} />
          </button>

          <button
            onClick={() => onClose(session.matchId)}
            title="Terminar sesión"
            className="p-1 bg-rose-950 hover:bg-rose-800 text-rose-200 border-2 border-rose-600 pixel-btn"
          >
            <PixelIcon name="close" size={13} />
          </button>
        </div>
      </div>

      {/* Game Viewport Container */}
      <div
        ref={containerRef}
        data-game-viewport={session.matchId}
        onMouseDown={() => containerRef.current?.focus()}
        className={`relative flex-1 min-h-0 bg-black flex ${
          isBattleship
            ? 'items-stretch justify-center overflow-hidden'
            : 'items-center justify-center overflow-auto min-h-[360px]'
        } focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-400/60 ${
          scanlineActive ? 'scanline' : ''
        }`}
        tabIndex={0}
      >
        {isBattleship ? (
          <div className="w-full h-full overflow-hidden flex items-stretch justify-center p-0.5">
            <BattleshipBoard game={session.gameInstance as BattleshipGame} />
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            width={800}
            height={550}
            className="w-full h-full object-contain max-h-[80vh] block focus:outline-none pixelated"
          />
        )}

        {status === 'PAUSED' && !isBattleship && (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-30">
            <div className="bg-[#131b2e] pixel-box-amber p-6 text-center space-y-4">
              <span className="font-arcade text-lg sm:text-xl text-amber-400 tracking-widest animate-pulse block">
                GAME PAUSED
              </span>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleTogglePause}
                  className="px-4 py-2.5 bg-amber-500 text-black font-arcade text-[10px] uppercase border-amber-200 pixel-btn inline-flex items-center space-x-2"
                >
                  <PixelIcon name="play" size={12} />
                  <span>REANUDAR</span>
                </button>
                <button
                  onClick={handleRestartMatch}
                  className="px-4 py-2.5 bg-[#0b0f19] text-cyan-300 font-arcade text-[10px] uppercase border-cyan-500 pixel-btn inline-flex items-center space-x-2"
                >
                  <PixelIcon name="refresh" size={12} />
                  <span>REINICIAR</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {status === 'FINISHED' && !isBattleship && (
          <div className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-30">
            <div className="bg-[#131b2e] pixel-box-rose p-6 text-center space-y-4">
              <span className="font-arcade text-lg sm:text-xl text-rose-400 tracking-widest block">
                MATCH FINISHED
              </span>
              <div className="text-xs font-pixel text-slate-300">
                PUNTUACIÓN FINAL: <strong className="text-emerald-400 font-arcade text-sm">{score}</strong>
              </div>
              <div className="flex items-center justify-center gap-3">
                <button
                  onClick={handleRestartMatch}
                  className="px-4 py-2.5 bg-emerald-500 text-black font-arcade text-[10px] uppercase border-emerald-200 pixel-btn inline-flex items-center space-x-2"
                >
                  <PixelIcon name="refresh" size={12} />
                  <span>PLAY AGAIN</span>
                </button>
                <button
                  onClick={() => onClose(session.matchId)}
                  className="px-4 py-2.5 bg-[#0b0f19] hover:bg-slate-800 text-white font-arcade text-[10px] uppercase border-slate-500 pixel-btn"
                >
                  CERRAR
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Handheld Bottom Status Strip with Pixelated GameStats LED */}
      <div className="bg-[#131b2e] border-t-[3px] border-slate-700 px-2.5 py-1 flex items-center justify-between text-[10px] font-pixel text-slate-400 shrink-0">
        <div className="flex items-center space-x-2 truncate">
          <PixelIcon name="terminal" size={12} className="text-emerald-400 shrink-0" />
          <span className="truncate">
            MATCH: <span className="text-slate-200">#{shortMatchId}</span>
            <span className="hidden md:inline text-slate-500 ml-2">({session.matchId})</span>
          </span>
        </div>

        {/* Pixelated LED for GameStats transmission */}
        <div className="shrink-0 flex items-center space-x-2 bg-[#0b0f19] border border-slate-700 px-2 py-0.5">
          <span className="relative inline-flex w-2.5 h-2.5">
            {ledConfig.pulse && (
              <span className={`absolute inset-0 ${ledConfig.bg} ${ledConfig.pulse} opacity-75`} />
            )}
            <span className={`relative inline-block w-2.5 h-2.5 ${ledConfig.bg} border ${ledConfig.border}`} />
          </span>
          <span className={`${ledConfig.text} font-bold`}>{ledConfig.label}</span>
        </div>
      </div>
    </div>
  );
};
