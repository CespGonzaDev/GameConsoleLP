import { BaseGame, IEventDispatcher, BaseGameOptions } from '../core/BaseGame';
import {
  SnakeChangeDirectionPayload,
  SnakeEatFoodPayload,
  SnakeCollisionPayload
} from '../types/contracts';
import { PixelSpriteCache, PixelPalette } from './pixel/PixelSpriteRenderer';

export type SnakeDirection = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

interface Point {
  x: number;
  y: number;
}

interface FoodItem {
  x: number;
  y: number;
  type: string;
  points: number;
  color: string;
  pulsePhase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  life: number;
  maxLife: number;
}

export class SnakeGame extends BaseGame {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  // Grid dimensions
  private readonly cols: number = 25;
  private readonly rows: number = 25;
  private cellSize: number = 24;

  // Snake State
  private snake: Point[] = [];
  private currentDirection: SnakeDirection = 'RIGHT';
  private nextDirection: SnakeDirection = 'RIGHT';
  private moveTimer: number = 0;
  private moveInterval: number = 0.12; // 120ms per step initially
  private speedBoost: number = 1.0;

  // Food and effects
  private food: FoodItem | null = null;
  private particles: Particle[] = [];
  private tonguePhase: number = 0;
  private pulseTimer: number = 0;

  // Pixel Art Offscreen Sprite Cache
  private spriteCache = new PixelSpriteCache();
  private bgCanvas: HTMLCanvasElement | null = null;
  private bgBoardSize: number = 0;

  // Audio synthesis (Web Audio API procedural sound - zero external assets)
  private audioCtx: AudioContext | null = null;

  // Key listeners bound
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;
  private touchStartX: number = 0;
  private touchStartY: number = 0;

