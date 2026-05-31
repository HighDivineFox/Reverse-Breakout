export function incrementBallCombo(ball) {
  ball.combo = getBallMultiplier(ball.combo) + 1;
  return ball.combo;
}

export function resetBallCombo(ball) {
  ball.combo = 1;
}

export function getBallMultiplier(combo) {
  return Math.max(1, combo || 0);
}

export function applyComboMultiplier(reward, combo) {
  return reward * getBallMultiplier(combo);
}

export function getDestroyedBlockRewards(blockReward, rewardMultiplier, combo) {
  const prestigeValue = Math.max(1, Math.floor(blockReward * rewardMultiplier));
  return {
    creditReward: applyComboMultiplier(prestigeValue, combo),
    prestigeValue
  };
}
