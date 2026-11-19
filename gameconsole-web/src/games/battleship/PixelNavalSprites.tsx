import React from 'react';
import { ShipOrientation } from './BattleshipTypes';

export type NavalShipId = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer' | string;

/**
 * Shared CSS stepped-frame keyframe animations for 16-bit pixel naval effects.
 * Uses steps(1, end) for authentic frame-by-frame pixel animation with zero smooth interpolation.
 */
export const NavalPixelStyles: React.FC = () => (
  <style>{`
    @keyframes np-water-1 {
      0%, 24% { opacity: 1; }
      25%, 100% { opacity: 0; }
    }
    @keyframes np-water-2 {
      0%, 24% { opacity: 0; }
      25%, 49% { opacity: 1; }
      50%, 100% { opacity: 0; }
    }
    @keyframes np-water-3 {
      0%, 49% { opacity: 0; }
      50%, 74% { opacity: 1; }
      75%, 100% { opacity: 0; }
    }
    @keyframes np-water-4 {
      0%, 74% { opacity: 0; }
      75%, 100% { opacity: 1; }
    }

    @keyframes np-burst-1 {
      0%, 33% { opacity: 1; }
      34%, 100% { opacity: 0; }
    }
    @keyframes np-burst-2 {
      0%, 33% { opacity: 0; }
      34%, 66% { opacity: 1; }
      67%, 100% { opacity: 0; }
    }
    @keyframes np-burst-3 {
      0%, 66% { opacity: 0; }
      67%, 99% { opacity: 1; }
      100% { opacity: 0; }
    }
    @keyframes np-ember-loop {
      0%, 49% { opacity: 1; transform: translateY(0px); }
      50%, 100% { opacity: 0.78; transform: translateY(-1px); }
    }

    @keyframes np-smoke-1 {
      0%, 33% { opacity: 0.85; }
      34%, 100% { opacity: 0; }
    }
    @keyframes np-smoke-2 {
      0%, 33% { opacity: 0; }
      34%, 66% { opacity: 0.85; }
      67%, 100% { opacity: 0; }
    }
    @keyframes np-smoke-3 {
      0%, 66% { opacity: 0; }
      67%, 100% { opacity: 0.85; }
    }

    @keyframes np-splash-1 {
      0%, 33% { opacity: 1; }
      34%, 100% { opacity: 0; }
    }
    @keyframes np-splash-2 {
      0%, 33% { opacity: 0; }
      34%, 66% { opacity: 1; }
      67%, 100% { opacity: 0; }
    }
    @keyframes np-splash-3 {
      0%, 66% { opacity: 0; }
      67%, 100% { opacity: 1; }
    }

    @keyframes np-radar-sweep {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(1000%); }
    }

    .np-wf-1 { animation: np-water-1 1.6s steps(1, end) infinite; }
    .np-wf-2 { animation: np-water-2 1.6s steps(1, end) infinite; }
    .np-wf-3 { animation: np-water-3 1.6s steps(1, end) infinite; }
    .np-wf-4 { animation: np-water-4 1.6s steps(1, end) infinite; }

    .np-exp-1 { animation: np-burst-1 0.42s steps(1, end) 1 forwards; opacity: 0; }
    .np-exp-2 { animation: np-burst-2 0.42s steps(1, end) 1 forwards; opacity: 0; }
    .np-exp-3 { animation: np-burst-3 0.42s steps(1, end) 1 forwards; opacity: 0; }
    .np-ember { animation: np-ember-loop 0.5s steps(1, end) infinite; animation-delay: 0.42s; }

    .np-smk-1 { animation: np-smoke-1 0.9s steps(1, end) infinite; }
    .np-smk-2 { animation: np-smoke-2 0.9s steps(1, end) infinite; }
    .np-smk-3 { animation: np-smoke-3 0.9s steps(1, end) infinite; }

    .np-spl-1 { animation: np-splash-1 0.5s steps(1, end) 1 forwards; opacity: 0; }
    .np-spl-2 { animation: np-splash-2 0.5s steps(1, end) 1 forwards; opacity: 0; }
    .np-spl-3 { animation: np-splash-3 0.5s steps(1, end) 1 forwards; opacity: 1; }

    .np-radar-scanline {
      animation: np-radar-sweep 3.2s steps(20, end) infinite;
    }
  `}</style>
);

