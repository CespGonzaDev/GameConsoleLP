/**
 * PixelSpriteRenderer.ts
 * Pre-renders 2D pixel-art character matrices onto offscreen <canvas> buffers
 * with imageSmoothingEnabled = false for zero-blur 60 FPS arcade rendering.
 */

export type PixelPalette = Record<string, string>;

/**
 * Creates a crisp offscreen HTMLCanvasElement from an ASCII pixel matrix.
 * '.' or ' ' are treated as transparent pixels.
 */
export function createPixelSprite(
  matrix: string[],
  palette: PixelPalette,
  pixelScale: number = 1
): HTMLCanvasElement {
  const height = matrix.length;
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width * pixelScale);
  canvas.height = Math.max(1, height * pixelScale);

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = false;

  for (let y = 0; y < height; y++) {
    const row = matrix[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * pixelScale, y * pixelScale, pixelScale, pixelScale);
    }
  }

  return canvas;
}

/**
 * Simple sprite cache keyed by sprite id so matrices are compiled only once.
 */
export class PixelSpriteCache {
  private cache = new Map<string, HTMLCanvasElement>();

  public getOrCreate(
    key: string,
    matrix: string[],
    palette: PixelPalette,
    pixelScale: number = 1
  ): HTMLCanvasElement {
    const existing = this.cache.get(key);
    if (existing) return existing;
    const sprite = createPixelSprite(matrix, palette, pixelScale);
    this.cache.set(key, sprite);
    return sprite;
  }

  public clear(): void {
    this.cache.clear();
  }
}
