function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function applyFinalBlockMagnetism(balls, blocks, dt) {
  if (blocks.length !== 1) return;

  const block = blocks[0];
  const maxTurn = Math.max(0, block.magnetism || 0) * dt;
  if (maxTurn === 0) return;

  const targetX = block.x + block.w / 2;
  const targetY = block.y + block.h / 2;

  for (const ball of balls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const targetDeltaX = targetX - ball.x;
    const targetDeltaY = targetY - ball.y;
    if (speed === 0 || (targetDeltaX === 0 && targetDeltaY === 0)) continue;

    const currentAngle = Math.atan2(ball.vy, ball.vx);
    const targetAngle = Math.atan2(targetDeltaY, targetDeltaX);
    const angleDelta = Math.atan2(
      Math.sin(targetAngle - currentAngle),
      Math.cos(targetAngle - currentAngle)
    );
    const nextAngle = currentAngle + clamp(angleDelta, -maxTurn, maxTurn);
    ball.vx = Math.cos(nextAngle) * speed;
    ball.vy = Math.sin(nextAngle) * speed;
  }
}