interface PixelRadarWaterProps {
  variant?: 'friendly' | 'radar';
  row: number;
  col: number;
  className?: string;
}

/**
 * 16x16 animated 4-frame 16-bit radar water tile.
 */
export const PixelRadarWater: React.FC<PixelRadarWaterProps> = ({
  variant = 'friendly',
  row,
  col,
  className = '',
}) => {
  const delayMs = -(((row * 3 + col * 5) % 4) * 400);
  const style = { animationDelay: `${delayMs}ms` };

  const baseBg = variant === 'friendly' ? '#071b2e' : '#04141f';
  const subPixel = variant === 'friendly' ? '#0b253d' : '#071d2c';
  const crestDark = variant === 'friendly' ? '#0e3354' : '#0a2b3d';
  const crestBright = variant === 'friendly' ? '#1c5a85' : '#124e66';
  const radarDot = variant === 'friendly' ? '#164e63' : '#0891b2';

  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`w-full h-full block pixelated pointer-events-none ${className}`}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="16" height="16" fill={baseBg} />
      <rect x="0" y="0" width="8" height="8" fill={subPixel} opacity="0.45" />
      <rect x="8" y="8" width="8" height="8" fill={subPixel} opacity="0.45" />
      {/* Subtle sonar grid intersection pixel */}
      <rect x="0" y="0" width="1" height="1" fill={radarDot} opacity="0.45" />

      {/* Frame 1 */}
      <g className="np-wf-1" style={style}>
        <rect x="2" y="4" width="4" height="1" fill={crestDark} />
        <rect x="3" y="4" width="2" height="1" fill={crestBright} />
        <rect x="9" y="11" width="4" height="1" fill={crestDark} />
        <rect x="10" y="11" width="2" height="1" fill={crestBright} />
      </g>

      {/* Frame 2 */}
      <g className="np-wf-2" style={style}>
        <rect x="4" y="4" width="4" height="1" fill={crestDark} />
        <rect x="5" y="4" width="2" height="1" fill={crestBright} />
        <rect x="10" y="11" width="4" height="1" fill={crestDark} />
        <rect x="12" y="11" width="1" height="1" fill={crestBright} />
      </g>

      {/* Frame 3 */}
      <g className="np-wf-3" style={style}>
        <rect x="5" y="5" width="4" height="1" fill={crestDark} />
        <rect x="6" y="5" width="2" height="1" fill={crestBright} />
        <rect x="2" y="12" width="3" height="1" fill={crestDark} />
        <rect x="11" y="10" width="3" height="1" fill={crestDark} />
      </g>

      {/* Frame 4 */}
      <g className="np-wf-4" style={style}>
        <rect x="3" y="5" width="3" height="1" fill={crestDark} />
        <rect x="8" y="11" width="4" height="1" fill={crestDark} />
        <rect x="9" y="11" width="2" height="1" fill={crestBright} />
      </g>
    </svg>
  );
};

interface SegmentRenderProps {
  shipId: NavalShipId;
  segmentIndex: number;
  sunk?: boolean;
}

/**
 * Renders the 16x16 horizontal pixel-art slice for a given ship and segment index (0 = bow, length-1 = stern).
 * When sunk=true, shifts palette to charred dark hull + rust/crimson accents.
 */