  constructor(
    playerId: string,
    dispatcher: IEventDispatcher,
    options: BaseGameOptions = {}
  ) {
    super('snake', playerId, dispatcher, {
      gameVersion: options.gameVersion || '1.0.0',
      gameMode: options.gameMode || 'SOLO',
      ...options
    });

    this.boundKeyDown = this.handleKeyDown.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);
    this.resetState();
  }

  private initAudio(): void {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
  }

  private playTone(freq: number, type: OscillatorType, duration: number, gainVal: number = 0.1): void {
    try {
      this.initAudio();
      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx?.resume();
      }
      if (!this.audioCtx) return;

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  private resetState(): void {
    const startX = Math.floor(this.cols / 4);
    const startY = Math.floor(this.rows / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.currentDirection = 'RIGHT';
    this.nextDirection = 'RIGHT';
    this.moveTimer = 0;
    this.currentScore = 0;
    this.speedBoost = 1.0;
    this.particles = [];
    this.spawnFood();
  }

  protected override onStart(): void {
    this.resetState();
    this.attachEventListeners();
    this.playTone(440, 'sine', 0.1, 0.15);
  }

  private attachEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('touchstart', this.boundTouchStart, { passive: true });
      window.addEventListener('touchend', this.boundTouchEnd, { passive: true });
    }
  }

  private detachEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('touchstart', this.boundTouchStart);
      window.removeEventListener('touchend', this.boundTouchEnd);
    }
  }

  private isViewportActiveForInput(): boolean {
    if (typeof document === 'undefined') return true;
    const viewports = document.querySelectorAll('[data-game-viewport]');
    if (viewports.length <= 1) return true;
    const myViewport = this.canvas?.closest('[data-game-viewport]');
    if (!myViewport) return false;
    return myViewport.contains(document.activeElement);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (this.status !== 'PLAYING' || !this.isViewportActiveForInput()) return;

    let requestedDir: SnakeDirection | null = null;
    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        requestedDir = 'UP';
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        requestedDir = 'DOWN';
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        requestedDir = 'LEFT';
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        requestedDir = 'RIGHT';
        break;
    }

    if (requestedDir) {
      e.preventDefault();
      this.setDirection(requestedDir);
    }
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length > 0) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }
  }

  private handleTouchEnd(e: TouchEvent): void {
    if (this.status !== 'PLAYING' || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 20) {
      if (absX > absY) {
        this.setDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        this.setDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
  }

  public setDirection(newDir: SnakeDirection): void {
    // Avoid reversing directly into oneself
    if (
      (newDir === 'UP' && this.currentDirection === 'DOWN') ||
      (newDir === 'DOWN' && this.currentDirection === 'UP') ||
      (newDir === 'LEFT' && this.currentDirection === 'RIGHT') ||
      (newDir === 'RIGHT' && this.currentDirection === 'LEFT')
    ) {
      return;
    }

    if (newDir !== this.currentDirection && newDir !== this.nextDirection) {
      const fromDir = this.currentDirection;
      this.nextDirection = newDir;

      // Telemetry: CHANGE_DIRECTION
      this.emit<SnakeChangeDirectionPayload>('INPUT', 'CHANGE_DIRECTION', {
        from: fromDir,
        to: newDir
      });

      this.playTone(320, 'square', 0.04, 0.05);
    }
  }

  private spawnFood(): void {
    const foodTypes = [
      { type: 'APPLE', points: 10, color: '#ef4444', weight: 60 },
      { type: 'CYBER_BERRY', points: 20, color: '#06b6d4', weight: 25 },
      { type: 'GOLDEN_STAR', points: 35, color: '#f59e0b', weight: 10 },
      { type: 'ENERGY_PILL', points: 50, color: '#a855f7', weight: 5 }
    ];

    const totalWeight = foodTypes.reduce((acc, f) => acc + f.weight, 0);
    let rand = Math.random() * totalWeight;
    let selected = foodTypes[0];
    for (const f of foodTypes) {
      if (rand < f.weight) {
        selected = f;
        break;
      }
      rand -= f.weight;
    }

    // Find unoccupied cell
    let freeCells: Point[] = [];
    const occupied = new Set(this.snake.map(p => `${p.x},${p.y}`));

    for (let x = 1; x < this.cols - 1; x++) {
      for (let y = 1; y < this.rows - 1; y++) {
        if (!occupied.has(`${x},${y}`)) {
          freeCells.push({ x, y });
        }
      }
    }

    if (freeCells.length === 0) {
      // Board full: Player wins
      this.finish(this.playerId, this.currentScore, 'BOARD_CLEARED');
      return;
    }

    const pos = freeCells[Math.floor(Math.random() * freeCells.length)];
    this.food = {
      x: pos.x,
      y: pos.y,
      type: selected.type,
      points: selected.points,
      color: selected.color,
      pulsePhase: 0
    };
  }

  private createEatParticles(x: number, y: number, color: string): void {
    const px = (x + 0.5) * this.cellSize;
    const py = (y + 0.5) * this.cellSize;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 120;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 4,
        alpha: 1.0,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.4
      });
    }
  }

  // --- Core Lifecycle ---
  public override update(deltaTime: number): void {
    if (this.status !== 'PLAYING') return;

    this.pulseTimer += deltaTime;
    this.tonguePhase += deltaTime * 5;

    // Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += deltaTime;
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      p.alpha = Math.max(0, 1 - (p.life / p.maxLife));
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
      }
    }

    // Step snake movement timer
    this.moveTimer += deltaTime;
    const currentInterval = Math.max(0.06, this.moveInterval / this.speedBoost);

    if (this.moveTimer >= currentInterval) {
      this.moveTimer -= currentInterval;
      this.step();
    }
  }

  private step(): void {
    this.currentDirection = this.nextDirection;
    const head = this.snake[0];
    let newHead: Point = { x: head.x, y: head.y };

    switch (this.currentDirection) {
      case 'UP':
        newHead.y -= 1;
        break;
      case 'DOWN':
        newHead.y += 1;
        break;
      case 'LEFT':
        newHead.x -= 1;
        break;
      case 'RIGHT':
        newHead.x += 1;
        break;
    }

    // 1. Collision with WALL
    if (
      newHead.x < 0 ||
      newHead.x >= this.cols ||
      newHead.y < 0 ||
      newHead.y >= this.rows
    ) {
      this.handleCollision('WALL');
      return;
    }

    // 2. Collision with SELF
    for (let i = 0; i < this.snake.length; i++) {
      if (this.snake[i].x === newHead.x && this.snake[i].y === newHead.y) {
        this.handleCollision('SELF');
        return;
      }
    }

    // Move snake forward
    this.snake.unshift(newHead);

    // 3. Check Food Eaten
    if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
      const eaten = this.food;
      this.currentScore += eaten.points;
      this.speedBoost = Math.min(2.0, 1.0 + (this.snake.length * 0.015));

      // Telemetry: EAT_FOOD
      this.emit<SnakeEatFoodPayload>('ACTION', 'EAT_FOOD', {
        foodType: eaten.type,
        points: eaten.points,
        currentLength: this.snake.length,
        coords: { x: eaten.x, y: eaten.y }
      });

      this.createEatParticles(eaten.x, eaten.y, eaten.color);
      this.playTone(600 + eaten.points * 10, 'sine', 0.12, 0.2);

      this.spawnFood();
    } else {
      // Remove tail if didn't eat
      this.snake.pop();
    }
  }

  private handleCollision(collisionWith: 'WALL' | 'SELF'): void {
    // Telemetry: COLLISION
    this.emit<SnakeCollisionPayload>('ACTION', 'COLLISION', {
      collisionWith,
      finalScore: this.currentScore
    });

    this.playTone(120, 'sawtooth', 0.4, 0.3);

    // Explode head particles
    const head = this.snake[0] || { x: this.cols / 2, y: this.rows / 2 };
    this.createEatParticles(head.x, head.y, '#ef4444');

    this.finish(undefined, this.currentScore, `COLLISION_${collisionWith}`);
  }

  // --- Render (100% Pixel Art via Offscreen Matrices) ---
  private rotateMatrixCW(matrix: string[]): string[] {
    const h = matrix.length;
    const w = matrix[0]?.length || 0;
    const out: string[] = [];
    for (let x = 0; x < w; x++) {
      let row = '';
      for (let y = h - 1; y >= 0; y--) {
        row += matrix[y][x] ?? '.';
      }
      out.push(row);
    }
    return out;
  }

  private flipMatrixH(matrix: string[]): string[] {
    return matrix.map((row) => row.split('').reverse().join(''));
  }

  private getDirectionalSprite(
    keyPrefix: string,
    baseRightMatrix: string[],
    palette: PixelPalette,
    dir: SnakeDirection
  ): HTMLCanvasElement {
    const key = `${keyPrefix}_${dir}`;
    let matrix = baseRightMatrix;
    if (dir === 'DOWN') {
      matrix = this.rotateMatrixCW(baseRightMatrix);
    } else if (dir === 'LEFT') {
      matrix = this.flipMatrixH(baseRightMatrix);
    } else if (dir === 'UP') {
      matrix = this.rotateMatrixCW(this.rotateMatrixCW(this.rotateMatrixCW(baseRightMatrix)));
    }
    return this.spriteCache.getOrCreate(key, matrix, palette, 2);
  }

  private getHeadSprite(dir: SnakeDirection, frame: number): HTMLCanvasElement {
    const palette: PixelPalette = {
      o: '#064e3b',
      d: '#059669',
      g: '#10b981',
      h: '#6ee7b7',
      w: '#ffffff',
      p: '#0b0f19',
      r: '#ef4444',
      k: '#fca5a5'
    };

    const frame0: string[] = [
      '................',
      'ooooooooooo.....',
      'gggggggggggo....',
      'hhhgggggggggo...',
      'gggggggwwggggo..',
      'gggdgggwpggggo..',
      'gggggggggggggo..',
      'gggdgggggggggo..',
      'gggdgggggggggo..',
      'gggggggggggggo..',
      'gggdgggwpggggo..',
      'gggggggwwggggo..',
      'dddgggggggggo...',
      'gggggggggggo....',
      'ooooooooooo.....',
      '................'
    ];

    const frame1: string[] = [
      '................',
      'ooooooooooo.....',
      'gggggggggggo....',
      'hhhgggggggggo...',
      'gggggggwwggggo..',
      'gggdgggwpggggo..',
      'gggggggggggggo..',
      'gggdgggggggggork',
      'gggdgggggggggork',
      'gggggggggggggo..',
      'gggdgggwpggggo..',
      'gggggggwwggggo..',
      'dddgggggggggo...',
      'gggggggggggo....',
      'ooooooooooo.....',
      '................'
    ];

    const frame2: string[] = [
      '................',
      'ooooooooooo.....',
      'gggggggggggo....',
      'hhhgggggggggo...',
      'gggggggwwggggo..',
      'gggdgggwpggggo..',
      'gggggggggggggor.',
      'gggdgggggggggorr',
      'gggdgggggggggorr',
      'gggggggggggggor.',
      'gggdgggwpggggo..',
      'gggggggwwggggo..',
      'dddgggggggggo...',
      'gggggggggggo....',
      'ooooooooooo.....',
      '................'
    ];

    const matrices = [frame0, frame1, frame2];
    return this.getDirectionalSprite(`snake_head_f${frame}`, matrices[frame], palette, dir);
  }

  private getBodyPalette(tier: 'front' | 'mid' | 'tail'): PixelPalette {
    if (tier === 'front') {
      return {
        o: '#064e3b',
        d: '#059669',
        m: '#10b981',
        h: '#6ee7b7',
        c: '#ecfdf5'
      };
    }
    if (tier === 'mid') {
      return {
        o: '#134e4a',
        d: '#0f766e',
        m: '#14b8a6',
        h: '#5eead4',
        c: '#f0fdfa'
      };
    }
    return {
      o: '#164e63',
      d: '#0891b2',
      m: '#06b6d4',
      h: '#67e8f9',
      c: '#ecfeff'
    };
  }

  private getBodySprite(shape: 'H' | 'V' | 'NE' | 'NW' | 'SE' | 'SW', tier: 'front' | 'mid' | 'tail'): HTMLCanvasElement {
    const palette = this.getBodyPalette(tier);

    const bodyH: string[] = [
      '................',
      'oooooooooooooooo',
      'mmmmmmmmmmmmmmmm',
      'hhhhhmmmmhhhhhmm',
      'mmmmmmmmmmmmmmmm',
      'mmmdmmmmmmmdmmmm',
      'mmmmmmccmmmmmmmm',
      'mmmmmmccmmmmmmmm',
      'mmmmmmmmmmmmmmmm',
      'mmmdmmmmmmmdmmmm',
      'mmmmmmmmmmmmmmmm',
      'ddddmmmmmmddddmm',
      'mmmmmmmmmmmmmmmm',
      'dddddddddddddddd',
      'oooooooooooooooo',
      '................'
    ];

    const cornerSE: string[] = [
      '................',
      '.ooooooooooooooo',
      '.ommmmmmmmmmmmmm',
      '.omhhhhmmmmhhhmm',
      '.ommmmmmmmmmmmmm',
      '.ommmdmmmmmdmmmm',
      '.ommmmmccmmmmmmm',
      '.ommmmmccmmmmmmm',
      '.ommmmmmmmmmmmmm',
      '.ommmdmmmmmdmmmm',
      '.ommmmmmmmmmmmmm',
      '.omdddmmmmdddddd',
      '.ommmmmmmmmmmmmm',
      '.omdddommmmmmmmm',
      '.oommooooooooooo',
      '.ommo...........'
    ];

    if (shape === 'H') {
      return this.spriteCache.getOrCreate(`snake_body_H_${tier}`, bodyH, palette, 2);
    }
    if (shape === 'V') {
      return this.spriteCache.getOrCreate(`snake_body_V_${tier}`, this.rotateMatrixCW(bodyH), palette, 2);
    }
    if (shape === 'SE') {
      return this.spriteCache.getOrCreate(`snake_body_SE_${tier}`, cornerSE, palette, 2);
    }
    if (shape === 'SW') {
      return this.spriteCache.getOrCreate(`snake_body_SW_${tier}`, this.flipMatrixH(cornerSE), palette, 2);
    }
    if (shape === 'NE') {
      const ne = this.rotateMatrixCW(this.rotateMatrixCW(this.rotateMatrixCW(cornerSE)));
      return this.spriteCache.getOrCreate(`snake_body_NE_${tier}`, ne, palette, 2);
    }
    // NW
    const nw = this.flipMatrixH(this.rotateMatrixCW(this.rotateMatrixCW(this.rotateMatrixCW(cornerSE))));
    return this.spriteCache.getOrCreate(`snake_body_NW_${tier}`, nw, palette, 2);
  }

  private getTailSprite(dirToPrev: SnakeDirection): HTMLCanvasElement {
    const palette = this.getBodyPalette('tail');
    const tailBaseRight: string[] = [
      '................',
      '..........oooooo',
      '.......ooommmmmm',
      '.....oommmhhhhmm',
      '...oommmmmmmmmmm',
      '..ommmmdmmmmmdmm',
      '.ommmmmmmccmmmmm',
      'ommmmmmmmccmmmmm',
      'ommmmmmmmmmmmmmm',
      '.ommmmmdmmmmmdmm',
      '..ommmmmmmmmmmmm',
      '...oomdddmmmdddd',
      '.....oommmmmmmmm',
      '.......ooodddddd',
      '..........oooooo',
      '................'
    ];
    return this.getDirectionalSprite('snake_tail', tailBaseRight, palette, dirToPrev);
  }

  private getFoodSprite(foodType: string, frame: number): HTMLCanvasElement {
    const isAlt = frame === 1;

    if (foodType === 'APPLE') {
      const palette: PixelPalette = {
        o: '#450a0a',
        d: '#b91c1c',
        r: '#ef4444',
        h: isAlt ? '#ffffff' : '#fca5a5',
        s: '#78350f',
        g: '#10b981',
        l: '#6ee7b7'
      };
      const matrix: string[] = [
        '.......ss.......',
        '.......ssggl....',
        '......oossgg....',
        '...oooorroooo...',
        '..orrrrrrrrrro..',
        '.orrhhrrrrrrrro.',
        '.orrhhrrrrrrrrro',
        '.orrrrrrrrrrrdro',
        '.orrrrrrrrrrrdro',
        '.orrrrrrrrrrddro',
        '..orrrrrrrrrddo.',
        '..odrrrrrrrrddo.',
        '...oddddddddoo..',
        '....oooooooo....',
        '................',
        '................'
      ];
      return this.spriteCache.getOrCreate(`food_apple_f${frame}`, matrix, palette, 2);
    }

    if (foodType === 'CYBER_BERRY') {
      const palette: PixelPalette = {
        o: '#164e63',
        d: '#0891b2',
        c: '#06b6d4',
        h: isAlt ? '#ffffff' : '#67e8f9',
        w: '#ecfeff'
      };
      const matrix: string[] = [
        '.......oo.......',
        '......occo......',
        '.....occcco.....',
        '....occhccco....',
        '...occhwwccco...',
        '..occhwwwwccdo..',
        '.occcwwwwcccddo.',
        'occcchwwccccdddo',
        '.occcccccccdddo.',
        '..occcccccdddo..',
        '...occcccdddo...',
        '....occcdddo....',
        '.....ocdddo.....',
        '......oddo......',
        '.......oo.......',
        '................'
      ];
      return this.spriteCache.getOrCreate(`food_berry_f${frame}`, matrix, palette, 2);
    }

    if (foodType === 'GOLDEN_STAR') {
      const palette: PixelPalette = {
        o: '#78350f',
        d: '#d97706',
        y: '#f59e0b',
        h: '#fde047',
        w: isAlt ? '#ffffff' : '#fef9c3'
      };
      const matrix: string[] = [
        '.......oo.......',
        '......oyyo......',
        '......ohyo......',
        '.....oyhhyo.....',
        '.oooooywyyooooo.',
        'oyyyyyhwwyyyyddo',
        '.oyyyhwwwwyyddo.',
        '..oyyyhwwyyddo..',
        '...oyyyyyyddo...',
        '...oyyyyydddo...',
        '..oyyyyooydddo..',
        '..oyyyo..odddo..',
        '.oyyyo....odddo.',
        '.oooo......oooo.',
        '................',
        '................'
      ];
      return this.spriteCache.getOrCreate(`food_star_f${frame}`, matrix, palette, 2);
    }

    // ENERGY_PILL
    const palette: PixelPalette = {
      o: '#3b0764',
      p: '#a855f7',
      d: '#7e22ce',
      m: '#ec4899',
      h: isAlt ? '#ffffff' : '#f5d0fe'
    };
    const matrix: string[] = [
      '................',
      '....oooooooo....',
      '..ooppppppppoo..',
      '.ophhpppppppppo.',
      '.ophppppppppppo.',
      'oppppppmmmpppppo',
      'opppppmmhmmppppo',
      'opppppmmmmmppdpo',
      'oppppppmmmppddpo',
      '.opppppppppddpo.',
      '.odpppppppdddpo.',
      '..ooddddddddoo..',
      '....oooooooo....',
      '................',
      '................',
      '................'
    ];
    return this.spriteCache.getOrCreate(`food_pill_f${frame}`, matrix, palette, 2);
  }

  private getFoodShadowSprite(): HTMLCanvasElement {
    const palette: PixelPalette = { s: 'rgba(2, 6, 23, 0.72)' };
    const matrix: string[] = [
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '................',
      '....ssssssss....',
      '..ssssssssssss..',
      '....ssssssss....',
      '................'
    ];
    return this.spriteCache.getOrCreate('food_shadow', matrix, palette, 2);
  }

  private ensureRetroBoardBackground(totalW: number, totalH: number): HTMLCanvasElement {
    const quantizedSize = Math.round(totalW);
    if (this.bgCanvas && this.bgBoardSize === quantizedSize) {
      return this.bgCanvas;
    }

    const tileEven = this.spriteCache.getOrCreate(
      'board_tile_even',
      [
        'bbbbbbbbbbbbbbbb',
        'baaaaaaaaaaaaaab',
        'bacaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaacab',
        'baaaaaaaaaaaaaab',
        'bbbbbbbbbbbbbbbb'
      ],
      { a: '#0b0f19', b: '#131c2e', c: '#1e293b' },
      2
    );

    const tileOdd = this.spriteCache.getOrCreate(
      'board_tile_odd',
      [
        'bbbbbbbbbbbbbbbb',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaacaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'baaaaaaaaaaaaaab',
        'bbbbbbbbbbbbbbbb'
      ],
      { a: '#0e1424', b: '#162033', c: '#1e293b' },
      2
    );

    const bg = document.createElement('canvas');
    bg.width = Math.max(1, Math.round(totalW));
    bg.height = Math.max(1, Math.round(totalH));
    const bctx = bg.getContext('2d');
    if (bctx) {
      bctx.imageSmoothingEnabled = false;
      const cellW = bg.width / this.cols;
      const cellH = bg.height / this.rows;

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tile = (r + c) % 2 === 0 ? tileEven : tileOdd;
          const x = Math.floor(c * cellW);
          const y = Math.floor(r * cellH);
          const w = Math.ceil((c + 1) * cellW) - x;
          const h = Math.ceil((r + 1) * cellH) - y;
          bctx.drawImage(tile, x, y, w, h);
        }
      }

      // Stepped Pixel Art Arcade Border Frame
      bctx.fillStyle = '#064e3b';
      bctx.fillRect(0, 0, bg.width, 4);
      bctx.fillRect(0, bg.height - 4, bg.width, 4);
      bctx.fillRect(0, 0, 4, bg.height);
      bctx.fillRect(bg.width - 4, 0, 4, bg.height);

      bctx.fillStyle = '#10b981';
      bctx.fillRect(2, 2, bg.width - 4, 2);
      bctx.fillRect(2, bg.height - 4, bg.width - 4, 2);
      bctx.fillRect(2, 2, 2, bg.height - 4);
      bctx.fillRect(bg.width - 4, 2, 2, bg.height - 4);

      // Corner pixel rivets
      bctx.fillStyle = '#6ee7b7';
      bctx.fillRect(2, 2, 4, 4);
      bctx.fillRect(bg.width - 6, 2, 4, 4);
      bctx.fillRect(2, bg.height - 6, 4, 4);
      bctx.fillRect(bg.width - 6, bg.height - 6, 4, 4);
    }

    this.bgCanvas = bg;
    this.bgBoardSize = quantizedSize;
    return bg;
  }

  public override render(target: HTMLElement | HTMLCanvasElement): void {
    if (target instanceof HTMLCanvasElement) {
      this.canvas = target;
    } else {
      let existingCanvas = target.querySelector('canvas') as HTMLCanvasElement;
      if (!existingCanvas) {
        existingCanvas = document.createElement('canvas');
        existingCanvas.className = 'w-full h-full block select-none';
        target.appendChild(existingCanvas);
      }
      this.canvas = existingCanvas;
    }

    if (!this.ctx && this.canvas) {
      this.ctx = this.canvas.getContext('2d');
    }

    if (!this.canvas || !this.ctx) return;

    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width || this.cols * this.cellSize;
    const height = rect.height || this.rows * this.cellSize;
    const dpr = window.devicePixelRatio || 1;

    if (this.canvas.width !== Math.floor(width * dpr) || this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    const boardWidth = Math.min(width, height);
    this.cellSize = boardWidth / Math.max(this.cols, this.rows);
    const totalW = this.cols * this.cellSize;
    const totalH = this.rows * this.cellSize;
    const offsetX = Math.floor((width - totalW) / 2);
    const offsetY = Math.floor((height - totalH) / 2);

    // Clear letterbox area cleanly
    this.ctx.fillStyle = '#05070e';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.translate(offsetX, offsetY);

    // 1. Draw Retro Pixel Tiled Board Background
    const bg = this.ensureRetroBoardBackground(totalW, totalH);
    this.ctx.drawImage(bg, 0, 0, totalW, totalH);

    // 2. Draw Food (16x16 Sprite + Hard Pixel Shadow)
    if (this.food) {
      this.renderPixelFood(this.ctx, this.food);
    }

    // 3. Draw Articulated Pixel-Art Snake
    this.renderPixelSnake(this.ctx);

    // 4. Draw Square Pixel Particles
    for (const p of this.particles) {
      const pxSize = Math.max(2, Math.round(p.size));
      this.ctx.fillStyle = p.color;
      this.ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
      this.ctx.fillRect(Math.round(p.x - pxSize / 2), Math.round(p.y - pxSize / 2), pxSize, pxSize);
    }
    this.ctx.globalAlpha = 1.0;

    // 5. Overlay Game Over / Paused Status
    if (this.status === 'FINISHED') {
      this.renderGameOverOverlay(this.ctx);
    } else if (this.status === 'PAUSED') {
      this.renderPausedOverlay(this.ctx);
    }

    this.ctx.restore();
  }

  private renderPixelFood(ctx: CanvasRenderingContext2D, food: FoodItem): void {
    const x = Math.floor(food.x * this.cellSize);
    const y = Math.floor(food.y * this.cellSize);
    const size = Math.ceil(this.cellSize);
    const bobPx = Math.round(Math.sin(this.pulseTimer * 6) * 2);
    const frame = Math.floor(this.pulseTimer * 4) % 2;

    // Hard pixel shadow on tile
    const shadow = this.getFoodShadowSprite();
    ctx.drawImage(shadow, x, y + 1, size, size);

    // 16x16 food sprite
    const sprite = this.getFoodSprite(food.type, frame);
    ctx.drawImage(sprite, x, y + bobPx - 1, size, size);
  }

  private renderPixelSnake(ctx: CanvasRenderingContext2D): void {
    if (this.snake.length === 0) return;

    // 1. Draw Tail (if length > 1)
    if (this.snake.length > 1) {
      const tailIdx = this.snake.length - 1;
      const tail = this.snake[tailIdx];
      const prev = this.snake[tailIdx - 1];
      let tailDir: SnakeDirection = 'RIGHT';
      if (prev.x > tail.x) tailDir = 'RIGHT';
      else if (prev.x < tail.x) tailDir = 'LEFT';
      else if (prev.y > tail.y) tailDir = 'DOWN';
      else if (prev.y < tail.y) tailDir = 'UP';

      const tailSprite = this.getTailSprite(tailDir);
      ctx.drawImage(
        tailSprite,
        Math.floor(tail.x * this.cellSize),
        Math.floor(tail.y * this.cellSize),
        Math.ceil(this.cellSize),
        Math.ceil(this.cellSize)
      );
    }

    // 2. Draw Articulated Body Segments
    for (let i = this.snake.length - 2; i >= 1; i--) {
      const seg = this.snake[i];
      const prev = this.snake[i - 1];
      const next = this.snake[i + 1];

      const ratio = 1 - i / this.snake.length;
      const tier: 'front' | 'mid' | 'tail' = ratio > 0.65 ? 'front' : ratio > 0.3 ? 'mid' : 'tail';

      const dirs = new Set<string>();
      if (prev.x > seg.x || next.x > seg.x) dirs.add('E');
      if (prev.x < seg.x || next.x < seg.x) dirs.add('W');
      if (prev.y > seg.y || next.y > seg.y) dirs.add('S');
      if (prev.y < seg.y || next.y < seg.y) dirs.add('N');

      let shape: 'H' | 'V' | 'NE' | 'NW' | 'SE' | 'SW' = 'H';
      if (dirs.has('E') && dirs.has('W')) shape = 'H';
      else if (dirs.has('N') && dirs.has('S')) shape = 'V';
      else if (dirs.has('S') && dirs.has('E')) shape = 'SE';
      else if (dirs.has('S') && dirs.has('W')) shape = 'SW';
      else if (dirs.has('N') && dirs.has('E')) shape = 'NE';
      else if (dirs.has('N') && dirs.has('W')) shape = 'NW';

      const bodySprite = this.getBodySprite(shape, tier);
      ctx.drawImage(
        bodySprite,
        Math.floor(seg.x * this.cellSize),
        Math.floor(seg.y * this.cellSize),
        Math.ceil(this.cellSize),
        Math.ceil(this.cellSize)
      );
    }

    // 3. Draw Multi-frame Directional Head
    const head = this.snake[0];
    const tongueVal = Math.abs(Math.sin(this.tonguePhase));
    const headFrame = tongueVal > 0.72 ? 2 : tongueVal > 0.38 ? 1 : 0;
    const headSprite = this.getHeadSprite(this.currentDirection, headFrame);

    ctx.drawImage(
      headSprite,
      Math.floor(head.x * this.cellSize),
      Math.floor(head.y * this.cellSize),
      Math.ceil(this.cellSize),
      Math.ceil(this.cellSize)
    );
  }

  private renderGameOverOverlay(ctx: CanvasRenderingContext2D): void {
    const totalW = this.cols * this.cellSize;
    const totalH = this.rows * this.cellSize;

    ctx.fillStyle = 'rgba(5, 7, 14, 0.86)';
    ctx.fillRect(0, 0, totalW, totalH);

    // Pixel-art dialog box
    const boxW = Math.min(totalW - 40, 380);
    const boxH = 140;
    const bx = Math.floor((totalW - boxW) / 2);
    const by = Math.floor((totalH - boxH) / 2);

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 4;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 18px "Press Start 2P", monospace';
    ctx.fillStyle = '#450a0a';
    ctx.fillText('CRASH DETECTED', totalW / 2 + 2, totalH / 2 - 26);
    ctx.fillStyle = '#ef4444';
    ctx.fillText('CRASH DETECTED', totalW / 2, totalH / 2 - 28);

    ctx.font = 'bold 12px "Press Start 2P", monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`FINAL SCORE: ${this.currentScore}`, totalW / 2, totalH / 2 + 12);

    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('PRESS START TO PLAY AGAIN', totalW / 2, totalH / 2 + 40);
  }

  private renderPausedOverlay(ctx: CanvasRenderingContext2D): void {
    const totalW = this.cols * this.cellSize;
    const totalH = this.rows * this.cellSize;

    ctx.fillStyle = 'rgba(5, 7, 14, 0.78)';
    ctx.fillRect(0, 0, totalW, totalH);

    const boxW = Math.min(totalW - 40, 280);
    const boxH = 76;
    const bx = Math.floor((totalW - boxW) / 2);
    const by = Math.floor((totalH - boxH) / 2);

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('GAME PAUSED', totalW / 2, totalH / 2);
  }

  public override destroy(): void {
    this.detachEventListeners();
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {
        // Ignored
      }
      this.audioCtx = null;
    }
    this.spriteCache.clear();
    this.bgCanvas = null;
    this.canvas = null;
    this.ctx = null;
  }
}
