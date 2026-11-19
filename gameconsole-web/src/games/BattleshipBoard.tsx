import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { BattleshipGame, ShotRecord } from './BattleshipGame';
import {
  FLEET_CONFIG,
  PlacedShip,
  ROW_LABELS,
  ShipDefinition,
  ShipOrientation
} from './battleship/BattleshipTypes';
import { PixelIcon } from '../components/pixel/PixelIcon';
import {
  NavalPixelStyles,
  PixelRadarWater,
  PixelShipSegment,
  PixelShipSprite,
  PixelExplosion,
  PixelSmokeColumn,
  PixelWaterSplash
} from './battleship/PixelNavalSprites';

interface BattleshipBoardProps {
  game: BattleshipGame;
}

interface CellShipInfo {
  shipId: string;
  shipName: string;
  color: string;
  orientation: ShipOrientation;
  segmentIndex: number;
  sunk: boolean;
}

type CellShotMap = Map<string, { result: 'HIT' | 'MISS'; shipSunk: string | null }>;

function buildShipCellMap(ships: PlacedShip[]): Map<string, CellShipInfo> {
  const map = new Map<string, CellShipInfo>();
  for (const ship of ships) {
    ship.coords.forEach((c, idx) => {
      map.set(`${c.row},${c.col}`, {
        shipId: ship.id,
        shipName: ship.name,
        color: ship.color,
        orientation: ship.orientation,
        segmentIndex: idx,
        sunk: ship.sunk
      });
    });
  }
  return map;
}

function buildShotMap(shots: ShotRecord[]): CellShotMap {
  const map: CellShotMap = new Map();
  for (const s of shots) {
    map.set(`${s.row},${s.col}`, { result: s.result, shipSunk: s.shipSunk });
  }
  return map;
}

interface NavalGridPanelProps {
  title: string;
  badgeText: string;
  accent: 'emerald' | 'cyan' | 'amber';
  waterVariant: 'friendly' | 'radar';
  shipsMap: Map<string, CellShipInfo>;
  shotsMap: CellShotMap;
  revealIntactShips: boolean;
  revealSunkShips: boolean;
  isPlacementBoard: boolean;
  isFireTargetBoard: boolean;
  showScanline: boolean;
  selectedShip: ShipDefinition | null;
  orientation: ShipOrientation;
  hoverCell: { row: number; col: number } | null;
  isPlacementValid: boolean;
  targetBanner?: string | null;
  ariaPrefix: string;
  onCellClick: (row: number, col: number) => void;
  onCellContextMenu?: (row: number, col: number, e: React.MouseEvent) => void;
  onCellHover: (cell: { row: number; col: number } | null) => void;
}

const ACCENT_STYLES = {
  emerald: {
    box: 'pixel-box-emerald bg-[#0d1626]',
    title: 'text-emerald-400',
    icon: 'text-emerald-400',
    badge: 'text-emerald-300 border-emerald-700/60',
    label: 'text-emerald-500/80',
    boardBg: 'pixel-box bg-[#030b14]',
    hoverBorder: 'hover:border-emerald-400',
    shipBorder: 'border-emerald-700/70',
    idleBorder: 'border-[#12304a]',
    reticleText: 'text-emerald-300',
    reticleBg: 'bg-emerald-500/15'
  },
  cyan: {
    box: 'pixel-box-cyan bg-[#0a1421]',
    title: 'text-cyan-400',
    icon: 'text-cyan-400',
    badge: 'text-cyan-300 border-cyan-700/60',
    label: 'text-cyan-500',
    boardBg: 'pixel-box-cyan bg-[#020a12]',
    hoverBorder: 'hover:border-cyan-300',
    shipBorder: 'border-cyan-700/70',
    idleBorder: 'border-[#0c354d]',
    reticleText: 'text-cyan-300',
    reticleBg: 'bg-cyan-500/15'
  },
  amber: {
    box: 'pixel-box-amber bg-[#141724]',
    title: 'text-amber-300',
    icon: 'text-amber-400',
    badge: 'text-amber-300 border-amber-600/60',
    label: 'text-amber-400/90',
    boardBg: 'pixel-box-amber bg-[#080b14]',
    hoverBorder: 'hover:border-amber-300',
    shipBorder: 'border-amber-700/70',
    idleBorder: 'border-[#2d2515]',
    reticleText: 'text-amber-300',
    reticleBg: 'bg-amber-500/15'
  }
} as const;