function renderHorizontalShipSegment({ shipId, segmentIndex, sunk = false }: SegmentRenderProps): React.ReactNode {
  // Palette tokens
  const hullDark = sunk ? '#271216' : '#1e293b';
  const hullMid = sunk ? '#451a22' : '#475569';
  const hullLight = sunk ? '#6b2732' : '#64748b';
  const deck = sunk ? '#33151b' : '#334155';
  const trim = sunk ? '#991b1b' : '#94a3b8';
  const hi = sunk ? '#f87171' : '#e2e8f0';
  const accentCyan = sunk ? '#ef4444' : '#22d3ee';
  const accentAmber = sunk ? '#b91c1c' : '#fbbf24';
  const wake = sunk ? '#450a0a' : '#38bdf8';

  switch (shipId) {
    case 'carrier': {
      // 5 segments: 0=bow, 1=fwd-deck+jet, 2=island, 3=aft-deck+jet, 4=stern
      if (segmentIndex === 0) {
        return (
          <>
            {/* Bow wake */}
            <rect x="0" y="6" width="1" height="4" fill={wake} opacity="0.6" />
            <rect x="1" y="4" width="1" height="8" fill={wake} opacity="0.4" />
            {/* Hull & flight deck prow */}
            <rect x="2" y="4" width="14" height="8" fill={hullDark} />
            <rect x="3" y="3" width="13" height="10" fill={hullMid} />
            <rect x="4" y="4" width="12" height="8" fill={deck} />
            {/* Flight deck edge stripes */}
            <rect x="4" y="4" width="12" height="1" fill={trim} />
            <rect x="4" y="11" width="12" height="1" fill={trim} />
            {/* Catapult launch tracks */}
            <rect x="6" y="7" width="10" height="2" fill={hullDark} />
            <rect x="7" y="7" width="3" height="1" fill={accentAmber} />
            <rect x="12" y="7" width="3" height="1" fill={hi} />
          </>
        );
      }
      if (segmentIndex === 1) {
        return (
          <>
            <rect x="0" y="2" width="16" height="12" fill={hullDark} />
            <rect x="0" y="3" width="16" height="10" fill={hullMid} />
            <rect x="0" y="4" width="16" height="8" fill={deck} />
            <rect x="0" y="4" width="16" height="1" fill={trim} />
            <rect x="0" y="11" width="16" height="1" fill={trim} />
            {/* Dashed runway centerline */}
            <rect x="1" y="7" width="3" height="1" fill={hi} />
            <rect x="6" y="7" width="3" height="1" fill={hi} />
            <rect x="11" y="7" width="3" height="1" fill={hi} />
            {/* Parked mini pixel fighter jet */}
            <rect x="4" y="5" width="4" height="1" fill={accentCyan} />
            <rect x="3" y="6" width="5" height="1" fill={hi} />
            <rect x="5" y="5" width="1" height="2" fill={hullDark} />
          </>
        );
      }
      if (segmentIndex === 2) {
        return (
          <>
            <rect x="0" y="2" width="16" height="12" fill={hullDark} />
            <rect x="0" y="3" width="16" height="10" fill={hullMid} />
            <rect x="0" y="4" width="16" height="8" fill={deck} />
            <rect x="0" y="4" width="16" height="1" fill={trim} />
            {/* Runway markings */}
            <rect x="1" y="7" width="3" height="1" fill={hi} />
            <rect x="6" y="7" width="3" height="1" fill={hi} />
            <rect x="11" y="7" width="3" height="1" fill={hi} />
            {/* Starboard Control Island */}
            <rect x="3" y="9" width="10" height="4" fill={hullDark} />
            <rect x="4" y="9" width="8" height="3" fill={hullLight} />
            <rect x="5" y="10" width="3" height="1" fill={accentCyan} />
            <rect x="9" y="10" width="2" height="1" fill={accentAmber} />
            {/* Radar mast */}
            <rect x="7" y="8" width="2" height="1" fill={hi} />
          </>
        );
      }
      if (segmentIndex === 3) {
        return (
          <>
            <rect x="0" y="2" width="16" height="12" fill={hullDark} />
            <rect x="0" y="3" width="16" height="10" fill={hullMid} />
            <rect x="0" y="4" width="16" height="8" fill={deck} />
            <rect x="0" y="4" width="16" height="1" fill={trim} />
            <rect x="0" y="11" width="16" height="1" fill={trim} />
            {/* Arresting wires */}
            <rect x="3" y="5" width="1" height="6" fill={hullDark} />
            <rect x="7" y="5" width="1" height="6" fill={hullDark} />
            {/* Runway centerline */}
            <rect x="1" y="7" width="3" height="1" fill={hi} />
            <rect x="6" y="7" width="3" height="1" fill={hi} />
            <rect x="11" y="7" width="3" height="1" fill={hi} />
            {/* Second parked jet */}
            <rect x="10" y="9" width="4" height="1" fill={accentCyan} />
            <rect x="9" y="10" width="5" height="1" fill={hi} />
          </>
        );
      }
      // seg 4: stern
      return (
        <>
          <rect x="0" y="3" width="12" height="10" fill={hullDark} />
          <rect x="0" y="4" width="11" height="8" fill={deck} />
          <rect x="0" y="4" width="10" height="1" fill={trim} />
          <rect x="0" y="11" width="10" height="1" fill={trim} />
          {/* Landing threshold */}
          <rect x="8" y="5" width="2" height="6" fill={accentAmber} />
          <rect x="2" y="7" width="4" height="1" fill={hi} />
          {/* Wake */}
          <rect x="12" y="5" width="2" height="6" fill={wake} opacity="0.45" />
          <rect x="14" y="6" width="2" height="4" fill={wake} opacity="0.25" />
        </>
      );
    }

    case 'battleship': {
      // 4 segments: 0=bow+turret1, 1=turret2, 2=bridge+funnel, 3=aft-turret+stern
      if (segmentIndex === 0) {
        return (
          <>
            <rect x="0" y="7" width="2" height="2" fill={wake} opacity="0.6" />
            <rect x="2" y="6" width="3" height="4" fill={hullDark} />
            <rect x="5" y="4" width="11" height="8" fill={hullDark} />
            <rect x="6" y="5" width="10" height="6" fill={hullMid} />
            <rect x="7" y="6" width="9" height="4" fill={hullLight} />
            {/* Forward main battery turret */}
            <rect x="10" y="6" width="4" height="4" fill={trim} />
            <rect x="6" y="7" width="4" height="1" fill={hi} />
            <rect x="6" y="8" width="4" height="1" fill={hi} />
          </>
        );
      }
      if (segmentIndex === 1) {
        return (
          <>
            <rect x="0" y="3" width="16" height="10" fill={hullDark} />
            <rect x="0" y="4" width="16" height="8" fill={hullMid} />
            <rect x="0" y="5" width="16" height="6" fill={deck} />
            {/* Superfiring turret */}
            <rect x="5" y="6" width="5" height="4" fill={trim} />
            <rect x="1" y="7" width="4" height="1" fill={hi} />
            <rect x="1" y="8" width="4" height="1" fill={hi} />
            <rect x="12" y="4" width="2" height="1" fill={accentCyan} />
            <rect x="12" y="11" width="2" height="1" fill={accentCyan} />
          </>
        );
      }
      if (segmentIndex === 2) {
        return (
          <>
            <rect x="0" y="3" width="16" height="10" fill={hullDark} />
            <rect x="0" y="4" width="16" height="8" fill={hullMid} />
            <rect x="0" y="5" width="16" height="6" fill={deck} />
            {/* Armored Bridge + Smokestack */}
            <rect x="2" y="5" width="6" height="6" fill={hullLight} />
            <rect x="3" y="6" width="4" height="4" fill={trim} />
            <rect x="4" y="7" width="2" height="2" fill={accentCyan} />
            {/* Funnel */}
            <rect x="10" y="6" width="4" height="4" fill={hullDark} />
            <rect x="11" y="7" width="2" height="2" fill={accentAmber} />
          </>
        );
      }
      // seg 3: aft turret + stern
      return (
        <>
          <rect x="0" y="4" width="12" height="8" fill={hullDark} />
          <rect x="0" y="5" width="11" height="6" fill={hullMid} />
          {/* Aft turret pointing right */}
          <rect x="2" y="6" width="4" height="4" fill={trim} />
          <rect x="6" y="7" width="4" height="1" fill={hi} />
          <rect x="6" y="8" width="4" height="1" fill={hi} />
          <rect x="12" y="5" width="2" height="6" fill={wake} opacity="0.45" />
          <rect x="14" y="6" width="2" height="4" fill={wake} opacity="0.25" />
        </>
      );
    }

    case 'cruiser': {
      // 3 segments: 0=bow+gun, 1=bridge+radar, 2=aft+stern
      if (segmentIndex === 0) {
        return (
          <>
            <rect x="0" y="7" width="2" height="2" fill={wake} opacity="0.6" />
            <rect x="2" y="6" width="4" height="4" fill={hullDark} />
            <rect x="6" y="4" width="10" height="8" fill={hullDark} />
            <rect x="7" y="5" width="9" height="6" fill={hullMid} />
            {/* Forward turret */}
            <rect x="10" y="6" width="4" height="4" fill={trim} />
            <rect x="6" y="7" width="4" height="2" fill={hi} />
          </>
        );
      }
      if (segmentIndex === 1) {
        return (
          <>
            <rect x="0" y="4" width="16" height="8" fill={hullDark} />
            <rect x="0" y="5" width="16" height="6" fill={hullMid} />
            {/* Bridge & emerald/cyan radar */}
            <rect x="3" y="5" width="6" height="6" fill={hullLight} />
            <rect x="5" y="6" width="2" height="4" fill={sunk ? '#ef4444' : '#10b981'} />
            <rect x="11" y="6" width="3" height="4" fill={hullDark} />
            <rect x="12" y="7" width="1" height="2" fill={accentAmber} />
          </>
        );
      }
      return (
        <>
          <rect x="0" y="4" width="12" height="8" fill={hullDark} />
          <rect x="0" y="5" width="11" height="6" fill={hullMid} />
          <rect x="2" y="6" width="4" height="4" fill={trim} />
          <rect x="6" y="7" width="3" height="2" fill={hi} />
          <rect x="12" y="5" width="2" height="6" fill={wake} opacity="0.4" />
          <rect x="14" y="6" width="2" height="4" fill={wake} opacity="0.2" />
        </>
      );
    }

    case 'submarine': {
      const subHull = sunk ? '#271216' : '#1f2937';
      const subBody = sunk ? '#451a22' : '#374151';
      const subHi = sunk ? '#991b1b' : '#6b7280';
      if (segmentIndex === 0) {
        return (
          <>
            <rect x="1" y="7" width="2" height="2" fill={wake} opacity="0.4" />
            <rect x="3" y="6" width="3" height="4" fill={subHull} />
            <rect x="6" y="5" width="10" height="6" fill={subHull} />
            <rect x="7" y="6" width="9" height="4" fill={subBody} />
            {/* Diving planes */}
            <rect x="9" y="4" width="2" height="1" fill={subHi} />
            <rect x="9" y="11" width="2" height="1" fill={subHi} />
            {/* Amber nose stripe */}
            <rect x="7" y="7" width="2" height="2" fill={accentAmber} />
          </>
        );
      }
      if (segmentIndex === 1) {
        return (
          <>
            <rect x="0" y="5" width="16" height="6" fill={subHull} />
            <rect x="0" y="6" width="16" height="4" fill={subBody} />
            {/* Conning tower (sail) */}
            <rect x="4" y="5" width="7" height="6" fill={subHi} />
            <rect x="5" y="6" width="5" height="4" fill={hullDark} />
            {/* Periscope & hatch */}
            <rect x="6" y="7" width="2" height="2" fill={accentAmber} />
            <rect x="9" y="7" width="1" height="2" fill={accentCyan} />
          </>
        );
      }
      return (
        <>
          <rect x="0" y="5" width="9" height="6" fill={subHull} />
          <rect x="0" y="6" width="8" height="4" fill={subBody} />
          <rect x="9" y="6" width="3" height="4" fill={subHull} />
          {/* Tail fins & propeller */}
          <rect x="10" y="4" width="2" height="2" fill={subHi} />
          <rect x="10" y="10" width="2" height="2" fill={subHi} />
          <rect x="12" y="6" width="1" height="4" fill={accentAmber} />
          <rect x="13" y="7" width="2" height="2" fill={wake} opacity="0.45" />
        </>
      );
    }

    case 'destroyer':
    default: {
      // 2 segments: 0=bow+gun, 1=bridge+stern
      if (segmentIndex === 0) {
        return (
          <>
            <rect x="0" y="7" width="2" height="2" fill={wake} opacity="0.5" />
            <rect x="2" y="6" width="4" height="4" fill={hullDark} />
            <rect x="6" y="4" width="10" height="8" fill={hullDark} />
            <rect x="7" y="5" width="9" height="6" fill={hullMid} />
            <rect x="10" y="6" width="4" height="4" fill={trim} />
            <rect x="6" y="7" width="4" height="2" fill={hi} />
          </>
        );
      }
      return (
        <>
          <rect x="0" y="4" width="12" height="8" fill={hullDark} />
          <rect x="0" y="5" width="11" height="6" fill={hullMid} />
          <rect x="2" y="5" width="4" height="6" fill={hullLight} />
          <rect x="3" y="7" width="2" height="2" fill={sunk ? '#ef4444' : '#f43f5e'} />
          <rect x="8" y="6" width="2" height="4" fill={trim} />
          <rect x="12" y="5" width="2" height="6" fill={wake} opacity="0.4" />
          <rect x="14" y="6" width="2" height="4" fill={wake} opacity="0.2" />
        </>
      );
    }
  }
}

