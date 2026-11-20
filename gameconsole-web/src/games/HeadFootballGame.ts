import { BaseGame, IEventDispatcher, BaseGameOptions } from '../core/BaseGame';
import {
  HeadFootballKickPayload,
  HeadFootballGoalPayload
} from '../types/contracts';
import { PixelSpriteCache, PixelPalette } from './pixel/PixelSpriteRenderer';

export type GameModeFootball = '1P_VS_CPU' | '2P_LOCAL';

interface Vector2D {
  x: number;
  y: number;
}

interface Confetti {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  rotation: number;
  vRot: number;
  alpha: number;
  life: number;
}

interface DustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export class HeadFootballGame extends BaseGame {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private animationFrameId: number | null = null;

  // Dimensions
  public readonly fieldWidth: number = 960;
  public readonly fieldHeight: number = 540;
  public readonly groundY: number = 460;

  // Goals
  public readonly goalWidth: number = 100;
  public readonly crossbarY: number = 290;
  public readonly crossbarHeight: number = 14;

  // Match Clock & Scoring (Countdown from 90s -> 0s)
  public matchMinute: number = 90;
  private matchTimeElapsed: number = 0;
  private readonly matchDurationSeconds: number = 90; // 90 seconds countdown
  private bounceSfxCooldown: number = 0;
  public p1Id: string = 'Player1';
  public p2Id: string = 'CPU_AI';
  public p1Score: number = 0;
  public p2Score: number = 0;
  public mode: GameModeFootball = '1P_VS_CPU';

  // Ball
  private ballPos: Vector2D = { x: 480, y: 220 };
  private ballVel: Vector2D = { x: 0, y: 0 };
  private ballRadius: number = 16;
  private ballRotation: number = 0;
  private gravity: number = 980; // px/s^2

  // Player 1 (Left / Home)
  private p1Pos: Vector2D = { x: 220, y: 460 };
  private p1Vel: Vector2D = { x: 0, y: 0 };
  private p1IsGrounded: boolean = true;
  private p1KickTimer: number = 0; // > 0 when kicking
  private p1KickType: 'GROUND' | 'LOB' = 'GROUND';
  private p1KickConnected: boolean = false;
  private p1Facing: number = 1; // 1 = right, -1 = left

  // Player 2 / CPU (Right / Away)
  private p2Pos: Vector2D = { x: 740, y: 460 };
  private p2Vel: Vector2D = { x: 0, y: 0 };
  private p2IsGrounded: boolean = true;
  private p2KickTimer: number = 0;
  private p2KickType: 'GROUND' | 'LOB' = 'GROUND';
  private p2KickConnected: boolean = false;
  private p2Facing: number = -1;

  // Player physical constants
  private readonly playerSpeed: number = 340;
  private readonly jumpForce: number = -600;
  private readonly headRadius: number = 28;
  private readonly bodyHeight: number = 44;
  private readonly bodyWidth: number = 36;

  // Goal celebration state
  private isGoalCelebration: boolean = false;
  private celebrationTimer: number = 0;
  private latestScorer: string | null = null;
  private confetti: Confetti[] = [];

  // Keys state
  private keysPressed: Set<string> = new Set();
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundKeyUp: (e: KeyboardEvent) => void;
  private boundWindowBlur: () => void;

  // Web Audio Procedural Synthesis
  private audioCtx: AudioContext | null = null;

  // Pixel Art Offscreen Sprite Cache & Visual-Only FX
  private spriteCache = new PixelSpriteCache();
  private stadiumBgCanvas: HTMLCanvasElement | null = null;
  private animClock: number = 0;
  private dustParticles: DustParticle[] = [];
  private prevP1Grounded: boolean = true;
  private prevP2Grounded: boolean = true;

