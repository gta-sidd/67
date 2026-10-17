import type { GameInput } from './types.ts';

// ---------------------------------------------------------------------------
// 1. CYBER SNAKE RULES
// ---------------------------------------------------------------------------
export interface SnakeSegment {
  x: number;
  y: number;
}

export interface SnakeState {
  body: SnakeSegment[];
  direction: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  nextDirection: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
  food: { x: number; y: number; type: 'normal' | 'super'; points: number };
  score: number;
  length: number;
  gridSize: number;
  cols: number;
  rows: number;
  moveTimer: number;
  moveInterval: number;
  isGameOver: boolean;
}

export function initSnakeState(cols = 48, rows = 27, gridSize = 40): SnakeState {
  const startX = Math.floor(cols / 4);
  const startY = Math.floor(rows / 2);
  return {
    body: [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
      { x: startX - 3, y: startY },
    ],
    direction: 'RIGHT',
    nextDirection: 'RIGHT',
    food: { x: Math.floor(cols / 2), y: startY, type: 'normal', points: 100 },
    score: 0,
    length: 4,
    gridSize,
    cols,
    rows,
    moveTimer: 0,
    moveInterval: 0.08,
    isGameOver: false,
  };
}

export function applySnakeInput(state: SnakeState, input: GameInput): void {
  let requested: 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | null = null;
  if (input.stickY < -0.4) requested = 'UP';
  else if (input.stickY > 0.4) requested = 'DOWN';
  else if (input.stickX < -0.4) requested = 'LEFT';
  else if (input.stickX > 0.4) requested = 'RIGHT';

  if (!requested) return;

  const current = state.direction;
  if (requested === 'UP' && current !== 'DOWN') state.nextDirection = 'UP';
  if (requested === 'DOWN' && current !== 'UP') state.nextDirection = 'DOWN';
  if (requested === 'LEFT' && current !== 'RIGHT') state.nextDirection = 'LEFT';
  if (requested === 'RIGHT' && current !== 'LEFT') state.nextDirection = 'RIGHT';
}

export function tickSnake(state: SnakeState): boolean {
  if (state.isGameOver) return false;

  state.direction = state.nextDirection;
  const head = state.body[0];
  let nextX = head.x;
  let nextY = head.y;

  if (state.direction === 'UP') nextY -= 1;
  else if (state.direction === 'DOWN') nextY += 1;
  else if (state.direction === 'LEFT') nextX -= 1;
  else if (state.direction === 'RIGHT') nextX += 1;

  // Wall collisions wrap around in cyber grid!
  if (nextX < 0) nextX = state.cols - 1;
  if (nextX >= state.cols) nextX = 0;
  if (nextY < 0) nextY = state.rows - 1;
  if (nextY >= state.rows) nextY = 0;

  // Self collision check
  for (let i = 1; i < state.body.length; i++) {
    if (state.body[i].x === nextX && state.body[i].y === nextY) {
      state.isGameOver = true;
      return false;
    }
  }

  // Insert new head
  state.body.unshift({ x: nextX, y: nextY });

  // Food check
  let ateFood = false;
  if (nextX === state.food.x && nextY === state.food.y) {
    state.score += state.food.points;
    state.length += 2;
    ateFood = true;

    // Spawn new food
    let valid = false;
    while (!valid) {
      const rx = Math.floor(Math.random() * (state.cols - 2)) + 1;
      const ry = Math.floor(Math.random() * (state.rows - 2)) + 1;
      const inBody = state.body.some(seg => seg.x === rx && seg.y === ry);
      if (!inBody) {
        state.food = {
          x: rx,
          y: ry,
          type: Math.random() > 0.8 ? 'super' : 'normal',
          points: Math.random() > 0.8 ? 250 : 100,
        };
        valid = true;
      }
    }
  }

  while (state.body.length > state.length) {
    state.body.pop();
  }

  return ateFood;
}

// ---------------------------------------------------------------------------
// 2. GALACTIC INVADERS RULES
// ---------------------------------------------------------------------------
export interface InvaderAlien {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  alive: boolean;
  type: 1 | 2 | 3; // Crab, Squid, Octopus
  points: number;
}

export interface BunkerShield {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

export function initInvadersGrid(): { aliens: InvaderAlien[]; bunkers: BunkerShield[] } {
  const aliens: InvaderAlien[] = [];
  let id = 1;
  const startX = 360;
  const startY = 160;
  const spacingX = 100;
  const spacingY = 70;

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 11; c++) {
      const type = (r === 0 ? 1 : r <= 2 ? 2 : 3) as 1 | 2 | 3;
      aliens.push({
        id: id++,
        row: r,
        col: c,
        x: startX + c * spacingX,
        y: startY + r * spacingY,
        alive: true,
        type,
        points: type === 1 ? 30 : type === 2 ? 20 : 10,
      });
    }
  }

  const bunkers: BunkerShield[] = [];
  const bunkerSpacing = 360;
  for (let b = 0; b < 4; b++) {
    bunkers.push({
      x: 420 + b * bunkerSpacing,
      y: 840,
      hp: 12,
      maxHp: 12,
    });
  }

  return { aliens, bunkers };
}