interface PixelShipSegmentProps {
  shipId: NavalShipId;
  orientation: ShipOrientation;
  segmentIndex: number;
  sunk?: boolean;
  ghost?: boolean;
  ghostValid?: boolean;
  className?: string;
}

/**
 * Single 16x16 grid-cell segment of a 16-bit warship, aligned to the crisp pixel grid
 * for both HORIZONTAL and VERTICAL orientations.
 */
export const PixelShipSegment: React.FC<PixelShipSegmentProps> = ({
  shipId,
  orientation,
  segmentIndex,
  sunk = false,
  ghost = false,
  ghostValid = true,
  className = '',
}) => {
  const content = renderHorizontalShipSegment({ shipId, segmentIndex, sunk });

  return (
    <svg
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`w-full h-full block pixelated pointer-events-none ${
        ghost ? (ghostValid ? 'opacity-75' : 'opacity-65') : ''
      } ${className}`}
      aria-hidden="true"
    >
      {orientation === 'VERTICAL' ? (
        <g transform="rotate(90 8 8)">{content}</g>
      ) : (
        content
      )}
      {ghost && (
        <rect
          x="0"
          y="0"
          width="16"
          height="16"
          fill={ghostValid ? '#10b981' : '#f43f5e'}
          opacity="0.25"
        />
      )}
    </svg>
  );
};