  constructor(
    playerId: string,
    dispatcher: IEventDispatcher,
    options: BaseGameOptions & { footballMode?: GameModeFootball; p2Name?: string; player2Id?: string } = {}
  ) {
    const isTwoPlayers =
      options.gameMode === 'TWO_PLAYERS_LOCAL' || options.footballMode === '2P_LOCAL';
    const resolvedMode: GameModeFootball = isTwoPlayers ? '2P_LOCAL' : '1P_VS_CPU';
    const resolvedP1Id = playerId?.trim() || 'Player1';
    const resolvedP2Id = isTwoPlayers
      ? (options.p2Name?.trim() || options.additionalPlayers?.[0]?.trim() || options.player2Id?.trim() || 'Player2')
      : 'CPU_AI';
    const validAdditionalPlayers = options.additionalPlayers?.map((p) => p.trim()).filter(Boolean);

    super('head_football', resolvedP1Id, dispatcher, {
      ...options,
      gameVersion: options.gameVersion || '1.0.0',
      gameMode: options.gameMode || resolvedMode,
      additionalPlayers:
        validAdditionalPlayers && validAdditionalPlayers.length > 0
          ? validAdditionalPlayers
          : [resolvedP2Id]
    });

    this.mode = resolvedMode;
    this.p1Id = resolvedP1Id;
    this.p2Id = resolvedP2Id;

    this.boundKeyDown = (e) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (this.status === 'PLAYING' && this.isViewportActiveForInput()) {
        if (
          e.key === 'ArrowUp' ||
          e.key === 'ArrowDown' ||
          e.key === 'ArrowLeft' ||
          e.key === 'ArrowRight' ||
          e.key === ' '
        ) {
          e.preventDefault();
        }
        this.keysPressed.add(e.key);
      }
    };
    this.boundKeyUp = (e) => {
      this.keysPressed.delete(e.key);
      if (e.key.length === 1) {
        this.keysPressed.delete(e.key.toLowerCase());
        this.keysPressed.delete(e.key.toUpperCase());
      }
    };
    this.boundWindowBlur = () => {
      this.keysPressed.clear();
    };
    this.resetField();
  }

  private isViewportActiveForInput(): boolean {
    if (typeof document === 'undefined') return true;
    const viewports = document.querySelectorAll('[data-game-viewport]');
    if (viewports.length <= 1) return true;
    const myViewport = this.canvas?.closest('[data-game-viewport]');
    if (!myViewport) return false;
    return myViewport.contains(document.activeElement);
  }

  private initAudio(): void {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioClass) {
        this.audioCtx = new AudioClass();
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
      // Audio autoplay policy
    }
  }

  private resetField(): void {
    this.ballPos = { x: this.fieldWidth / 2, y: 220 };
    this.ballVel = { x: (Math.random() - 0.5) * 80, y: -100 };
    this.p1Pos = { x: 220, y: this.groundY };
    this.p1Vel = { x: 0, y: 0 };
    this.p1IsGrounded = true;
    this.p1KickTimer = 0;
    this.p1KickType = 'GROUND';
    this.p1KickConnected = false;
    this.p1Facing = 1;

    this.p2Pos = { x: 740, y: this.groundY };
    this.p2Vel = { x: 0, y: 0 };
    this.p2IsGrounded = true;
    this.p2KickTimer = 0;
    this.p2KickType = 'GROUND';
    this.p2KickConnected = false;
    this.p2Facing = -1;

    this.isGoalCelebration = false;
    this.celebrationTimer = 0;
    this.prevP1Grounded = true;
    this.prevP2Grounded = true;
    this.dustParticles = [];
  }

  protected override onStart(): void {
    this.p1Score = 0;
    this.p2Score = 0;
    this.matchMinute = this.matchDurationSeconds;
    this.matchTimeElapsed = 0;
    this.bounceSfxCooldown = 0;
    this.resetField();
    this.attachEventListeners();
    this.playTone(520, 'triangle', 0.2, 0.2);
  }

  private attachEventListeners(): void {
    this.detachEventListeners();
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', this.boundKeyDown);
      window.addEventListener('keyup', this.boundKeyUp);
      window.addEventListener('blur', this.boundWindowBlur);
    }
  }

  private detachEventListeners(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('keydown', this.boundKeyDown);
      window.removeEventListener('keyup', this.boundKeyUp);
      window.removeEventListener('blur', this.boundWindowBlur);
    }
  }

  protected override onPause(): void {
    this.keysPressed.clear();
  }

  protected override onFinish(): void {
    this.keysPressed.clear();
  }

  // --- Core Game Loop & Physics Update ---
  public override update(deltaTime: number): void {
    if (this.status !== 'PLAYING') return;

    this.animClock += deltaTime;
    this.updateDustParticles(deltaTime);
    if (this.bounceSfxCooldown > 0) {
      this.bounceSfxCooldown = Math.max(0, this.bounceSfxCooldown - deltaTime);
    }

    // 1. Countdown Match Clock (90 down to 0)
    if (!this.isGoalCelebration) {
      this.matchTimeElapsed += deltaTime;
      const remaining = Math.max(0, this.matchDurationSeconds - this.matchTimeElapsed);
      this.matchMinute = Math.ceil(remaining);

      if (remaining <= 0) {
        this.matchMinute = 0;
        this.finishMatch();
        return;
      }
    }

    // 2. Goal Celebration state
    if (this.isGoalCelebration) {
      this.celebrationTimer -= deltaTime;
      this.updateConfetti(deltaTime);
      if (this.celebrationTimer <= 0) {
        this.resetField();
      }
      return;
    }

    // 3. Update Inputs (Player 1 & Player 2 / CPU)
    this.handlePlayer1Input(deltaTime);
    if (this.mode === '2P_LOCAL') {
      this.handlePlayer2Input(deltaTime);
    } else {
      this.updateCpuAi(deltaTime);
    }

    // 4. Update Player Physics (Gravity, Movement)
    this.updatePlayerPhysics(this.p1Pos, this.p1Vel, (g) => { this.p1IsGrounded = g; }, deltaTime, 1);
    this.updatePlayerPhysics(this.p2Pos, this.p2Vel, (g) => { this.p2IsGrounded = g; }, deltaTime, 2);

    // Visual-only jump/landing pixel dust
    if (this.prevP1Grounded !== this.p1IsGrounded) {
      this.spawnDustBurst(this.p1Pos.x, this.groundY, '#cbd5e1');
      this.prevP1Grounded = this.p1IsGrounded;
    }
    if (this.prevP2Grounded !== this.p2IsGrounded) {
      this.spawnDustBurst(this.p2Pos.x, this.groundY, '#cbd5e1');
      this.prevP2Grounded = this.p2IsGrounded;
    }

    if (this.p1KickTimer > 0) this.p1KickTimer = Math.max(0, this.p1KickTimer - deltaTime);
    if (this.p2KickTimer > 0) this.p2KickTimer = Math.max(0, this.p2KickTimer - deltaTime);

    // 5. Update Ball Physics
    this.updateBallPhysics(deltaTime);

    // 6. Handle Player-Ball Collisions & Kicking
    this.handlePlayerBallInteraction(this.p1Pos, this.p1Vel, this.p1Facing, this.p1KickTimer, this.p1KickType, this.p1Id, 1);
    this.handlePlayerBallInteraction(this.p2Pos, this.p2Vel, this.p2Facing, this.p2KickTimer, this.p2KickType, this.p2Id, 2);

    // 7. Check Goal Detection
    this.checkGoalDetection();
  }

  private handlePlayer1Input(_dt: number): void {
    // In 2P_LOCAL mode, P1 uses ONLY WASD + Space/S/F so Arrow keys belong exclusively to P2.
    // In 1P_VS_CPU mode, P1 can use both WASD and Arrow keys.
    const allowArrows = this.mode !== '2P_LOCAL';

    let moveDir = 0;
    if (
      this.keysPressed.has('a') ||
      this.keysPressed.has('A') ||
      (allowArrows && this.keysPressed.has('ArrowLeft'))
    ) {
      moveDir -= 1;
    }
    if (
      this.keysPressed.has('d') ||
      this.keysPressed.has('D') ||
      (allowArrows && this.keysPressed.has('ArrowRight'))
    ) {
      moveDir += 1;
    }

    this.p1Vel.x = moveDir * this.playerSpeed;

    // Jump
    if (
      (this.keysPressed.has('w') ||
        this.keysPressed.has('W') ||
        (allowArrows && this.keysPressed.has('ArrowUp'))) &&
      this.p1IsGrounded
    ) {
      this.p1Vel.y = this.jumpForce;
      this.p1IsGrounded = false;
      this.playTone(300, 'sine', 0.08, 0.05);
    }

    // Ground Kick (Space / S, plus ArrowDown in 1P_VS_CPU)
    if (
      (this.keysPressed.has(' ') ||
        this.keysPressed.has('s') ||
        this.keysPressed.has('S') ||
        (allowArrows && this.keysPressed.has('ArrowDown'))) &&
      this.p1KickTimer <= 0
    ) {
      this.triggerKick('GROUND', 1);
    }

    // Lob Kick (F)
    if ((this.keysPressed.has('f') || this.keysPressed.has('F')) && this.p1KickTimer <= 0) {
      this.triggerKick('LOB', 1);
    }
  }

  private handlePlayer2Input(_dt: number): void {
    // P2 Local Controls: ArrowLeft/ArrowRight (or J/L), ArrowUp (or I), ArrowDown (or K), Enter/M
    let moveDir = 0;
    if (this.keysPressed.has('ArrowLeft') || this.keysPressed.has('j') || this.keysPressed.has('J')) {
      moveDir -= 1;
    }
    if (this.keysPressed.has('ArrowRight') || this.keysPressed.has('l') || this.keysPressed.has('L')) {
      moveDir += 1;
    }

    this.p2Vel.x = moveDir * this.playerSpeed;

    if (
      (this.keysPressed.has('ArrowUp') || this.keysPressed.has('i') || this.keysPressed.has('I')) &&
      this.p2IsGrounded
    ) {
      this.p2Vel.y = this.jumpForce;
      this.p2IsGrounded = false;
      this.playTone(300, 'sine', 0.08, 0.05);
    }

    if (
      (this.keysPressed.has('ArrowDown') || this.keysPressed.has('k') || this.keysPressed.has('K')) &&
      this.p2KickTimer <= 0
    ) {
      this.triggerKick('GROUND', 2);
    }

    if (
      (this.keysPressed.has('Enter') || this.keysPressed.has('m') || this.keysPressed.has('M')) &&
      this.p2KickTimer <= 0
    ) {
      this.triggerKick('LOB', 2);
    }
  }

  private updateCpuAi(_dt: number): void {
    // Tactical CPU AI: Defends its right side, attacks when ball is loose, jumps and lobs
    const targetX = Math.min(840, Math.max(520, this.ballPos.x + 40));
    const distToTarget = targetX - this.p2Pos.x;

    if (Math.abs(distToTarget) > 15) {
      this.p2Vel.x = Math.sign(distToTarget) * this.playerSpeed * 0.88;
    } else {
      this.p2Vel.x = 0;
    }

    // Jump if ball is high and within range
    const distToBall = Math.hypot(this.ballPos.x - this.p2Pos.x, this.ballPos.y - (this.p2Pos.y - 50));
    if (distToBall < 120 && this.ballPos.y < this.p2Pos.y - 40 && this.p2IsGrounded && Math.random() < 0.04) {
      this.p2Vel.y = this.jumpForce;
      this.p2IsGrounded = false;
    }

    // Kick if ball is in front and close
    if (distToBall < 75 && this.ballPos.x < this.p2Pos.x && this.p2KickTimer <= 0) {
      const shotType = Math.random() > 0.4 ? 'GROUND' : 'LOB';
      this.triggerKick(shotType, 2);
    }
  }

  private updatePlayerPhysics(
    pos: Vector2D,
    vel: Vector2D,
    setGrounded: (g: boolean) => void,
    dt: number,
    playerNum: number
  ): void {
    // Apply gravity
    vel.y += this.gravity * dt;

    pos.x += vel.x * dt;
    pos.y += vel.y * dt;

    // Ground collision
    if (pos.y >= this.groundY) {
      pos.y = this.groundY;
      vel.y = 0;
      setGrounded(true);
    } else {
      setGrounded(false);
    }

    // Pitch bounds
    const minX = playerNum === 1 ? this.goalWidth + 10 : this.fieldWidth / 2 + 10;
    const maxX = playerNum === 1 ? this.fieldWidth / 2 - 10 : this.fieldWidth - this.goalWidth - 10;

    if (pos.x < minX) pos.x = minX;
    if (pos.x > maxX) pos.x = maxX;
  }

  private updateBallPhysics(dt: number): void {
    this.ballVel.y += this.gravity * dt;

    this.ballPos.x += this.ballVel.x * dt;
    this.ballPos.y += this.ballVel.y * dt;

    // Ball rotation spin
    this.ballRotation += (this.ballVel.x / this.ballRadius) * dt;

    // Ceiling collision
    if (this.ballPos.y - this.ballRadius <= 20) {
      this.ballPos.y = 20 + this.ballRadius;
      this.ballVel.y = Math.abs(this.ballVel.y) * 0.75;
      if (this.bounceSfxCooldown <= 0 && Math.abs(this.ballVel.y) > 110) {
        this.playTone(280, 'sine', 0.03, 0.04);
        this.bounceSfxCooldown = 0.12;
      }
    }

    // Left / Right field boundaries (prevents ball escaping above goals)
    if (this.ballPos.x - this.ballRadius <= 5) {
      this.ballPos.x = 5 + this.ballRadius;
      this.ballVel.x = Math.abs(this.ballVel.x) * 0.75;
    } else if (this.ballPos.x + this.ballRadius >= this.fieldWidth - 5) {
      this.ballPos.x = this.fieldWidth - 5 - this.ballRadius;
      this.ballVel.x = -Math.abs(this.ballVel.x) * 0.75;
    }

    // Ground collision
    if (this.ballPos.y + this.ballRadius >= this.groundY) {
      this.ballPos.y = this.groundY - this.ballRadius;
      this.ballVel.y = -Math.abs(this.ballVel.y) * 0.72;
      if (Math.abs(this.ballVel.y) < 35) {
        this.ballVel.y = 0;
      }
      this.ballVel.x *= 0.98; // Ground friction
      if (this.bounceSfxCooldown <= 0 && Math.abs(this.ballVel.y) > 110) {
        this.playTone(180, 'triangle', 0.03, 0.04);
        this.bounceSfxCooldown = 0.12;
      }
    }

    // Left Goal Post / Crossbar collision
    this.checkGoalPostCollisions(0, this.goalWidth);

    // Right Goal Post / Crossbar collision
    this.checkGoalPostCollisions(this.fieldWidth - this.goalWidth, this.fieldWidth);

    // Clamping speed
    const currentSpeed = Math.hypot(this.ballVel.x, this.ballVel.y);
    if (currentSpeed > 1400) {
      const scale = 1400 / currentSpeed;
      this.ballVel.x *= scale;
      this.ballVel.y *= scale;
    }
  }

  private checkGoalPostCollisions(postStartX: number, postEndX: number): void {
    const isLeft = postStartX === 0;
    const goalLineX = isLeft ? postEndX : postStartX;

    // 1. Crossbar top and bottom bounce
    if (
      this.ballPos.x + this.ballRadius >= Math.min(postStartX, postEndX) &&
      this.ballPos.x - this.ballRadius <= Math.max(postStartX, postEndX)
    ) {
      // Top of crossbar (sloped roof bounce pushes ball back into the pitch so it never gets trapped)
      if (
        this.ballPos.y + this.ballRadius >= this.crossbarY &&
        this.ballPos.y - this.ballRadius < this.crossbarY + this.crossbarHeight &&
        this.ballVel.y >= 0
      ) {
        this.ballPos.y = this.crossbarY - this.ballRadius;
        this.ballVel.y = Math.min(-Math.abs(this.ballVel.y) * 0.75, -160);
        this.ballVel.x = isLeft
          ? Math.max(this.ballVel.x, 220)
          : Math.min(this.ballVel.x, -220);
        if (this.bounceSfxCooldown <= 0) {
          this.playTone(420, 'square', 0.05, 0.06);
          this.bounceSfxCooldown = 0.14;
        }
      }
      // Bottom of crossbar
      else if (
        this.ballPos.y - this.ballRadius <= this.crossbarY + this.crossbarHeight &&
        this.ballPos.y + this.ballRadius > this.crossbarY &&
        this.ballVel.y < 0
      ) {
        this.ballPos.y = this.crossbarY + this.crossbarHeight + this.ballRadius;
        this.ballVel.y = Math.abs(this.ballVel.y) * 0.8;
        if (this.bounceSfxCooldown <= 0) {
          this.playTone(420, 'square', 0.05, 0.06);
          this.bounceSfxCooldown = 0.14;
        }
      }
    }

    // 2. Goal post corner tip
    const tipX = goalLineX;
    const tipY = this.crossbarY;
    const distToTip = Math.hypot(this.ballPos.x - tipX, this.ballPos.y - tipY);
    if (distToTip < this.ballRadius + 4) {
      const nx = (this.ballPos.x - tipX) / distToTip;
      const ny = (this.ballPos.y - tipY) / distToTip;
      const dot = this.ballVel.x * nx + this.ballVel.y * ny;
      if (dot < 0) {
        this.ballVel.x = (this.ballVel.x - 2 * dot * nx) * 0.85;
        this.ballVel.y = (this.ballVel.y - 2 * dot * ny) * 0.85;
        this.playTone(440, 'square', 0.08, 0.1);
      }
    }

    // 3. Back of net / side boundary
    if (isLeft && this.ballPos.x - this.ballRadius <= 5) {
      this.ballPos.x = 5 + this.ballRadius;
      this.ballVel.x = Math.abs(this.ballVel.x) * 0.5;
    } else if (!isLeft && this.ballPos.x + this.ballRadius >= this.fieldWidth - 5) {
      this.ballPos.x = this.fieldWidth - 5 - this.ballRadius;
      this.ballVel.x = -Math.abs(this.ballVel.x) * 0.5;
    }
  }

  private handlePlayerBallInteraction(
    pos: Vector2D,
    vel: Vector2D,
    facing: number,
    kickTimer: number,
    kickType: 'GROUND' | 'LOB',
    playerId: string,
    playerNum: 1 | 2
  ): void {
    const headX = pos.x;
    const headY = pos.y - this.bodyHeight - this.headRadius + 6;

    // A. Head Collision
    const distHead = Math.hypot(this.ballPos.x - headX, this.ballPos.y - headY);
    const minDistHead = this.ballRadius + this.headRadius;

    if (distHead < minDistHead) {
      const nx = (this.ballPos.x - headX) / (distHead || 1);
      const ny = (this.ballPos.y - headY) / (distHead || 1);

      // Separate ball
      this.ballPos.x = headX + nx * minDistHead;
      this.ballPos.y = headY + ny * minDistHead;

      // Header impulse
      const power = 480;
      this.ballVel.x = (nx * power) + (vel.x * 0.8) + (facing * 180);
      this.ballVel.y = Math.min(-240, ny * power);

      // Telemetry: KICK (HEADER)
      const ballSpeed = Math.round(Math.hypot(this.ballVel.x, this.ballVel.y));
      this.emit<HeadFootballKickPayload>(
        'ACTION',
        'KICK',
        {
          shotType: 'HEADER',
          ballSpeed,
          power: Math.round(power)
        },
        playerId
      );

      this.playTone(380, 'sine', 0.1, 0.15);
      return;
    }

    // B. Body / Foot Interaction
    const footX = pos.x + facing * 24;
    const footY = pos.y - 12;
    const distFoot = Math.hypot(this.ballPos.x - footX, this.ballPos.y - footY);

    if (distFoot < this.ballRadius + 26) {
      const alreadyConnected = playerNum === 1 ? this.p1KickConnected : this.p2KickConnected;

      if (kickTimer > 0) {
        if (alreadyConnected) {
          return;
        }

        // Active kick (single impulse + telemetry per swing)
        const isLob = kickType === 'LOB';
        const shotType = isLob ? 'LOB' : 'GROUND';
        const power = isLob ? 680 : 780;

        if (isLob) {
          this.ballVel.x = facing * 440;
          this.ballVel.y = -560;
        } else {
          this.ballVel.x = facing * 720;
          this.ballVel.y = -140;
        }

        if (playerNum === 1) {
          this.p1KickConnected = true;
        } else {
          this.p2KickConnected = true;
        }

        const ballSpeed = Math.round(Math.hypot(this.ballVel.x, this.ballVel.y));
        this.emit<HeadFootballKickPayload>(
          'ACTION',
          'KICK',
          {
            shotType,
            ballSpeed,
            power
          },
          playerId
        );

        this.playTone(260, 'square', 0.15, 0.2);
      } else {
        // Passive push
        this.ballVel.x = facing * 240 + vel.x * 0.6;
        this.ballVel.y = -120;
      }
    }
  }

  private triggerKick(shotType: 'GROUND' | 'LOB', playerNum: 1 | 2): void {
    this.playTone(220, 'sawtooth', 0.08, 0.08);
    // If not immediately touching the ball, telemetry will be emitted upon contact
    if (playerNum === 1) {
      this.p1KickType = shotType;
      this.p1KickConnected = false;
      this.p1KickTimer = shotType === 'LOB' ? 0.25 : 0.22;
    } else {
      this.p2KickType = shotType;
      this.p2KickConnected = false;
      this.p2KickTimer = shotType === 'LOB' ? 0.25 : 0.22;
    }
  }

  private checkGoalDetection(): void {
    // 1. Goal in Left Net (Scored by P2 / Away)
    if (
      this.ballPos.x < this.goalWidth - 10 &&
      this.ballPos.y > this.crossbarY + this.crossbarHeight &&
      this.ballPos.y < this.groundY
    ) {
      this.recordGoal(2);
    }
    // 2. Goal in Right Net (Scored by P1 / Home)
    else if (
      this.ballPos.x > this.fieldWidth - this.goalWidth + 10 &&
      this.ballPos.y > this.crossbarY + this.crossbarHeight &&
      this.ballPos.y < this.groundY
    ) {
      this.recordGoal(1);
    }
  }

  private recordGoal(scorerNum: 1 | 2): void {
    if (this.isGoalCelebration) return;

    const scorerId = scorerNum === 1 ? this.p1Id : this.p2Id;
    if (scorerNum === 1) {
      this.p1Score += 1;
    } else {
      this.p2Score += 1;
    }

    this.latestScorer = scorerId;
    this.isGoalCelebration = true;
    this.celebrationTimer = 2.4; // 2.4 seconds celebration

    // Telemetry: GOAL with exact cumulative score for COMEBACK detection in Scala
    const currentScorePayload: Record<string, number> = {
      [this.p1Id]: this.p1Score,
      [this.p2Id]: this.p2Score
    };

    // Elapsed match minute 0..90 (matchMinute is a display countdown, not valid for telemetry)
    const elapsedMinute = Math.min(
      90,
      Math.max(0, Math.round((this.matchTimeElapsed / this.matchDurationSeconds) * 90))
    );

    this.emit<HeadFootballGoalPayload>(
      'STATE_UPDATE',
      'GOAL',
      {
        scorerId,
        minute: elapsedMinute,
        currentScore: currentScorePayload
      },
      scorerId
    );

    this.currentScore = Math.max(this.p1Score, this.p2Score);

    // Audio & Confetti burst
    this.playTone(600, 'sawtooth', 0.6, 0.35);
    this.createGoalConfetti(this.ballPos.x, this.ballPos.y);
  }

  private createGoalConfetti(cx: number, cy: number): void {
    const colors = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444', '#ec4899', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 450;
      this.confetti.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 200,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 4 + Math.random() * 6,
        rotation: Math.random() * Math.PI,
        vRot: (Math.random() - 0.5) * 12,
        alpha: 1.0,
        life: 0
      });
    }
  }

  private updateConfetti(dt: number): void {
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const c = this.confetti[i];
      c.life += dt;
      c.vy += 450 * dt; // gravity
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rotation += c.vRot * dt;
      c.alpha = Math.max(0, 1 - (c.life / 2.2));
      if (c.life >= 2.2) {
        this.confetti.splice(i, 1);
      }
    }
  }

  private finishMatch(): void {
    const winnerId = this.p1Score > this.p2Score
      ? this.p1Id
      : this.p2Score > this.p1Score
      ? this.p2Id
      : 'DRAW';

    this.playTone(440, 'triangle', 0.8, 0.3);
    this.finish(winnerId, Math.max(this.p1Score, this.p2Score), 'FULL_TIME_90_MIN');
  }

  // --- Visual-Only Pixel Dust Helpers ---
  private spawnDustBurst(x: number, y: number, color: string): void {
    for (let i = 0; i < 8; i++) {
      const dir = i < 4 ? -1 : 1;
      this.dustParticles.push({
        x: x + dir * (6 + Math.random() * 10),
        y: y - 2 - Math.random() * 4,
        vx: dir * (35 + Math.random() * 75),
        vy: -(25 + Math.random() * 65),
        size: Math.random() > 0.5 ? 4 : 6,
        color,
        alpha: 1,
        life: 0,
        maxLife: 0.28 + Math.random() * 0.16
      });
    }
  }

  private updateDustParticles(dt: number): void {
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life += dt;
      p.vy += 240 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > this.groundY) p.y = this.groundY;
      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
      if (p.life >= p.maxLife) {
        this.dustParticles.splice(i, 1);
      }
    }
  }

  // --- 100% Pixel Art Offscreen Sprite Rendering ---
  private flipMatrixH(matrix: string[]): string[] {
    return matrix.map((row) => row.split('').reverse().join(''));
  }

  private getCrowdSprite(colorHex: string, darkHex: string, cheering: boolean): HTMLCanvasElement {
    const key = `crowd_${colorHex}_${cheering ? 'up' : 'dn'}`;
    const palette: PixelPalette = {
      o: '#05070e',
      s: '#fbcfe8',
      h: '#1e293b',
      j: colorHex,
      d: darkHex
    };

    const downMatrix: string[] = [
      '..hhhh..',
      '.hssssh.',
      '.hssssh.',
      '..oooo..',
      '.jjjjjj.',
      'sjjddjjs',
      'sjjddjjs',
      '.jjjjjj.',
      '.dd..dd.',
      '.oo..oo.'
    ];

    const upMatrix: string[] = [
      's.hhhh.s',
      'sjssssjs',
      '.hssssh.',
      '..oooo..',
      '.jjjjjj.',
      '.jjddjj.',
      '.jjddjj.',
      '.jjjjjj.',
      '.dd..dd.',
      '.oo..oo.'
    ];

    return this.spriteCache.getOrCreate(key, cheering ? upMatrix : downMatrix, palette, 2);
  }

  private getPlayerHeadSprite(
    facing: number,
    jerseyKey: string,
    accentColor: string,
    hairColor: string
  ): HTMLCanvasElement {
    const dir = facing >= 0 ? 'R' : 'L';
    const key = `phead_${jerseyKey}_${dir}`;
    const palette: PixelPalette = {
      o: '#0b0f19',
      s: '#fbcfe8',
      d: '#f472b6',
      a: accentColor,
      h: hairColor,
      w: '#ffffff'
    };

    // 20x20 matrix facing RIGHT -> pixelScale 3 = 60x60
    const baseRight: string[] = [
      '.....oooooooooo.....',
      '...oohhhhhhhhhhoo...',
      '..ohhhhhhhhhhhhhho..',
      '.ohhhhhhhhhhhhhhhho.',
      '.oaaaaaaaaaaaaaaaaao',
      '.oaaaaaaaaaaaaaaaaao',
      '.osssssssssssssssso.',
      '.osssssssssssssssso.',
      '.osssssswwwsswwwsso.',
      '.osssssswwwsswwwsso.',
      '.osssssswwwsswwwsso.',
      '.osssssssssssssssso.',
      '.osssssssssssddsso..',
      '.ossssssssooooooso..',
      '.odsssssssssssssso..',
      '..odsssssssssssdo...',
      '...oddddddddddoo....',
      '.....oooooooooo.....',
      '....................',
      '....................'
    ];

    const matrix = facing >= 0 ? baseRight : this.flipMatrixH(baseRight);
    return this.spriteCache.getOrCreate(key, matrix, palette, 3);
  }

  private getPlayerTorsoSprite(
    facing: number,
    jerseyKey: string,
    jerseyColor: string,
    jerseyDark: string,
    accentColor: string
  ): HTMLCanvasElement {
    const dir = facing >= 0 ? 'R' : 'L';
    const key = `ptorso_${jerseyKey}_${dir}`;
    const palette: PixelPalette = {
      o: '#0b0f19',
      j: jerseyColor,
      d: jerseyDark,
      a: accentColor,
      w: '#ffffff'
    };

    // 14x15 matrix -> pixelScale 3 = 42x45
    const baseRight: string[] = [
      '...oooooooo...',
      '..oaawwwwaao..',
      '.ojjjjjjjjjjo.',
      '.ojjaajjjjaao.',
      'oojjjjjjjjjjoo',
      'ojjjjjjjjjjjjo',
      'ojjjjjjjjjjjdo',
      'ojjjjjjjjjjjdo',
      'ojjjjjjjjjjjdo',
      'ojjjjjjjjjjjdo',
      'oddddddddddddo',
      '.oaaaaaaaaaao.',
      '.oddddooddddo.',
      '.odddd..ddddo.',
      '..oooo..oooo..'
    ];

    const matrix = facing >= 0 ? baseRight : this.flipMatrixH(baseRight);
    return this.spriteCache.getOrCreate(key, matrix, palette, 3);
  }

  private getPlayerBootSprite(
    facing: number,
    jerseyKey: string,
    accentColor: string,
    isKicking: boolean
  ): HTMLCanvasElement {
    const dir = facing >= 0 ? 'R' : 'L';
    const state = isKicking ? 'kick' : 'idle';
    const key = `pboot_${jerseyKey}_${dir}_${state}`;
    const palette: PixelPalette = {
      o: '#05070e',
      b: '#0f172a',
      s: '#334155',
      a: accentColor,
      w: '#ffffff'
    };

    const idleRight: string[] = [
      '.ooooo....',
      'obbbbo....',
      'obaaaooo..',
      'obbbbbbbbo',
      'osssssssso',
      '.oooooooo.'
    ];

    const kickRight: string[] = [
      '..oooooo.w',
      '.obbbbbo..',
      'oobaaaaoow',
      'obbbbbbbbo',
      'osssssssso',
      '.oooooooo.'
    ];

    const base = isKicking ? kickRight : idleRight;
    const matrix = facing >= 0 ? base : this.flipMatrixH(base);
    return this.spriteCache.getOrCreate(key, matrix, palette, 3);
  }

  private getBallSprite(frame: number): HTMLCanvasElement {
    const palette: PixelPalette = {
      o: '#0b0f19',
      w: '#ffffff',
      l: '#cbd5e1',
      s: '#64748b',
      p: '#0f172a'
    };

    const frames: string[][] = [
      // Frame 0
      [
        '.....oooooo.....',
        '...oowwwwwwoo...',
        '..owwwppppwwwo..',
        '.owwwwppppwwwwl.',
        '.owwwwwppwwwwll.',
        'owwwwwwppwwwwwlo',
        'oppwwwwwwwwwwppo',
        'opppwwppppwwpppo',
        'oppwwwppppwwwppo',
        'owwwwwppppwwwwlo',
        'owwwwwwppwwwwwlo',
        '.olwwwwwwwwwwlo.',
        '.ollwwppppwwllo.',
        '..ollwppppwllo..',
        '...oossssssoo...',
        '.....oooooo.....'
      ],
      // Frame 1
      [
        '.....oooooo.....',
        '...oowwwwwwoo...',
        '..owwwwwppppwo..',
        '.owwwwwwppppwwl.',
        '.opppwwwwppwwll.',
        'oppppwwwwwwwwwlo',
        'opppwwwppppwwwlo',
        'owwwwwwppppwwppo',
        'owwwwwwwwwwwpppo',
        'owwwppppwwwwpppo',
        'owwwppppwwwwwwlo',
        '.olwwppwwwwwwlo.',
        '.ollwwwwwwwwllo.',
        '..ollssppppwlo..',
        '...oossssssoo...',
        '.....oooooo.....'
      ],
      // Frame 2
      [
        '.....oooooo.....',
        '...oowppppoow...',
        '..owwwppppwwwo..',
        '.owwwwwppwwwwwl.',
        '.owwwwwwwwwwwll.',
        'owwpppwwwwpppwlo',
        'owwppppwwpppppwo',
        'owwwppwwwwppwwlo',
        'owwwwwwwwwwwwwlo',
        'owwwwwppppwwwwlo',
        'olwwwwppppwwwwlo',
        '.olwwwwppwwwwlo.',
        '.ollwwwwwwwwllo.',
        '..ollssssssllo..',
        '...oossssssoo...',
        '.....oooooo.....'
      ],
      // Frame 3
      [
        '.....oooooo.....',
        '...oowwwwwwoo...',
        '..owppppwwwwwo..',
        '.owwppppwwwwwwl.',
        '.owwwppwwwwpppl.',
        'owwwwwwwwwpppppo',
        'owwwwppppwwwpppo',
        'opppwppppwwwwwlo',
        'opppwwwwwwwwwwlo',
        'opppwwwwppppwwlo',
        'owwwwwwwppppwwlo',
        '.olwwwwwwppwwlo.',
        '.ollwwwwwwwwllo.',
        '..ollwppppsslo..',
        '...oossssssoo...',
        '.....oooooo.....'
      ]
    ];

    return this.spriteCache.getOrCreate(`ball_f${frame}`, frames[frame % 4], palette, 2);
  }

  private getPlayerShadowSprite(): HTMLCanvasElement {
    const palette: PixelPalette = { s: 'rgba(2, 6, 23, 0.58)' };
    const matrix: string[] = [
      '...ssssssssss...',
      '.ssssssssssssss.',
      'ssssssssssssssss',
      '.ssssssssssssss.',
      '...ssssssssss...'
    ];
    return this.spriteCache.getOrCreate('player_shadow', matrix, palette, 3);
  }

  private ensureStadiumBackground(): HTMLCanvasElement {
    if (this.stadiumBgCanvas) return this.stadiumBgCanvas;

    const bg = document.createElement('canvas');
    bg.width = this.fieldWidth;
    bg.height = this.groundY;
    const bctx = bg.getContext('2d');
    if (bctx) {
      bctx.imageSmoothingEnabled = false;

      // Stepped pixel night sky bands
      const skyBands = ['#05070e', '#070b17', '#091021', '#0b1329', '#0e1733'];
      const bandH = Math.ceil(this.groundY / skyBands.length);
      skyBands.forEach((col, i) => {
        bctx.fillStyle = col;
        bctx.fillRect(0, i * bandH, this.fieldWidth, bandH);
      });

      // Crisp pixel stars
      bctx.fillStyle = '#475569';
      const starCoords = [
        [60, 34], [140, 72], [230, 28], [310, 88], [410, 44],
        [540, 32], [620, 76], [710, 26], [810, 62], [890, 40],
        [185, 120], [490, 110], [760, 115]
      ];
      for (const [sx, sy] of starCoords) {
        bctx.fillRect(sx, sy, 2, 2);
      }

      // Stepped pixel floodlight cones (left & right)
      bctx.fillStyle = 'rgba(6, 182, 212, 0.045)';
      for (let y = 24; y < this.groundY - 120; y += 8) {
        const spread = Math.floor((y - 24) * 0.75);
        bctx.fillRect(Math.max(0, 110 - spread), y, 20 + spread * 2, 8);
        bctx.fillRect(Math.max(0, 830 - spread), y, 20 + spread * 2, 8);
      }

      // Pixel Floodlight Towers
      const drawTower = (tx: number) => {
        bctx.fillStyle = '#1e293b';
        bctx.fillRect(tx - 6, 40, 12, this.groundY - 180);
        bctx.fillStyle = '#334155';
        bctx.fillRect(tx - 24, 16, 48, 26);
        bctx.fillStyle = '#0f172a';
        bctx.fillRect(tx - 20, 20, 40, 18);
        // Pixel bulbs
        bctx.fillStyle = '#67e8f9';
        for (let bx = -16; bx <= 12; bx += 10) {
          bctx.fillRect(tx + bx, 23, 6, 4);
          bctx.fillRect(tx + bx, 31, 6, 4);
        }
      };
      drawTower(120);
      drawTower(840);

      // Stadium Bleachers / Stands tiers
      bctx.fillStyle = '#0f172a';
      bctx.fillRect(0, this.groundY - 130, this.fieldWidth, 130);
      bctx.fillStyle = '#1e293b';
      bctx.fillRect(0, this.groundY - 132, this.fieldWidth, 4);
      bctx.fillRect(0, this.groundY - 88, this.fieldWidth, 4);

      // Pixel Ad Boards along pitch edge
      bctx.fillStyle = '#0b0f19';
      bctx.fillRect(0, this.groundY - 26, this.fieldWidth, 26);
      bctx.fillStyle = '#1e293b';
      bctx.fillRect(0, this.groundY - 28, this.fieldWidth, 2);

      const adColors = ['#10b981', '#06b6d4', '#f59e0b', '#ef4444'];
      const adLabels = ['PIXEL CUP', '16-BIT', 'ARCADE', 'HEAD GOAL'];
      for (let i = 0; i < 8; i++) {
        const ax = i * 120 + 6;
        bctx.fillStyle = '#111827';
        bctx.fillRect(ax, this.groundY - 22, 108, 18);
        bctx.fillStyle = adColors[i % adColors.length];
        bctx.fillRect(ax, this.groundY - 22, 4, 18);
        bctx.font = 'bold 8px "Press Start 2P", monospace';
        bctx.textAlign = 'center';
        bctx.textBaseline = 'middle';
        bctx.fillText(adLabels[i % adLabels.length], ax + 56, this.groundY - 12);
      }
    }

    this.stadiumBgCanvas = bg;
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
    const width = rect.width || this.fieldWidth;
    const height = rect.height || this.fieldHeight;
    const dpr = window.devicePixelRatio || 1;

    if (this.canvas.width !== Math.floor(width * dpr) || this.canvas.height !== Math.floor(height * dpr)) {
      this.canvas.width = Math.floor(width * dpr);
      this.canvas.height = Math.floor(height * dpr);
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;

    const scale = Math.min(width / this.fieldWidth, height / this.fieldHeight);
    const offsetX = Math.floor((width - this.fieldWidth * scale) / 2);
    const offsetY = Math.floor((height - this.fieldHeight * scale) / 2);

    // Clear letterbox
    this.ctx.fillStyle = '#05070e';
    this.ctx.fillRect(0, 0, width, height);

    this.ctx.translate(offsetX, offsetY);
    this.ctx.scale(scale, scale);

    // 1. Pixel-Art Stadium & Animated Crowd
    this.renderStadium(this.ctx);

    // 2. Two-Tone Striped Pixel Pitch & Pixel-Net Goals
    this.renderPitchAndGoals(this.ctx);

    // 3. Jump/Land Pixel Dust Particles
    this.renderDustParticles(this.ctx);

    // 4. Pixel-Art Players
    this.renderPlayer(
      this.ctx,
      this.p1Pos,
      this.p1Facing,
      this.p1KickTimer,
      'p1',
      '#10b981',
      '#059669',
      '#06b6d4',
      '#0f172a',
      '07',
      this.p1Id
    );
    this.renderPlayer(
      this.ctx,
      this.p2Pos,
      this.p2Facing,
      this.p2KickTimer,
      'p2',
      '#ef4444',
      '#b91c1c',
      '#f59e0b',
      '#1e1b4b',
      '10',
      this.p2Id
    );

    // 5. Classic 16x16 Rotating Pixel Soccer Ball
    this.renderBall(this.ctx);

    // 6. Square Pixel Confetti
    this.renderConfetti(this.ctx);

    // 7. Retro Luminous Arcade Scoreboard
    this.renderScoreboard(this.ctx);

    // 8. On-canvas control hints
    this.renderControlHints(this.ctx);

    // 9. Goal or Full Time Banner
    if (this.isGoalCelebration) {
      this.renderGoalBanner(this.ctx);
    } else if (this.status === 'FINISHED') {
      this.renderFullTimeBanner(this.ctx);
    }

    this.ctx.restore();
  }

  private renderStadium(ctx: CanvasRenderingContext2D): void {
    const bg = this.ensureStadiumBackground();
    ctx.drawImage(bg, 0, 0);

    // Animated pixel crowd jumping in two tiers
    const crowdColors: Array<[string, string]> = [
      ['#10b981', '#047857'],
      ['#06b6d4', '#0e7490'],
      ['#f59e0b', '#b45309'],
      ['#ef4444', '#b91c1c'],
      ['#64748b', '#334155']
    ];

    const speed = this.isGoalCelebration ? 14 : 4;
    const maxJump = this.isGoalCelebration ? 8 : 3;

    // Back tier
    for (let i = 0; i < 38; i++) {
      const x = 22 + i * 24;
      const [col, dark] = crowdColors[(i * 3) % crowdColors.length];
      const wave = Math.sin(this.animClock * speed + i * 0.9);
      const jumpY = wave > 0.2 ? -Math.round(wave * maxJump) : 0;
      const cheering = this.isGoalCelebration || wave > 0.55;
      const sprite = this.getCrowdSprite(col, dark, cheering);
      ctx.drawImage(sprite, x, this.groundY - 116 + jumpY, 16, 20);
    }

    // Front tier
    for (let i = 0; i < 40; i++) {
      const x = 10 + i * 24;
      const [col, dark] = crowdColors[(i + 2) % crowdColors.length];
      const wave = Math.sin(this.animClock * speed + i * 1.3 + 1.5);
      const jumpY = wave > 0.1 ? -Math.round(wave * maxJump) : 0;
      const cheering = this.isGoalCelebration || wave > 0.45;
      const sprite = this.getCrowdSprite(col, dark, cheering);
      ctx.drawImage(sprite, x, this.groundY - 72 + jumpY, 16, 20);
    }
  }

  private renderPitchAndGoals(ctx: CanvasRenderingContext2D): void {
    // Base two-tone grass pitch
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, this.groundY, this.fieldWidth, this.fieldHeight - this.groundY);

    ctx.fillStyle = '#065f46';
    for (let x = 0; x < this.fieldWidth; x += 80) {
      ctx.fillRect(x, this.groundY, 40, this.fieldHeight - this.groundY);
    }

    // Pixel grass tuft top edge
    ctx.fillStyle = '#10b981';
    for (let x = 0; x < this.fieldWidth; x += 8) {
      ctx.fillRect(x, this.groundY - 2, 4, 2);
    }

    // Crisp pixel touchline
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, this.groundY, this.fieldWidth, 4);

    // Center line
    const midX = Math.floor(this.fieldWidth / 2);
    ctx.fillRect(midX - 2, this.groundY, 4, this.fieldHeight - this.groundY);

    // Pixel-stepped center circle arc
    const r = 56;
    for (let dx = -r; dx <= r; dx += 4) {
      const dy = Math.round(Math.sqrt(Math.max(0, r * r - dx * dx)) / 4) * 4;
      ctx.fillRect(midX + dx - 2, this.groundY + dy - 2, 4, 4);
    }

    // Left & Right Pixel Goals
    this.renderSingleGoal(ctx, 0, this.goalWidth, true);
    this.renderSingleGoal(ctx, this.fieldWidth - this.goalWidth, this.fieldWidth, false);
  }

  private renderSingleGoal(
    ctx: CanvasRenderingContext2D,
    startX: number,
    endX: number,
    isLeft: boolean
  ): void {
    const goalLineX = isLeft ? endX : startX;
    const backX = isLeft ? startX + 4 : endX - 4;
    const netMinX = Math.min(backX, goalLineX);
    const netMaxX = Math.max(backX, goalLineX);

    // Pixelated net grid (2px crisp lines)
    ctx.fillStyle = 'rgba(226, 232, 240, 0.24)';
    for (let y = this.crossbarY + 12; y < this.groundY; y += 12) {
      ctx.fillRect(netMinX, y, netMaxX - netMinX, 2);
    }
    for (let x = netMinX; x <= netMaxX; x += 12) {
      ctx.fillRect(x, this.crossbarY, 2, this.groundY - this.crossbarY);
    }

    // Back support post (pixel slate)
    ctx.fillStyle = '#475569';
    ctx.fillRect(backX - 2, this.crossbarY, 4, this.groundY - this.crossbarY);

    // Crossbar (3-tone pixel bevel)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(netMinX, this.crossbarY - 4, netMaxX - netMinX, 10);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(netMinX, this.crossbarY - 2, netMaxX - netMinX, 4);

    // Front vertical post (3-tone pixel bevel)
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(goalLineX - 4, this.crossbarY - 4, 8, this.groundY - this.crossbarY + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(goalLineX - 2, this.crossbarY - 2, 4, this.groundY - this.crossbarY + 2);
  }

  private renderDustParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.dustParticles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
    }
    ctx.globalAlpha = 1.0;
  }

  private renderPlayer(
    ctx: CanvasRenderingContext2D,
    pos: Vector2D,
    facing: number,
    kickTimer: number,
    jerseyKey: string,
    jerseyColor: string,
    jerseyDark: string,
    accentColor: string,
    hairColor: string,
    numberStr: string,
    name: string
  ): void {
    const px = Math.round(pos.x);
    const py = Math.round(pos.y);

    // 1. Hard Pixel Ground Shadow
    const shadow = this.getPlayerShadowSprite();
    ctx.drawImage(shadow, px - 24, this.groundY - 4, 48, 15);

    // 2. Animated Pixel Boot (Kicking vs Idle)
    const isKicking = kickTimer > 0;
    const bootSprite = this.getPlayerBootSprite(facing, jerseyKey, accentColor, isKicking);
    const bootX = facing > 0 ? px - 8 + (isKicking ? 20 : 0) : px - 22 - (isKicking ? 20 : 0);
    const bootY = py - 18 - (isKicking ? 6 : 0);
    ctx.drawImage(bootSprite, bootX, bootY, 30, 18);

    // 3. Pixel Torso / Jersey
    const torsoY = py - this.bodyHeight;
    const torsoSprite = this.getPlayerTorsoSprite(facing, jerseyKey, jerseyColor, jerseyDark, accentColor);
    ctx.drawImage(torsoSprite, px - 21, torsoY, 42, 45);

    // Crisp Pixel Dorsal Number
    ctx.font = 'bold 10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#0b0f19';
    ctx.fillText(numberStr, px + 1, torsoY + 23);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(numberStr, px, torsoY + 22);

    // 4. Pixel Bobblehead
    const headCenterY = torsoY - this.headRadius + 6;
    const headSprite = this.getPlayerHeadSprite(facing, jerseyKey, accentColor, hairColor);
    ctx.drawImage(headSprite, px - 30, headCenterY - 28, 60, 60);

    // Pixel Pupils tracking the ball (quantized 4x4 squares)
    const angleToBall = Math.atan2(this.ballPos.y - headCenterY, this.ballPos.x - px);
    const pupilDx = Math.round(Math.cos(angleToBall) * 2);
    const pupilDy = Math.round(Math.sin(angleToBall) * 2);

    // Eye white centers in 20x20x3 sprite:
    // Right-facing: cols 8..10 (x: -6..+3) and 13..15 (x: +9..+18), rows 8..10 (y: -4..+5)
    const leftEyeX = facing >= 0 ? px - 4 : px - 16;
    const rightEyeX = facing >= 0 ? px + 11 : px - 1;
    const eyeCenterY = headCenterY - 2;

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(leftEyeX + pupilDx, eyeCenterY + pupilDy, 4, 4);
    ctx.fillRect(rightEyeX + pupilDx, eyeCenterY + pupilDy, 4, 4);

    // 5. Pixel Name Tag above head
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillStyle = '#05070e';
    ctx.fillText(name, px + 1, headCenterY - this.headRadius - 7);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(name, px, headCenterY - this.headRadius - 8);
  }

  private renderBall(ctx: CanvasRenderingContext2D): void {
    const normalizedRot = ((this.ballRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    const frame = Math.floor(normalizedRot / (Math.PI / 2)) % 4;
    const ballSprite = this.getBallSprite(frame);

    const bx = Math.round(this.ballPos.x - this.ballRadius);
    const by = Math.round(this.ballPos.y - this.ballRadius);
    const size = this.ballRadius * 2; // 32x32 exact 2x scale of 16x16 sprite

    ctx.drawImage(ballSprite, bx, by, size, size);
  }

  private renderScoreboard(ctx: CanvasRenderingContext2D): void {
    const cx = Math.floor(this.fieldWidth / 2);
    const topY = 12;
    const boxW = 440;
    const boxH = 52;
    const leftX = cx - boxW / 2;

    // Hard pixel drop shadow
    ctx.fillStyle = '#020617';
    ctx.fillRect(leftX + 4, topY + 4, boxW, boxH);

    // Outer pixel frame
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(leftX, topY, boxW, boxH);

    // Inner dark LED panel
    ctx.fillStyle = '#05070e';
    ctx.fillRect(leftX + 4, topY + 4, boxW - 8, boxH - 8);

    // Corner pixel rivets
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(leftX + 2, topY + 2, 4, 4);
    ctx.fillRect(leftX + boxW - 6, topY + 2, 4, 4);
    ctx.fillRect(leftX + 2, topY + boxH - 6, 4, 4);
    ctx.fillRect(leftX + boxW - 6, topY + boxH - 6, 4, 4);

    // Center clock pill
    ctx.fillStyle = '#111827';
    ctx.fillRect(cx - 34, topY + 8, 68, 36);
    ctx.fillStyle = '#334155';
    ctx.fillRect(cx - 34, topY + 8, 68, 2);
    ctx.fillRect(cx - 34, topY + 42, 68, 2);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const midY = topY + boxH / 2 + 1;

    // Match minute LED (90s -> 0s countdown)
    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(`${this.matchMinute}'`, cx, midY);

    // Scores
    ctx.font = 'bold 20px "Press Start 2P", monospace';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`${this.p1Score}`, cx - 60, midY);

    ctx.fillStyle = '#ef4444';
    ctx.fillText(`${this.p2Score}`, cx + 60, midY);

    // Team names
    ctx.font = 'bold 9px "Press Start 2P", monospace';
    ctx.fillStyle = '#cbd5e1';
    ctx.textAlign = 'right';
    ctx.fillText(this.p1Id.slice(0, 10), cx - 88, midY);
    ctx.textAlign = 'left';
    ctx.fillText(this.p2Id.slice(0, 10), cx + 88, midY);

    // Mode pill below scoreboard
    const modeW = 112;
    const modeH = 16;
    const modeX = cx - modeW / 2;
    const modeY = topY + boxH;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(modeX, modeY, modeW, modeH);
    ctx.fillStyle = '#05070e';
    ctx.fillRect(modeX + 2, modeY, modeW - 4, modeH - 2);
    ctx.textAlign = 'center';
    ctx.font = 'bold 7px "Press Start 2P", monospace';
    ctx.fillStyle = this.mode === '2P_LOCAL' ? '#06b6d4' : '#94a3b8';
    ctx.fillText(this.mode === '2P_LOCAL' ? '2P LOCAL' : '1P VS CPU', cx, modeY + 8);
  }

  private renderControlHints(ctx: CanvasRenderingContext2D): void {
    const barY = 516;
    const barH = 18;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 8px "Press Start 2P", monospace';

    if (this.mode === '2P_LOCAL') {
      // Player 1 (Left) Controls Hint
      ctx.fillStyle = 'rgba(5, 7, 14, 0.82)';
      ctx.fillRect(12, barY, 456, barH);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(12, barY, 4, barH);
      ctx.fillStyle = '#a7f3d0';
      ctx.fillText('P1: A/D MOVE  W JUMP  S/SPC KICK  F LOB', 242, barY + 10);

      // Player 2 (Right) Controls Hint
      ctx.fillStyle = 'rgba(5, 7, 14, 0.82)';
      ctx.fillRect(492, barY, 456, barH);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(944, barY, 4, barH);
      ctx.fillStyle = '#fecaca';
      ctx.fillText('P2: ARROWS(JLI)  DN/K KICK  ENT/M LOB', 718, barY + 10);
    } else {
      // Single Player vs CPU Controls Hint
      ctx.fillStyle = 'rgba(5, 7, 14, 0.82)';
      ctx.fillRect(120, barY, 720, barH);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(120, barY, 4, barH);
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('CONTROLS: WASD/ARROWS MOVE+JUMP  S/SPC/DN KICK  F LOB', 480, barY + 10);
    }
  }

  private renderConfetti(ctx: CanvasRenderingContext2D): void {
    for (const c of this.confetti) {
      const s = Math.max(4, Math.round(c.size));
      ctx.fillStyle = c.color;
      ctx.globalAlpha = c.alpha;
      ctx.fillRect(Math.round(c.x - s / 2), Math.round(c.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1.0;
  }

  private renderGoalBanner(ctx: CanvasRenderingContext2D): void {
    const cx = this.fieldWidth / 2;
    const cy = this.fieldHeight / 2 - 20;

    ctx.fillStyle = 'rgba(5, 7, 14, 0.9)';
    ctx.fillRect(0, cy - 64, this.fieldWidth, 128);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(0, cy - 64, this.fieldWidth, 4);
    ctx.fillRect(0, cy + 60, this.fieldWidth, 4);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 44px "Press Start 2P", monospace';
    ctx.fillStyle = '#78350f';
    ctx.fillText('GOAL!', cx + 4, cy - 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillText('GOAL!', cx, cy - 16);

    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#ecfeff';
    ctx.fillText(`${this.latestScorer} SCORES AT ${this.matchMinute}'!`, cx, cy + 32);
  }

  private renderFullTimeBanner(ctx: CanvasRenderingContext2D): void {
    const cx = this.fieldWidth / 2;
    const cy = this.fieldHeight / 2;

    ctx.fillStyle = 'rgba(5, 7, 14, 0.9)';
    ctx.fillRect(0, 0, this.fieldWidth, this.fieldHeight);

    const boxW = 540;
    const boxH = 190;
    const bx = Math.floor(cx - boxW / 2);
    const by = Math.floor(cy - boxH / 2);

    ctx.fillStyle = '#0b0f19';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 4;
    ctx.strokeRect(bx, by, boxW, boxH);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 28px "Press Start 2P", monospace';
    ctx.fillStyle = '#064e3b';
    ctx.fillText("FULL TIME (90')", cx + 3, cy - 45);
    ctx.fillStyle = '#10b981';
    ctx.fillText("FULL TIME (90')", cx, cy - 48);

    ctx.font = 'bold 16px "Press Start 2P", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`FINAL SCORE: ${this.p1Score} - ${this.p2Score}`, cx, cy + 6);

    const winnerText = this.p1Score > this.p2Score
      ? `${this.p1Id} WINS!`
      : this.p2Score > this.p1Score
      ? `${this.p2Id} WINS!`
      : 'MATCH TIED (DRAW)!';

    ctx.font = 'bold 14px "Press Start 2P", monospace';
    ctx.fillStyle = '#f59e0b';
    ctx.fillText(winnerText, cx, cy + 48);
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
    this.stadiumBgCanvas = null;
    this.canvas = null;
    this.ctx = null;
  }
}
