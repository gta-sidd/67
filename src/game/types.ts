export interface GameInput {
  stickX: number; // -1 to 1
  stickY: number; // -1 to 1
  fire: boolean;
  boost: boolean;
  shield: boolean;
  bomb: boolean;
  tiltX?: number; // Gyro tilt
  tiltY?: number;
}

export interface PlayerState {
  id: number;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  health: number; // Max 5 pips
  maxHealth: number;
  shield: number; // 0 to 100
  energy: number; // 0 to 100
  bombCharge: number; // 0 to 100
  score: number;
  combo: number;
  comboTimer: number;
  isBoosting: boolean;
  isShieldActive: boolean;
  invulnerableTime: number;
  lastFireTime: number;
}

export type EnemyType = 'drone' | 'cruiser' | 'interceptor' | 'asteroid' | 'boss';

export interface Enemy {
  id: number;
  type: EnemyType;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  radius: number;
  angle: number;
  attackCooldown: number;
  color: string;
  points: number;
  flashTimer: number; // Hit flash
  telegraphTimer: number; // Visual attack windup
  splitLevel?: number; // for asteroids
}

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  isPlayer: boolean;
  damage: number;
  color: string;
  life: number;
  maxLife: number;
}

export interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
}

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  maxLife: number;
  vy: number;
}

export type GameStatus = 'title' | 'playing' | 'paused' | 'gameover' | 'victory';

export interface WaveConfig {
  waveNumber: number;
  droneCount: number;
  cruiserCount: number;
  interceptorCount: number;
  asteroidCount: number;
  hasBoss: boolean;
}
