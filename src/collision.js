const TIME_EPSILON = 1e-9;

function cellKey(x, y) {
  return `${x},${y}`;
}

function getCellRange(x, y, w, h, cellSize) {
  return {
    minX: Math.floor(x / cellSize),
    maxX: Math.floor((x + w) / cellSize),
    minY: Math.floor(y / cellSize),
    maxY: Math.floor((y + h) / cellSize)
  };
}

function forEachCell(range, visit) {
  for (let y = range.minY; y <= range.maxY; y++) {
    for (let x = range.minX; x <= range.maxX; x++) {
      visit(cellKey(x, y));
    }
  }
}

export function createBlockSpatialIndex(blocks, cellSize) {
  const cells = new Map();
  const blockCells = new Map();
  const activeBlocks = new Set();

  function insert(block) {
    if (activeBlocks.has(block)) return;

    const keys = [];
    const range = getCellRange(block.x, block.y, block.w, block.h, cellSize);
    forEachCell(range, key => {
      let cell = cells.get(key);
      if (!cell) {
        cell = new Set();
        cells.set(key, cell);
      }
      cell.add(block);
      keys.push(key);
    });

    blockCells.set(block, keys);
    activeBlocks.add(block);
  }

  function remove(block) {
    if (!activeBlocks.delete(block)) return false;

    for (const key of blockCells.get(block) || []) {
      const cell = cells.get(key);
      cell?.delete(block);
      if (cell?.size === 0) cells.delete(key);
    }
    blockCells.delete(block);
    return true;
  }

  function query(x, y, w, h) {
    const matches = new Set();
    const range = getCellRange(x, y, w, h, cellSize);
    forEachCell(range, key => {
      for (const block of cells.get(key) || []) {
        if (activeBlocks.has(block)) matches.add(block);
      }
    });
    return [...matches];
  }

  for (const block of blocks) insert(block);

  return {
    cellSize,
    insert,
    remove,
    query,
    has: block => activeBlocks.has(block),
    get size() {
      return activeBlocks.size;
    }
  };
}

export function querySweptCircle(index, circle, deltaX, deltaY) {
  const minX = Math.min(circle.x, circle.x + deltaX) - circle.r;
  const minY = Math.min(circle.y, circle.y + deltaY) - circle.r;
  const maxX = Math.max(circle.x, circle.x + deltaX) + circle.r;
  const maxY = Math.max(circle.y, circle.y + deltaY) + circle.r;
  return index.query(minX, minY, maxX - minX, maxY - minY);
}

function normalize(x, y) {
  const length = Math.hypot(x, y);
  return length > 0
    ? { x: x / length, y: y / length }
    : { x: 1, y: 0 };
}

function getInitialOverlap(circle, rect) {
  const nearestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
  const nearestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
  const dx = circle.x - nearestX;
  const dy = circle.y - nearestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > circle.r * circle.r) return null;

  if (distanceSquared > TIME_EPSILON) {
    const distance = Math.sqrt(distanceSquared);
    return {
      normalX: dx / distance,
      normalY: dy / distance,
      depth: Math.max(0, circle.r - distance)
    };
  }

  const sides = [
    { normalX: -1, normalY: 0, depth: circle.x - rect.x + circle.r },
    { normalX: 1, normalY: 0, depth: rect.x + rect.w - circle.x + circle.r },
    { normalX: 0, normalY: -1, depth: circle.y - rect.y + circle.r },
    { normalX: 0, normalY: 1, depth: rect.y + rect.h - circle.y + circle.r }
  ];
  return sides.reduce((best, side) => side.depth < best.depth ? side : best);
}

