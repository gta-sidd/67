import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  createInitialPlayer,
  updatePlayerMovement,
  checkCircleCollision,
  calculateScoreReward,
  applyDamageToPlayer,
  shouldFireBullet,
} from './physics.ts';
import type {
  PlayerState,
  GameInput,
  Enemy,
  Bullet,
  Particle,
  FloatingText,
  GameStatus,
  WaveConfig,
} from './types.ts';
import { sound } from './audio.ts';

const MAX_PARTICLES = 400;

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;
  public status: GameStatus = 'title';

  // State
  public players: Map<number, PlayerState> = new Map();
  public inputs: Map<number, GameInput> = new Map();
  public enemies: Enemy[] = [];
  public bullets: Bullet[] = [];
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  // Wave progression
  public wave: number = 1;
  public waveTimer: number = 0;
  public waveTotalEnemies: number = 0;
  public waveDefeatedEnemies: number = 0;
  public bossActive: boolean = false;

  // Effects & Juice
  public trauma: number = 0;
  public hitstopTimer: number = 0;
  public timeScale: number = 1.0;
  public flashScreenTimer: number = 0;

  // Starfield parallax
  private stars: Array<{ x: number; y: number; speed: number; size: number; alpha: number }> = [];

  private lastTime: number = 0;
  private animId: number = 0;
  private nextId: number = 1;

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
    this.initParticles();
    this.initStars();
    this.players.set(1, createInitialPlayer(1));
    this.inputs.set(1, {
      stickX: 0,
      stickY: 0,
      fire: false,
      boost: false,
      shield: false,
      bomb: false,
    });
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: '#ffffff',
        size: 2,
        life: 0,
        maxLife: 1,
      });
    }
  }

  private initStars() {
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      this.stars.push({
        x: Math.random() * ARENA_WIDTH,
        y: Math.random() * ARENA_HEIGHT,
        speed: 40 + Math.random() * 220,
        size: 1 + Math.random() * 2.5,
        alpha: 0.3 + Math.random() * 0.7,
      });
    }
  }

  public spawnParticle(x: number, y: number, vx: number, vy: number, color: string, size: number, maxLife: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.particles[i].active) {
        const p = this.particles[i];
        p.active = true;
        p.x = x;
        p.y = y;
        p.vx = vx;
        p.vy = vy;
        p.color = color;
        p.size = size;
        p.life = 0;
        p.maxLife = maxLife;
        return;
      }
    }
  }

  public spawnExplosion(x: number, y: number, color: string, count = 20, isHeavy = false) {
    sound.playExplosion(isHeavy);
    this.trauma = Math.min(1.0, this.trauma + (isHeavy ? 0.6 : 0.25));

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * (isHeavy ? 450 : 250);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const size = 2 + Math.random() * (isHeavy ? 6 : 3.5);
      const life = 0.3 + Math.random() * (isHeavy ? 0.6 : 0.4);
      this.spawnParticle(x, y, vx, vy, color, size, life);
    }
  }

  public addFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({
      id: this.nextId++,
      x,
      y,
      text,
      color,
      life: 0,
      maxLife: 0.8,
      vy: -60,
    });
  }

  public setInput(playerId: number, input: GameInput) {
    this.inputs.set(playerId, { ...input });

    // Handle EMP Bomb trigger immediately
    if (input.bomb) {
      const player = this.players.get(playerId);
      if (player && player.bombCharge >= 100) {
        this.triggerBomb(player);
      }
    }
  }

  public triggerBomb(player: PlayerState) {
    player.bombCharge = 0;
    this.flashScreenTimer = 0.2;
    this.trauma = 0.9;
    sound.playBombNova();

    // Clear all enemy bullets and damage all enemies
    this.bullets = this.bullets.filter(b => b.isPlayer);

    for (const enemy of this.enemies) {
      enemy.hp -= 200;
      enemy.flashTimer = 0.2;
      this.spawnExplosion(enemy.x, enemy.y, '#c084fc', 12);
    }

    this.addFloatingText(player.x, player.y - 40, 'EMP DETONATION!', '#e879f9');

    if (this.onHapticTrigger) {
      this.onHapticTrigger(player.id, [150, 50, 200], player.health, player.shield, player.score);
    }
  }

  public startWave(waveNum: number) {
    this.wave = waveNum;
    this.enemies = [];
    this.bullets = [];
    this.bossActive = waveNum % 3 === 0;

    const config: WaveConfig = {
      waveNumber: waveNum,
      droneCount: 6 + waveNum * 4,
      cruiserCount: Math.floor(waveNum * 1.5),
      interceptorCount: Math.floor(waveNum * 2),
      asteroidCount: 4 + Math.min(8, waveNum * 2),
      hasBoss: this.bossActive,
    };

    this.waveTotalEnemies = config.droneCount + config.cruiserCount + config.interceptorCount + (config.hasBoss ? 1 : 0);
    this.waveDefeatedEnemies = 0;

    // Spawn Asteroids
    for (let i = 0; i < config.asteroidCount; i++) {
      this.spawnAsteroid();
    }

    // Spawn opening batch of enemies
    this.scheduleSpawns(config);
  }

  private scheduleSpawns(config: WaveConfig) {
    if (config.hasBoss) {
      this.spawnBoss();
      return;
    }

    // Drones
    for (let i = 0; i < config.droneCount; i++) {
      setTimeout(() => {
        if (this.status === 'playing') this.spawnDrone();
      }, i * 700 + Math.random() * 400);
    }

    // Cruisers
    for (let i = 0; i < config.cruiserCount; i++) {
      setTimeout(() => {
        if (this.status === 'playing') this.spawnCruiser();
      }, (i + 1) * 2200);
    }

    // Interceptors
    for (let i = 0; i < config.interceptorCount; i++) {
      setTimeout(() => {
        if (this.status === 'playing') this.spawnInterceptor();
      }, (i + 1) * 1600 + 800);
    }
  }

  private spawnDrone() {
    this.enemies.push({
      id: this.nextId++,
      type: 'drone',
      x: 100 + Math.random() * (ARENA_WIDTH - 200),
      y: -40,
      vx: (Math.random() - 0.5) * 80,
      vy: 140 + Math.random() * 80,
      hp: 25,
      maxHp: 25,
      radius: 22,
      angle: Math.PI / 2,
      attackCooldown: 2 + Math.random() * 2,
      color: '#ef4444',
      points: 100,
      flashTimer: 0,
      telegraphTimer: 0,
    });
  }

  private spawnCruiser() {
    this.enemies.push({
      id: this.nextId++,
      type: 'cruiser',
      x: 200 + Math.random() * (ARENA_WIDTH - 400),
      y: -60,
      vx: (Math.random() - 0.5) * 40,
      vy: 60 + Math.random() * 40,
      hp: 120,
      maxHp: 120,
      radius: 44,
      angle: Math.PI / 2,
      attackCooldown: 1.5,
      color: '#a855f7',
      points: 350,
      flashTimer: 0,
      telegraphTimer: 0,
    });
  }

  private spawnInterceptor() {
    const fromLeft = Math.random() > 0.5;
    this.enemies.push({
      id: this.nextId++,
      type: 'interceptor',
      x: fromLeft ? -40 : ARENA_WIDTH + 40,
      y: 120 + Math.random() * 300,
      vx: fromLeft ? 260 : -260,
      vy: 40 + Math.random() * 60,
      hp: 45,
      maxHp: 45,
      radius: 26,
      angle: fromLeft ? 0 : Math.PI,
      attackCooldown: 1.2,
      color: '#f59e0b',
      points: 200,
      flashTimer: 0,
      telegraphTimer: 0,
    });
  }

  private spawnAsteroid(x?: number, y?: number, splitLevel = 2) {
    const radius = splitLevel === 2 ? 55 : splitLevel === 1 ? 32 : 18;
    this.enemies.push({
      id: this.nextId++,
      type: 'asteroid',
      x: x !== undefined ? x : Math.random() * ARENA_WIDTH,
      y: y !== undefined ? y : -50 - Math.random() * 100,
      vx: (Math.random() - 0.5) * 70,
      vy: 40 + Math.random() * 60,
      hp: radius * 2,
      maxHp: radius * 2,
      radius,
      angle: Math.random() * Math.PI * 2,
      attackCooldown: 999,
      color: '#71717a',
      points: splitLevel * 50,
      flashTimer: 0,
      telegraphTimer: 0,
      splitLevel,
    });
  }

  private spawnBoss() {
    this.enemies.push({
      id: this.nextId++,
      type: 'boss',
      x: ARENA_WIDTH / 2,
      y: -120,
      vx: 60,
      vy: 35,
      hp: 1400,
      maxHp: 1400,
      radius: 110,
      angle: Math.PI / 2,
      attackCooldown: 2.0,
      color: '#dc2626',
      points: 5000,
      flashTimer: 0,
      telegraphTimer: 0,
    });
  }

  public startGame() {
    this.status = 'playing';
    document.body.dataset.state = 'playing';
    this.players.set(1, createInitialPlayer(1));
    this.startWave(1);
    this.lastTime = performance.now();
    this.runLoop();
  }

  public pauseGame() {
    if (this.status === 'playing') {
      this.status = 'paused';
      document.body.dataset.state = 'paused';
    } else if (this.status === 'paused') {
      this.status = 'playing';
      document.body.dataset.state = 'playing';
      this.lastTime = performance.now();
      this.runLoop();
    }
  }

  public restartGame() {
    this.startGame();
  }

  public runLoop = () => {
    if (this.status !== 'playing') return;

    const now = performance.now();
    const rawDt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Clamped dt per Ultra mode guidelines
    const dt = Math.min(rawDt, 0.05);

    this.update(dt, now);
    this.render();

    this.animId = requestAnimationFrame(this.runLoop);
  };

  public stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
    }
  }

  private update(dt: number, now: number) {
    // Sim Hitstop handling
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    // Screenshake decay
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - 1.2 * dt);
    }
    if (this.flashScreenTimer > 0) {
      this.flashScreenTimer = Math.max(0, this.flashScreenTimer - dt);
    }

    // Update Starfield
    for (const star of this.stars) {
      star.y += star.speed * dt;
      if (star.y > ARENA_HEIGHT) {
        star.y = 0;
        star.x = Math.random() * ARENA_WIDTH;
      }
    }

    // Update Players
    for (const [id, player] of this.players.entries()) {
      if (player.health <= 0) continue;

      const input = this.inputs.get(id) || {
        stickX: 0,
        stickY: 0,
        fire: false,
        boost: false,
        shield: false,
        bomb: false,
      };

      updatePlayerMovement(player, input, dt);

      // Boost particles
      if (input.boost && player.isBoosting) {
        const backAngle = player.angle + Math.PI;
        for (let i = 0; i < 3; i++) {
          const spread = (Math.random() - 0.5) * 0.4;
          const pAngle = backAngle + spread;
          const pSpeed = 300 + Math.random() * 200;
          this.spawnParticle(
            player.x - Math.cos(player.angle) * 20,
            player.y - Math.sin(player.angle) * 20,
            Math.cos(pAngle) * pSpeed,
            Math.sin(pAngle) * pSpeed,
            '#38bdf8',
            3.5,
            0.25
          );
        }
      }

      // Check bullet firing
      if (shouldFireBullet(player, input, now)) {
        sound.playLaser();
        const angle = player.angle;
        const forwardX = Math.cos(angle);
        const forwardY = Math.sin(angle);
        const perpX = -forwardY;
        const perpY = forwardX;
        const bulletSpeed = 1200;

        // Dual blasters from wings
        [-14, 14].forEach(wingOffset => {
          this.bullets.push({
            id: this.nextId++,
            x: player.x + forwardX * 24 + perpX * wingOffset,
            y: player.y + forwardY * 24 + perpY * wingOffset,
            vx: forwardX * bulletSpeed,
            vy: forwardY * bulletSpeed,
            radius: 5,
            isPlayer: true,
            damage: 25,
            color: player.color,
            life: 0,
            maxLife: 1.5,
          });
        });
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.flashTimer > 0) enemy.flashTimer = Math.max(0, enemy.flashTimer - dt);

      // Behavior policies
      if (enemy.type === 'drone') {
        // Swarm towards nearest player
        let nearest: PlayerState | null = null;
        let minDist = Infinity;
        for (const p of this.players.values()) {
          if (p.health > 0) {
            const d = Math.hypot(p.x - enemy.x, p.y - enemy.y);
            if (d < minDist) {
              minDist = d;
              nearest = p;
            }
          }
        }
        if (nearest) {
          const targetAngle = Math.atan2(nearest.y - enemy.y, nearest.x - enemy.x);
          enemy.vx += Math.cos(targetAngle) * 380 * dt;
          enemy.vy += Math.sin(targetAngle) * 380 * dt;
          enemy.vx = Math.max(-240, Math.min(240, enemy.vx));
          enemy.vy = Math.max(60, Math.min(320, enemy.vy));
          enemy.angle = Math.atan2(enemy.vy, enemy.vx);
        }
      } else if (enemy.type === 'cruiser') {
        // Slow advance, strafe left/right, shoot dual plasma cannons
        if (enemy.y > 180 && enemy.vy > 10) enemy.vy = 20;
        if (enemy.x < 150 || enemy.x > ARENA_WIDTH - 150) enemy.vx *= -1;

        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0.4 && enemy.attackCooldown > 0) {
          enemy.telegraphTimer = 0.4; // Telegraph visual charge
        }
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 2.2;
          enemy.telegraphTimer = 0;
          // Fire 2 heavy plasma bolts
          [-25, 25].forEach(ox => {
            this.bullets.push({
              id: this.nextId++,
              x: enemy.x + ox,
              y: enemy.y + 40,
              vx: 0,
              vy: 360,
              radius: 9,
              isPlayer: false,
              damage: 1,
              color: '#d946ef',
              life: 0,
              maxLife: 3,
            });
          });
        }
      } else if (enemy.type === 'interceptor') {
        // High speed crossing attack
        if (enemy.x < -100 || enemy.x > ARENA_WIDTH + 100) {
          enemy.vx *= -1;
          enemy.y += 100;
        }
        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 1.4;
          this.bullets.push({
            id: this.nextId++,
            x: enemy.x,
            y: enemy.y,
            vx: (Math.random() - 0.5) * 80,
            vy: 420,
            radius: 6,
            isPlayer: false,
            damage: 1,
            color: '#fbbf24',
            life: 0,
            maxLife: 2.5,
          });
        }
      } else if (enemy.type === 'boss') {
        // Mothership boss behavior
        if (enemy.y < 220) {
          enemy.vy = 40;
        } else {
          enemy.vy = 0;
        }
        if (enemy.x < 300 || enemy.x > ARENA_WIDTH - 300) {
          enemy.vx *= -1;
        }

        enemy.attackCooldown -= dt;
        if (enemy.attackCooldown <= 0.6 && enemy.attackCooldown > 0) {
          enemy.telegraphTimer = 0.6;
        }
        if (enemy.attackCooldown <= 0) {
          enemy.attackCooldown = 2.5;
          enemy.telegraphTimer = 0;
          // Spread shot of 5 energy spheres
          for (let a = -0.6; a <= 0.6; a += 0.3) {
            this.bullets.push({
              id: this.nextId++,
              x: enemy.x,
              y: enemy.y + 80,
              vx: Math.sin(a) * 340,
              vy: Math.cos(a) * 340,
              radius: 11,
              isPlayer: false,
              damage: 1,
              color: '#ef4444',
              life: 0,
              maxLife: 3.5,
            });
          }
        }
      }

      enemy.x += enemy.vx * dt;
      enemy.y += enemy.vy * dt;

      // Clean off-screen non-boss enemies
      if (enemy.y > ARENA_HEIGHT + 100 && enemy.type !== 'boss') {
        this.enemies.splice(i, 1);
        continue;
      }

      // Check collision with players
      for (const player of this.players.values()) {
        if (player.health <= 0) continue;
        if (checkCircleCollision(player.x, player.y, 20, enemy.x, enemy.y, enemy.radius)) {
          const hurt = applyDamageToPlayer(player, 1);
          if (hurt) {
            this.spawnExplosion(player.x, player.y, '#f43f5e', 25, true);
            if (this.onHapticTrigger) {
              this.onHapticTrigger(player.id, [100, 40, 100], player.health, player.shield, player.score);
            }
          } else {
            sound.playShieldHit();
            this.spawnExplosion(player.x, player.y, '#38bdf8', 10);
          }

          // Damage enemy too
          enemy.hp -= 40;
          if (enemy.hp <= 0) {
            this.handleEnemyDefeat(enemy, player);
          }
        }
      }
    }

    // Update Bullets
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life += dt;

      // Remove expired or out of bounds
      if (
        b.life >= b.maxLife ||
        b.x < -40 ||
        b.x > ARENA_WIDTH + 40 ||
        b.y < -40 ||
        b.y > ARENA_HEIGHT + 40
      ) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Collision checks
      if (b.isPlayer) {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (checkCircleCollision(b.x, b.y, b.radius, enemy.x, enemy.y, enemy.radius)) {
            enemy.hp -= b.damage;
            enemy.flashTimer = 0.08;
            this.bullets.splice(i, 1);

            // Small spark on hit
            this.spawnParticle(b.x, b.y, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80, '#fef08a', 2.5, 0.15);

            if (enemy.hp <= 0) {
              const killer = this.players.get(1); // default player
              if (killer) {
                this.handleEnemyDefeat(enemy, killer);
              }
            }
            break;
          }
        }
      } else {
        // Enemy bullet hitting player
        for (const player of this.players.values()) {
          if (player.health <= 0) continue;
          if (checkCircleCollision(b.x, b.y, b.radius, player.x, player.y, 20)) {
            this.bullets.splice(i, 1);
            const hurt = applyDamageToPlayer(player, b.damage);
            if (hurt) {
              this.spawnExplosion(player.x, player.y, '#ef4444', 18);
              if (this.onHapticTrigger) {
                this.onHapticTrigger(player.id, [80, 40, 80], player.health, player.shield, player.score);
              }
            } else {
              sound.playShieldHit();
              this.spawnExplosion(player.x, player.y, '#38bdf8', 8);
            }
            break;
          }
        }
      }
    }

    // Check Victory / Next Wave
    if (this.enemies.length === 0 && this.status === 'playing') {
      this.waveTimer += dt;
      if (this.waveTimer > 2.0) {
        this.waveTimer = 0;
        this.startWave(this.wave + 1);
        this.addFloatingText(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, `WAVE ${this.wave} INCOMING!`, '#38bdf8');
      }
    }

    // Check Player Defeat
    const p1 = this.players.get(1);
    if (p1 && p1.health <= 0 && this.status === 'playing') {
      this.status = 'gameover';
      document.body.dataset.state = 'gameover';
    }

    // Update Particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (p.active) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
        }
      }
    }

    // Update Floating Texts
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.life += dt;
      if (ft.life >= ft.maxLife) {
        this.floatingTexts.splice(i, 1);
      }
    }

    // Notify React HUD
    if (this.onStatsChange && p1) {
      this.onStatsChange({
        score: p1.score,
        health: p1.health,
        shield: p1.shield,
        energy: p1.energy,
        bombCharge: p1.bombCharge,
        wave: this.wave,
        status: this.status,
        combo: p1.combo,
      });
    }
  }

  private handleEnemyDefeat(enemy: Enemy, player: PlayerState) {
    const isHeavy = enemy.type === 'cruiser' || enemy.type === 'boss';
    this.spawnExplosion(enemy.x, enemy.y, enemy.color, isHeavy ? 45 : 20, isHeavy);

    // Hitstop freeze for tactile impact
    this.hitstopTimer = isHeavy ? 0.08 : 0.04;

    // Score & Combo
    player.combo = Math.min(10, player.combo + 1);
    player.comboTimer = 3.5;
    const reward = calculateScoreReward(enemy.points, player.combo);
    player.score += reward;
    player.bombCharge = Math.min(100, player.bombCharge + 10);

    this.addFloatingText(
      enemy.x,
      enemy.y,
      `+${reward}${player.combo > 1 ? ` (x${player.combo})` : ''}`,
      '#facc15'
    );

    // Asteroid splits
    if (enemy.type === 'asteroid' && (enemy.splitLevel || 0) > 0) {
      const nextLevel = (enemy.splitLevel || 0) - 1;
      this.spawnAsteroid(enemy.x - 20, enemy.y, nextLevel);
      this.spawnAsteroid(enemy.x + 20, enemy.y, nextLevel);
    }

    // Remove from array
    const idx = this.enemies.indexOf(enemy);
    if (idx !== -1) {
      this.enemies.splice(idx, 1);
    }
  }

  public render() {
    const ctx = this.ctx;
    const w = ARENA_WIDTH;
    const h = ARENA_HEIGHT;

    ctx.save();

    // Screenshake offset
    if (this.trauma > 0) {
      const shakeMagnitude = this.trauma * this.trauma * 24;
      const shakeX = (Math.random() * 2 - 1) * shakeMagnitude;
      const shakeY = (Math.random() * 2 - 1) * shakeMagnitude;
      ctx.translate(shakeX, shakeY);
    }

    // Deep space background
    ctx.fillStyle = '#060814';
    ctx.fillRect(0, 0, w, h);

    // Starfield
    for (const star of this.stars) {
      ctx.fillStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    }

    // Grid lines for neon arcade depth
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 120) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 120) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Render Enemies
    for (const enemy of this.enemies) {
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      ctx.rotate(enemy.angle);

      // Hit flash white fill
      const isFlashing = enemy.flashTimer > 0;
      ctx.fillStyle = isFlashing ? '#ffffff' : enemy.color;
      ctx.strokeStyle = isFlashing ? '#ffffff' : '#ffffff';
      ctx.lineWidth = 2;

      // Telegraph attack aura
      if (enemy.telegraphTimer > 0) {
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius + 15, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }

      if (enemy.type === 'drone') {
        // Dart triangle
        ctx.beginPath();
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(-enemy.radius, -enemy.radius * 0.7);
        ctx.lineTo(-enemy.radius * 0.4, 0);
        ctx.lineTo(-enemy.radius, enemy.radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (enemy.type === 'cruiser') {
        // Diamond heavy battle-cruiser
        ctx.beginPath();
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(0, -enemy.radius * 0.7);
        ctx.lineTo(-enemy.radius, -enemy.radius * 0.4);
        ctx.lineTo(-enemy.radius * 0.6, 0);
        ctx.lineTo(-enemy.radius, enemy.radius * 0.4);
        ctx.lineTo(0, enemy.radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (enemy.type === 'interceptor') {
        // Sleek delta wing
        ctx.beginPath();
        ctx.moveTo(enemy.radius, 0);
        ctx.lineTo(-enemy.radius, -enemy.radius);
        ctx.lineTo(-enemy.radius * 0.3, 0);
        ctx.lineTo(-enemy.radius, enemy.radius);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (enemy.type === 'asteroid') {
        // Jagged rock
        ctx.beginPath();
        const pts = 8;
        for (let p = 0; p < pts; p++) {
          const a = (p / pts) * Math.PI * 2;
          const r = enemy.radius * (0.8 + ((p % 3) * 0.15));
          const px = Math.cos(a) * r;
          const py = Math.sin(a) * r;
          if (p === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (enemy.type === 'boss') {
        // Massive Mothership Dreadnought
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing energy core
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(0, 0, enemy.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();

      // Enemy health bar if damaged
      if (enemy.hp < enemy.maxHp && enemy.type !== 'asteroid') {
        const barW = enemy.radius * 1.8;
        const barH = 5;
        const hpPct = Math.max(0, enemy.hp / enemy.maxHp);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 14, barW, barH);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(enemy.x - barW / 2, enemy.y - enemy.radius - 14, barW * hpPct, barH);
      }
    }

    // Render Bullets
    for (const b of this.bullets) {
      ctx.save();
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Render Players
    for (const player of this.players.values()) {
      if (player.health <= 0) continue;

      // Invulnerability flicker
      if (player.invulnerableTime > 0 && Math.floor(player.invulnerableTime * 20) % 2 === 0) {
        continue;
      }

      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle);

      // Thruster flame
      ctx.fillStyle = player.isBoosting ? '#38bdf8' : '#f97316';
      ctx.beginPath();
      ctx.moveTo(-16, -6);
      ctx.lineTo(-28 - (player.isBoosting ? 20 : 10) * Math.random(), 0);
      ctx.lineTo(-16, 6);
      ctx.closePath();
      ctx.fill();

      // Player Ship Fighter Body
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = player.color;
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(26, 0); // Nose tip
      ctx.lineTo(-18, -20); // Left wingtip
      ctx.lineTo(-10, -6);
      ctx.lineTo(-18, 0);
      ctx.lineTo(-10, 6);
      ctx.lineTo(-18, 20); // Right wingtip
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canopy cockpit
      ctx.fillStyle = player.color;
      ctx.beginPath();
      ctx.arc(4, 0, 5, 0, Math.PI * 2);
      ctx.fill();

      // Active Shield Aura
      if (player.isShieldActive) {
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 14;
        ctx.beginPath();
        ctx.arc(0, 0, 32, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    }

    // Render Particles
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (p.active) {
        const alpha = Math.max(0, 1 - p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1.0;

    // Render Floating Text
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    for (const ft of this.floatingTexts) {
      const alpha = Math.max(0, 1 - ft.life / ft.maxLife);
      ctx.fillStyle = ft.color;
      ctx.globalAlpha = alpha;
      ctx.fillText(ft.text, ft.x, ft.y);
    }
    ctx.globalAlpha = 1.0;

    // Fullscreen Screen Flash on EMP Bomb
    if (this.flashScreenTimer > 0) {
      ctx.fillStyle = `rgba(232, 121, 249, ${this.flashScreenTimer * 3})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();
  }
}
