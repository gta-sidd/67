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
} from './retroRules.ts';
import type { GameInput, GameStatus } from './types.ts';
import type { RetroGameId } from './retroGames.ts';
import { sound } from './audio.ts';

export const ARENA_WIDTH = 1920;
export const ARENA_HEIGHT = 1080;

export class RetroArcadeEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public activeGame: RetroGameId = 'void_horizon';
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
    }
    this.render();
  }

  public setInput(input: GameInput) {
    this.currentInput = { ...input };
    if (this.activeGame === 'void_horizon') {
      this.voidEngine.setInput(1, input);
    } else if (this.activeGame === 'cyber_snake') {
      applySnakeInput(this.snakeState, input);
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
    }
  }
}