export function stepInvadersMarch(
  aliens: InvaderAlien[],
  direction: number,
  speed: number,
  arenaWidth = 1920
): { newDirection: number; dropDown: boolean } {
  const activeAliens = aliens.filter(a => a.alive);
  if (activeAliens.length === 0) return { newDirection: direction, dropDown: false };

  let hitWall = false;
  for (const a of activeAliens) {
    if ((direction > 0 && a.x > arenaWidth - 180) || (direction < 0 && a.x < 180)) {
      hitWall = true;
      break;
    }
  }

  if (hitWall) {
    return { newDirection: -direction, dropDown: true };
  }

  return { newDirection: direction, dropDown: false };
}

// ---------------------------------------------------------------------------
// 3. NEON PONG HYPER PADDLE RULES
// ---------------------------------------------------------------------------
export interface PongBall {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  speed: number;
}

export interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
  score: number;
}

export function checkPaddleBallBounce(
  ball: PongBall,
  paddle: Paddle,
  isLeftPaddle: boolean
): boolean {
  // Check bounding box
  const halfH = paddle.h / 2;
  const halfW = paddle.w / 2;

  if (
    ball.y + ball.radius >= paddle.y - halfH &&
    ball.y - ball.radius <= paddle.y + halfH
  ) {
    if (isLeftPaddle && ball.x - ball.radius <= paddle.x + halfW && ball.x + ball.radius >= paddle.x - halfW && ball.vx < 0) {
      // Calculate bounce angle based on where ball hits paddle (-1 top to +1 bottom)
      const offset = (ball.y - paddle.y) / halfH;
      const angle = offset * (Math.PI / 3); // Max 60 deg
      ball.speed = Math.min(1800, ball.speed * 1.05);
      ball.vx = Math.abs(Math.cos(angle) * ball.speed);
      ball.vy = Math.sin(angle) * ball.speed;
      return true;
    } else if (!isLeftPaddle && ball.x + ball.radius >= paddle.x - halfW && ball.x - ball.radius <= paddle.x + halfW && ball.vx > 0) {
      const offset = (ball.y - paddle.y) / halfH;
      const angle = offset * (Math.PI / 3);
      ball.speed = Math.min(1800, ball.speed * 1.05);
      ball.vx = -Math.abs(Math.cos(angle) * ball.speed);
      ball.vy = Math.sin(angle) * ball.speed;
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// 4. TURBO HIGHWAY RACER RULES
// ---------------------------------------------------------------------------
export interface RacerCar {
  x: number; // 0 to 1 across road lanes
  y: number;
  speed: number;
  maxSpeed: number;
  boost: boolean;
  lane: number;
}

export function updateRacerPosition(
  car: RacerCar,
  steerInput: number,
  gasInput: boolean,
  brakeInput: boolean,
  boostInput: boolean,
  dt: number
): void {
  const topSpeed = boostInput ? 320 : 240;
  if (gasInput) {
    car.speed = Math.min(topSpeed, car.speed + (boostInput ? 300 : 160) * dt);
  } else if (brakeInput) {
    car.speed = Math.max(0, car.speed - 320 * dt);
  } else {
    car.speed = Math.max(0, car.speed - 80 * dt);
  }

  // Steering scales with speed
  const steerAmount = (car.speed / topSpeed) * steerInput * 0.9 * dt;
  car.x = Math.max(0.08, Math.min(0.92, car.x + steerAmount));
}

// ---------------------------------------------------------------------------
// 5. VECTOR ASTEROIDS RULES
// ---------------------------------------------------------------------------
export interface VectorShip {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // radians
  radius: number;
  score: number;
  lives: number;
}

export function updateVectorShipPhysics(
  ship: VectorShip,
  rotateInput: number,
  thrustInput: boolean,
  dt: number,
  arenaW = 1920,
  arenaH = 1080
): void {
  // Rotate
  ship.angle += rotateInput * 4.5 * dt;

  // Thrust in direction of facing
  if (thrustInput) {
    const accel = 650 * dt;
    ship.vx += Math.cos(ship.angle) * accel;
    ship.vy += Math.sin(ship.angle) * accel;
  }

  // Inertial friction
  ship.vx *= Math.pow(0.985, dt * 60);
  ship.vy *= Math.pow(0.985, dt * 60);

  // Position
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;

  // Screen wrap-around (Classic Asteroids style!)
  if (ship.x < 0) ship.x += arenaW;
  if (ship.x > arenaW) ship.x -= arenaW;
  if (ship.y < 0) ship.y += arenaH;
  if (ship.y > arenaH) ship.y -= arenaH;
}
