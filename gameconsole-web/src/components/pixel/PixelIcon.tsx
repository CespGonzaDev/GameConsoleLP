import React from 'react';

export type PixelIconName =
  | 'gamepad'
  | 'trophy'
  | 'flame'
  | 'activity'
  | 'wifi'
  | 'wifi-off'
  | 'cpu'
  | 'shield'
  | 'play'
  | 'pause'
  | 'close'
  | 'external-link'
  | 'copy'
  | 'check'
  | 'refresh'
  | 'clock'
  | 'alert'
  | 'search'
  | 'filter'
  | 'eye'
  | 'send'
  | 'layers'
  | 'sparkles'
  | 'terminal'
  | 'monitor'
  | 'rotate'
  | 'crosshair'
  | 'maximize'
  | 'user'
  | 'zap'
  | 'anchor';

interface PixelIconProps {
  name: PixelIconName;
  size?: number;
  className?: string;
}

/**
 * 16x16 crisp-edges Pixel Art SVG Icon Library (zero smooth vectors, zero external assets).
 */
export const PixelIcon: React.FC<PixelIconProps> = ({
  name,
  size = 16,
  className = '',
}) => {
  const renderRects = () => {
    switch (name) {
      case 'gamepad':
        return (
          <>
            <rect x="2" y="4" width="12" height="7" />
            <rect x="1" y="5" width="1" height="7" />
            <rect x="14" y="5" width="1" height="7" />
            <rect x="1" y="10" width="3" height="2" />
            <rect x="12" y="10" width="3" height="2" />
            <rect x="4" y="6" width="1" height="3" fill="#0b0f19" />
            <rect x="3" y="7" width="3" height="1" fill="#0b0f19" />
            <rect x="10" y="6" width="1" height="1" fill="#0b0f19" />
            <rect x="12" y="7" width="1" height="1" fill="#0b0f19" />
            <rect x="10" y="8" width="1" height="1" fill="#0b0f19" />
          </>
        );
      case 'trophy':
        return (
          <>
            <rect x="4" y="2" width="8" height="6" />
            <rect x="2" y="3" width="2" height="3" />
            <rect x="12" y="3" width="2" height="3" />
            <rect x="5" y="8" width="6" height="2" />
            <rect x="7" y="10" width="2" height="2" />
            <rect x="4" y="12" width="8" height="2" />
            <rect x="6" y="4" width="1" height="2" fill="#0b0f19" />
          </>
        );
      case 'flame':
        return (
          <>
            <rect x="7" y="1" width="2" height="2" />
            <rect x="6" y="3" width="4" height="2" />
            <rect x="4" y="5" width="8" height="3" />
            <rect x="3" y="8" width="10" height="4" />
            <rect x="4" y="12" width="8" height="2" />
            <rect x="6" y="14" width="4" height="1" />
            <rect x="6" y="9" width="4" height="3" fill="#0b0f19" />
            <rect x="7" y="7" width="2" height="2" fill="#0b0f19" />
          </>
        );
      case 'activity':
        return (
          <>
            <rect x="1" y="8" width="3" height="2" />
            <rect x="4" y="5" width="2" height="4" />
            <rect x="6" y="3" width="2" height="9" />
            <rect x="8" y="9" width="2" height="5" />
            <rect x="10" y="6" width="2" height="4" />
            <rect x="12" y="8" width="3" height="2" />
          </>
        );
      case 'wifi':
        return (
          <>
            <rect x="3" y="3" width="10" height="2" />
            <rect x="1" y="5" width="2" height="2" />
            <rect x="13" y="5" width="2" height="2" />
            <rect x="5" y="7" width="6" height="2" />
            <rect x="3" y="9" width="2" height="1" />
            <rect x="11" y="9" width="2" height="1" />
            <rect x="7" y="11" width="2" height="3" />
          </>
        );
      case 'wifi-off':
        return (
          <>
            <rect x="2" y="2" width="2" height="2" />
            <rect x="4" y="4" width="2" height="2" />
            <rect x="6" y="6" width="2" height="2" />
            <rect x="8" y="8" width="2" height="2" />
            <rect x="10" y="10" width="2" height="2" />
            <rect x="12" y="12" width="2" height="2" />
            <rect x="8" y="3" width="5" height="2" />
            <rect x="7" y="11" width="2" height="3" />
          </>
        );
      case 'cpu':
        return (
          <>
            <rect x="4" y="4" width="8" height="8" />
            <rect x="6" y="6" width="4" height="4" fill="#0b0f19" />
            <rect x="5" y="1" width="2" height="3" />
            <rect x="9" y="1" width="2" height="3" />
            <rect x="5" y="12" width="2" height="3" />
            <rect x="9" y="12" width="2" height="3" />
            <rect x="1" y="5" width="3" height="2" />
            <rect x="1" y="9" width="3" height="2" />
            <rect x="12" y="5" width="3" height="2" />
            <rect x="12" y="9" width="3" height="2" />
          </>
        );
      case 'shield':
        return (
          <>
            <rect x="3" y="2" width="10" height="2" />
            <rect x="2" y="4" width="12" height="5" />
            <rect x="3" y="9" width="10" height="2" />
            <rect x="5" y="11" width="6" height="2" />
            <rect x="7" y="13" width="2" height="2" />
            <rect x="7" y="5" width="2" height="4" fill="#0b0f19" />
          </>
        );
      case 'play':
        return (
          <>
            <rect x="4" y="2" width="2" height="12" />
            <rect x="6" y="3" width="2" height="10" />
            <rect x="8" y="5" width="2" height="6" />
            <rect x="10" y="6" width="2" height="4" />
            <rect x="12" y="7" width="1" height="2" />
          </>
        );
      case 'pause':
        return (
          <>
            <rect x="3" y="2" width="4" height="12" />
            <rect x="9" y="2" width="4" height="12" />
          </>
        );
      case 'close':
        return (
          <>
            <rect x="3" y="3" width="2" height="2" />
            <rect x="5" y="5" width="2" height="2" />
            <rect x="7" y="7" width="2" height="2" />
            <rect x="9" y="9" width="2" height="2" />
            <rect x="11" y="11" width="2" height="2" />
            <rect x="11" y="3" width="2" height="2" />
            <rect x="9" y="5" width="2" height="2" />
            <rect x="5" y="9" width="2" height="2" />
            <rect x="3" y="11" width="2" height="2" />
          </>
        );
      case 'external-link':
        return (
          <>
            <rect x="2" y="5" width="2" height="9" />
            <rect x="2" y="12" width="9" height="2" />
            <rect x="9" y="9" width="2" height="5" />
            <rect x="2" y="5" width="5" height="2" />
            <rect x="9" y="2" width="5" height="2" />
            <rect x="12" y="2" width="2" height="5" />
            <rect x="10" y="4" width="2" height="2" />
            <rect x="8" y="6" width="2" height="2" />
          </>
        );
      case 'copy':
        return (
          <>
            <rect x="5" y="2" width="9" height="2" />
            <rect x="12" y="2" width="2" height="9" />
            <rect x="2" y="5" width="8" height="2" />
            <rect x="2" y="5" width="2" height="9" />
            <rect x="2" y="12" width="8" height="2" />
            <rect x="8" y="5" width="2" height="9" />
          </>
        );
      case 'check':
        return (
          <>
            <rect x="2" y="8" width="2" height="2" />
            <rect x="4" y="10" width="2" height="2" />
            <rect x="6" y="12" width="2" height="2" />
            <rect x="8" y="9" width="2" height="3" />
            <rect x="10" y="6" width="2" height="3" />
            <rect x="12" y="3" width="2" height="3" />
          </>
        );
      case 'refresh':
        return (
          <>
            <rect x="4" y="2" width="8" height="2" />
            <rect x="10" y="4" width="4" height="2" />
            <rect x="2" y="4" width="2" height="4" />
            <rect x="12" y="8" width="2" height="4" />
            <rect x="4" y="12" width="8" height="2" />
            <rect x="2" y="10" width="4" height="2" />
          </>
        );
      case 'clock':
        return (
          <>
            <rect x="4" y="1" width="8" height="2" />
            <rect x="4" y="13" width="8" height="2" />
            <rect x="1" y="4" width="2" height="8" />
            <rect x="13" y="4" width="2" height="8" />
            <rect x="7" y="4" width="2" height="5" />
            <rect x="9" y="7" width="3" height="2" />
          </>
        );
      case 'alert':
        return (
          <>
            <rect x="7" y="2" width="2" height="2" />
            <rect x="5" y="4" width="6" height="3" />
            <rect x="3" y="7" width="10" height="4" />
            <rect x="1" y="11" width="14" height="3" />
            <rect x="7" y="6" width="2" height="4" fill="#0b0f19" />
            <rect x="7" y="11" width="2" height="2" fill="#0b0f19" />
          </>
        );
      case 'search':
        return (
          <>
            <rect x="4" y="2" width="6" height="2" />
            <rect x="2" y="4" width="2" height="6" />
            <rect x="10" y="4" width="2" height="6" />
            <rect x="4" y="10" width="6" height="2" />
            <rect x="10" y="10" width="2" height="2" />
            <rect x="12" y="12" width="2" height="2" />
          </>
        );
      case 'filter':
        return (
          <>
            <rect x="1" y="2" width="14" height="2" />
            <rect x="3" y="4" width="10" height="2" />
            <rect x="5" y="6" width="6" height="2" />
            <rect x="7" y="8" width="2" height="6" />
          </>
        );
      case 'eye':
        return (
          <>
            <rect x="4" y="4" width="8" height="2" />
            <rect x="2" y="6" width="12" height="4" />
            <rect x="4" y="10" width="8" height="2" />
            <rect x="6" y="6" width="4" height="4" fill="#0b0f19" />
            <rect x="7" y="7" width="2" height="2" />
          </>
        );
      case 'send':
        return (
          <>
            <rect x="2" y="7" width="12" height="2" />
            <rect x="10" y="5" width="2" height="6" />
            <rect x="8" y="3" width="2" height="2" />
            <rect x="8" y="11" width="2" height="2" />
          </>
        );
      case 'layers':
        return (
          <>
            <rect x="3" y="2" width="10" height="3" />
            <rect x="2" y="7" width="12" height="2" />
            <rect x="2" y="11" width="12" height="2" />
          </>
        );
      case 'sparkles':
        return (
          <>
            <rect x="7" y="1" width="2" height="10" />
            <rect x="3" y="5" width="10" height="2" />
            <rect x="12" y="10" width="2" height="4" />
            <rect x="11" y="11" width="4" height="2" />
            <rect x="2" y="11" width="2" height="2" />
          </>
        );
      case 'terminal':
        return (
          <>
            <rect x="1" y="2" width="14" height="12" />
            <rect x="3" y="4" width="10" height="8" fill="#0b0f19" />
            <rect x="4" y="5" width="2" height="2" />
            <rect x="6" y="7" width="2" height="2" />
            <rect x="4" y="9" width="2" height="2" />
            <rect x="8" y="9" width="4" height="2" />
          </>
        );
      case 'monitor':
        return (
          <>
            <rect x="1" y="2" width="14" height="9" />
            <rect x="3" y="4" width="10" height="5" fill="#0b0f19" />
            <rect x="6" y="11" width="4" height="2" />
            <rect x="4" y="13" width="8" height="2" />
          </>
        );
      case 'rotate':
        return (
          <>
            <rect x="4" y="2" width="8" height="2" />
            <rect x="2" y="4" width="2" height="6" />
            <rect x="12" y="4" width="2" height="6" />
            <rect x="4" y="10" width="4" height="2" />
            <rect x="10" y="9" width="4" height="3" />
          </>
        );
      case 'crosshair':
        return (
          <>
            <rect x="7" y="1" width="2" height="4" />
            <rect x="7" y="11" width="2" height="4" />
            <rect x="1" y="7" width="4" height="2" />
            <rect x="11" y="7" width="4" height="2" />
            <rect x="4" y="4" width="8" height="2" />
            <rect x="4" y="10" width="8" height="2" />
            <rect x="4" y="6" width="2" height="4" />
            <rect x="10" y="6" width="2" height="4" />
            <rect x="7" y="7" width="2" height="2" />
          </>
        );
      case 'maximize':
        return (
          <>
            <rect x="2" y="2" width="4" height="2" />
            <rect x="2" y="2" width="2" height="4" />
            <rect x="10" y="2" width="4" height="2" />
            <rect x="12" y="2" width="2" height="4" />
            <rect x="2" y="12" width="4" height="2" />
            <rect x="2" y="10" width="2" height="4" />
            <rect x="10" y="12" width="4" height="2" />
            <rect x="12" y="10" width="2" height="4" />
          </>
        );
      case 'user':
        return (
          <>
            <rect x="6" y="2" width="4" height="4" />
            <rect x="4" y="8" width="8" height="2" />
            <rect x="3" y="10" width="10" height="4" />
          </>
        );
      case 'zap':
        return (
          <>
            <rect x="8" y="1" width="4" height="2" />
            <rect x="6" y="3" width="4" height="3" />
            <rect x="4" y="6" width="8" height="3" />
            <rect x="6" y="9" width="4" height="3" />
            <rect x="4" y="12" width="4" height="3" />
          </>
        );
      case 'anchor':
        return (
          <>
            <rect x="7" y="1" width="2" height="2" />
            <rect x="6" y="3" width="4" height="2" />
            <rect x="7" y="5" width="2" height="8" />
            <rect x="4" y="6" width="8" height="2" />
            <rect x="2" y="10" width="2" height="3" />
            <rect x="12" y="10" width="2" height="3" />
            <rect x="4" y="12" width="8" height="2" />
          </>
        );
    }
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      shapeRendering="crispEdges"
      className={`inline-block shrink-0 pixelated ${className}`}
      aria-hidden="true"
    >
      {renderRects()}
    </svg>
  );
};