function addRectSideHits(hits, circle, rect, velocityX, velocityY, maxTime) {
  if (velocityX > TIME_EPSILON) {
    const time = (rect.x - circle.r - circle.x) / velocityX;
    const y = circle.y + velocityY * time;
    if (time >= 0 && time <= maxTime && y >= rect.y && y <= rect.y + rect.h) {
      hits.push({ time, normalX: -1, normalY: 0 });
    }
  } else if (velocityX < -TIME_EPSILON) {
    const time = (rect.x + rect.w + circle.r - circle.x) / velocityX;
    const y = circle.y + velocityY * time;
    if (time >= 0 && time <= maxTime && y >= rect.y && y <= rect.y + rect.h) {
      hits.push({ time, normalX: 1, normalY: 0 });
    }
  }

  if (velocityY > TIME_EPSILON) {
    const time = (rect.y - circle.r - circle.y) / velocityY;
    const x = circle.x + velocityX * time;
    if (time >= 0 && time <= maxTime && x >= rect.x && x <= rect.x + rect.w) {
      hits.push({ time, normalX: 0, normalY: -1 });
    }
  } else if (velocityY < -TIME_EPSILON) {
    const time = (rect.y + rect.h + circle.r - circle.y) / velocityY;
    const x = circle.x + velocityX * time;
    if (time >= 0 && time <= maxTime && x >= rect.x && x <= rect.x + rect.w) {
      hits.push({ time, normalX: 0, normalY: 1 });
    }
  }
}

function addRectCornerHits(hits, circle, rect, velocityX, velocityY, maxTime) {
  const speedSquared = velocityX * velocityX + velocityY * velocityY;
  if (speedSquared <= TIME_EPSILON) return;

  const corners = [
    { x: rect.x, y: rect.y, check: (x, y) => x <= rect.x && y <= rect.y },
    { x: rect.x + rect.w, y: rect.y, check: (x, y) => x >= rect.x + rect.w && y <= rect.y },
    { x: rect.x, y: rect.y + rect.h, check: (x, y) => x <= rect.x && y >= rect.y + rect.h },
    { x: rect.x + rect.w, y: rect.y + rect.h, check: (x, y) => x >= rect.x + rect.w && y >= rect.y + rect.h }
  ];

  for (const corner of corners) {
    const offsetX = circle.x - corner.x;
    const offsetY = circle.y - corner.y;
    const b = 2 * (offsetX * velocityX + offsetY * velocityY);
    const c = offsetX * offsetX + offsetY * offsetY - circle.r * circle.r;
    const discriminant = b * b - 4 * speedSquared * c;
    if (discriminant < 0) continue;

    const time = (-b - Math.sqrt(discriminant)) / (2 * speedSquared);
    if (time < 0 || time > maxTime) continue;

    const x = circle.x + velocityX * time;
    const y = circle.y + velocityY * time;
    if (!corner.check(x, y)) continue;

    const normal = normalize(x - corner.x, y - corner.y);
    hits.push({ time, normalX: normal.x, normalY: normal.y });
  }
}

export function sweepCircleRect(circle, rect, velocityX, velocityY, maxTime) {
  const overlap = getInitialOverlap(circle, rect);
  if (overlap) {
    const approachSpeed = velocityX * overlap.normalX + velocityY * overlap.normalY;
    if (overlap.depth > TIME_EPSILON || approachSpeed < 0) {
      return { time: 0, ...overlap };
    }
  }

  const hits = [];
  addRectSideHits(hits, circle, rect, velocityX, velocityY, maxTime);
  addRectCornerHits(hits, circle, rect, velocityX, velocityY, maxTime);
  return hits.reduce((best, hit) => !best || hit.time < best.time ? hit : best, null);
}

function sweepWorldBounds(ball, bounds, maxTime) {
  const hits = [];

  if (ball.vx < -TIME_EPSILON) {
    const time = (bounds.left + ball.r - ball.x) / ball.vx;
    if (time >= 0 && time <= maxTime) hits.push({ time, normalX: 1, normalY: 0 });
  } else if (ball.vx > TIME_EPSILON) {
    const time = (bounds.right - ball.r - ball.x) / ball.vx;
    if (time >= 0 && time <= maxTime) hits.push({ time, normalX: -1, normalY: 0 });
  }

  if (ball.vy < -TIME_EPSILON) {
    const time = (bounds.top + ball.r - ball.y) / ball.vy;
    if (time >= 0 && time <= maxTime) hits.push({ time, normalX: 0, normalY: 1 });
  } else if (ball.vy > TIME_EPSILON) {
    const time = (bounds.bottom - ball.r - ball.y) / ball.vy;
    if (time >= 0 && time <= maxTime) hits.push({ time, normalX: 0, normalY: -1 });
  }

  return hits.reduce((best, hit) => !best || hit.time < best.time ? hit : best, null);
}

