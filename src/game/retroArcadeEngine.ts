import { GameEngine } from './engine.ts';
import {
  initSnakeState,
  applySnakeInput,
  tickSnake,
  SnakeState,
  initInvadersGrid,
  stepInvadersMarch,
  InvaderAlien,
  BunkerShield,
  PongBall,
  Paddle,
  checkPaddleBallBounce,
  RacerCar,
  updateRacerPosition,
  VectorShip,
  updateVectorShipPhysics,
  initPlumberStage,
  updatePlumberMovement,
  PlumberPlayer,
  PlatformBlock,
  PlatformEnemy,
} from './retroRules.ts';
import type { GameInput, GameStatus } from './types.ts';
import type { RetroGameId } from './retroGames.ts';
import { sound } from './audio.ts';

export const ARENA_WIDTH = 1920;
export const ARENA_HEIGHT = 1080;

export class RetroArcadeEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public activeGame: RetroGameId = 'super_plumber';
  public status: GameStatus = 'title';

  // Sub-engines
  public voidEngine: GameEngine;

  // Snake State
  public snakeState: SnakeState;
  private snakeTimer: number = 0;

  // Invaders State
  public invaderAliens: InvaderAlien[] = [];
  public invaderBunkers: BunkerShield[] = [];
  public invaderPlayerX: number = ARENA_WIDTH / 2;
  public invaderDirection: number = 1;
  public invaderSpeed: number = 80;
  public invaderMarchTimer: number = 0;
  public invaderBullets: Array<{ x: number; y: number; vy: number; isPlayer: boolean }> = [];
  public invaderUfo: { x: number; y: number; active: boolean; score: number } = { x: -100, y: 100, active: false, score: 300 };
  public invaderPlayerHp: number = 3;
  public invaderScore: number = 0;

  // Pong State
  public pongBall: PongBall = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 550, vy: 250, radius: 14, speed: 600 };
  public playerPaddle: Paddle = { x: 90, y: ARENA_HEIGHT / 2, w: 24, h: 180, score: 0 };
  public aiPaddle: Paddle = { x: ARENA_WIDTH - 90, y: ARENA_HEIGHT / 2, w: 24, h: 180, score: 0 };
  public pongRally: number = 0;

  // Turbo Racer State
  public racerPlayer: RacerCar = { x: 0.5, y: 840, speed: 120, maxSpeed: 280, boost: false, lane: 2 };
  public racerTraffic: Array<{ x: number; y: number; speed: number; color: string }> = [];
  public racerRoadOffset: number = 0;
  public racerScore: number = 0;
  public racerLapTime: number = 0;

  // Vector Asteroids State
  public vectorShip: VectorShip = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 18, score: 0, lives: 3 };
  public vectorRocks: Array<{ x: number; y: number; vx: number; vy: number; radius: number; points: number }> = [];
  public vectorShots: Array<{ x: number; y: number; vx: number; vy: number; life: number }> = [];
  public vectorUfo: { x: number; y: number; vx: number; active: boolean } = { x: -80, y: 200, vx: 180, active: false };

  // Super Plumber (Mario 1985) State
  public plumberStage!: {
    player: PlumberPlayer;
    blocks: PlatformBlock[];
    enemies: PlatformEnemy[];
    flagpoleX: number;
  };
  public plumberCameraX: number = 0;
  public plumberTime: number = 400;
  public plumberFireballs: Array<{ x: number; y: number; vx: number; vy: number; bounces: number }> = [];
  public plumberParticles: Array<{ x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number; size: number; text?: string }> = [];
  public plumberStageClear: boolean = false;
  public plumberFlagY: number = 320;
  public plumberClearTimer: number = 0;
  private prevFireInput: boolean = false;

  // Inputs
  public currentInput: GameInput = {
    stickX: 0,
    stickY: 0,
    fire: false,
    boost: false,
    shield: false,
    bomb: false,
  };

  private lastTime: number = 0;
  private animId: number = 0;

  public onStatsChange?: (stats: {
    score: number;
    health: number;
    shield: number;
    energy: number;
    bombCharge: number;
    wave: number;
    status: GameStatus;
    combo: number;
  }) => void;

  public onHapticTrigger?: (playerId: number, pattern: number[], health: number, shield: number, score: number) => void;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.voidEngine = new GameEngine(canvas);
    this.snakeState = initSnakeState();
    this.initInvaders();
    this.initRacer();
    this.initVectorAsteroids();
    this.initPlumber();

    this.voidEngine.onStatsChange = (s) => {
      if (this.activeGame === 'void_horizon' && this.onStatsChange) {
        this.onStatsChange(s);
        this.status = s.status;
      }
    };
    this.voidEngine.onHapticTrigger = (id, pat, hp, sh, sc) => {
      if (this.activeGame === 'void_horizon' && this.onHapticTrigger) {
        this.onHapticTrigger(id, pat, hp, sh, sc);
      }
    };
  }

  public setGame(gameId: RetroGameId) {
    this.activeGame = gameId;
    this.status = 'title';
    document.body.dataset.state = 'title';
    if (gameId === 'void_horizon') {
      this.voidEngine.status = 'title';
    } else if (gameId === 'cyber_snake') {
      this.snakeState = initSnakeState();
    } else if (gameId === 'galactic_invaders') {
      this.initInvaders();
    } else if (gameId === 'neon_pong') {
      this.resetPongBall();
      this.playerPaddle.score = 0;
      this.aiPaddle.score = 0;
    } else if (gameId === 'turbo_racer') {
      this.initRacer();
    } else if (gameId === 'vector_asteroids') {
      this.initVectorAsteroids();
    } else if (gameId === 'super_plumber') {
      this.initPlumber();
    }
    this.render();
  }

  public setInput(input: GameInput) {
    this.currentInput = { ...input };
    if (this.activeGame === 'void_horizon') {
      this.voidEngine.setInput(1, input);
    } else if (this.activeGame === 'cyber_snake') {
      applySnakeInput(this.snakeState, input);
    } else if (this.activeGame === 'super_plumber') {
      if (input.fire && !this.prevFireInput && !this.plumberStage.player.isDead && !this.plumberStageClear) {
        this.spawnPlumberFireball();
      }
      this.prevFireInput = !!input.fire;
    }
  }

  public startGame() {
    this.status = 'playing';
    document.body.dataset.state = 'playing';

    if (this.activeGame === 'void_horizon') {
      this.voidEngine.startGame();
    } else if (this.activeGame === 'cyber_snake') {
      this.snakeState = initSnakeState();
    } else if (this.activeGame === 'galactic_invaders') {
      this.initInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.resetPongBall();
      this.playerPaddle.score = 0;
      this.aiPaddle.score = 0;
    } else if (this.activeGame === 'turbo_racer') {
      this.initRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.initVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.initPlumber();
    }

    this.lastTime = performance.now();
    this.runLoop();
  }

  public pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused';
      document.body.dataset.state = 'paused';
      if (this.activeGame === 'void_horizon') this.voidEngine.pauseGame();
    } else if (this.status === 'paused') {
      this.status = 'playing';
      document.body.dataset.state = 'playing';
      if (this.activeGame === 'void_horizon') this.voidEngine.pauseGame();
      this.lastTime = performance.now();
      this.runLoop();
    }
  }

  public restartGame() {
    this.startGame();
  }

  public stop() {
    if (this.animId) cancelAnimationFrame(this.animId);
    this.voidEngine.stop();
  }

  public runLoop = () => {
    if (this.status !== 'playing') return;

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    if (this.activeGame === 'void_horizon') {
      // Handled by voidEngine
    } else if (this.activeGame === 'cyber_snake') {
      this.updateSnake(dt);
      this.renderSnake();
    } else if (this.activeGame === 'galactic_invaders') {
      this.updateInvaders(dt);
      this.renderInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.updatePong(dt);
      this.renderPong();
    } else if (this.activeGame === 'turbo_racer') {
      this.updateRacer(dt);
      this.renderRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.updateVectorAsteroids(dt);
      this.renderVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.updatePlumber(dt);
      this.renderPlumber();
    }

    this.animId = requestAnimationFrame(this.runLoop);
  };

  // -------------------------------------------------------------------------
  // 1. CYBER SNAKE
  // -------------------------------------------------------------------------
  private updateSnake(dt: number) {
    if (this.snakeState.isGameOver) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    this.snakeTimer += dt;
    const interval = this.currentInput.boost ? 0.04 : 0.08;
    if (this.snakeTimer >= interval) {
      this.snakeTimer = 0;
      const ateFood = tickSnake(this.snakeState);
      if (ateFood) {
        sound.playBlip(720, 0.1);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [60], 5, 100, this.snakeState.score);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.snakeState.score,
        health: this.snakeState.isGameOver ? 0 : 5,
        shield: 100,
        energy: this.currentInput.boost ? 40 : 100,
        bombCharge: 100,
        wave: Math.floor(this.snakeState.score / 500) + 1,
        status: this.status,
        combo: Math.min(8, Math.floor(this.snakeState.length / 5)),
      });
    }
  }

  private renderSnake() {
    const ctx = this.ctx;
    ctx.fillStyle = '#050914';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Neon Grid
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.12)';
    ctx.lineWidth = 1;
    const sz = this.snakeState.gridSize;
    for (let x = 0; x < ARENA_WIDTH; x += sz) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ARENA_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < ARENA_HEIGHT; y += sz) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ARENA_WIDTH, y);
      ctx.stroke();
    }

    // Food Core
    const fx = this.snakeState.food.x * sz + sz / 2;
    const fy = this.snakeState.food.y * sz + sz / 2;
    ctx.fillStyle = this.snakeState.food.type === 'super' ? '#f59e0b' : '#38bdf8';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(fx, fy, sz * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Snake Body
    for (let i = 0; i < this.snakeState.body.length; i++) {
      const seg = this.snakeState.body[i];
      const isHead = i === 0;
      ctx.fillStyle = isHead ? '#ffffff' : '#10b981';
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = isHead ? 20 : 10;
      ctx.fillRect(seg.x * sz + 2, seg.y * sz + 2, sz - 4, sz - 4);
    }
    ctx.shadowBlur = 0;
  }

  // -------------------------------------------------------------------------
  // 2. GALACTIC INVADERS
  // -------------------------------------------------------------------------
  private initInvaders() {
    const data = initInvadersGrid();
    this.invaderAliens = data.aliens;
    this.invaderBunkers = data.bunkers;
    this.invaderPlayerX = ARENA_WIDTH / 2;
    this.invaderDirection = 1;
    this.invaderSpeed = 80;
    this.invaderBullets = [];
    this.invaderPlayerHp = 3;
    this.invaderScore = 0;
  }

  private updateInvaders(dt: number) {
    if (this.invaderPlayerHp <= 0) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    // Player Steer
    const steer = this.currentInput.stickX;
    this.invaderPlayerX += steer * 600 * dt;
    this.invaderPlayerX = Math.max(120, Math.min(ARENA_WIDTH - 120, this.invaderPlayerX));

    // Player Fire
    if (this.currentInput.fire && this.invaderBullets.filter(b => b.isPlayer).length < 2) {
      sound.playLaser(200);
      this.invaderBullets.push({
        x: this.invaderPlayerX,
        y: 920,
        vy: -900,
        isPlayer: true,
      });
    }

    // March Swarm
    this.invaderMarchTimer += dt;
    if (this.invaderMarchTimer >= 0.04) {
      this.invaderMarchTimer = 0;
      const step = stepInvadersMarch(this.invaderAliens, this.invaderDirection, this.invaderSpeed, ARENA_WIDTH);
      if (step.dropDown) {
        this.invaderDirection = step.newDirection;
        for (const a of this.invaderAliens) {
          if (a.alive) a.y += 35;
        }
        sound.playRetroMarch();
      } else {
        for (const a of this.invaderAliens) {
          if (a.alive) a.x += this.invaderDirection * this.invaderSpeed * 0.04;
        }
      }
    }

    // Alien fire random bombs
    if (Math.random() < 0.03 && this.invaderBullets.filter(b => !b.isPlayer).length < 4) {
      const liveAliens = this.invaderAliens.filter(a => a.alive);
      if (liveAliens.length > 0) {
        const shooter = liveAliens[Math.floor(Math.random() * liveAliens.length)];
        this.invaderBullets.push({
          x: shooter.x,
          y: shooter.y + 20,
          vy: 360,
          isPlayer: false,
        });
      }
    }

    // Bullets update
    for (let i = this.invaderBullets.length - 1; i >= 0; i--) {
      const b = this.invaderBullets[i];
      b.y += b.vy * dt;

      if (b.y < 0 || b.y > ARENA_HEIGHT) {
        this.invaderBullets.splice(i, 1);
        continue;
      }

      // Check hit alien
      if (b.isPlayer) {
        for (const a of this.invaderAliens) {
          if (a.alive && Math.hypot(b.x - a.x, b.y - a.y) < 30) {
            a.alive = false;
            this.invaderBullets.splice(i, 1);
            this.invaderScore += a.points;
            this.invaderSpeed += 2.5; // Swarm speeds up!
            sound.playExplosion(false);
            if (this.onHapticTrigger) this.onHapticTrigger(1, [40], 5, 100, this.invaderScore);
            break;
          }
        }
      } else {
        // Alien bomb hit player
        if (Math.hypot(b.x - this.invaderPlayerX, b.y - 960) < 36) {
          this.invaderBullets.splice(i, 1);
          this.invaderPlayerHp--;
          sound.playExplosion(true);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [120, 50, 120], this.invaderPlayerHp, 0, this.invaderScore);
        }
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.invaderScore,
        health: this.invaderPlayerHp,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: 1,
        status: this.status,
        combo: 1,
      });
    }
  }

  private renderInvaders() {
    const ctx = this.ctx;
    ctx.fillStyle = '#06060c';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Render aliens
    for (const a of this.invaderAliens) {
      if (!a.alive) continue;
      ctx.fillStyle = a.type === 1 ? '#f43f5e' : a.type === 2 ? '#38bdf8' : '#eab308';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(a.x - 22, a.y - 18, 44, 36);
    }
    ctx.shadowBlur = 0;

    // Render bunkers
    for (const b of this.invaderBunkers) {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(b.x - 45, b.y, 90, 50);
    }

    // Render Player Cannon
    ctx.fillStyle = '#22c55e';
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 15;
    ctx.fillRect(this.invaderPlayerX - 30, 950, 60, 24);
    ctx.fillRect(this.invaderPlayerX - 8, 930, 16, 20);
    ctx.shadowBlur = 0;

    // Render Bullets
    for (const b of this.invaderBullets) {
      ctx.fillStyle = b.isPlayer ? '#38bdf8' : '#ef4444';
      ctx.fillRect(b.x - 3, b.y - 10, 6, 20);
    }
  }

  // -------------------------------------------------------------------------
  // 3. NEON PONG
  // -------------------------------------------------------------------------
  private resetPongBall() {
    this.pongBall.x = ARENA_WIDTH / 2;
    this.pongBall.y = ARENA_HEIGHT / 2;
    this.pongBall.speed = 650;
    const dir = Math.random() > 0.5 ? 1 : -1;
    this.pongBall.vx = dir * this.pongBall.speed;
    this.pongBall.vy = (Math.random() - 0.5) * 400;
  }

  private updatePong(dt: number) {
    // Player Paddle moved by stickY or Gyro
    let py = this.currentInput.stickY;
    if (this.currentInput.tiltY) py += this.currentInput.tiltY;
    this.playerPaddle.y += py * 850 * dt;
    this.playerPaddle.y = Math.max(100, Math.min(ARENA_HEIGHT - 100, this.playerPaddle.y));

    // AI Paddle tracking ball
    const diff = this.pongBall.y - this.aiPaddle.y;
    this.aiPaddle.y += Math.sign(diff) * Math.min(Math.abs(diff), 600 * dt);
    this.aiPaddle.y = Math.max(100, Math.min(ARENA_HEIGHT - 100, this.aiPaddle.y));

    // Ball movement
    this.pongBall.x += this.pongBall.vx * dt;
    this.pongBall.y += this.pongBall.vy * dt;

    // Top / bottom bounce
    if (this.pongBall.y - this.pongBall.radius <= 0 && this.pongBall.vy < 0) {
      this.pongBall.vy *= -1;
      sound.playBounce(320);
    }
    if (this.pongBall.y + this.pongBall.radius >= ARENA_HEIGHT && this.pongBall.vy > 0) {
      this.pongBall.vy *= -1;
      sound.playBounce(320);
    }

    // Paddle bounces
    if (checkPaddleBallBounce(this.pongBall, this.playerPaddle, true)) {
      this.pongRally++;
      sound.playBounce(480);
      if (this.onHapticTrigger) this.onHapticTrigger(1, [50], 5, 100, this.playerPaddle.score);
    }
    if (checkPaddleBallBounce(this.pongBall, this.aiPaddle, false)) {
      this.pongRally++;
      sound.playBounce(440);
    }

    // Goal scored
    if (this.pongBall.x < 0) {
      this.aiPaddle.score++;
      sound.playExplosion(false);
      this.resetPongBall();
    } else if (this.pongBall.x > ARENA_WIDTH) {
      this.playerPaddle.score++;
      sound.playBlip(880, 0.2);
      this.resetPongBall();
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.playerPaddle.score * 1000 + this.pongRally * 50,
        health: 5,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: this.pongRally,
        status: this.status,
        combo: this.pongRally,
      });
    }
  }

  private renderPong() {
    const ctx = this.ctx;
    ctx.fillStyle = '#080812';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Center dotted line
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.25)';
    ctx.setLineDash([16, 16]);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(ARENA_WIDTH / 2, 0);
    ctx.lineTo(ARENA_WIDTH / 2, ARENA_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player Paddle (Left - Cyan)
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 18;
    ctx.fillRect(this.playerPaddle.x - this.playerPaddle.w / 2, this.playerPaddle.y - this.playerPaddle.h / 2, this.playerPaddle.w, this.playerPaddle.h);

    // AI Paddle (Right - Rose)
    ctx.fillStyle = '#f43f5e';
    ctx.shadowColor = '#f43f5e';
    ctx.shadowBlur = 18;
    ctx.fillRect(this.aiPaddle.x - this.aiPaddle.w / 2, this.aiPaddle.y - this.aiPaddle.h / 2, this.aiPaddle.w, this.aiPaddle.h);

    // Ball (Yellow Pulse)
    ctx.fillStyle = '#eab308';
    ctx.shadowColor = '#eab308';
    ctx.shadowBlur = 24;
    ctx.beginPath();
    ctx.arc(this.pongBall.x, this.pongBall.y, this.pongBall.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Scores in massive numerals
    ctx.font = 'black 120px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.fillText(`${this.playerPaddle.score}`, ARENA_WIDTH / 4, 180);
    ctx.fillStyle = 'rgba(244, 63, 94, 0.4)';
    ctx.fillText(`${this.aiPaddle.score}`, (ARENA_WIDTH * 3) / 4, 180);
  }

  // -------------------------------------------------------------------------
  // 4. TURBO HIGHWAY RACER
  // -------------------------------------------------------------------------
  private initRacer() {
    this.racerPlayer = { x: 0.5, y: 840, speed: 120, maxSpeed: 280, boost: false, lane: 2 };
    this.racerTraffic = [];
    for (let i = 0; i < 6; i++) {
      this.racerTraffic.push({
        x: 0.2 + Math.random() * 0.6,
        y: -100 - i * 280,
        speed: 80 + Math.random() * 60,
        color: i % 2 === 0 ? '#f43f5e' : '#eab308',
      });
    }
    this.racerScore = 0;
  }

  private updateRacer(dt: number) {
    const steer = this.currentInput.stickX;
    const gas = this.currentInput.fire || this.currentInput.boost || true;
    const brake = this.currentInput.shield;
    const boost = this.currentInput.boost;

    updateRacerPosition(this.racerPlayer, steer, gas, brake, boost, dt);

    this.racerRoadOffset = (this.racerRoadOffset + this.racerPlayer.speed * 4 * dt) % 120;
    this.racerScore += Math.round(this.racerPlayer.speed * dt * 2);

    // Move traffic
    for (const car of this.racerTraffic) {
      car.y += (this.racerPlayer.speed - car.speed) * 3 * dt;
      if (car.y > ARENA_HEIGHT + 100) {
        car.y = -150;
        car.x = 0.2 + Math.random() * 0.6;
      }

      // Collision check
      const playerPxX = ARENA_WIDTH * this.racerPlayer.x;
      const trafficPxX = ARENA_WIDTH * car.x;
      if (Math.hypot(playerPxX - trafficPxX, this.racerPlayer.y - car.y) < 65) {
        this.racerPlayer.speed = Math.max(30, this.racerPlayer.speed - 140);
        sound.playExplosion(false);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [150], 3, 100, this.racerScore);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.racerScore,
        health: 5,
        shield: 100,
        energy: boost ? 50 : 100,
        bombCharge: 100,
        wave: Math.floor(this.racerScore / 5000) + 1,
        status: this.status,
        combo: Math.floor(this.racerPlayer.speed / 40),
      });
    }
  }

  private renderRacer() {
    const ctx = this.ctx;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Roadway asphalt
    const roadLeft = ARENA_WIDTH * 0.15;
    const roadWidth = ARENA_WIDTH * 0.7;
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(roadLeft, 0, roadWidth, ARENA_HEIGHT);

    // Road stripes
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 6;
    ctx.setLineDash([40, 40]);
    ctx.lineDashOffset = -this.racerRoadOffset;

    ctx.beginPath();
    ctx.moveTo(roadLeft + roadWidth * 0.33, 0);
    ctx.lineTo(roadLeft + roadWidth * 0.33, ARENA_HEIGHT);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(roadLeft + roadWidth * 0.66, 0);
    ctx.lineTo(roadLeft + roadWidth * 0.66, ARENA_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Player Sports Car (Cyan)
    const px = ARENA_WIDTH * this.racerPlayer.x;
    ctx.fillStyle = '#00f0ff';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 20;
    ctx.fillRect(px - 28, this.racerPlayer.y - 45, 56, 90);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px - 18, this.racerPlayer.y - 15, 36, 40); // windshield
    ctx.shadowBlur = 0;

    // Traffic Cars
    for (const car of this.racerTraffic) {
      const cx = ARENA_WIDTH * car.x;
      ctx.fillStyle = car.color;
      ctx.fillRect(cx - 25, car.y - 40, 50, 80);
    }
  }

  // -------------------------------------------------------------------------
  // 5. VECTOR ASTEROIDS
  // -------------------------------------------------------------------------
  private initVectorAsteroids() {
    this.vectorShip = { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT / 2, vx: 0, vy: 0, angle: -Math.PI / 2, radius: 18, score: 0, lives: 3 };
    this.vectorRocks = [];
    this.vectorShots = [];
    for (let i = 0; i < 8; i++) {
      this.vectorRocks.push({
        x: Math.random() * ARENA_WIDTH,
        y: Math.random() * ARENA_HEIGHT,
        vx: (Math.random() - 0.5) * 120,
        vy: (Math.random() - 0.5) * 120,
        radius: 40 + Math.random() * 30,
        points: 50,
      });
    }
  }

  private updateVectorAsteroids(dt: number) {
    if (this.vectorShip.lives <= 0) {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
      return;
    }

    const rot = this.currentInput.stickX;
    const thrust = this.currentInput.boost || this.currentInput.stickY < -0.3;
    updateVectorShipPhysics(this.vectorShip, rot, thrust, dt);

    // Shoot
    if (this.currentInput.fire && this.vectorShots.length < 5) {
      sound.playLaser(100);
      this.vectorShots.push({
        x: this.vectorShip.x + Math.cos(this.vectorShip.angle) * 25,
        y: this.vectorShip.y + Math.sin(this.vectorShip.angle) * 25,
        vx: Math.cos(this.vectorShip.angle) * 1000,
        vy: Math.sin(this.vectorShip.angle) * 1000,
        life: 0,
      });
    }

    // Hyperspace jump
    if (this.currentInput.bomb) {
      this.vectorShip.x = Math.random() * ARENA_WIDTH;
      this.vectorShip.y = Math.random() * ARENA_HEIGHT;
      this.vectorShip.vx = 0;
      this.vectorShip.vy = 0;
      sound.playBombNova();
    }

    // Update shots
    for (let i = this.vectorShots.length - 1; i >= 0; i--) {
      const s = this.vectorShots[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life += dt;
      if (s.life > 1.4) {
        this.vectorShots.splice(i, 1);
        continue;
      }

      // Check hit rock
      for (let j = this.vectorRocks.length - 1; j >= 0; j--) {
        const r = this.vectorRocks[j];
        if (Math.hypot(s.x - r.x, s.y - r.y) < r.radius) {
          this.vectorShots.splice(i, 1);
          this.vectorRocks.splice(j, 1);
          this.vectorShip.score += r.points;
          sound.playExplosion(false);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [60], this.vectorShip.lives, 100, this.vectorShip.score);

          // Split rock
          if (r.radius > 25) {
            this.vectorRocks.push({
              x: r.x - 15,
              y: r.y,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              radius: r.radius / 2,
              points: 100,
            });
            this.vectorRocks.push({
              x: r.x + 15,
              y: r.y,
              vx: (Math.random() - 0.5) * 180,
              vy: (Math.random() - 0.5) * 180,
              radius: r.radius / 2,
              points: 100,
            });
          }
          break;
        }
      }
    }

    // Update rocks
    for (const r of this.vectorRocks) {
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      if (r.x < 0) r.x += ARENA_WIDTH;
      if (r.x > ARENA_WIDTH) r.x -= ARENA_WIDTH;
      if (r.y < 0) r.y += ARENA_HEIGHT;
      if (r.y > ARENA_HEIGHT) r.y -= ARENA_HEIGHT;

      // Check hit ship
      if (Math.hypot(r.x - this.vectorShip.x, r.y - this.vectorShip.y) < r.radius + this.vectorShip.radius) {
        this.vectorShip.lives--;
        this.vectorShip.x = ARENA_WIDTH / 2;
        this.vectorShip.y = ARENA_HEIGHT / 2;
        this.vectorShip.vx = 0;
        this.vectorShip.vy = 0;
        sound.playExplosion(true);
        if (this.onHapticTrigger) this.onHapticTrigger(1, [150, 50, 150], this.vectorShip.lives, 0, this.vectorShip.score);
      }
    }

    if (this.onStatsChange) {
      this.onStatsChange({
        score: this.vectorShip.score,
        health: this.vectorShip.lives,
        shield: 100,
        energy: 100,
        bombCharge: 100,
        wave: 1,
        status: this.status,
        combo: 1,
      });
    }
  }

  private renderVectorAsteroids() {
    const ctx = this.ctx;
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // Vector line aesthetics
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 12;

    // Render Ship
    ctx.save();
    ctx.translate(this.vectorShip.x, this.vectorShip.y);
    ctx.rotate(this.vectorShip.angle);
    ctx.beginPath();
    ctx.moveTo(24, 0);
    ctx.lineTo(-18, -14);
    ctx.lineTo(-10, 0);
    ctx.lineTo(-18, 14);
    ctx.closePath();
    ctx.stroke();

    if (this.currentInput.boost || this.currentInput.stickY < -0.3) {
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(-24, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Render Rocks
    ctx.strokeStyle = '#a855f7';
    ctx.shadowColor = '#a855f7';
    for (const r of this.vectorRocks) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Render Shots
    ctx.fillStyle = '#ffffff';
    for (const s of this.vectorShots) {
      ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }
    ctx.shadowBlur = 0;
  }

  // -------------------------------------------------------------------------
  // 7. SUPER PLUMBER (Mario 1985 Platformer)
  // -------------------------------------------------------------------------
  public initPlumber() {
    this.plumberStage = initPlumberStage();
    this.plumberCameraX = 0;
    this.plumberTime = 400;
    this.plumberFireballs = [];
    this.plumberParticles = [];
    this.plumberStageClear = false;
    this.plumberFlagY = 320;
    this.plumberClearTimer = 0;
    this.prevFireInput = false;
  }

  public spawnPlumberFireball() {
    if (!this.plumberStage || !this.plumberStage.player) return;
    const p = this.plumberStage.player;
    if (this.plumberFireballs.length >= 2) return; // NES Mario maximum 2 fireballs
    sound.playLaser(200);
    this.plumberFireballs.push({
      x: p.facing > 0 ? p.x + p.w + 6 : p.x - 12,
      y: p.y + p.h * 0.45,
      vx: p.facing * 750,
      vy: 180,
      bounces: 0,
    });
    if (this.onHapticTrigger) this.onHapticTrigger(1, [35], p.lives, 100, p.score);
  }

  public addPlumberFloatingText(x: number, y: number, text: string, color: string) {
    this.plumberParticles.push({
      x,
      y,
      vx: 0,
      vy: -120,
      color,
      life: 0,
      maxLife: 0.9,
      size: 16,
      text,
    });
  }

  private updatePlumber(dt: number) {
    if (!this.plumberStage || !this.plumberStage.player) return;
    const player = this.plumberStage.player;

    // Plumber Death Animation
    if (player.isDead) {
      player.vy += 2200 * dt;
      player.y += player.vy * dt;
      if (player.y > 1250) {
        this.status = 'gameover';
        document.body.dataset.state = 'gameover';
      }
      return;
    }

    // Time countdown
    this.plumberTime = Math.max(0, this.plumberTime - dt * 2.2);
    if (this.plumberTime <= 0 && !this.plumberStageClear) {
      player.isDead = true;
      player.vy = -750;
      sound.playExplosion(false);
      return;
    }

    // Victory sequence: Flagpole reached!
    if (this.plumberStageClear) {
      this.plumberClearTimer += dt;
      // Slide flag down the pole
      if (this.plumberFlagY < 810) {
        this.plumberFlagY += 450 * dt;
      }
      // Plumber slides down pole, then walks to the right into the castle
      if (player.y < 824) {
        player.y += 360 * dt;
        player.onGround = false;
      } else if (player.x < this.plumberStage.flagpoleX + 380) {
        player.onGround = true;
        player.x += 180 * dt;
        player.facing = 1;
      }

      if (this.plumberClearTimer > 4.5) {
        this.status = 'gameover';
        document.body.dataset.state = 'gameover';
      }
      return;
    }

    // Check if player grabbed the flagpole
    if (player.x >= this.plumberStage.flagpoleX - 30 && !this.plumberStageClear) {
      this.plumberStageClear = true;
      this.plumberClearTimer = 0;
      sound.playStageClear();
      const timeBonus = Math.floor(this.plumberTime) * 50;
      player.score += 5000 + timeBonus;
      player.vx = 0;
      player.vy = 0;
      this.addPlumberFloatingText(player.x, player.y - 40, `+${5000 + timeBonus} PTS!`, '#4ade80');
      if (this.onHapticTrigger) {
        this.onHapticTrigger(1, [100, 50, 100, 50, 200], player.lives, 100, player.score);
      }
      return;
    }

    // Standard platformer movement & collision physics
    updatePlumberMovement(
      player,
      this.plumberStage.blocks,
      this.plumberStage.enemies,
      this.currentInput,
      dt,
      {
        onJump: () => {
          sound.playJump();
          if (this.onHapticTrigger) this.onHapticTrigger(1, [30], player.lives, 100, player.score);
        },
        onCoin: () => {
          sound.playCoin();
          this.addPlumberFloatingText(player.x, player.y - 30, '+200', '#facc15');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [40], player.lives, 100, player.score);
        },
        onStomp: () => {
          sound.playStomp();
          this.addPlumberFloatingText(player.x, player.y - 30, '+200', '#38bdf8');
          if (this.onHapticTrigger) this.onHapticTrigger(1, [75], player.lives, 100, player.score);
        },
        onHurt: () => {
          sound.playExplosion(false);
          if (this.onHapticTrigger) this.onHapticTrigger(1, [140, 80, 180], player.lives, 0, player.score);
        },
      }
    );

    // Fireballs physics and enemy collision
    for (let i = this.plumberFireballs.length - 1; i >= 0; i--) {
      const fb = this.plumberFireballs[i];
      fb.vy += 1800 * dt;
      fb.x += fb.vx * dt;
      fb.y += fb.vy * dt;

      // Bounce off ground and blocks
      for (const b of this.plumberStage.blocks) {
        if (fb.x > b.x && fb.x < b.x + b.w && fb.y + 10 >= b.y && fb.y + 10 <= b.y + 24) {
          fb.y = b.y - 10;
          fb.vy = -460;
          fb.bounces++;
          sound.playBlip(320, 0.04);
          break;
        }
      }

      // Check hit against enemies
      let hitEnemy = false;
      for (const enemy of this.plumberStage.enemies) {
        if (enemy.alive && !enemy.isSquashed) {
          if (fb.x > enemy.x && fb.x < enemy.x + enemy.w && fb.y > enemy.y && fb.y < enemy.y + enemy.h) {
            enemy.alive = false;
            hitEnemy = true;
            player.score += 300;
            sound.playStomp();
            this.addPlumberFloatingText(enemy.x, enemy.y - 20, '+300', '#f97316');
            break;
          }
        }
      }

      if (
        hitEnemy ||
        fb.bounces > 4 ||
        fb.y > 1100 ||
        fb.x < this.plumberCameraX - 50 ||
        fb.x > this.plumberCameraX + ARENA_WIDTH + 50
      ) {
        this.plumberFireballs.splice(i, 1);
      }
    }

    // Update floating particles
    for (let i = this.plumberParticles.length - 1; i >= 0; i--) {
      const p = this.plumberParticles[i];
      p.life += dt;
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      if (p.life >= p.maxLife) {
        this.plumberParticles.splice(i, 1);
      }
    }

    // Smooth horizontal camera scrolling following player
    const targetCam = Math.max(0, Math.min(this.plumberStage.flagpoleX - 700, player.x - 480));
    this.plumberCameraX += (targetCam - this.plumberCameraX) * Math.min(1, dt * 8);

    // Notify stats HUD
    if (this.onStatsChange) {
      this.onStatsChange({
        score: player.score,
        health: player.lives,
        shield: Math.max(0, Math.floor(this.plumberTime)),
        energy: player.coins,
        bombCharge: 100,
        wave: 1,
        status: this.status,
        combo: player.coins,
      });
    }
  }

  private renderPlumber() {
    const ctx = this.ctx;
    if (!this.plumberStage || !this.plumberStage.player) return;
    const player = this.plumberStage.player;
    const camX = this.plumberCameraX;

    // 1. Classic Vibrant Blue Super Mario Sky
    ctx.fillStyle = '#5c94fc';
    ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

    // 2. Parallax Distant Clouds
    ctx.fillStyle = '#ffffff';
    const cloudOffsets = [150, 600, 1100, 1600, 2100, 2700, 3400, 4200, 5000];
    for (const cx of cloudOffsets) {
      const screenCx = cx - camX * 0.25;
      if (screenCx > -200 && screenCx < ARENA_WIDTH + 200) {
        const cy = 180 + ((cx * 13) % 120);
        ctx.beginPath();
        ctx.arc(screenCx, cy, 35, 0, Math.PI * 2);
        ctx.arc(screenCx + 30, cy - 15, 45, 0, Math.PI * 2);
        ctx.arc(screenCx + 70, cy - 10, 40, 0, Math.PI * 2);
        ctx.arc(screenCx + 100, cy, 35, 0, Math.PI * 2);
        ctx.fill();
        // Soft cloud base
        ctx.fillStyle = '#d4e4fc';
        ctx.fillRect(screenCx - 10, cy + 15, 120, 18);
        ctx.fillStyle = '#ffffff';
      }
    }

    // 3. Parallax Rolling Green Hills
    const hillOffsets = [100, 800, 1500, 2300, 3200, 4100, 5000];
    for (const hx of hillOffsets) {
      const screenHx = hx - camX * 0.45;
      if (screenHx > -300 && screenHx < ARENA_WIDTH + 300) {
        ctx.fillStyle = '#00a800';
        ctx.beginPath();
        ctx.ellipse(screenHx, 880, 220, 160, 0, Math.PI, 0);
        ctx.fill();
        ctx.strokeStyle = '#005800';
        ctx.lineWidth = 4;
        ctx.stroke();
        // Shading dots on hills
        ctx.fillStyle = '#005800';
        ctx.beginPath();
        ctx.arc(screenHx - 40, 780, 14, 0, Math.PI * 2);
        ctx.arc(screenHx + 30, 810, 18, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 4. Parallax Green Bushes
    const bushOffsets = [300, 1000, 1800, 2700, 3600, 4500, 5400];
    for (const bx of bushOffsets) {
      const screenBx = bx - camX * 0.7;
      if (screenBx > -150 && screenBx < ARENA_WIDTH + 150) {
        ctx.fillStyle = '#48c018';
        ctx.beginPath();
        ctx.arc(screenBx, 875, 24, 0, Math.PI * 2);
        ctx.arc(screenBx + 28, 865, 30, 0, Math.PI * 2);
        ctx.arc(screenBx + 56, 875, 24, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#005800';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    // 5. World Geometry (Camera-translated)
    ctx.save();
    ctx.translate(-camX, 0);

    // Platform Blocks & Ground
    for (const b of this.plumberStage.blocks) {
      if (b.x + b.w < camX - 100 || b.x > camX + ARENA_WIDTH + 100) continue;

      const bounceY = b.bounceTimer ? -Math.sin((b.bounceTimer / 0.15) * Math.PI) * 16 : 0;
      const drawY = b.y + bounceY;

      if (b.type === 'ground') {
        // Brown stone/soil with green grass fringe
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        // Green grass top layer
        ctx.fillStyle = '#00a800';
        ctx.fillRect(b.x, drawY, b.w, 18);
        ctx.fillStyle = '#005800';
        ctx.fillRect(b.x, drawY + 18, b.w, 4);

        // Brick seam lines on ground
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
      } else if (b.type === 'pipe') {
        // Iconic Green Warp Pipe
        const lipHeight = 38;
        const lipOverhang = 8;
        // Pipe collar / lip
        const gradLip = ctx.createLinearGradient(b.x - lipOverhang, drawY, b.x + b.w + lipOverhang, drawY);
        gradLip.addColorStop(0, '#005800');
        gradLip.addColorStop(0.2, '#80d010');
        gradLip.addColorStop(0.5, '#00a800');
        gradLip.addColorStop(1, '#004800');
        ctx.fillStyle = gradLip;
        ctx.fillRect(b.x - lipOverhang, drawY, b.w + lipOverhang * 2, lipHeight);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x - lipOverhang, drawY, b.w + lipOverhang * 2, lipHeight);

        // Pipe stem / column
        const gradStem = ctx.createLinearGradient(b.x, drawY + lipHeight, b.x + b.w, drawY + lipHeight);
        gradStem.addColorStop(0, '#005800');
        gradStem.addColorStop(0.2, '#80d010');
        gradStem.addColorStop(0.5, '#00a800');
        gradStem.addColorStop(1, '#004800');
        ctx.fillStyle = gradStem;
        ctx.fillRect(b.x, drawY + lipHeight, b.w, b.h - lipHeight);
        ctx.strokeRect(b.x, drawY + lipHeight, b.w, b.h - lipHeight);
      } else if (b.type === 'question') {
        // Glowing Gold Question [?] Block
        ctx.fillStyle = '#fc9838';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, drawY, b.w, b.h);

        // Corner bolts
        ctx.fillStyle = '#000000';
        ctx.fillRect(b.x + 4, drawY + 4, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + 4, 4, 4);
        ctx.fillRect(b.x + 4, drawY + b.h - 8, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + b.h - 8, 4, 4);

        // Question mark "?"
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', b.x + b.w / 2, drawY + b.h / 2);
      } else if (b.type === 'empty_question') {
        // Deactivated dark brown block
        ctx.fillStyle = '#a85428';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        ctx.fillStyle = '#000000';
        ctx.fillRect(b.x + 4, drawY + 4, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + 4, 4, 4);
        ctx.fillRect(b.x + 4, drawY + b.h - 8, 4, 4);
        ctx.fillRect(b.x + b.w - 8, drawY + b.h - 8, 4, 4);
      } else if (b.type === 'brick') {
        // Terracotta Brick Block
        ctx.fillStyle = '#c84c0c';
        ctx.fillRect(b.x, drawY, b.w, b.h);
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(b.x, drawY, b.w, b.h);
        // Mortar lines
        ctx.beginPath();
        ctx.moveTo(b.x, drawY + b.h / 2);
        ctx.lineTo(b.x + b.w, drawY + b.h / 2);
        ctx.moveTo(b.x + b.w / 2, drawY);
        ctx.lineTo(b.x + b.w / 2, drawY + b.h / 2);
        ctx.stroke();
      }
    }

    // Flagpole at flagpoleX
    const fx = this.plumberStage.flagpoleX;
    // Pole
    ctx.fillStyle = '#00a800';
    ctx.fillRect(fx, 280, 12, 600);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.strokeRect(fx, 280, 12, 600);
    // Gold finial ball
    ctx.fillStyle = '#fcb800';
    ctx.beginPath();
    ctx.arc(fx + 6, 280, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Red triangular flag
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(fx, this.plumberFlagY);
    ctx.lineTo(fx - 60, this.plumberFlagY + 24);
    ctx.lineTo(fx, this.plumberFlagY + 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Peach's Castle at fx + 320
    const castleX = fx + 320;
    const castleY = 620;
    ctx.fillStyle = '#c84c0c'; // Brick fortress
    ctx.fillRect(castleX, castleY, 260, 260);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(castleX, castleY, 260, 260);
    // Battlements
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = '#c84c0c';
      ctx.fillRect(castleX + c * 65, castleY - 30, 45, 30);
      ctx.strokeRect(castleX + c * 65, castleY - 30, 45, 30);
    }
    // Arched black door
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(castleX + 130, castleY + 170, 40, Math.PI, 0);
    ctx.rect(castleX + 90, castleY + 170, 80, 90);
    ctx.fill();

    // Render Enemies
    for (const enemy of this.plumberStage.enemies) {
      if (!enemy.alive) continue;
      if (enemy.x + enemy.w < camX - 100 || enemy.x > camX + ARENA_WIDTH + 100) continue;

      if (enemy.isSquashed) {
        // Squashed Goomba flat pancake
        ctx.fillStyle = '#9c4000';
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h - 8, enemy.w / 2, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (enemy.type === 'goomba') {
        // Animated Goomba (Brown mushroom creature)
        const walkWaddle = Math.sin(Date.now() / 100) * 3;
        // Cap
        ctx.fillStyle = '#9c4000';
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + 16, enemy.w / 2, 16, 0, Math.PI, 0);
        ctx.lineTo(enemy.x + enemy.w, enemy.y + 24);
        ctx.lineTo(enemy.x, enemy.y + 24);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Stem / Face
        ctx.fillStyle = '#fce0a8';
        ctx.fillRect(enemy.x + 8, enemy.y + 22, enemy.w - 16, 12);
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(enemy.x + 12, enemy.y + 20, 6, 8);
        ctx.fillRect(enemy.x + enemy.w - 18, enemy.y + 20, 6, 8);
        ctx.fillStyle = '#000000';
        ctx.fillRect(enemy.x + 14, enemy.y + 22, 3, 5);
        ctx.fillRect(enemy.x + enemy.w - 16, enemy.y + 22, 3, 5);

        // Shoes with waddle
        ctx.fillStyle = '#000000';
        ctx.fillRect(enemy.x + 4 + walkWaddle, enemy.y + 34, 14, 8);
        ctx.fillRect(enemy.x + enemy.w - 18 - walkWaddle, enemy.y + 34, 14, 8);
      } else if (enemy.type === 'koopa') {
        // Green Turtle (Koopa)
        ctx.fillStyle = '#22c55e';
        ctx.beginPath();
        ctx.ellipse(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, enemy.w / 2 - 2, enemy.h / 2 - 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Shell rim
        ctx.fillStyle = '#facc15';
        ctx.fillRect(enemy.x + 4, enemy.y + enemy.h - 14, enemy.w - 8, 8);
      }
    }

    // Render Fireballs
    for (const fb of this.plumberFireballs) {
      const grad = ctx.createRadialGradient(fb.x, fb.y, 2, fb.x, fb.y, 12);
      grad.addColorStop(0, '#fef08a');
      grad.addColorStop(0.5, '#f97316');
      grad.addColorStop(1, '#dc2626');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fb.x, fb.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Render Plumber (Mario)
    if (!player.isDead || Math.floor(Date.now() / 80) % 2 === 0) {
      if (!(player.invincibleTimer > 0 && Math.floor(Date.now() / 80) % 2 === 0)) {
        ctx.save();
        ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
        ctx.scale(player.facing, 1);

        const pw = player.w;
        const ph = player.h;
        const hx = -pw / 2;
        const hy = -ph / 2;

        // 1. Red Cap
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(hx + 4, hy, pw - 8, 14);
        ctx.fillRect(hx + 8, hy + 6, pw - 2, 8); // Visor overhang

        // 2. Face and Nose
        ctx.fillStyle = '#fde047'; // Peach skin tone
        ctx.fillRect(hx + 6, hy + 14, pw - 12, 14);
        ctx.fillRect(hx + pw - 8, hy + 16, 6, 8); // Nose
        // Eye
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(hx + pw - 14, hy + 15, 3, 5);

        // 3. Brown Sideburns and Mustache
        ctx.fillStyle = '#78350f';
        ctx.fillRect(hx + 4, hy + 14, 6, 8);
        ctx.fillStyle = '#000000'; // Bold Mustache
        ctx.fillRect(hx + 10, hy + 22, pw - 10, 6);

        // 4. Red Shirt
        ctx.fillStyle = '#dc2626';
        ctx.fillRect(hx + 6, hy + 28, pw - 12, 12);

        // 5. Blue Overalls
        ctx.fillStyle = '#1d4ed8';
        ctx.fillRect(hx + 8, hy + 32, pw - 16, 16);
        // Yellow Suspender Buttons
        ctx.fillStyle = '#facc15';
        ctx.fillRect(hx + 10, hy + 34, 3, 3);
        ctx.fillRect(hx + pw - 14, hy + 34, 3, 3);

        // 6. White Gloves / Arms
        ctx.fillStyle = '#ffffff';
        if (!player.onGround) {
          // Jump pose: Right fist triumphantly thrust upwards!
          ctx.fillRect(hx + pw - 8, hy - 4, 10, 10);
          ctx.fillRect(hx, hy + 24, 8, 8);
        } else {
          ctx.fillRect(hx + 2, hy + 30, 8, 8);
          ctx.fillRect(hx + pw - 10, hy + 30, 8, 8);
        }

        // 7. Brown Boots with Leg Stride
        ctx.fillStyle = '#78350f';
        if (!player.onGround) {
          // Jump pose legs tucked
          ctx.fillRect(hx + 4, hy + ph - 8, 12, 8);
          ctx.fillRect(hx + pw - 16, hy + ph - 8, 12, 8);
        } else if (Math.abs(player.vx) > 10) {
          const runStep = Math.sin(Date.now() / 80) * 6;
          ctx.fillRect(hx + 4 + runStep, hy + ph - 8, 12, 8);
          ctx.fillRect(hx + pw - 16 - runStep, hy + ph - 8, 12, 8);
        } else {
          // Idle standing boots
          ctx.fillRect(hx + 4, hy + ph - 8, 13, 8);
          ctx.fillRect(hx + pw - 17, hy + ph - 8, 13, 8);
        }

        ctx.restore();
      }
    }

    // Render Floating Particles (+200, +5000, etc.)
    for (const p of this.plumberParticles) {
      if (p.text) {
        ctx.save();
        ctx.font = 'bold 22px monospace';
        ctx.fillStyle = p.color;
        ctx.shadowColor = '#000000';
        ctx.shadowBlur = 6;
        ctx.fillText(p.text, p.x, p.y);
        ctx.restore();
      }
    }

    ctx.restore(); // Restore camera translation

    // 6. Classic Super Plumber / NES Arcade HUD
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, ARENA_WIDTH, 70);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    // MARIO & Score
    ctx.fillText('MARIO', 220, 28);
    ctx.fillStyle = '#fde047';
    ctx.fillText(player.score.toString().padStart(6, '0'), 220, 54);

    // COINS & Count
    ctx.fillStyle = '#ffffff';
    ctx.fillText('COINS', 640, 28);
    ctx.fillStyle = '#facc15';
    ctx.fillText(`★ x ${player.coins.toString().padStart(2, '0')}`, 640, 54);

    // WORLD
    ctx.fillStyle = '#ffffff';
    ctx.fillText('WORLD', 1280, 28);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('1-1', 1280, 54);

    // TIME
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TIME', 1700, 28);
    ctx.fillStyle = this.plumberTime < 50 ? '#ef4444' : '#fde047';
    ctx.fillText(Math.floor(this.plumberTime).toString().padStart(3, '0'), 1700, 54);

    ctx.restore();
  }

  public render() {
    if (this.activeGame === 'void_horizon') {
      this.voidEngine.render();
    } else if (this.activeGame === 'cyber_snake') {
      this.renderSnake();
    } else if (this.activeGame === 'galactic_invaders') {
      this.renderInvaders();
    } else if (this.activeGame === 'neon_pong') {
      this.renderPong();
    } else if (this.activeGame === 'turbo_racer') {
      this.renderRacer();
    } else if (this.activeGame === 'vector_asteroids') {
      this.renderVectorAsteroids();
    } else if (this.activeGame === 'super_plumber') {
      this.renderPlumber();
    }
  }
}