const NavalGridPanel: React.FC<NavalGridPanelProps> = ({
  title,
  badgeText,
  accent,
  waterVariant,
  shipsMap,
  shotsMap,
  revealIntactShips,
  revealSunkShips,
  isPlacementBoard,
  isFireTargetBoard,
  showScanline,
  selectedShip,
  orientation,
  hoverCell,
  isPlacementValid,
  targetBanner,
  ariaPrefix,
  onCellClick,
  onCellContextMenu,
  onCellHover
}) => {
  const styles = ACCENT_STYLES[accent];

  // Precompute hovered cells during placement for fast lookup
  const hoverSegmentMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!isPlacementBoard || !hoverCell || !selectedShip) return map;
    for (let i = 0; i < selectedShip.length; i++) {
      const hr = orientation === 'HORIZONTAL' ? hoverCell.row : hoverCell.row + i;
      const hc = orientation === 'HORIZONTAL' ? hoverCell.col + i : hoverCell.col;
      if (hr >= 0 && hr < 10 && hc >= 0 && hc < 10) {
        map.set(`${hr},${hc}`, i);
      }
    }
    return map;
  }, [isPlacementBoard, hoverCell, selectedShip, orientation]);

  return (
    <div className={`${styles.box} p-1.5 sm:p-2 flex flex-col justify-between min-h-0 overflow-hidden relative`}>
      {/* Panel Header */}
      <div className="flex items-center justify-between gap-2 mb-1 shrink-0 z-10">
        <div className="flex items-center gap-1.5 min-w-0">
          <PixelIcon
            name={waterVariant === 'friendly' ? 'anchor' : 'crosshair'}
            size={13}
            className={styles.icon}
          />
          <span className={`font-arcade text-[10px] tracking-wider uppercase truncate ${styles.title}`}>
            {title}
          </span>
        </div>
        <div className={`pixel-box bg-[#0b0f19] px-1.5 py-0.5 text-[9px] shrink-0 ${styles.badge}`}>
          {badgeText}
        </div>
      </div>

      {/* Optional active turn/deployment banner */}
      {targetBanner && (
        <div className="mb-1 px-2 py-0.5 bg-[#0b0f19]/90 border border-emerald-400/70 text-[10px] font-pixel font-bold text-emerald-300 text-center leading-tight truncate animate-pulse shrink-0 z-10">
          {targetBanner}
        </div>
      )}

      {/* 10x10 Sea Grid */}
      <div className="flex-1 min-h-0 flex flex-col justify-center items-center z-10">
        <div className={`${styles.boardBg} p-1 relative overflow-hidden`}>
          {/* Stepped 16-bit Radar Scanline Sweep */}
          {showScanline && (
            <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
              <div className="np-radar-scanline w-full h-2 bg-cyan-400/20 border-t border-cyan-300/40" />
            </div>
          )}

          {/* Column labels */}
          <div className={`grid grid-cols-[14px_repeat(10,auto)] gap-[2px] text-center text-[8px] font-bold mb-0.5 leading-none ${styles.label}`}>
            <div className="w-3.5" />
            {Array.from({ length: 10 }, (_, i) => (
              <div key={i} className="w-[clamp(17px,2.35vh,25px)]">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Grid Rows */}
          {Array.from({ length: 10 }, (_, r) => (
            <div key={r} className="grid grid-cols-[14px_repeat(10,auto)] gap-[2px] mb-[2px] last:mb-0 items-center">
              <div className={`text-[8px] font-bold text-center w-3.5 leading-none ${styles.label}`}>
                {ROW_LABELS[r]}
              </div>

              {Array.from({ length: 10 }, (_, c) => {
                const cellKey = `${r},${c}`;
                const shipInfo = shipsMap.get(cellKey);
                const shot = shotsMap.get(cellKey);

                const hoverSegmentIndex = hoverSegmentMap.get(cellKey) ?? null;
                const isHovered = hoverSegmentIndex !== null;

                const isFired = !!shot;
                const isHit = shot?.result === 'HIT';
                const isShipSunk = Boolean(shipInfo?.sunk);
                const isSunkCell = Boolean(shot?.shipSunk || (revealSunkShips && isShipSunk));

                const showShipSprite = Boolean(
                  shipInfo && (revealIntactShips || (revealSunkShips && isShipSunk))
                );
                const isRelocatingThisShip = Boolean(
                  isPlacementBoard && shipInfo && selectedShip?.id === shipInfo.shipId
                );

                const canFireCell = isFireTargetBoard && !isFired;
                const canClickPlacement =
                  isPlacementBoard && (Boolean(selectedShip) || Boolean(shipInfo));
                const isClickable = canPlacementOrFire(canClickPlacement, canFireCell);

                let borderClass = `${styles.idleBorder}`;
                if (isSunkCell) {
                  borderClass = 'border-rose-500 ring-1 ring-rose-400';
                } else if (isHit) {
                  borderClass = 'border-rose-500';
                } else if (isHovered && isPlacementBoard) {
                  borderClass = isPlacementValid
                    ? 'border-emerald-400 ring-1 ring-emerald-400'
                    : 'border-rose-500 ring-1 ring-rose-500';
                } else if (canFireCell) {
                  borderClass = `${styles.idleBorder} ${styles.hoverBorder} cursor-crosshair`;
                } else if (isFired) {
                  borderClass = 'border-cyan-900/70';
                } else if (showShipSprite) {
                  borderClass = isPlacementBoard
                    ? `${styles.shipBorder} hover:border-amber-300 cursor-pointer`
                    : `${styles.shipBorder}`;
                } else if (isPlacementBoard) {
                  borderClass = `${styles.idleBorder} ${styles.hoverBorder} cursor-pointer`;
                }

                const showSmoke = Boolean(
                  (revealSunkShips && isShipSunk) ||
                    (isHit && (revealIntactShips || revealSunkShips || !shipInfo))
                );

                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onCellClick(r, c)}
                    onContextMenu={
                      onCellContextMenu ? e => onCellContextMenu(r, c, e) : undefined
                    }
                    onMouseEnter={isPlacementBoard ? () => onCellHover({ row: r, col: c }) : undefined}
                    onMouseLeave={isPlacementBoard ? () => onCellHover(null) : undefined}
                    disabled={!isClickable}
                    aria-label={`${ariaPrefix} ${ROW_LABELS[r]}${c + 1}`}
                    className={`group w-[clamp(17px,2.35vh,25px)] h-[clamp(17px,2.35vh,25px)] relative overflow-hidden p-0 border transition-none ${borderClass}`}
                  >
                    {/* Layer 1: Animated 16-bit Pixel Water */}
                    <PixelRadarWater variant={waterVariant} row={r} col={c} />

                    {/* Layer 2: Placed or Sunk Pixel Warship Segment */}
                    {showShipSprite && shipInfo && (
                      <div className={`absolute inset-0 ${isRelocatingThisShip ? 'opacity-40' : ''}`}>
                        <PixelShipSegment
                          shipId={shipInfo.shipId}
                          orientation={shipInfo.orientation}
                          segmentIndex={shipInfo.segmentIndex}
                          sunk={shipInfo.sunk}
                        />
                      </div>
                    )}

                    {/* Layer 3: Placement Ghost Preview */}
                    {isPlacementBoard &&
                      isHovered &&
                      selectedShip &&
                      hoverSegmentIndex !== null &&
                      (!shipInfo || shipInfo.shipId === selectedShip.id) && (
                        <div className="absolute inset-0">
                          <PixelShipSegment
                            shipId={selectedShip.id}
                            orientation={orientation}
                            segmentIndex={hoverSegmentIndex}
                            ghost
                            ghostValid={isPlacementValid}
                          />
                        </div>
                      )}
                    {isPlacementBoard &&
                      isHovered &&
                      selectedShip &&
                      shipInfo &&
                      shipInfo.shipId !== selectedShip.id && (
                        <div className="absolute inset-0 bg-rose-500/35 z-10 pointer-events-none" />
                      )}

                    {/* Layer 4: Target Reticle on Hover when ready to fire */}
                    {canFireCell && (
                      <div
                        className={`absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 ${styles.reticleBg} z-10 pointer-events-none`}
                      >
                        <PixelIcon name="crosshair" size={12} className={styles.reticleText} />
                      </div>
                    )}

                    {/* Layer 5: Rising Pixel Smoke on Damaged/Sunk Ship */}
                    {showSmoke && (
                      <div className="absolute inset-0 z-10">
                        <PixelSmokeColumn />
                      </div>
                    )}

                    {/* Layer 6: Multi-frame Pixel Explosion (HIT) or Water Splash (MISS) */}
                    {isHit && (
                      <div className="absolute inset-0 z-20">
                        <PixelExplosion sunk={isSunkCell} />
                      </div>
                    )}
                    {isFired && !isHit && (
                      <div className="absolute inset-0 z-10">
                        <PixelWaterSplash />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function canPlacementOrFire(canPlace: boolean, canFire: boolean): boolean {
  return canPlace || canFire;
}

export const BattleshipBoard: React.FC<BattleshipBoardProps> = ({ game }) => {
  // Sync state from game engine
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = game.subscribe(() => {
      setTick(t => t + 1);
    });
    return unsubscribe;
  }, [game]);

  const phase = game.getPhase();
  const isTwoPlayers = game.isTwoPlayerMode();
  const isPlacement = game.isPlacementPhase();
  const p1Id = game.getP1Id();
  const p2Id = game.getP2Id();
  const currentPlacerId = game.getCurrentPlacingPlayerId();
  const p1Ships = game.getP1Ships();
  const p2Ships = game.getP2Ships();
  const activePlacedShips = game.getPlacedShips();
  const selectedShip = game.getSelectedShip();
  const orientation = game.getOrientation();
  const playerShotsFired = game.getPlayerShotsFired();
  const playerShotsReceived = game.getPlayerShotsReceived();
  const activeTurn = game.getActiveTurn();
  const currentTurn = game.getCurrentTurn();
  const isAiThinking = game.getIsAiThinking();
  const latestAiDecision = game.getLatestAiDecision();
  const isFleetReady = game.isFleetComplete();
  const p1Score = game.getP1Score();
  const p2Score = game.getP2Score();
  const winnerId = game.getWinnerId();

  // Placement hover state
  const [hoverCell, setHoverCell] = useState<{ row: number; col: number } | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Clear hover when phase switches
  useEffect(() => {
    setHoverCell(null);
  }, [phase]);

  // Dispose AudioContext on unmount
  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        void audioCtxRef.current.close();
      }
    };
  }, []);

  // Procedural audio synthesizer reusing a single AudioContext
  const playSfx = useCallback((type: 'fire' | 'hit' | 'miss' | 'sunk' | 'ping') => {
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'fire') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'hit') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'miss') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(350, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 0.25);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else if (type === 'sunk') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(120, ctx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.5);
      } else if (type === 'ping') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch {
      // Audio autoplay policy
    }
  }, []);

  const playShotOutcomeSfx = useCallback(
    (shot: ShotRecord | null) => {
      if (!shot) return;
      if (shot.shipSunk) {
        playSfx('sunk');
      } else if (shot.result === 'HIT') {
        playSfx('hit');
      } else {
        playSfx('miss');
      }
    },
    [playSfx]
  );

  // Calculate validity of hover placement
  const isPlacementValid = useMemo(() => {
    if (!isPlacement || !selectedShip || !hoverCell) return false;
    return game.canPlaceShip(selectedShip, hoverCell.row, hoverCell.col, orientation);
  }, [isPlacement, selectedShip, hoverCell, orientation, game, tick]);

  // Fast key listener for 'R' to rotate during placement
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && isPlacement) {
        game.toggleOrientation();
        playSfx('ping');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [game, isPlacement, playSfx]);

  // Ship cell maps & shot maps (include tick so every shot/sunk update renders immediately)
  const p1CellMap = useMemo(() => buildShipCellMap(p1Ships), [p1Ships, tick]);
  const p2CellMap = useMemo(() => buildShipCellMap(p2Ships), [p2Ships, tick]);
  const p1ShotsMap = useMemo(() => buildShotMap(playerShotsFired), [playerShotsFired, tick]);
  const p2ShotsMap = useMemo(() => buildShotMap(playerShotsReceived), [playerShotsReceived, tick]);

  // Handle placement click (for P1 on left board in PLACEMENT_P1, or P2 on right board in PLACEMENT_P2)
  const handlePlacementCellClick = useCallback(
    (r: number, c: number, cellMap: Map<string, CellShipInfo>) => {
      if (!isPlacement) return;

      if (selectedShip) {
        const success = game.placePlayerShip(selectedShip, r, c, orientation);
        if (success) {
          playSfx('ping');
        }
        return;
      }

      // If all ships are placed (selectedShip === null), clicking an existing ship selects it for relocation
      const existing = cellMap.get(`${r},${c}`);
      if (existing) {
        const shipDef = FLEET_CONFIG.find(s => s.id === existing.shipId) || null;
        if (shipDef) {
          game.setSelectedShip(shipDef);
          playSfx('ping');
        }
      }
    },
    [isPlacement, selectedShip, orientation, game, playSfx]
  );

  const handlePlacementContextMenu = useCallback(
    (r: number, c: number, e: React.MouseEvent, cellMap: Map<string, CellShipInfo>) => {
      e.preventDefault();
      if (!isPlacement) return;
      const existing = cellMap.get(`${r},${c}`);
      if (existing) {
        const removed = game.removePlayerShip(existing.shipId);
        if (removed) {
          playSfx('miss');
        }
      }
    },
    [isPlacement, game, playSfx]
  );

  // Left board click handler (P1 placement OR P2 firing in 2P combat)
  const handleLeftGridClick = async (r: number, c: number) => {
    if (phase === 'PLACEMENT_P1') {
      handlePlacementCellClick(r, c, p1CellMap);
      return;
    }

    if (isTwoPlayers && phase === 'COMBAT' && activeTurn === 'PLAYER2') {
      playSfx('fire');
      const shot = game.player2Fire(r, c);
      playShotOutcomeSfx(shot);
    }
  };

  // Right board click handler (P2 placement in 2P, instant quick-start fire in 1P, OR P1 firing in combat)
  const handleRightGridClick = async (r: number, c: number) => {
    if (phase === 'PLACEMENT_P2' && isTwoPlayers) {
      handlePlacementCellClick(r, c, p2CellMap);
      return;
    }

    // Immediate frictionless combat transition in 1P/SOLO: click any Enemy Radar cell when 5 ships placed!
    if (!isTwoPlayers && phase === 'PLACEMENT_P1' && isFleetReady) {
      const started = game.beginCombat();
      if (!started) return;
      playSfx('fire');
      const shot = await game.playerFire(r, c);
      playShotOutcomeSfx(shot);
      return;
    }

    if (phase === 'COMBAT' && activeTurn === 'PLAYER' && !isAiThinking) {
      playSfx('fire');
      const shot = await game.playerFire(r, c);
      playShotOutcomeSfx(shot);
    }
  };

  // Derived visibility flags for 1P vs 2P fairness
  const leftIsPlacement = phase === 'PLACEMENT_P1';
  const rightIsPlacement = isTwoPlayers && phase === 'PLACEMENT_P2';

  // In 2P COMBAT, hide intact/unsunk ships on BOTH boards behind radar water!
  // In PLACEMENT_P2 or TURN_TRANSITION, P1's ships MUST remain completely hidden!
  const leftRevealIntact =
    phase === 'FINISHED' ||
    phase === 'PLACEMENT_P1' ||
    (!isTwoPlayers && phase === 'COMBAT');

  const rightRevealIntact =
    phase === 'FINISHED' || (isTwoPlayers && phase === 'PLACEMENT_P2');

  const revealSunk = phase === 'COMBAT' || phase === 'FINISHED';

  const leftCanFireTarget = isTwoPlayers && phase === 'COMBAT' && activeTurn === 'PLAYER2';
  const rightCanQuickStartFire = !isTwoPlayers && phase === 'PLACEMENT_P1' && isFleetReady;
  const rightCanFireTarget =
    rightCanQuickStartFire || (phase === 'COMBAT' && activeTurn === 'PLAYER' && !isAiThinking);

  const playerVictory =
    phase === 'FINISHED' &&
    (isTwoPlayers ? winnerId === p1Id : p2Ships.length > 0 && p2Ships.every(s => s.sunk));

  const renderPrimaryConfirmAction = (compact: boolean) => {
    if (!isPlacement) return null;

    if (!isTwoPlayers) {
      if (!isFleetReady) {
        if (compact) return null;
        return (
          <button
            type="button"
            disabled
            className="pixel-btn w-full py-1 px-3 font-arcade text-[10px] tracking-wider uppercase flex items-center justify-center gap-2 bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
          >
            <PixelIcon name="crosshair" size={13} />
            <span>COLOCA LOS 5 BARCOS ({5 - activePlacedShips.length} RESTANTES)</span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => {
            game.beginCombat();
            playSfx('sunk');
          }}
          className={`pixel-btn ${
            compact ? 'px-2.5 py-0.5 text-[9px]' : 'w-full sm:flex-1 py-1 px-3 text-[10px]'
          } bg-emerald-500 border-emerald-200 text-slate-950 font-arcade tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer animate-pulse`}
        >
          <PixelIcon name="crosshair" size={compact ? 12 : 14} />
          <span>INICIAR COMBATE NAVAL!</span>
        </button>
      );
    }

    // TWO_PLAYERS_LOCAL
    if (phase === 'PLACEMENT_P1') {
      if (!isFleetReady) {
        if (compact) return null;
        return (
          <button
            type="button"
            disabled
            className="pixel-btn w-full py-1 px-3 font-arcade text-[10px] tracking-wider uppercase flex items-center justify-center gap-2 bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
          >
            <PixelIcon name="shield" size={13} />
            <span>
              DESPLIEGA LOS 5 BARCOS DE {p1Id} ({5 - activePlacedShips.length} RESTANTES)
            </span>
          </button>
        );
      }

      return (
        <button
          type="button"
          onClick={() => {
            game.confirmP1Placement();
            playSfx('ping');
          }}
          className={`pixel-btn ${
            compact ? 'px-2.5 py-0.5 text-[9px]' : 'w-full py-1 px-3 text-[10px]'
          } bg-amber-400 border-amber-100 text-slate-950 font-arcade tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer animate-pulse`}
        >
          <PixelIcon name="shield" size={compact ? 12 : 14} />
          <span>
            CONFIRMAR FLOTA DE {p1Id} -&gt; TURNO DE {p2Id}
          </span>
        </button>
      );
    }

    // PLACEMENT_P2
    if (!isFleetReady) {
      if (compact) return null;
      return (
        <button
          type="button"
          disabled
          className="pixel-btn w-full py-1 px-3 font-arcade text-[10px] tracking-wider uppercase flex items-center justify-center gap-2 bg-slate-800 border-slate-700 text-slate-500 cursor-not-allowed"
        >
          <PixelIcon name="crosshair" size={13} />
          <span>
            DESPLIEGA LOS 5 BARCOS DE {p2Id} ({5 - activePlacedShips.length} RESTANTES)
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => {
          game.beginCombat();
          playSfx('sunk');
        }}
        className={`pixel-btn ${
          compact ? 'px-2.5 py-0.5 text-[9px]' : 'w-full py-1 px-3 text-[10px]'
        } bg-emerald-500 border-emerald-200 text-slate-950 font-arcade tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer animate-pulse`}
      >
        <PixelIcon name="crosshair" size={compact ? 12 : 14} />
        <span>INICIAR COMBATE J1 vs J2!</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col w-full h-full bg-[#0b0f19] arcade-grid-bg text-slate-100 select-none p-1.5 sm:p-2 font-pixel overflow-y-auto lg:overflow-hidden justify-between gap-1.5">
      <NavalPixelStyles />

      {/* 16-Bit Tactical Naval Radar Header HUD */}
      <div className="pixel-box bg-[#131b2e] px-2.5 py-1 mb-0 shrink-0 flex flex-wrap items-center justify-between gap-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="pixel-box-cyan bg-[#04141f] p-1 text-cyan-400 flex items-center justify-center shrink-0">
            <PixelIcon name="wifi" size={14} className="animate-pulse" />
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="font-arcade text-[11px] sm:text-xs text-white leading-none">
              BATTLESHIP
            </span>
            <span className="hidden xl:inline font-arcade text-[8px] tracking-widest text-cyan-400/90 uppercase leading-none">
              16-BIT NAVAL RADAR COMMAND
            </span>
            <span className="pixel-box bg-[#0b0f19] px-1.5 py-0.5 text-[9px] text-amber-300 font-pixel inline-flex items-center gap-1 leading-none">
              <PixelIcon name={isTwoPlayers ? 'gamepad' : 'cpu'} size={10} />
              {isTwoPlayers ? `2P LOCAL: ${p1Id} vs ${p2Id}` : '1P vs PROLOG AI'}
            </span>
          </div>
        </div>

        {/* Phase, Turn Status & Top Quick-Start CTA */}
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {isPlacement && (
            <>
              <div className="pixel-box-amber bg-amber-950/70 px-2 py-0.5 text-amber-300 text-[10px] flex items-center gap-1 leading-tight">
                <PixelIcon name="shield" size={11} />
                <span>
                  DESPLIEGUE {currentPlacerId} ({activePlacedShips.length}/5)
                </span>
              </div>
              {renderPrimaryConfirmAction(true)}
            </>
          )}

          {phase === 'TURN_TRANSITION' && (
            <div className="pixel-box-amber bg-amber-950/80 px-2 py-0.5 text-amber-200 text-[10px] font-arcade flex items-center gap-1 animate-pulse leading-tight">
              <PixelIcon name="eye" size={11} />
              <span>CAMBIO DE ALMIRANTE -&gt; {p2Id}</span>
            </div>
          )}

          {phase === 'COMBAT' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div
                className={`px-2 py-0.5 text-[9px] font-arcade uppercase flex items-center gap-1 leading-tight ${
                  activeTurn === 'PLAYER'
                    ? 'pixel-box-emerald bg-emerald-950/80 text-emerald-300'
                    : activeTurn === 'PLAYER2'
                    ? 'pixel-box-amber bg-amber-950/80 text-amber-300'
                    : 'pixel-box-rose bg-rose-950/80 text-rose-300 animate-pulse'
                }`}
              >
                <PixelIcon name="crosshair" size={11} />
                <span>
                  {isTwoPlayers
                    ? activeTurn === 'PLAYER'
                      ? `TURNO: ${p1Id}`
                      : `TURNO: ${p2Id}`
                    : activeTurn === 'PLAYER'
                    ? 'YOUR TURN: FIRE'
                    : 'AI TARGETING...'}
                </span>
              </div>
              <div className="pixel-box bg-[#0b0f19] px-1.5 py-0.5 text-[10px] text-slate-300 leading-tight">
                TURN #{currentTurn}
              </div>
              {isTwoPlayers && (
                <div className="pixel-box bg-[#0b0f19] px-1.5 py-0.5 text-[10px] text-cyan-300 leading-tight">
                  {p1Id}:{p1Score} | {p2Id}:{p2Score}
                </div>
              )}
            </div>
          )}

          {phase === 'FINISHED' && (
            <div
              className={`px-2.5 py-0.5 text-[10px] font-arcade flex items-center gap-1.5 leading-tight ${
                isTwoPlayers || playerVictory
                  ? 'pixel-box-emerald bg-emerald-950/80 text-emerald-300'
                  : 'pixel-box-rose bg-rose-950/80 text-rose-300'
              }`}
            >
              <PixelIcon name={isTwoPlayers || playerVictory ? 'trophy' : 'alert'} size={12} />
              <span>
                {isTwoPlayers
                  ? `VICTORIA: ${winnerId || p1Id}`
                  : playerVictory
                  ? 'SECTOR SECURED: VICTORY'
                  : 'FLEET LOST: DEFEAT'}
              </span>
            </div>
          )}

          {/* Prolog AI Mode Badge (1P only) */}
          {!isTwoPlayers && latestAiDecision && (
            <div className="hidden md:flex items-center gap-1 px-2 py-0.5 pixel-box-cyan bg-[#071320] text-[10px] leading-tight">
              <PixelIcon name="zap" size={11} className="text-cyan-400" />
              <span className="text-slate-400">AI:</span>
              <span
                className={`font-bold ${
                  latestAiDecision.mode === 'TARGET' ? 'text-rose-400 animate-pulse' : 'text-cyan-300'
                }`}
              >
                {latestAiDecision.mode}
              </span>
              <span className="text-[9px] text-slate-500">
                ({latestAiDecision.inferenceTimeMs}ms)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main Twin Radar Boards (+ Privacy Veil during TURN_TRANSITION) */}
      <div className="relative shrink-0 lg:shrink lg:flex-1 lg:min-h-0 flex flex-col">
        {phase === 'TURN_TRANSITION' && (
          <div className="absolute inset-0 z-30 bg-[#070d18] pixel-box-amber flex flex-col items-center justify-center p-4 overflow-y-auto text-center">
            <div className="pixel-box-amber bg-amber-950/50 p-2.5 text-amber-300 mb-2.5">
              <PixelIcon name="shield" size={28} />
            </div>
            <div className="font-arcade text-xs sm:text-sm text-amber-300 uppercase mb-1.5">
              CAMBIO DE ALMIRANTE — FLOTA PROTEGIDA
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mb-4">
              La flota de <strong className="text-emerald-300">{p1Id}</strong> quedó confirmada y
              oculta bajo el radar. Pasa el control a{' '}
              <strong className="text-cyan-300">{p2Id}</strong> sin mirar la pantalla anterior.
            </p>
            <button
              type="button"
              onClick={() => {
                game.continueFromTransition();
                playSfx('ping');
              }}
              className="pixel-btn px-4 py-2.5 bg-cyan-400 border-cyan-100 text-slate-950 font-arcade text-[11px] uppercase flex items-center gap-2 cursor-pointer"
            >
              <PixelIcon name="play" size={14} />
              <span>SOY {p2Id} — LISTO PARA DESPLEGAR MI FLOTA</span>
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-2 items-stretch">
          {/* LEFT SECTOR: PLAYER 1 WATERS */}
          <NavalGridPanel
            title={isTwoPlayers ? `SECTOR DE ${p1Id}` : 'PLAYER WATERS'}
            badgeText={
              phase === 'PLACEMENT_P1'
                ? `DESPLIEGUE (${p1Ships.length}/5)`
                : phase === 'PLACEMENT_P2' || phase === 'TURN_TRANSITION'
                ? 'FLOTA OCULTA'
                : `${p1Ships.filter(s => !s.sunk).length}/5 AFLOAT`
            }
            accent={leftCanFireTarget ? 'amber' : 'emerald'}
            waterVariant="friendly"
            shipsMap={p1CellMap}
            shotsMap={p2ShotsMap}
            revealIntactShips={leftRevealIntact}
            revealSunkShips={revealSunk}
            isPlacementBoard={leftIsPlacement}
            isFireTargetBoard={leftCanFireTarget}
            showScanline={leftCanFireTarget}
            selectedShip={selectedShip}
            orientation={orientation}
            hoverCell={hoverCell}
            isPlacementValid={isPlacementValid}
            targetBanner={
              isTwoPlayers && phase === 'PLACEMENT_P1'
                ? `DESPLIEGA AQUÍ LA FLOTA DE ${p1Id}`
                : leftCanFireTarget
                ? `TURNO DE ${p2Id} — DISPARA EN EL SECTOR DE ${p1Id}`
                : null
            }
            ariaPrefix={`${p1Id} grid cell`}
            onCellClick={handleLeftGridClick}
            onCellContextMenu={
              leftIsPlacement
                ? (r, c, e) => handlePlacementContextMenu(r, c, e, p1CellMap)
                : undefined
            }
            onCellHover={setHoverCell}
          />

          {/* RIGHT SECTOR: ENEMY RADAR OR PLAYER 2 WATERS */}
          <NavalGridPanel
            title={isTwoPlayers ? `SECTOR DE ${p2Id}` : 'ENEMY SECTOR RADAR'}
            badgeText={
              phase === 'PLACEMENT_P1'
                ? isTwoPlayers
                  ? `ESPERANDO A ${p2Id}`
                  : isFleetReady
                  ? 'LISTO — CLIC PARA DISPARAR'
                  : 'RECON STANDBY'
                : phase === 'PLACEMENT_P2'
                ? `DESPLIEGUE (${p2Ships.length}/5)`
                : `${p2Ships.filter(s => !s.sunk).length}/5 ${isTwoPlayers ? 'AFLOAT' : 'HOSTILES'}`
            }
            accent="cyan"
            waterVariant="radar"
            shipsMap={p2CellMap}
            shotsMap={p1ShotsMap}
            revealIntactShips={rightRevealIntact}
            revealSunkShips={revealSunk}
            isPlacementBoard={rightIsPlacement}
            isFireTargetBoard={rightCanFireTarget}
            showScanline={phase === 'COMBAT' && (!isTwoPlayers || activeTurn === 'PLAYER')}
            selectedShip={selectedShip}
            orientation={orientation}
            hoverCell={hoverCell}
            isPlacementValid={isPlacementValid}
            targetBanner={
              rightCanQuickStartFire
                ? 'FLOTA LISTA — HAZ CLIC EN CUALQUIER CELDA PARA DISPARAR Y COMENZAR'
                : rightIsPlacement
                ? `DESPLIEGA AQUÍ LA FLOTA DE ${p2Id}`
                : isTwoPlayers && phase === 'COMBAT' && activeTurn === 'PLAYER'
                ? `TURNO DE ${p1Id} — DISPARA EN EL SECTOR DE ${p2Id}`
                : null
            }
            ariaPrefix={`${isTwoPlayers ? p2Id : 'Enemy'} sector cell`}
            onCellClick={handleRightGridClick}
            onCellContextMenu={
              rightIsPlacement
                ? (r, c, e) => handlePlacementContextMenu(r, c, e, p2CellMap)
                : undefined
            }
            onCellHover={setHoverCell}
          />
        </div>
      </div>

      {/* VISIBLE BOTTOM FLEET DOCK (Always shown during P1 or P2 placement) */}
      {isPlacement && (
        <div className="pixel-box-emerald bg-[#0d1626] mt-0 p-1.5 sm:p-2 z-10 flex flex-col gap-1.5 shrink-0">
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <PixelIcon name="user" size={12} className="text-emerald-400 shrink-0" />
              <span className="font-arcade text-[9px] text-emerald-400 uppercase truncate">
                FLOTA DE {currentPlacerId} ({activePlacedShips.length}/5) — ELIGE CUALQUIER BARCO:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  game.toggleOrientation();
                  playSfx('ping');
                }}
                className="pixel-btn px-2 py-0.5 bg-[#1e293b] border-cyan-500 text-[10px] flex items-center gap-1 text-cyan-300 leading-tight"
              >
                <PixelIcon name="rotate" size={11} />
                <span>
                  ROTATE: <strong className="text-white">{orientation}</strong> (R)
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  game.autoPlacePlayerFleet();
                  playSfx('ping');
                }}
                className="pixel-btn px-2 py-0.5 bg-[#1e293b] border-amber-500 text-[10px] flex items-center gap-1 text-amber-300 leading-tight"
              >
                <PixelIcon name="refresh" size={11} />
                <span>AUTO DEPLOY</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  game.clearCurrentPlacement();
                  playSfx('miss');
                }}
                disabled={activePlacedShips.length === 0}
                className={`pixel-btn px-2 py-0.5 text-[10px] flex items-center gap-1 leading-tight ${
                  activePlacedShips.length > 0
                    ? 'bg-[#1e293b] border-rose-500 text-rose-300'
                    : 'bg-slate-900 border-slate-700 text-slate-600 cursor-not-allowed'
                }`}
              >
                <PixelIcon name="close" size={11} />
                <span>CLEAR</span>
              </button>
            </div>
          </div>

          {/* 5 Selectable Ship Cards with PixelShipSprite */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {FLEET_CONFIG.map(ship => {
              const isPlaced = activePlacedShips.some(s => s.id === ship.id);
              const isSelected = selectedShip?.id === ship.id;

              return (
                <div
                  key={ship.id}
                  className={`pixel-btn p-1 relative flex flex-col justify-between gap-0.5 ${
                    isSelected
                      ? 'bg-cyan-950/85 border-cyan-400 text-white'
                      : isPlaced
                      ? 'bg-emerald-950/55 border-emerald-500 text-emerald-200'
                      : 'bg-[#131b2e] border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        game.setSelectedShip(ship);
                        playSfx('ping');
                      }}
                      className="flex-1 min-w-0 text-left flex items-center justify-between gap-1 focus:outline-none"
                      title={
                        isPlaced
                          ? `Seleccionar ${ship.name} para reubicar`
                          : `Seleccionar ${ship.name} (${ship.length} casillas)`
                      }
                    >
                      <span className="text-[9px] font-bold truncate leading-tight">
                        {ship.name}
                      </span>
                      <span className="text-[8px] text-slate-400 shrink-0 leading-tight">
                        {ship.length}SQ
                      </span>
                    </button>

                    {isPlaced && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <PixelIcon name="check" size={10} className="text-emerald-400" />
                        <button
                          type="button"
                          onClick={() => {
                            game.removePlayerShip(ship.id);
                            playSfx('miss');
                          }}
                          title={`Quitar ${ship.name} del tablero`}
                          aria-label={`Remove ${ship.name}`}
                          className="p-0.5 text-rose-400 hover:text-rose-200 hover:bg-rose-950/80"
                        >
                          <PixelIcon name="close" size={9} />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      game.setSelectedShip(ship);
                      playSfx('ping');
                    }}
                    className="w-full h-3 flex items-center focus:outline-none"
                    title={
                      isPlaced
                        ? `Seleccionar ${ship.name} para reubicar`
                        : `Seleccionar ${ship.name} (${ship.length} casillas)`
                    }
                  >
                    <PixelShipSprite
                      shipId={ship.id}
                      length={ship.length}
                      orientation="HORIZONTAL"
                      className="h-2.5 w-auto max-w-full"
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Primary Confirm / Start Combat CTA inside Bottom Dock */}
          <div className="flex flex-col sm:flex-row items-center gap-1.5">
            {renderPrimaryConfirmAction(false)}
            {!isTwoPlayers && isFleetReady && (
              <div className="text-[9px] text-center sm:text-left text-cyan-300 leading-tight shrink-0">
                Tip: clic directo en el Radar Enemigo para iniciar con tu primer disparo.
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMBAT / FINISHED BOTTOM FLEET SIGNATURES BAR */}
      {!isPlacement && phase !== 'TURN_TRANSITION' && (
        <div className="pixel-box-cyan bg-[#0a1421] mt-0 p-1.5 sm:p-2 z-10 flex flex-col gap-1.5 shrink-0">
          {!isTwoPlayers ? (
            <>
              <div className="text-[10px] text-slate-400 flex items-center justify-between gap-2 leading-tight">
                <span className="font-arcade text-[9px] text-cyan-400 uppercase">
                  HOSTILE FLEET SIGNATURES:
                </span>
                {isAiThinking && (
                  <span className="text-amber-400 flex items-center gap-1 text-[10px] animate-pulse">
                    <PixelIcon name="activity" size={12} />
                    <span>PROLOG AI COMPUTING...</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                {FLEET_CONFIG.map(ship => {
                  const enemyPlaced = p2Ships.find(s => s.name === ship.name);
                  const isSunk = enemyPlaced ? enemyPlaced.sunk : false;

                  return (
                    <div
                      key={ship.id}
                      className={`p-1 flex flex-col justify-between gap-0.5 ${
                        isSunk
                          ? 'pixel-box-rose bg-rose-950/40 text-rose-300'
                          : 'pixel-box bg-[#0b0f19] text-slate-300'
                      }`}
                    >
                      <div className="text-[9px] font-bold truncate flex items-center justify-between gap-1 leading-tight">
                        <span className="truncate">{ship.name}</span>
                        {isSunk && (
                          <PixelIcon name="alert" size={10} className="text-rose-400 shrink-0" />
                        )}
                      </div>
                      <div className="h-3 flex items-center">
                        <PixelShipSprite
                          shipId={ship.id}
                          length={ship.length}
                          orientation="HORIZONTAL"
                          sunk={isSunk}
                          className="h-2.5 w-auto max-w-full"
                        />
                      </div>
                      <div
                        className={`text-[8px] font-arcade leading-tight ${
                          isSunk ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {isSunk ? 'SUNK' : 'ACTIVE'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {[
                { label: `FLOTA ${p1Id}`, fleet: p1Ships, color: 'text-emerald-400' },
                { label: `FLOTA ${p2Id}`, fleet: p2Ships, color: 'text-cyan-400' }
              ].map(side => (
                <div key={side.label} className="flex flex-col gap-1">
                  <div className={`font-arcade text-[8px] uppercase leading-tight ${side.color}`}>
                    {side.label} ({side.fleet.filter(s => !s.sunk).length}/5 AFLOAT)
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {FLEET_CONFIG.map(ship => {
                      const placed = side.fleet.find(s => s.id === ship.id);
                      const isSunk = placed ? placed.sunk : false;
                      return (
                        <div
                          key={ship.id}
                          className={`p-1 flex flex-col gap-0.5 ${
                            isSunk
                              ? 'pixel-box-rose bg-rose-950/40 text-rose-300'
                              : 'pixel-box bg-[#0b0f19] text-slate-300'
                          }`}
                        >
                          <div className="text-[8px] font-bold truncate leading-tight">
                            {ship.name}
                          </div>
                          <div className="h-2.5 flex items-center">
                            <PixelShipSprite
                              shipId={ship.id}
                              length={ship.length}
                              orientation="HORIZONTAL"
                              sunk={isSunk}
                              className="h-2 w-auto max-w-full"
                            />
                          </div>
                          <div
                            className={`text-[7px] font-arcade leading-tight ${
                              isSunk ? 'text-rose-400' : 'text-emerald-400'
                            }`}
                          >
                            {isSunk ? 'SUNK' : 'OK'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
