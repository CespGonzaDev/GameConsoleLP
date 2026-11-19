import React, { useState } from 'react';
import { GameId } from '../../types/contracts';
import { ActiveSession, GameSessionManager } from '../../core/GameSessionManager';
import { PixelIcon, PixelIconName } from '../pixel/PixelIcon';

interface ArcadeLobbyProps {
  onLaunchGame: (
    gameId: GameId,
    mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO',
    playerName: string,
    player2Name: string
  ) => void;
  activeSessions: ActiveSession[];
}

interface GameCardMeta {
  id: GameId;
  cartCode: string;
  title: string;
  subtitle: string;
  tagline: string;
  headerBg: string;
  headerText: string;
  iconBg: string;
  iconText: string;
  badgeText: string;
  icon: PixelIconName;
  modes: Array<{
    id: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO';
    label: string;
    icon: PixelIconName;
  }>;
  scalaPattern: string;
  controls: string[];
}

const GAMES: GameCardMeta[] = [
  {
    id: 'snake',
    cartCode: 'ROM-01',
    title: 'SNAKE NEO',
    subtitle: 'CANVAS 2D · 60 FPS',
    tagline: 'Sobrevive devorando ítems pixel-art con estela articulada y velocidad progresiva.',
    headerBg: 'bg-[#10b981]',
    headerText: 'text-[#0f172a]',
    iconBg: 'bg-[#10b981]',
    iconText: 'text-[#fffbeb]',
    badgeText: 'SOLO',
    icon: 'gamepad',
    modes: [{ id: 'SOLO', label: '1P CLASSIC', icon: 'user' }],
    scalaPattern: 'Eficiencia de movimiento (giros por comida)',
    controls: ['WASD o Flechas para girar', 'Botón Pausa en barra superior', 'Swipe en móvil']
  },
  {
    id: 'battleship',
    cartCode: 'ROM-02',
    title: 'BATTLESHIP AI',
    subtitle: 'RADAR 16-BIT · PROLOG / 2P',
    tagline: 'Despliega 5 navíos y combate contra la IA lógica SWI-Prolog o en duelo local por turnos.',
    headerBg: 'bg-[#0284c7]',
    headerText: 'text-white',
    iconBg: 'bg-[#0284c7]',
    iconText: 'text-white',
    badgeText: 'AI / 2P',
    icon: 'crosshair',
    modes: [
      { id: 'SINGLE_VS_AI', label: '1P VS PROLOG IA', icon: 'cpu' },
      { id: 'TWO_PLAYERS_LOCAL', label: '2P TURNOS LOCAL', icon: 'gamepad' }
    ],
    scalaPattern: 'DEADLY_STREAK (>= 3 impactos + hundimiento)',
    controls: [
      'Tecla R para rotar barco al desplegar',
      'Click en radar enemigo para disparar',
      '2P oculta flotas entre turnos locales'
    ]
  },
  {
    id: 'head_football',
    cartCode: 'ROM-03',
    title: 'HEAD FOOTBALL',
    subtitle: 'FÍSICA 2D · 90S COUNTDOWN',
    tagline: 'Fútbol arcade con gravedad, cabezazos, patadas y cuenta regresiva de 90 segundos.',
    headerBg: 'bg-[#f59e0b]',
    headerText: 'text-[#0f172a]',
    iconBg: 'bg-[#f59e0b]',
    iconText: 'text-[#0f172a]',
    badgeText: '1P / 2P',
    icon: 'trophy',
    modes: [
      { id: 'SINGLE_VS_AI', label: '1P VS CPU', icon: 'cpu' },
      { id: 'TWO_PLAYERS_LOCAL', label: '2P LOCAL', icon: 'gamepad' }
    ],
    scalaPattern: 'COMEBACK (Remontada tras déficit >= 2 goles)',
    controls: ['P1: A/D mover, W saltar, Espacio/S/F patear', 'P2: Flechas + Enter/M (o J/L/I)']
  }
];

/**
 * Animated 16-bit Pixel Art SVG Cartridge Screen Previews (cheerful bright palette, crispEdges)
 */
