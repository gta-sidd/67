import type { GameInput, PlayerState, Enemy, Bullet } from './types.ts';

export const ARENA_WIDTH = 1920;
export const ARENA_HEIGHT = 1080;

export function createInitialPlayer(id: number = 1): PlayerState {
  return {
    id,
    name: `Pilot ${id}`,
    color: id === 1 ? '#00f0ff' : '#ff0077',
    x: ARENA_WIDTH / 2,
    y: ARENA_HEIGHT * 0.75,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2, // Facing up
    health: 5,
    maxHealth: 5,
    shield: 100,
    energy: 100,
    bombCharge: 100,
    score: 0,
    combo: 1,
    comboTimer: 0,
    isBoosting: false,
    isShieldActive: false,
    invulnerableTime: 0,
    lastFireTime: 0,
  };
}

export function updatePlayerMovement(
  player: PlayerState,
  input: GameInput,
  dt: number
): void {
  const baseSpeed = 480;
  const boostMultiplier = 1.85;
  const friction = 0.88;

  let moveX = input.stickX;
  let moveY = input.stickY;

  // Add gyro tilt steering if provided
  if (input.tiltX !== undefined && input.tiltY !== undefined) {
    moveX = Math.max(-1, Math.min(1, moveX + input.tiltX));
    moveY = Math.max(-1, Math.min(1, moveY + input.tiltY));
  }

  // Deadzone
  if (Math.hypot(moveX, moveY) < 0.12) {
    moveX = 0;
    moveY = 0;
  }

  // Boosting consumes energy
  const isBoosting = input.boost && player.energy > 5;
  player.isBoosting = isBoosting;

  if (isBoosting) {
    player.energy = Math.max(0, player.energy - 35 * dt);
  } else {
    player.energy = Math.min(100, player.energy + 20 * dt);
  }

  // Shield consumes energy
  const isShield = input.shield && player.energy > 10;
  player.isShieldActive = isShield;
  if (isShield) {
    player.energy = Math.max(0, player.energy - 45 * dt);
  }

  const speed = (isBoosting ? baseSpeed * boostMultiplier : baseSpeed);

  // Apply acceleration from input
  if (moveX !== 0 || moveY !== 0) {
    const len = Math.hypot(moveX, moveY);
    const normX = moveX / len;
    const normY = moveY / len;
    const accel = 2200 * dt;
    player.vx += normX * accel;
    player.vy += normY * accel;

    // Smoothly turn ship facing direction toward movement
    const targetAngle = Math.atan2(normY, normX);
    let diff = targetAngle - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.angle += diff * Math.min(1, 14 * dt);
  } else {
    // Face forward upwards by default if completely stopped
    const targetAngle = -Math.PI / 2;
    let diff = targetAngle - player.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    player.angle += diff * Math.min(1, 4 * dt);
  }

  // Clamp velocity to max speed
  const currentSpeed = Math.hypot(player.vx, player.vy);
  if (currentSpeed > speed) {
    player.vx = (player.vx / currentSpeed) * speed;
    player.vy = (player.vy / currentSpeed) * speed;
  }

  // Apply natural dampening friction
  player.vx *= Math.pow(friction, dt * 60);
  player.vy *= Math.pow(friction, dt * 60);

  // Integrate position
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  // Arena bounds with margin
  const margin = 40;
  player.x = Math.max(margin, Math.min(ARENA_WIDTH - margin, player.x));
  player.y = Math.max(margin, Math.min(ARENA_HEIGHT - margin, player.y));

  // Combo timer decay
  if (player.comboTimer > 0) {
    player.comboTimer -= dt;
    if (player.comboTimer <= 0) {
      player.combo = 1;
    }
  }

  // Invulnerability timer
  if (player.invulnerableTime > 0) {
    player.invulnerableTime = Math.max(0, player.invulnerableTime - dt);
  }

  // Bomb passive slow charge
  player.bombCharge = Math.min(100, player.bombCharge + 3 * dt);
}

export function checkCircleCollision(
  x1: number,
  y1: number,
  r1: number,
  x2: number,
  y2: number,
  r2: number
): boolean {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const distSq = dx * dx + dy * dy;
  const radiiSum = r1 + r2;
  return distSq <= radiiSum * radiiSum;
}

export function calculateScoreReward(basePoints: number, combo: number): number {
  return Math.round(basePoints * Math.max(1, combo));
}

export function applyDamageToPlayer(player: PlayerState, damage: number): boolean {
  if (player.invulnerableTime > 0) return false;

  // If shield active, deflect completely
  if (player.isShieldActive) {
    player.shield = Math.max(0, player.shield - damage * 15);
    return false;
  }

  // First damage shield
  if (player.shield > 0) {
    player.shield = Math.max(0, player.shield - damage * 20);
    player.invulnerableTime = 0.4;
  } else {
    // Then deplete health pip
    player.health = Math.max(0, player.health - 1);
    player.invulnerableTime = 1.2;
    player.combo = 1; // Reset combo on hit
    player.comboTimer = 0;
  }
  return true;
}

export function shouldFireBullet(player: PlayerState, input: GameInput, now: number): boolean {
  const fireIntervalMs = 120; // 8-9 shots per second
  if (input.fire && now - player.lastFireTime >= fireIntervalMs) {
    player.lastFireTime = now;
    return true;
  }
  return false;
}
