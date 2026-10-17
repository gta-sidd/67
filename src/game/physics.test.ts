import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialPlayer,
  updatePlayerMovement,
  checkCircleCollision,
  calculateScoreReward,
  applyDamageToPlayer,
  shouldFireBullet,
  ARENA_WIDTH,
  ARENA_HEIGHT
} from './physics.ts';

test('createInitialPlayer initializes valid player stats', () => {
  const p = createInitialPlayer(1);
  assert.equal(p.id, 1);
  assert.equal(p.health, 5);
  assert.equal(p.shield, 100);
  assert.equal(p.energy, 100);
  assert.equal(p.score, 0);
  assert.equal(p.x, ARENA_WIDTH / 2);
});

test('checkCircleCollision accurately detects overlapping and non-overlapping circles', () => {
  // Overlapping
  assert.equal(checkCircleCollision(100, 100, 20, 120, 100, 15), true);
  // Separate
  assert.equal(checkCircleCollision(100, 100, 10, 200, 200, 10), false);
  // Touching exactly
  assert.equal(checkCircleCollision(0, 0, 10, 0, 20, 10), true);
});

test('calculateScoreReward applies combo multiplier correctly', () => {
  assert.equal(calculateScoreReward(100, 1), 100);
  assert.equal(calculateScoreReward(100, 3), 300);
  assert.equal(calculateScoreReward(250, 4), 1000);
});

test('updatePlayerMovement moves player within boundaries', () => {
  const p = createInitialPlayer(1);
  const input = {
    stickX: 1,
    stickY: 0,
    fire: false,
    boost: false,
    shield: false,
    bomb: false
  };

  const initialX = p.x;
  updatePlayerMovement(p, input, 0.1);
  assert.ok(p.x > initialX, 'Player should have moved right');
  assert.ok(p.x <= ARENA_WIDTH, 'Player must stay inside arena width');
  assert.ok(p.y <= ARENA_HEIGHT, 'Player must stay inside arena height');
});

test('applyDamageToPlayer damages shield first then health pips', () => {
  const p = createInitialPlayer(1);
  assert.equal(p.health, 5);
  assert.equal(p.shield, 100);

  // Take damage while shield has charge
  applyDamageToPlayer(p, 2);
  assert.equal(p.health, 5, 'Health should not drop while shield holds');
  assert.ok(p.shield < 100, 'Shield should have decreased');

  // Deplete shield completely
  p.shield = 0;
  p.invulnerableTime = 0;
  applyDamageToPlayer(p, 1);
  assert.equal(p.health, 4, 'Health should lose 1 pip when shield is broken');
});

test('shouldFireBullet honors fire rate limit', () => {
  const p = createInitialPlayer(1);
  const input = { stickX: 0, stickY: 0, fire: true, boost: false, shield: false, bomb: false };
  
  const now = 1000;
  assert.equal(shouldFireBullet(p, input, now), true);
  // Immediate next frame within 50ms should be throttled
  assert.equal(shouldFireBullet(p, input, now + 50), false);
  // Frame after interval should fire
  assert.equal(shouldFireBullet(p, input, now + 150), true);
});
