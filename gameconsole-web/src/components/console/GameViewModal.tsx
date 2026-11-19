import React from 'react';
import { ActiveSession } from '../../core/GameSessionManager';
import { GameInstanceView } from './GameInstanceView';
import { PixelIcon } from '../pixel/PixelIcon';

interface GameViewModalProps {
  session: ActiveSession | null;
  isOpen: boolean;
  onClose: () => void;
  onRestart?: (session: ActiveSession) => void;
  scanlineActive?: boolean;
}

export const GameViewModal: React.FC<GameViewModalProps> = ({
  session,
  isOpen,
  onClose,
  onRestart,
  scanlineActive = false
}) => {
  if (!isOpen || !session) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-1.5 sm:p-3 bg-black/80">
      <div className="relative w-full max-w-6xl h-[94vh] flex flex-col bg-[#0b0f19] pixel-box-emerald overflow-hidden">
        {/* Arcade Cabinet Top Bezel */}
        <div className="bg-[#131b2e] border-b-[3px] border-slate-700 px-3 py-1.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <PixelIcon name="gamepad" size={15} className="text-emerald-400" />
            <span className="font-arcade text-[11px] sm:text-xs text-emerald-400">
              ARCADE CABINET
            </span>
            <span className="hidden sm:inline text-slate-400 font-pixel text-xs">
              • FOCUSED MODE
            </span>
            <span className="bg-[#0b0f19] border border-slate-700 px-1.5 py-0.5 text-[10px] font-pixel text-cyan-300">
              #{session.matchId.substring(0, 8)}
            </span>
          </div>
          <button
            onClick={onClose}
            title="Cerrar vista enfocada (la sesión sigue en Multi-Dock)"
            className="p-1 bg-[#0b0f19] hover:bg-rose-900 text-slate-300 hover:text-white border-slate-600 pixel-btn"
          >
            <PixelIcon name="close" size={14} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 min-h-0 overflow-hidden p-1 bg-[#050811]">
          <GameInstanceView
            session={session}
            onClose={() => onClose()}
            onRestart={onRestart}
            scanlineActive={scanlineActive}
          />
        </div>
      </div>
    </div>
  );
};