interface PixelShipSpriteProps {
  shipId: NavalShipId;
  length: number;
  orientation?: ShipOrientation;
  sunk?: boolean;
  className?: string;
}

/**
 * Full multi-cell 16-bit warship SVG sprite (useful for fleet selector & damage roster).
 */
export const PixelShipSprite: React.FC<PixelShipSpriteProps> = ({
  shipId,
  length,
  orientation = 'HORIZONTAL',
  sunk = false,
  className = '',
}) => {
  const width = orientation === 'HORIZONTAL' ? length * 16 : 16;
  const height = orientation === 'HORIZONTAL' ? 16 : length * 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      shapeRendering="crispEdges"
      className={`block pixelated pointer-events-none ${className}`}
      aria-hidden="true"
    >
      {Array.from({ length }, (_, idx) => {
        const seg = renderHorizontalShipSegment({ shipId, segmentIndex: idx, sunk });
        if (orientation === 'HORIZONTAL') {
          return (
            <g key={idx} transform={`translate(${idx * 16}, 0)`}>
              {seg}
            </g>
          );
        }
        return (
          <g key={idx} transform={`translate(0, ${idx * 16}) rotate(90 8 8)`}>
            {seg}
          </g>
        );
      })}
    </svg>
  );
};

/**
 * Multi-frame stepped 16-bit pixel explosion + persistent burning ember for HIT cells.
 */