function compareHits(current, candidate) {
  if (!current || candidate.time < current.time - TIME_EPSILON) return candidate;
  if (Math.abs(candidate.time - current.time) > TIME_EPSILON) return current;

  const priorities = { wall: 0, paddle: 1, block: 2 };
  if (priorities[candidate.type] !== priorities[current.type]) {
    return priorities[candidate.type] < priorities[current.type] ? candidate : current;
  }

  const candidateId = String(candidate.target?.id ?? "");
  const currentId = String(current.target?.id ?? "");
  return candidateId < currentId ? candidate : current;
}

function reflect(ball, hit) {
  const approachSpeed = ball.vx * hit.normalX + ball.vy * hit.normalY;
  if (approachSpeed >= 0) return;
  ball.vx -= 2 * approachSpeed * hit.normalX;
  ball.vy -= 2 * approachSpeed * hit.normalY;
}

function increment(metrics, key, amount = 1) {
  if (metrics) metrics[key] = (metrics[key] || 0) + amount;
}

function clampBallToBounds(ball, bounds) {
  ball.x = Math.max(bounds.left + ball.r, Math.min(bounds.right - ball.r, ball.x));
  ball.y = Math.max(bounds.top + ball.r, Math.min(bounds.bottom - ball.r, ball.y));
}

export function advanceBall(ball, dt, world, handlers = {}, metrics) {
  const maxImpacts = world.maxImpactsPerStep ?? 8;
  const separationEpsilon = world.separationEpsilon ?? 0.001;
  let remaining = dt;
  let impacts = 0;

  clampBallToBounds(ball, world.bounds);

  while (remaining > TIME_EPSILON && ball.hp > 0) {
    let earliest = null;
    const wallHit = sweepWorldBounds(ball, world.bounds, remaining);
    if (wallHit) earliest = { ...wallHit, type: "wall" };

    for (const paddle of world.paddles || []) {
      const paddleRect = {
        x: paddle.x - paddle.w / 2,
        y: paddle.y - paddle.h / 2,
        w: paddle.w,
        h: paddle.h
      };
      const hit = sweepCircleRect(ball, paddleRect, ball.vx, ball.vy, remaining);
      if (hit) earliest = compareHits(earliest, { ...hit, type: "paddle", target: paddle });
    }

    const blocks = querySweptCircle(
      world.blockIndex,
      ball,
      ball.vx * remaining,
      ball.vy * remaining
    );
    increment(metrics, "candidateChecks", blocks.length);
    for (const block of blocks) {
      const hit = sweepCircleRect(ball, block, ball.vx, ball.vy, remaining);
      if (hit) earliest = compareHits(earliest, { ...hit, type: "block", target: block });
    }

    if (!earliest) {
      ball.x += ball.vx * remaining;
      ball.y += ball.vy * remaining;
      return impacts;
    }

    ball.x += ball.vx * earliest.time;
    ball.y += ball.vy * earliest.time;
    remaining -= earliest.time;

    const separation = (earliest.depth || 0) + separationEpsilon;
    ball.x += earliest.normalX * separation;
    ball.y += earliest.normalY * separation;

    if (earliest.type === "paddle" && handlers.onPaddleHit) {
      handlers.onPaddleHit(ball, earliest.target);
    } else {
      reflect(ball, earliest);
      if (earliest.type === "block") handlers.onBlockHit?.(ball, earliest.target);
    }

    impacts += 1;
    increment(metrics, "resolvedImpacts");
    if (impacts >= maxImpacts && remaining > TIME_EPSILON) {
      increment(metrics, "iterationLimitHits");
      return impacts;
    }
  }

  return impacts;
}
