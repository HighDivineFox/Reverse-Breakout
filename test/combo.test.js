import assert from "node:assert/strict";
import test from "node:test";

import {
  applyComboMultiplier,
  getDestroyedBlockRewards,
  incrementBallCombo,
  resetBallCombo
} from "../src/combo.js";

test("ball combos increment from zero without a cap", () => {
  const ball = { combo: 0 };

  assert.equal(incrementBallCombo(ball), 1);
  assert.equal(incrementBallCombo(ball), 2);
  ball.combo = 999;
  assert.equal(incrementBallCombo(ball), 1000);
});

test("wall resets return a ball combo to zero", () => {
  const ball = { combo: 4 };

  resetBallCombo(ball);

  assert.equal(ball.combo, 0);
});

test("combo multiplier keeps the first block hit at one times rewards", () => {
  assert.equal(applyComboMultiplier(7, 0), 7);
  assert.equal(applyComboMultiplier(7, 1), 7);
  assert.equal(applyComboMultiplier(7, 3), 21);
});

test("combo credits do not increase prestige value", () => {
  assert.deepEqual(getDestroyedBlockRewards(7, 1.2, 3), {
    creditReward: 24,
    prestigeValue: 8
  });
});