const CartridgePreviewSvg: React.FC<{ gameId: GameId }> = ({ gameId }) => {
  if (gameId === 'snake') {
    return (
      <svg
        viewBox="0 0 64 32"
        shapeRendering="crispEdges"
        className="w-full h-24 bg-[#dcfce7] border-[3px] border-[#0f172a] pixelated"
        aria-hidden="true"
      >
        <rect x="0" y="0" width="64" height="32" fill="#dcfce7" />
        <rect x="16" y="0" width="1" height="32" fill="#bbf7d0" />
        <rect x="32" y="0" width="1" height="32" fill="#bbf7d0" />
        <rect x="48" y="0" width="1" height="32" fill="#bbf7d0" />
        <rect x="0" y="16" width="64" height="1" fill="#bbf7d0" />
        {/* Cheerful corner flowers/pixels */}
        <rect x="4" y="4" width="2" height="2" fill="#facc15" />
        <rect x="56" y="25" width="2" height="2" fill="#38bdf8" />
        <g>
          <animateTransform
            attributeName="transform"
            type="translate"
            values="0,0; 4,0; 4,-2; 0,0"
            dur="2.4s"
            repeatCount="indefinite"
            calcMode="discrete"
          />
          <rect x="10" y="18" width="4" height="4" fill="#047857" />
          <rect x="14" y="18" width="4" height="4" fill="#059669" />
          <rect x="18" y="18" width="4" height="4" fill="#10b981" />
          <rect x="18" y="14" width="4" height="4" fill="#10b981" />
          <rect x="22" y="14" width="4" height="4" fill="#34d399" />
          <rect x="26" y="13" width="6" height="6" fill="#22c55e" />
          <rect x="29" y="14" width="1" height="1" fill="#0f172a" />
          <rect x="29" y="17" width="1" height="1" fill="#0f172a" />
          <rect x="32" y="15" width="3" height="1" fill="#f43f5e">
            <animate attributeName="width" values="3;1;3" dur="0.8s" repeatCount="indefinite" calcMode="discrete" />
          </rect>
        </g>
        <g>
          <animate attributeName="opacity" values="1;0.75;1" dur="1s" repeatCount="indefinite" calcMode="discrete" />
          <rect x="46" y="12" width="5" height="5" fill="#f43f5e" />
          <rect x="47" y="13" width="1" height="1" fill="#fffbeb" />
          <rect x="48" y="10" width="2" height="2" fill="#15803d" />
        </g>
      </svg>
    );
  }

  if (gameId === 'battleship') {
    return (
      <svg
        viewBox="0 0 64 32"
        shapeRendering="crispEdges"
        className="w-full h-24 bg-[#bae6fd] border-[3px] border-[#0f172a] pixelated"
        aria-hidden="true"
      >
        {/* Bright daytime sky + ocean */}
        <rect x="0" y="0" width="64" height="11" fill="#bae6fd" />
        <rect x="6" y="3" width="8" height="3" fill="#ffffff" />
        <rect x="8" y="2" width="4" height="1" fill="#ffffff" />
        <rect x="46" y="4" width="6" height="2" fill="#ffffff" />
        <rect x="0" y="11" width="64" height="21" fill="#0ea5e9" />
        <rect x="0" y="16" width="64" height="1" fill="#38bdf8" />
        <rect x="0" y="24" width="64" height="1" fill="#0284c7" />
        <rect x="32" y="11" width="1" height="21" fill="#0284c7" />
        {/* Cheerful 16-bit Battleship */}
        <rect x="9" y="19" width="20" height="4" fill="#334155" />
        <rect x="10" y="18" width="18" height="2" fill="#f8fafc" />
        <rect x="14" y="14" width="8" height="4" fill="#cbd5e1" />
        <rect x="17" y="11" width="2" height="3" fill="#475569" />
        <rect x="19" y="11" width="3" height="2" fill="#f43f5e" />
        {/* Sunny radar sweep */}
        <rect x="0" y="11" width="3" height="21" fill="#facc15" opacity="0.45">
          <animate attributeName="x" values="0;16;32;48;61;0" dur="2.5s" repeatCount="indefinite" calcMode="discrete" />
        </rect>
        {/* Target reticle */}
        <g>
          <animate attributeName="opacity" values="1;0.4;1" dur="0.9s" repeatCount="indefinite" calcMode="discrete" />
          <rect x="41" y="14" width="6" height="1" fill="#facc15" />
          <rect x="41" y="21" width="6" height="1" fill="#facc15" />
          <rect x="40" y="15" width="1" height="6" fill="#facc15" />
          <rect x="47" y="15" width="1" height="6" fill="#facc15" />
          <rect x="43" y="17" width="2" height="2" fill="#f43f5e" />
        </g>
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 64 32"
      shapeRendering="crispEdges"
      className="w-full h-24 bg-[#7dd3fc] border-[3px] border-[#0f172a] pixelated"
      aria-hidden="true"
    >
      {/* Bright daytime stadium sky + sun + clouds */}
      <rect x="0" y="0" width="64" height="23" fill="#7dd3fc" />
      <rect x="52" y="2" width="5" height="5" fill="#facc15" />
      <rect x="10" y="4" width="8" height="3" fill="#ffffff" />
      <rect x="12" y="3" width="4" height="1" fill="#ffffff" />
      {/* Striped bright pixel turf */}
      <rect x="0" y="23" width="64" height="9" fill="#22c55e" />
      <rect x="8" y="23" width="8" height="9" fill="#16a34a" />
      <rect x="24" y="23" width="8" height="9" fill="#16a34a" />
      <rect x="40" y="23" width="8" height="9" fill="#16a34a" />
      <rect x="56" y="23" width="8" height="9" fill="#16a34a" />
      {/* Crisp goalposts */}
      <rect x="2" y="12" width="2" height="11" fill="#ffffff" />
      <rect x="2" y="12" width="5" height="2" fill="#ffffff" />
      <rect x="60" y="12" width="2" height="11" fill="#ffffff" />
      <rect x="57" y="12" width="5" height="2" fill="#ffffff" />
      {/* Player 1 (Sunny Gold) */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-3; 0,0"
          dur="1.2s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
        <rect x="14" y="12" width="6" height="6" fill="#facc15" />
        <rect x="18" y="14" width="1" height="1" fill="#0f172a" />
        <rect x="15" y="18" width="4" height="5" fill="#f59e0b" />
      </g>
      {/* Player 2 (Ocean Blue / Coral) */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 0,-2; 0,0"
          dur="1.5s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
        <rect x="44" y="12" width="6" height="6" fill="#0284c7" />
        <rect x="45" y="14" width="1" height="1" fill="#ffffff" />
        <rect x="45" y="18" width="4" height="5" fill="#f43f5e" />
      </g>
      {/* Bouncing soccer ball */}
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values="0,0; 5,-6; 10,0; 5,-4; 0,0"
          dur="1.6s"
          repeatCount="indefinite"
          calcMode="discrete"
        />
        <rect x="26" y="18" width="4" height="4" fill="#ffffff" />
        <rect x="27" y="19" width="2" height="2" fill="#0f172a" />
      </g>
    </svg>
  );
};

export const ArcadeLobby: React.FC<ArcadeLobbyProps> = ({ onLaunchGame, activeSessions }) => {
  const [playerName, setPlayerName] = useState<string>('Player1');
  const [player2Name, setPlayer2Name] = useState<string>('Player2');
  const [selectedGameId, setSelectedGameId] = useState<GameId>('snake');
  const [selectedModes, setSelectedModes] = useState<
    Record<GameId, 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO'>
  >({
    snake: 'SOLO',
    battleship: 'SINGLE_VS_AI',
    head_football: 'SINGLE_VS_AI'
  });

  const isAnyTwoPlayerSelected = Object.values(selectedModes).some(
    (mode) => mode === 'TWO_PLAYERS_LOCAL'
  );

  const handleModeChange = (
    gameId: GameId,
    mode: 'SINGLE_VS_AI' | 'TWO_PLAYERS_LOCAL' | 'SOLO'
  ) => {
    setSelectedModes((prev) => ({ ...prev, [gameId]: mode }));
  };

  const handleOpenStandaloneTab = (gameId: GameId) => {
    const mode = selectedModes[gameId] || 'SOLO';
    GameSessionManager.openInNewTab(
      gameId,
      undefined,
      mode,
      playerName || 'Player1',
      player2Name || 'Player2'
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Cheerful 16-Bit Console Header Bar + Dual Player Tag Setup */}
      <div className="bg-[#fffbeb] pixel-box p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-arcade text-[#0f172a]">
            <span className="bg-[#facc15] border-2 border-[#0f172a] px-2 py-1 shadow-[2px_2px_0_0_#0f172a]">
              16-BIT CONSOLE
            </span>
            <span className="bg-[#e0f2fe] border-2 border-[#0f172a] px-2 py-1 inline-flex items-center space-x-1.5 shadow-[2px_2px_0_0_#0f172a]">
              <PixelIcon name="cpu" size={11} className="text-[#0284c7]" />
              <span>PROLOG AI READY</span>
            </span>
            <span className="bg-[#d1fae5] border-2 border-[#0f172a] px-2 py-1 inline-flex items-center space-x-1.5 shadow-[2px_2px_0_0_#0f172a]">
              <PixelIcon name="layers" size={11} className="text-[#059669]" />
              <span>2P LOCAL &amp; MULTI-TAB</span>
            </span>
          </div>

          <h1 className="text-lg sm:text-2xl font-arcade text-[#0f172a] uppercase tracking-wide pt-1">
            SELECT CARTRIDGE
          </h1>

          <p className="text-xs font-pixel text-[#334155] max-w-2xl">
            Elige un cartucho para jugar solo o en duelo 2P local, en el dock multi-instancia o en pestañas independientes.
          </p>
        </div>

        {/* Dual Player Tag Box */}
        <div className="bg-[#f8fafc] border-[3px] border-[#0f172a] shadow-[4px_4px_0_0_#0f172a] p-3.5 w-full xl:w-auto xl:min-w-[390px]">
          <div className="text-[10px] font-arcade uppercase text-[#0f172a] mb-2.5 flex items-center justify-between gap-2">
            <span className="flex items-center space-x-1.5">
              <PixelIcon name="user" size={12} className="text-[#2563eb]" />
              <span>PLAYER TAGS</span>
            </span>
            <div className="flex items-center space-x-1.5">
              {isAnyTwoPlayerSelected && (
                <span className="bg-[#facc15] text-[#0f172a] border-2 border-[#0f172a] px-1.5 py-0.5 text-[9px] font-arcade">
                  2P READY
                </span>
              )}
              <span className="bg-[#e0f2fe] text-[#0f172a] border-2 border-[#0f172a] px-1.5 py-0.5 text-[9px] font-arcade">
                ACTIVO: {activeSessions.length}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {/* PLAYER 1 TAG */}
            <div className="bg-white border-2 border-[#0f172a] p-2">
              <label
                htmlFor="lobby-player1-tag"
                className="text-[9px] font-arcade uppercase text-[#047857] mb-1 flex items-center justify-between"
              >
                <span>PLAYER 1 TAG</span>
                <span className="bg-[#22c55e] text-[#0f172a] border border-[#0f172a] px-1 py-0.2 text-[8px]">
                  1UP
                </span>
              </label>
              <input
                id="lobby-player1-tag"
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={16}
                placeholder="Player1"
                className="bg-[#f8fafc] border-2 border-[#0f172a] px-2.5 py-1 text-sm font-pixel text-[#0f172a] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#10b981] w-full"
              />
            </div>

            {/* PLAYER 2 TAG (Highlighted when any game has TWO_PLAYERS_LOCAL selected) */}
            <div
              className={`border-2 p-2 transition-colors ${
                isAnyTwoPlayerSelected
                  ? 'bg-[#fef3c7] border-[#f59e0b] shadow-[2px_2px_0_0_#0f172a]'
                  : 'bg-[#f1f5f9] border-[#94a3b8]'
              }`}
            >
              <label
                htmlFor="lobby-player2-tag"
                className={`text-[9px] font-arcade uppercase mb-1 flex items-center justify-between ${
                  isAnyTwoPlayerSelected ? 'text-[#92400e]' : 'text-[#475569]'
                }`}
              >
                <span>PLAYER 2 TAG</span>
                <span
                  className={`border px-1 py-0.2 text-[8px] ${
                    isAnyTwoPlayerSelected
                      ? 'bg-[#facc15] text-[#0f172a] border-[#0f172a]'
                      : 'bg-white text-[#475569] border-[#94a3b8]'
                  }`}
                >
                  2UP
                </span>
              </label>
              <input
                id="lobby-player2-tag"
                type="text"
                value={player2Name}
                onChange={(e) => setPlayer2Name(e.target.value)}
                maxLength={16}
                placeholder="Player2"
                className={`border-2 px-2.5 py-1 text-sm font-pixel text-[#0f172a] placeholder-slate-400 focus:outline-none w-full ${
                  isAnyTwoPlayerSelected
                    ? 'bg-white border-[#0f172a] focus:border-[#d97706]'
                    : 'bg-white border-[#64748b] focus:border-[#0284c7]'
                }`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bright Cream/Ivory Cartridge Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {GAMES.map((game) => {
          const isSelectedCard = selectedGameId === game.id;
          const currentMode = selectedModes[game.id] || game.modes[0].id;
          const matchingActiveSessions = activeSessions.filter((s) => s.gameId === game.id);

          return (
            <article
              key={game.id}
              onClick={() => setSelectedGameId(game.id)}
              className={`bg-[#fffbeb] flex flex-col justify-between cursor-pointer transition-transform duration-100 hover:-translate-y-0.5 ${
                isSelectedCard ? 'pixel-box-amber' : 'pixel-box'
              }`}
            >
              {/* Vibrant Game Header Strip */}
              <div
                className={`${game.headerBg} ${game.headerText} border-b-[3px] border-[#0f172a] px-4 py-2.5 flex items-center justify-between`}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-arcade font-bold">
                    {game.cartCode}
                  </span>
                  <span className="text-[10px] font-pixel font-bold text-[#0f172a] border-2 border-[#0f172a] px-1.5 py-0.5 bg-[#fffbeb]">
                    {game.badgeText}
                  </span>
                </div>

                {matchingActiveSessions.length > 0 ? (
                  <span className="bg-[#fb7185] text-[#0f172a] border-2 border-[#0f172a] px-2 py-0.5 text-[9px] font-arcade">
                    {matchingActiveSessions.length} RUN
                  </span>
                ) : (
                  <div className="flex space-x-1" aria-hidden="true">
                    <span className="w-2.5 h-1.5 bg-[#0f172a]/30 inline-block" />
                    <span className="w-2.5 h-1.5 bg-[#0f172a]/30 inline-block" />
                    <span className="w-2.5 h-1.5 bg-[#0f172a]/30 inline-block" />
                  </div>
                )}
              </div>

              {/* Cartridge Screen & Title */}
              <div className="p-4 border-b-[3px] border-[#0f172a] bg-[#f8fafc] space-y-3">
                <CartridgePreviewSvg gameId={game.id} />

                <div className="flex items-start space-x-3">
                  <div
                    className={`w-10 h-10 shrink-0 ${game.iconBg} ${game.iconText} border-2 border-[#0f172a] shadow-[2px_2px_0_0_#0f172a] flex items-center justify-center`}
                  >
                    <PixelIcon name={game.icon} size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-arcade text-sm text-[#0f172a] tracking-wide leading-snug">
                      {game.title}
                    </h3>
                    <div className="text-[10px] font-pixel font-bold text-[#475569] mt-0.5 uppercase">
                      {game.subtitle}
                    </div>
                  </div>
                </div>

                <p className="text-xs font-pixel text-[#1e293b] leading-relaxed min-h-[40px]">
                  {game.tagline}
                </p>
              </div>

              {/* Config & Controls */}
              <div className="p-4 space-y-3 flex-1 bg-[#fffbeb]">
                <div>
                  <span className="text-[9px] font-arcade uppercase text-[#475569] block mb-1.5">
                    MODO DE JUEGO
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {game.modes.map((m) => {
                      const isSelected = currentMode === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedGameId(game.id);
                            handleModeChange(game.id, m.id);
                          }}
                          className={`px-2.5 py-1.5 text-[11px] font-pixel flex items-center justify-center space-x-1.5 border-[#0f172a] pixel-btn ${
                            isSelected
                              ? 'bg-[#facc15] text-[#0f172a] font-bold'
                              : 'bg-white text-[#0f172a] hover:bg-[#e0f2fe]'
                          }`}
                        >
                          <PixelIcon
                            name={m.icon}
                            size={12}
                            className={isSelected ? 'text-[#1d4ed8]' : 'text-[#475569]'}
                          />
                          <span>{m.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#f8fafc] border-2 border-[#0f172a] p-2.5 space-y-1">
                  <div className="text-[9px] font-arcade text-[#b45309] uppercase flex items-center space-x-1">
                    <PixelIcon name="zap" size={11} className="text-[#f59e0b]" />
                    <span>SCALA: {game.scalaPattern}</span>
                  </div>
                  <ul className="text-[11px] font-pixel text-[#334155] space-y-0.5 pt-1">
                    {game.controls.map((ctrl, i) => (
                      <li key={i} className="flex items-start">
                        <span className="text-[#0284c7] font-bold mr-1.5">›</span>
                        <span>{ctrl}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 pt-0 bg-[#fffbeb] flex gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onLaunchGame(
                      game.id,
                      currentMode,
                      playerName || 'Player1',
                      player2Name || 'Player2'
                    );
                  }}
                  className="flex-1 py-2.5 px-4 bg-[#22c55e] hover:bg-[#4ade80] text-[#0f172a] font-arcade text-[11px] uppercase flex items-center justify-center space-x-2 border-[#0f172a] pixel-btn"
                >
                  <PixelIcon name="play" size={13} />
                  <span>START GAME</span>
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenStandaloneTab(game.id);
                  }}
                  title="Abrir en pestaña independiente (?tab=play)"
                  className="py-2.5 px-3 bg-[#fb7185] hover:bg-[#fda4af] text-[#0f172a] border-[#0f172a] pixel-btn flex items-center justify-center"
                >
                  <PixelIcon name="external-link" size={14} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
