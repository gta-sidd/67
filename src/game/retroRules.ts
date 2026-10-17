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

// ---------------------------------------------------------------------------
// 6. SUPER PLUMBER (MARIO STYLE PLATFORMER) RULES
// ---------------------------------------------------------------------------
export interface PlumberPlayer {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  facing: 1 | -1;
  onGround: boolean;
  coyoteTimer: number;
  isJumping: boolean;
  lives: number;
  coins: number;
  score: number;
  invincibleTimer: number;
  isDead: boolean;
}

export interface PlatformBlock {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'ground' | 'brick' | 'question' | 'empty_question' | 'pipe';
  hasCoin?: boolean;
  bounceTimer?: number;
}

export interface PlatformEnemy {
  id: number;
  type: 'goomba' | 'koopa';
  x: number;
  y: number;
  vx: number;
  w: number;
  h: number;
  alive: boolean;
  isSquashed: boolean;
  squashTimer: number;
}

export function initPlumberStage(): {
  player: PlumberPlayer;
  blocks: PlatformBlock[];
  enemies: PlatformEnemy[];
  flagpoleX: number;
} {
  const player: PlumberPlayer = {
    x: 120,
    y: 700,
    vx: 0,
    vy: 0,
    w: 40,
    h: 56,
    facing: 1,
    onGround: true,
    coyoteTimer: 0.1,
    isJumping: false,
    lives: 3,
    coins: 0,
    score: 0,
    invincibleTimer: 0,
    isDead: false,
  };

  const blocks: PlatformBlock[] = [];
  let blockId = 1;

  // Ground platforms (with some pits!)
  blocks.push({ id: blockId++, x: 0, y: 880, w: 2200, h: 200, type: 'ground' });
  blocks.push({ id: blockId++, x: 2360, y: 880, w: 1800, h: 200, type: 'ground' });
  blocks.push({ id: blockId++, x: 4300, y: 880, w: 2200, h: 200, type: 'ground' });

  // Warp Pipes
  blocks.push({ id: blockId++, x: 650, y: 760, w: 90, h: 120, type: 'pipe' });
  blocks.push({ id: blockId++, x: 1200, y: 700, w: 90, h: 180, type: 'pipe' });
  blocks.push({ id: blockId++, x: 1850, y: 640, w: 90, h: 240, type: 'pipe' });
  blocks.push({ id: blockId++, x: 3100, y: 720, w: 90, h: 160, type: 'pipe' });
  blocks.push({ id: blockId++, x: 4700, y: 680, w: 90, h: 200, type: 'pipe' });

  // Classic Question [?] and Brick rows
  // Row 1: ? - Brick - ? - Brick - ?
  const row1X = 400;
  const row1Y = 640;
  blocks.push({ id: blockId++, x: row1X, y: row1Y, w: 50, h: 50, type: 'question', hasCoin: true });
  blocks.push({ id: blockId++, x: row1X + 50, y: row1Y, w: 50, h: 50, type: 'brick' });
  blocks.push({ id: blockId++, x: row1X + 100, y: row1Y, w: 50, h: 50, type: 'question', hasCoin: true });
  blocks.push({ id: blockId++, x: row1X + 150, y: row1Y, w: 50, h: 50, type: 'brick' });
  blocks.push({ id: blockId++, x: row1X + 200, y: row1Y, w: 50, h: 50, type: 'question', hasCoin: true });

  // Elevated brick platform
  const row2X = 1450;
  const row2Y = 560;
  for (let i = 0; i < 6; i++) {
    blocks.push({
      id: blockId++,
      x: row2X + i * 50,
      y: row2Y,
      w: 50,
      h: 50,
      type: i === 2 ? 'question' : 'brick',
      hasCoin: i === 2,
    });
  }

  // High bonus coins
  blocks.push({ id: blockId++, x: 2600, y: 520, w: 50, h: 50, type: 'question', hasCoin: true });
  blocks.push({ id: blockId++, x: 2650, y: 520, w: 50, h: 50, type: 'question', hasCoin: true });
  blocks.push({ id: blockId++, x: 2700, y: 520, w: 50, h: 50, type: 'question', hasCoin: true });

  // Staircase to flagpole
  const stairX = 5300;
  for (let s = 1; s <= 6; s++) {
    blocks.push({
      id: blockId++,
      x: stairX + (s - 1) * 60,
      y: 880 - s * 50,
      w: 60,
      h: s * 50,
      type: 'brick',
    });
  }

  // Enemies (Goombas / Walking critters)
  const enemies: PlatformEnemy[] = [
    { id: 1, type: 'goomba', x: 520, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 2, type: 'goomba', x: 950, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 3, type: 'goomba', x: 1050, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 4, type: 'goomba', x: 1600, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 5, type: 'koopa', x: 2800, y: 830, vx: -110, w: 44, h: 50, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 6, type: 'goomba', x: 3500, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
    { id: 7, type: 'goomba', x: 4900, y: 835, vx: -90, w: 42, h: 42, alive: true, isSquashed: false, squashTimer: 0 },
  ];

  return { player, blocks, enemies, flagpoleX: 5800 };
}

export function updatePlumberMovement(
  player: PlumberPlayer,
  blocks: PlatformBlock[],
  enemies: PlatformEnemy[],
  input: GameInput,
  dt: number,
  callbacks: {
    onJump?: () => void;
    onCoin?: () => void;
    onStomp?: () => void;
    onHurt?: () => void;
  } = {}
): void {
  if (player.isDead) return;

  const gravity = 2100;
  const walkSpeed = 340;
  const sprintSpeed = 520;
  const isSprinting = input.fire || input.boost;
  const maxSpeed = isSprinting ? sprintSpeed : walkSpeed;
  const accel = 1800;
  const friction = 0.84;

  // Horizontal input
  const moveX = input.stickX;
  if (Math.abs(moveX) > 0.15) {
    player.vx += Math.sign(moveX) * accel * dt;
    player.facing = moveX > 0 ? 1 : -1;
  } else {
    player.vx *= Math.pow(friction, dt * 60);
    if (Math.abs(player.vx) < 5) player.vx = 0;
  }
  player.vx = Math.max(-maxSpeed, Math.min(maxSpeed, player.vx));

  // Jump trigger: [A] or Jump button
  const wantsJump = input.boost || input.stickY < -0.4;
  if (player.onGround) {
    player.coyoteTimer = 0.12;
  } else {
    player.coyoteTimer = Math.max(0, player.coyoteTimer - dt);
  }

  if (wantsJump && !player.isJumping && player.coyoteTimer > 0) {
    player.vy = -920;
    player.onGround = false;
    player.isJumping = true;
    player.coyoteTimer = 0;
    callbacks.onJump?.();
  }

  // Variable jump cut (holding jump leaps higher, releasing cuts ascent)
  if (!wantsJump && player.vy < -250) {
    player.vy *= 0.52;
  }

  if (!wantsJump && player.onGround) {
    player.isJumping = false;
  }

  // Apply gravity
  player.vy += gravity * dt;
  player.vy = Math.min(1200, player.vy);

  // Apply velocity to position
  player.x += player.vx * dt;
  player.x = Math.max(0, player.x);

  // Horizontal block collision
  for (const block of blocks) {
    if (
      player.x + player.w > block.x &&
      player.x < block.x + block.w &&
      player.y + player.h > block.y + 6 &&
      player.y < block.y + block.h - 6
    ) {
      if (player.vx > 0) {
        player.x = block.x - player.w;
        player.vx = 0;
      } else if (player.vx < 0) {
        player.x = block.x + block.w;
        player.vx = 0;
      }
    }
  }

  // Vertical position and collision
  player.y += player.vy * dt;
  player.onGround = false;

  for (const block of blocks) {
    if (
      player.x + player.w > block.x + 4 &&
      player.x < block.x + block.w - 4
    ) {
      // Landing on block top
      if (
        player.vy >= 0 &&
        player.y + player.h >= block.y &&
        player.y + player.h <= block.y + 24
      ) {
        player.y = block.y - player.h;
        player.vy = 0;
        player.onGround = true;
        player.isJumping = false;
      }
      // Hitting block from below
      else if (
        player.vy < 0 &&
        player.y <= block.y + block.h &&
        player.y >= block.y + block.h - 24
      ) {
        player.y = block.y + block.h;
        player.vy = 40;
        block.bounceTimer = 0.15;

        if (block.type === 'question' && block.hasCoin) {
          block.type = 'empty_question';
          block.hasCoin = false;
          player.coins += 1;
          player.score += 200;
          callbacks.onCoin?.();
        } else if (block.type === 'brick') {
          player.score += 50;
          callbacks.onCoin?.();
        }
      }
    }
  }

  // Fall down pit
  if (player.y > 1150) {
    player.lives--;
    player.isDead = true;
    callbacks.onHurt?.();
    return;
  }

  // Enemy updates and stomp collisions
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    if (enemy.isSquashed) {
      enemy.squashTimer -= dt;
      if (enemy.squashTimer <= 0) enemy.alive = false;
      continue;
    }

    // Move enemy
    enemy.x += enemy.vx * dt;

    // Check enemy-player overlap
    const pRight = player.x + player.w;
    const pBottom = player.y + player.h;
    const eRight = enemy.x + enemy.w;
    const eBottom = enemy.y + enemy.h;

    const overlapX = pRight > enemy.x + 4 && player.x < eRight - 4;
    const overlapY = pBottom > enemy.y && player.y < eBottom;

    if (overlapX && overlapY) {
      // Stomp from above!
      if (player.vy > 0 && (pBottom - player.vy * dt <= enemy.y + 28 || pBottom <= enemy.y + enemy.h * 0.75)) {
        enemy.isSquashed = true;
        enemy.squashTimer = 0.35;
        player.vy = -620; // Bouncy hop off enemy!
        player.score += 200;
        callbacks.onStomp?.();
      }
      // Hurt from side
      else if (player.invincibleTimer <= 0) {
        player.lives--;
        player.invincibleTimer = 1.5;
        callbacks.onHurt?.();
        if (player.lives <= 0) {
          player.isDead = true;
        }
      }
    }
  }

  if (player.invincibleTimer > 0) {
    player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
  }
}