export const PixelExplosion: React.FC<{ sunk?: boolean; className?: string }> = ({
  sunk = false,
  className = '',
}) => (
  <svg
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className={`w-full h-full block pixelated pointer-events-none ${className}`}
    aria-hidden="true"
  >
    {/* Frame 1: White-hot core */}
    <g className="np-exp-1">
      <rect x="6" y="6" width="4" height="4" fill="#fef08a" />
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
      <rect x="5" y="7" width="1" height="2" fill="#f97316" />
      <rect x="10" y="7" width="1" height="2" fill="#f97316" />
      <rect x="7" y="5" width="2" height="1" fill="#f97316" />
      <rect x="7" y="10" width="2" height="1" fill="#f97316" />
    </g>

    {/* Frame 2: Expanding fireball */}
    <g className="np-exp-2">
      <rect x="4" y="4" width="8" height="8" fill="#ea580c" />
      <rect x="5" y="5" width="6" height="6" fill="#facc15" />
      <rect x="7" y="7" width="2" height="2" fill="#ffffff" />
      <rect x="2" y="7" width="2" height="2" fill="#ef4444" />
      <rect x="12" y="7" width="2" height="2" fill="#ef4444" />
      <rect x="7" y="2" width="2" height="2" fill="#ef4444" />
      <rect x="7" y="12" width="2" height="2" fill="#ef4444" />
    </g>

    {/* Frame 3: Blast shards */}
    <g className="np-exp-3">
      <rect x="2" y="2" width="2" height="2" fill="#f97316" />
      <rect x="12" y="2" width="2" height="2" fill="#f97316" />
      <rect x="2" y="12" width="2" height="2" fill="#f97316" />
      <rect x="12" y="12" width="2" height="2" fill="#f97316" />
      <rect x="5" y="4" width="6" height="8" fill="#dc2626" />
      <rect x="4" y="5" width="8" height="6" fill="#dc2626" />
      <rect x="6" y="6" width="4" height="4" fill="#fbbf24" />
    </g>

    {/* Persistent flickering fire/ember */}
    <g className="np-ember">
      <rect x="6" y="4" width="4" height="2" fill={sunk ? '#dc2626' : '#f97316'} />
      <rect x="5" y="6" width="6" height="5" fill={sunk ? '#b91c1c' : '#ef4444'} />
      <rect x="6" y="7" width="4" height="4" fill="#f97316" />
      <rect x="7" y="8" width="2" height="3" fill="#fde047" />
      <rect x="4" y="11" width="8" height="2" fill="#7f1d1d" />
    </g>
  </svg>
);

