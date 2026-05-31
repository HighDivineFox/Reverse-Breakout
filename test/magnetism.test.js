import assert from "node:assert/strict";
import test from "node:test";

import { applyFinalBlockMagnetism } from "../src/magnetism.js";

function createBall(overrides = {}) {
  return {
    x: 0,
    y: 0,
    vx: 100,
    vy: 0,
    ...overrides
  };
}

function createBlock(overrides = {}) {
  return {
    x: 0,
    y: 100,
    w: 20,
    h: 20,
    magnetism: 0.35,
    ...overrides
  };
}

test("magnetism does nothing unless exactly one block remains", () => {
  const noBlocksBall = createBall();
  const multipleBlocksBall = createBall();

  applyFinalBlockMagnetism([noBlocksBall], [], 1);
  applyFinalBlockMagnetism([multipleBlocksBall], [createBlock(), createBlock()], 1);

  assert.deepEqual(noBlocksBall, createBall());
  assert.deepEqual(multipleBlocksBall, createBall());
});

test("final block magnetism gently steers every ball without changing speed", () => {
  const balls = [
    createBall(),
    createBall({ vx: -80, vy: 0 })
  ];
  const speeds = balls.map(ball => Math.hypot(ball.vx, ball.vy));

  applyFinalBlockMagnetism(balls, [createBlock()], 1);

  assert.ok(Math.abs(Math.atan2(balls[0].vy, balls[0].vx) - 0.35) < 1e-10);
  assert.ok(balls[1].vy > 0);
  assert.deepEqual(balls.map(ball => Math.hypot(ball.vx, ball.vy)), speeds);
});
