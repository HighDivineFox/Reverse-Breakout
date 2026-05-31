import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComboMultiplier,
  getBallMultiplier,
  getDestroyedBlockRewards,
  incrementBallCombo,
  resetBallCombo
} from "../src/combo.js";

test("ball multipliers increment from one without a cap", () => {
  const ball = { combo: 1 };

  assert.equal(incrementBallCombo(ball), 2);
  assert.equal(incrementBallCombo(ball), 3);
  ball.combo = 999;
  assert.equal(incrementBallCombo(ball), 1000);
});

test("wall resets return a ball multiplier to one", () => {
  const ball = { combo: 4 };

  resetBallCombo(ball);

  assert.equal(ball.combo, 1);
});

test("ball multipliers have a one-times baseline", () => {
  assert.equal(getBallMultiplier(0), 1);
  assert.equal(getBallMultiplier(1), 1);
  assert.equal(getBallMultiplier(3), 3);
});

test("combo multiplier increases rewards after the first block hit", () => {
  assert.equal(applyComboMultiplier(7, 1), 7);
  assert.equal(applyComboMultiplier(7, 2), 14);
  assert.equal(applyComboMultiplier(7, 3), 21);
});

test("combo credits do not increase prestige value", () => {
  assert.deepEqual(getDestroyedBlockRewards(7, 1.2, 3), {
    creditReward: 24,
    prestigeValue: 8
  });
});