/**
 * Multi-frame rising 16-bit pixel smoke column for damaged or sunk ships.
 */
export const PixelSmokeColumn: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className={`w-full h-full block pixelated pointer-events-none ${className}`}
    aria-hidden="true"
  >
    {/* Smoke Frame 1 */}
    <g className="np-smk-1">
      <rect x="6" y="5" width="4" height="3" fill="#334155" />
      <rect x="7" y="4" width="2" height="1" fill="#475569" />
      <rect x="5" y="2" width="3" height="2" fill="#1e293b" />
    </g>
    {/* Smoke Frame 2 */}
    <g className="np-smk-2">
      <rect x="5" y="4" width="4" height="3" fill="#475569" />
      <rect x="7" y="1" width="4" height="3" fill="#334155" />
      <rect x="8" y="0" width="2" height="1" fill="#64748b" />
    </g>
    {/* Smoke Frame 3 */}
    <g className="np-smk-3">
      <rect x="7" y="3" width="4" height="3" fill="#334155" />
      <rect x="5" y="0" width="4" height="3" fill="#1e293b" />
      <rect x="6" y="1" width="2" height="1" fill="#475569" />
    </g>
  </svg>
);

/**
 * Multi-frame 16-bit water splash + settled sonar ripple for MISS cells.
 */
export const PixelWaterSplash: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className={`w-full h-full block pixelated pointer-events-none ${className}`}
    aria-hidden="true"
  >
    {/* Frame 1: High splash droplets */}
    <g className="np-spl-1">
      <rect x="7" y="3" width="2" height="6" fill="#e0f2fe" />
      <rect x="5" y="5" width="2" height="3" fill="#38bdf8" />
      <rect x="9" y="5" width="2" height="3" fill="#38bdf8" />
      <rect x="6" y="9" width="4" height="2" fill="#0ea5e9" />
    </g>

    {/* Frame 2: Expanding pixel ring */}
    <g className="np-spl-2">
      <rect x="4" y="6" width="2" height="2" fill="#bae6fd" />
      <rect x="10" y="6" width="2" height="2" fill="#bae6fd" />
      <rect x="5" y="9" width="6" height="2" fill="#38bdf8" />
      <rect x="4" y="10" width="8" height="1" fill="#0284c7" />
    </g>

    {/* Frame 3: Settled pixel ripple marker */}
    <g className="np-spl-3">
      <rect x="5" y="6" width="6" height="1" fill="#38bdf8" opacity="0.65" />
      <rect x="5" y="9" width="6" height="1" fill="#38bdf8" opacity="0.65" />
      <rect x="4" y="7" width="1" height="2" fill="#38bdf8" opacity="0.65" />
      <rect x="11" y="7" width="1" height="2" fill="#38bdf8" opacity="0.65" />
      <rect x="7" y="7" width="2" height="2" fill="#94a3b8" />
    </g>
  </svg>
);
