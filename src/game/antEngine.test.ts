import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPointInHitbox,
  stepAnt,
  isAntOutOfBounds,
  spawnAnt,
  createSplat,
  checkMilestone,
  ANT_CONFIGS,
} from './antEngine.ts';

test('isPointInHitbox returns true when tap point is within hitRadius', () => {
  // Center hit
  assert.equal(isPointInHitbox(100, 100, 100, 100, 40), true);
  // Boundary hit
  assert.equal(isPointInHitbox(100, 135, 100, 100, 40), true);
  // Outside hit
  assert.equal(isPointInHitbox(100, 145, 100, 100, 40), false);
});

test('stepAnt advances position based on speed and delta time', () => {
  const ant = {
    id: 'test-1',
    type: 'standard' as const,
    x: 100,
    y: 100,
    vx: 50,
    vy: 0,
    angle: 0,
    speed: 50,
    size: 26,
    hitRadius: 40,
    legPhase: 0,
    wobbleOffset: 0,
    wobbleSpeed: 0,
    health: 1,
    maxHealth: 1,
    color: '#000',
    accentColor: '#333',
  };

  const next = stepAnt(ant, 0.05);
  assert.ok(next.x > ant.x, 'X position should advance forward');
  assert.equal(next.health, 1);
});

test('isAntOutOfBounds correctly detects ants outside bounds', () => {
  const bounds = { width: 800, height: 600 };
  const insideAnt = spawnAnt(bounds, 'standard');
  insideAnt.x = 400;
  insideAnt.y = 300;
  assert.equal(isAntOutOfBounds(insideAnt, bounds), false);

  const outsideAnt = spawnAnt(bounds, 'standard');
  outsideAnt.x = -200;
  outsideAnt.y = 300;
  assert.equal(isAntOutOfBounds(outsideAnt, bounds), true);
});

test('spawnAnt creates valid ant with proper configuration', () => {
  const bounds = { width: 800, height: 600 };
  const ant = spawnAnt(bounds, 'golden', 1.0);
  assert.equal(ant.type, 'golden');
  assert.equal(ant.color, ANT_CONFIGS.golden.color);
  assert.ok(ant.hitRadius >= 40, 'Hitbox radius is toddler-friendly');
});

test('createSplat generates splat with multiple organic droplets', () => {
  const bounds = { width: 800, height: 600 };
  const ant = spawnAnt(bounds, 'speedy');
  ant.x = 250;
  ant.y = 350;

  const splat = createSplat(ant, 'jelly');
  assert.equal(splat.x, 250);
  assert.equal(splat.y, 350);
  assert.ok(splat.droplets.length >= 6, 'Has multiple splat droplets');
});

test('checkMilestone correctly triggers toddler celebratory milestones', () => {
  assert.equal(checkMilestone(4, 5), 'High Five! ✋');
  assert.equal(checkMilestone(9, 10), 'Super Squasher! ⭐');
  assert.equal(checkMilestone(10, 11), null);
  assert.equal(checkMilestone(19, 20), 'Ant Champion! 🏆');
});
