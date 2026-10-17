import test from 'node:test';
import assert from 'node:assert/strict';
import {
  initSnakeState,
  applySnakeInput,
  tickSnake,
  initInvadersGrid,
  stepInvadersMarch,
  checkPaddleBallBounce,
  updateRacerPosition,
  updateVectorShipPhysics,
  initPlumberStage,
  updatePlumberMovement,
} from './retroRules.ts';

test('initSnakeState sets up initial snake body and food', () => {
  const s = initSnakeState(30, 20);
  assert.equal(s.body.length, 4);
  assert.equal(s.direction, 'RIGHT');
  assert.equal(s.isGameOver, false);
  assert.equal(s.food.points, 100);
});

test('applySnakeInput ignores reversing directly into own body', () => {
  const s = initSnakeState(30, 20);
  // Snake is moving RIGHT, input LEFT should be ignored
  applySnakeInput(s, { stickX: -1, stickY: 0, fire: false, boost: false, shield: false, bomb: false });
  assert.equal(s.nextDirection, 'RIGHT', 'Should not turn 180 deg into self');

  // Input UP should be accepted
  applySnakeInput(s, { stickX: 0, stickY: -1, fire: false, boost: false, shield: false, bomb: false });
  assert.equal(s.nextDirection, 'UP');
});

test('tickSnake advances body and wraps edges', () => {
  const s = initSnakeState(10, 10);
  const startX = s.body[0].x;
  tickSnake(s);
  assert.equal(s.body[0].x, (startX + 1) % 10);
});

test('initInvadersGrid creates 55 aliens and 4 bunkers', () => {
  const { aliens, bunkers } = initInvadersGrid();
  assert.equal(aliens.length, 55);
  assert.equal(bunkers.length, 4);
  assert.equal(aliens.filter(a => a.alive).length, 55);
});

test('stepInvadersMarch detects wall bounce and signals dropDown', () => {
  const { aliens } = initInvadersGrid();
  // Move an alien close to right border
  aliens[0].x = 1900;
  const res = stepInvadersMarch(aliens, 1, 10, 1920);
  assert.equal(res.dropDown, true);
  assert.equal(res.newDirection, -1);
});

test('checkPaddleBallBounce correctly redirects pong ball', () => {
  const paddle = { x: 80, y: 300, w: 20, h: 120, score: 0 };
  const ball = { x: 85, y: 300, vx: -400, vy: 0, radius: 10, speed: 400 };

  const bounced = checkPaddleBallBounce(ball, paddle, true);
  assert.equal(bounced, true);
  assert.ok(ball.vx > 0, 'Ball velocity should now be positive (moving right)');
});

test('updateRacerPosition increases speed on gas and steers', () => {
  const car = { x: 0.5, y: 0.8, speed: 0, maxSpeed: 240, boost: false, lane: 2 };
  updateRacerPosition(car, 1.0, true, false, false, 0.5);
  assert.ok(car.speed > 0, 'Car should accelerate when pressing gas');
  assert.ok(car.x > 0.5, 'Car should steer right with positive steer input');
});

test('updateVectorShipPhysics applies thrust and rotates', () => {
  const ship = { x: 500, y: 500, vx: 0, vy: 0, angle: 0, radius: 15, score: 0, lives: 3 };
  // Thrust forward with angle 0 (rightwards)
  updateVectorShipPhysics(ship, 0, true, 0.1, 1920, 1080);
  assert.ok(ship.vx > 0, 'Ship should gain positive vx forward');
  assert.ok(ship.x > 500, 'Ship position should move forward');
});

test('initPlumberStage initializes player, blocks, and enemies', () => {
  const stage = initPlumberStage();
  assert.equal(stage.player.lives, 3);
  assert.equal(stage.player.coins, 0);
  assert.ok(stage.blocks.length > 10, 'Stage should have blocks');
  assert.ok(stage.enemies.length >= 5, 'Stage should have enemies');
  assert.equal(stage.flagpoleX, 5800);
});

test('updatePlumberMovement allows jumping and stomping enemies', () => {
  const stage = initPlumberStage();
  const input = { stickX: 1, stickY: 0, fire: false, boost: true, shield: false, bomb: false };

  // Jump triggered
  let jumped = false;
  updatePlumberMovement(stage.player, stage.blocks, stage.enemies, input, 0.05, {
    onJump: () => { jumped = true; },
  });

  assert.equal(jumped, true, 'Should trigger jump callback');
  assert.ok(stage.player.vy < 0, 'Player vy should be negative when jumping');
  assert.ok(stage.player.vx > 0, 'Player should be running right');

  // Test stomp collision
  const testPlayer = { ...stage.player, x: 520, y: 800, vy: 400 }; // Falling directly onto enemy #1
  const testEnemy = { ...stage.enemies[0], x: 520, y: 835 };
  let stomped = false;
  updatePlumberMovement(testPlayer, [], [testEnemy], { stickX: 0, stickY: 0, fire: false, boost: false, shield: false, bomb: false }, 0.05, {
    onStomp: () => { stomped = true; },
  });

  assert.equal(stomped, true, 'Should trigger stomp callback');
  assert.equal(testEnemy.isSquashed, true, 'Enemy should be squashed');
  assert.ok(testPlayer.vy < 0, 'Player should bounce upward after stomp');
});
