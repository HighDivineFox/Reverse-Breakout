import assert from "node:assert/strict";
import test from "node:test";

import {
  advanceBall,
  createBlockSpatialIndex,
  querySweptCircle,
  sweepCircleRect
} from "../src/collision.js";

function createWorld(blocks = [], overrides = {}) {
  return {
    bounds: { left: 0, right: 1000, top: 0, bottom: 1000 },
    paddles: [],
    blockIndex: createBlockSpatialIndex(blocks, 64),
    maxImpactsPerStep: 8,
    separationEpsilon: 0.001,
    ...overrides
  };
}

function createBall(overrides = {}) {
  return {
    x: 50,
    y: 50,
    vx: 0,
    vy: 0,
    r: 5,
    hp: 10,
    ...overrides
  };
}

test("spatial index deduplicates queries and removes destroyed blocks immediately", () => {
  const wideBlock = { id: "wide", x: 50, y: 50, w: 120, h: 20 };
  const index = createBlockSpatialIndex([wideBlock], 64);
  const matches = querySweptCircle(index, createBall({ x: 40, y: 60 }), 150, 0);

  assert.deepEqual(matches, [wideBlock]);
  assert.equal(index.size, 1);
  assert.equal(index.remove(wideBlock), true);
  assert.equal(index.size, 0);
  assert.deepEqual(querySweptCircle(index, createBall({ x: 40, y: 60 }), 150, 0), []);
});

test("swept movement prevents a fast ball from tunneling through a block", () => {
  const block = { id: "target", x: 100, y: 40, w: 10, h: 20 };
  const world = createWorld([block]);
  const ball = createBall({ vx: 500 });
  const hits = [];

  advanceBall(ball, 0.2, world, {
    onBlockHit: (hitBall, hitBlock) => {
      hits.push(hitBlock.id);
      world.blockIndex.remove(hitBlock);
    }
  });

  assert.deepEqual(hits, ["target"]);
  assert.ok(ball.vx < 0);
  assert.ok(ball.x < 50);
});

test("corner contacts return a diagonal normal", () => {
  const ball = createBall({ x: 50, y: 50 });
  const block = { x: 100, y: 100, w: 20, h: 20 };
  const hit = sweepCircleRect(ball, block, 100, 100, 1);

  assert.ok(hit);
  assert.ok(hit.time > 0.45 && hit.time < 0.5);
  assert.ok(Math.abs(hit.normalX + Math.SQRT1_2) < 1e-6);
  assert.ok(Math.abs(hit.normalY + Math.SQRT1_2) < 1e-6);
});

test("initial overlaps are separated before remaining movement continues", () => {
  const block = { id: "overlap", x: 100, y: 40, w: 20, h: 20 };
  const world = createWorld([block]);
  const ball = createBall({ x: 98, vx: 100 });

  advanceBall(ball, 0.1, world);

  assert.ok(ball.vx < 0);
  assert.ok(ball.x < 95);
});

test("world wall rebounds consume only the elapsed portion of the step", () => {
  const world = createWorld([], {
    bounds: { left: 0, right: 100, top: 0, bottom: 100 }
  });
  const ball = createBall({ x: 90, vx: 100 });

  advanceBall(ball, 0.1, world);

  assert.ok(Math.abs(ball.x - 89.999) < 1e-6);
  assert.equal(ball.vx, -100);
});

test("paddle collision callback preserves the existing steering shape", () => {
  const paddle = { id: "paddle", x: 100, y: 100, w: 80, h: 12, dir: 1 };
  const world = createWorld([], { paddles: [paddle] });
  const ball = createBall({ x: 120, y: 140, vy: -100 });

  advanceBall(ball, 0.4, world, {
    onPaddleHit: (hitBall, hitPaddle) => {
      const offset = (hitBall.x - hitPaddle.x) / (hitPaddle.w / 2);
      hitBall.vx += offset * 95 + hitPaddle.dir * 18;
      hitBall.vy = Math.abs(hitBall.vy);
      hitBall.y = hitPaddle.y + hitPaddle.h / 2 + hitBall.r + world.separationEpsilon;
    }
  });

  assert.equal(ball.vx, 65.5);
  assert.equal(ball.vy, 100);
  assert.ok(ball.y > paddle.y);
});

test("ordered movement can resolve multiple legitimate block hits in one step", () => {
  const blocks = [
    { id: "left", x: 30, y: 40, w: 10, h: 20 },
    { id: "right", x: 100, y: 40, w: 10, h: 20 }
  ];
  const world = createWorld(blocks);
  const ball = createBall({ x: 70, vx: 200 });
  const hits = [];

  advanceBall(ball, 0.5, world, {
    onBlockHit: (hitBall, block) => {
      hits.push(block.id);
      world.blockIndex.remove(block);
    }
  });

  assert.deepEqual(hits, ["right", "left"]);
  assert.ok(ball.vx > 0);
});

test("impact safety cap stops pathological movement and records a metric", () => {
  const world = createWorld([], {
    bounds: { left: 0, right: 30, top: 0, bottom: 100 },
    maxImpactsPerStep: 2
  });
  const ball = createBall({ x: 15, vx: 1000 });
  const metrics = {};

  assert.equal(advanceBall(ball, 1, world, {}, metrics), 2);
  assert.equal(metrics.resolvedImpacts, 2);
  assert.equal(metrics.iterationLimitHits, 1);
});

test("64 balls and 256 blocks stay well below brute-force candidate checks", () => {
  const blocks = [];
  for (let row = 0; row < 16; row++) {
    for (let col = 0; col < 16; col++) {
      blocks.push({
        id: `${row}-${col}`,
        x: 120 + col * 34,
        y: 180 + row * 20,
        w: 28,
        h: 14
      });
    }
  }

  const world = createWorld(blocks, {
    bounds: { left: 0, right: 800, top: 0, bottom: 600 }
  });
  const balls = Array.from({ length: 64 }, (_, index) => createBall({
    x: 130 + (index % 16) * 32,
    y: 80 + Math.floor(index / 16) * 16,
    vx: 150 + (index % 7) * 13,
    vy: 220 + (index % 5) * 11,
    hp: 1000
  }));
  const metrics = {};
  const steps = 240;

  for (let step = 0; step < steps; step++) {
    for (const ball of balls) advanceBall(ball, 1 / 120, world, {}, metrics);
  }

  const bruteForceChecks = balls.length * blocks.length * steps;
  assert.equal(metrics.iterationLimitHits || 0, 0);
  assert.ok(metrics.candidateChecks < bruteForceChecks / 4, {
    candidateChecks: metrics.candidateChecks,
    bruteForceChecks
  });
});
