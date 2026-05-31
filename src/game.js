import { advanceBall, createBlockSpatialIndex } from "./collision.js";
import { getBallMultiplier, getDestroyedBlockRewards, incrementBallCombo, resetBallCombo } from "./combo.js";
import { applyFinalBlockMagnetism } from "./magnetism.js";

const GAME_VERSION = "0.3.2";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");

const ui = {
  version: document.querySelector("#versionValue"),
  level: document.querySelector("#levelValue"),
  currency: document.querySelector("#currencyValue"),
  prestige: document.querySelector("#prestigeValue"),
  damage: document.querySelector("#damageValue"),
  blocks: document.querySelector("#blocksValue"),
  balls: document.querySelector("#ballsValue"),
  ballHp: document.querySelector("#ballHpValue"),
  cooldown: document.querySelector("#cooldownValue"),
  speed: document.querySelector("#speedValue"),
  zoom: document.querySelector("#zoomValue"),
  runOverlay: document.querySelector("#runOverlay"),
  shopOverlay: document.querySelector("#shopOverlay"),
  prestigeOverlay: document.querySelector("#prestigeOverlay"),
  sandboxOverlay: document.querySelector("#sandboxOverlay"),
  shopGrid: document.querySelector("#shopGrid"),
  prestigeGrid: document.querySelector("#prestigeGrid"),
  nextLevel: document.querySelector("#nextLevelValue"),
  clearSummary: document.querySelector("#clearSummary"),
  prestigePreview: document.querySelector("#prestigePreview"),
  runButton: document.querySelector("#runButton"),
  pauseButton: document.querySelector("#pauseButton"),
  prestigeButton: document.querySelector("#prestigeButton"),
  sandboxButton: document.querySelector("#sandboxButton"),
  mobileSandboxButton: document.querySelector("#mobileSandboxButton"),
  toolbarOverflow: document.querySelector(".toolbar-overflow"),
  closeRunButton: document.querySelector("#closeRunButton"),
  closeSandboxButton: document.querySelector("#closeSandboxButton"),
  confirmPrestigeButton: document.querySelector("#confirmPrestigeButton"),
  cancelPrestigeButton: document.querySelector("#cancelPrestigeButton"),
  continueButton: document.querySelector("#continueButton"),
  speedSlider: document.querySelector("#speedSlider"),
  speedOutput: document.querySelector("#speedOutput"),
  jumpButton: document.querySelector("#jumpButton"),
  resetButton: document.querySelector("#resetButton")
};

const CONFIG = {
  fixedStep: 1 / 120,
  stage: {
    width: 1120,
    height: 720,
    wallInset: 34,
    paddleY: 72,
    blockBottomClearance: 48,
    blockGap: 7
  },
  level: {
    zoomCap: 0.72,
    zoomDropPerLevel: 0.018,
    baseRows: 1,
    baseCols: 6,
    colsPerLevel: 0.75,
    maxRows: 9,
    maxCols: 20
  },
  economy: {
    clearBonusBase: 22,
    blockRewardBase: 2,
    prestigeUnlockLevel: 10
  },
  block: {
    magnetism: 0.35
  },
  ball: {
    radius: 7,
    baseHp: 1,
    baseSpeed: 170,
    baseDamage: 1,
    launchAngleSpread: 0.52,
    launchAngleVariance: Math.PI / 120
  },
  paddle: {
    width: 82,
    height: 12,
    speed: 132,
    cooldown: 1.75
  },
  collision: {
    cellSize: 64,
    maxImpactsPerStep: 8,
    separationEpsilon: 0.001
  },
  colors: ["#4fd1c5", "#f6c85f", "#f28f8f", "#9ca8ff", "#74d680"]
};

const UPGRADE_GROUPS = {
  launcher: "Launcher",
  ball: "Ball",
  economy: "Economy"
};

const UPGRADES = [
  {
    id: "cooldown",
    group: "launcher",
    label: "Launch Cadence",
    desc: "Shortens each paddle's launch timer.",
    max: 20,
    cost: level => Math.floor(18 * Math.pow(1.35, level)),
    value: level => Math.max(0.55, CONFIG.paddle.cooldown - level * 0.09),
    display: level => `${formatNumber(Math.max(0.55, CONFIG.paddle.cooldown - level * 0.09))}s cooldown`
  },
  {
    id: "ballCap",
    group: "launcher",
    label: "Ball Capacity",
    desc: "Raises the active ball limit.",
    max: 18,
    cost: level => Math.floor(42 * Math.pow(1.55, level)),
    value: level => 1 + level,
    display: level => `${1 + level} active balls`
  },
  {
    id: "paddles",
    group: "launcher",
    label: "Extra Paddles",
    desc: "Adds another automatic launcher lane.",
    max: 5,
    cost: level => Math.floor(220 * Math.pow(2.4, level)),
    value: level => 1 + level,
    display: level => `${1 + level} paddles`
  },
  {
    id: "speed",
    group: "ball",
    label: "Ball Speed",
    desc: "Balls travel farther between collisions.",
    max: 18,
    cost: level => Math.floor(28 * Math.pow(1.42, level)),
    value: level => CONFIG.ball.baseSpeed + level * 18,
    display: level => `${Math.round(CONFIG.ball.baseSpeed + level * 18)} speed`
  },
  {
    id: "flatDamage",
    group: "ball",
    label: "Flat Strength",
    desc: "Adds direct damage to every block hit.",
    max: 30,
    cost: level => Math.floor(24 * Math.pow(1.33, level)),
    value: level => CONFIG.ball.baseDamage + level,
    display: level => `+${level} flat`
  },
  {
    id: "damageMultiplier",
    group: "ball",
    label: "Strength Multiplier",
    desc: "Multiplies flat strength after additions.",
    max: 15,
    cost: level => Math.floor(95 * Math.pow(1.62, level)),
    value: level => 1 + level * 0.16,
    display: level => `${formatNumber(1 + level * 0.16)}x damage`
  },
  {
    id: "ballHp",
    group: "ball",
    label: "Ball HP",
    desc: "Each ball survives more block collisions.",
    max: 24,
    cost: level => Math.floor(32 * Math.pow(1.38, level)),
    value: level => CONFIG.ball.baseHp + level,
    display: level => `${CONFIG.ball.baseHp + level} HP`
  },
  {
    id: "blockValue",
    group: "economy",
    label: "Block Bounty",
    desc: "Destroyed blocks pay more credits.",
    max: 20,
    cost: level => Math.floor(54 * Math.pow(1.45, level)),
    value: level => 1 + level * 0.12,
    display: level => `${formatNumber(1 + level * 0.12)}x rewards`
  }
];

const PRESTIGE_UNLOCKS = [
  {
    id: "angleSpread",
    label: "Divergent Launchers",
    desc: "Paddles use a wider launch spread, improving side coverage.",
    cost: 2
  },
  {
    id: "startingKit",
    label: "Permanent Starter Kit",
    desc: "Begin each run with one Ball Capacity and one Flat Strength level.",
    cost: 3
  }
];

const baseUpgrades = Object.fromEntries(UPGRADES.map(upgrade => [upgrade.id, 0]));

const state = {
  mode: "playing",
  paused: false,
  pageHidden: document.hidden === true,
  simSpeed: 1,
  level: 1,
  highestLevel: 1,
  currency: 0,
  prestigeCurrency: 0,
  totalBlockValue: 0,
  upgrades: { ...baseUpgrades },
  prestigeUnlocks: new Set(),
  paddles: [],
  balls: [],
  blocks: [],
  blockIndex: null,
  levelConfig: null,
  accumulator: 0,
  lastTime: 0,
  clearSnapshot: null,
  prestigeShopOnly: false
};

function resetRun() {
  state.level = 1;
  state.highestLevel = 1;
  state.currency = 0;
  state.totalBlockValue = 0;
  state.upgrades = { ...baseUpgrades };
  if (state.prestigeUnlocks.has("startingKit")) {
    state.upgrades.ballCap = 1;
    state.upgrades.flatDamage = 1;
  }
  state.balls = [];
  startLevel(1);
}

function startLevel(level) {
  state.mode = "playing";
  state.level = level;
  state.highestLevel = Math.max(state.highestLevel, level);
  state.levelConfig = getLevelConfig(level);
  state.balls = [];
  state.blocks = buildBlocks(state.levelConfig);
  state.blockIndex = createBlockSpatialIndex(state.blocks, CONFIG.collision.cellSize);
  state.paddles = buildPaddles(getStats().paddles);
  state.clearSnapshot = null;
  closeUtilityOverlays();
  ui.shopOverlay.classList.add("hidden");
  ui.prestigeOverlay.classList.add("hidden");
  renderShops();
  renderUi();
}

function getLevelConfig(level) {
  const zoom = Math.max(CONFIG.level.zoomCap, 1 - (level - 1) * CONFIG.level.zoomDropPerLevel);
  const cols = Math.min(CONFIG.level.maxCols, CONFIG.level.baseCols + Math.floor((level - 1) * CONFIG.level.colsPerLevel));
  const rows = Math.min(CONFIG.level.maxRows, CONFIG.level.baseRows + Math.floor((level - 1) / 3));
  const density = level <= 2 ? 1 : Math.min(0.96, 0.64 + level * 0.018);
  const baseHp = Math.max(1, Math.floor(1 + Math.pow(level, 1.18) * 0.72));
  const rewardMultiplier = 1 + level * 0.08;
  return { level, zoom, cols, rows, density, baseHp, rewardMultiplier, seed: level * 9973 };
}

function buildBlocks(levelConfig) {
  const random = seededRandom(levelConfig.seed);
  const boardWidth = CONFIG.stage.width * levelConfig.zoom - CONFIG.stage.wallInset * 2;
  const blockWidth = (boardWidth - CONFIG.stage.blockGap * (levelConfig.cols - 1)) / levelConfig.cols;
  const lowerBandTop = CONFIG.stage.height / 2;
  const blockBottom = CONFIG.stage.height - 18 - CONFIG.stage.blockBottomClearance;
  const naturalBlockHeight = 42 * levelConfig.zoom;
  const availableBlockHeight = (
    blockBottom - lowerBandTop - CONFIG.stage.blockGap * (levelConfig.rows - 1)
  ) / levelConfig.rows;
  const blockHeight = Math.max(24, Math.min(naturalBlockHeight, availableBlockHeight));
  const blockTop = blockBottom - levelConfig.rows * blockHeight - (levelConfig.rows - 1) * CONFIG.stage.blockGap;
  const left = (CONFIG.stage.width - boardWidth) / 2;
  const blocks = [];

  for (let row = 0; row < levelConfig.rows; row++) {
    for (let col = 0; col < levelConfig.cols; col++) {
      const edgeBias = row === 0 || col === 0 || col === levelConfig.cols - 1 ? 0.08 : 0;
      if (random() > levelConfig.density + edgeBias) continue;
      const hpVariance = 1 + Math.floor(random() * Math.max(1, Math.min(5, levelConfig.level / 4)));
      const hp = levelConfig.baseHp + row * Math.ceil(levelConfig.level / 6) + hpVariance - 1;
      blocks.push({
        id: `${row}-${col}`,
        x: left + col * (blockWidth + CONFIG.stage.blockGap),
        y: blockTop + row * (blockHeight + CONFIG.stage.blockGap),
        w: blockWidth,
        h: blockHeight,
        hp,
        maxHp: hp,
        magnetism: CONFIG.block.magnetism,
        reward: Math.max(1, Math.floor((CONFIG.economy.blockRewardBase + hp * 0.65) * levelConfig.rewardMultiplier)),
        colorIndex: (row + col) % CONFIG.colors.length
      });
    }
  }

  return blocks;
}

function buildPaddles(count) {
  const paddles = [];
  const usableWidth = CONFIG.stage.width - CONFIG.stage.wallInset * 2;
  for (let i = 0; i < count; i++) {
    const laneOffset = (i + 1) / (count + 1);
    paddles.push({
      x: CONFIG.stage.wallInset + usableWidth * laneOffset,
      y: CONFIG.stage.paddleY + i * 20,
      w: CONFIG.paddle.width,
      h: CONFIG.paddle.height,
      dir: i % 2 === 0 ? 1 : -1,
      cooldown: i * 0.38,
      hue: CONFIG.colors[i % CONFIG.colors.length]
    });
  }
  return paddles;
}

function getStats() {
  const lookup = id => UPGRADES.find(upgrade => upgrade.id === id);
  const flatStrength = lookup("flatDamage").value(state.upgrades.flatDamage);
  const damageMultiplier = lookup("damageMultiplier").value(state.upgrades.damageMultiplier);
  return {
    cooldown: lookup("cooldown").value(state.upgrades.cooldown),
    ballCap: lookup("ballCap").value(state.upgrades.ballCap),
    paddles: lookup("paddles").value(state.upgrades.paddles),
    speed: lookup("speed").value(state.upgrades.speed),
    ballHp: lookup("ballHp").value(state.upgrades.ballHp),
    damage: Math.max(1, Math.floor(flatStrength * damageMultiplier)),
    rewardMultiplier: lookup("blockValue").value(state.upgrades.blockValue)
  };
}

function tick(dt) {
  if (state.mode !== "playing" || state.paused || state.pageHidden) return;
  const stats = getStats();

  for (const paddle of state.paddles) {
    paddle.x += paddle.dir * CONFIG.paddle.speed * dt;
    const minX = CONFIG.stage.wallInset + paddle.w / 2;
    const maxX = CONFIG.stage.width - CONFIG.stage.wallInset - paddle.w / 2;
    if (paddle.x < minX || paddle.x > maxX) {
      paddle.x = Math.max(minX, Math.min(maxX, paddle.x));
      paddle.dir *= -1;
    }

    paddle.cooldown -= dt;
    if (paddle.cooldown <= 0 && state.balls.length < stats.ballCap) {
      launchBall(paddle, stats);
      paddle.cooldown += stats.cooldown;
    }
  }

  applyFinalBlockMagnetism(state.balls, state.blocks, dt);

  for (const ball of state.balls) {
    advanceBall(ball, dt, {
      bounds: {
        left: CONFIG.stage.wallInset,
        right: CONFIG.stage.width - CONFIG.stage.wallInset,
        top: 22,
        bottom: CONFIG.stage.height - 18
      },
      paddles: state.paddles,
      blockIndex: state.blockIndex,
      maxImpactsPerStep: CONFIG.collision.maxImpactsPerStep,
      separationEpsilon: CONFIG.collision.separationEpsilon
    }, {
      onPaddleHit: (hitBall, paddle) => {
        const offset = (hitBall.x - paddle.x) / (paddle.w / 2);
        hitBall.vx += offset * 95 + paddle.dir * 18;
        hitBall.vy = Math.abs(hitBall.vy);
        hitBall.y = paddle.y + paddle.h / 2 + hitBall.r + CONFIG.collision.separationEpsilon;
      },
      onWallHit: resetBallCombo,
      onBlockHit: (hitBall, block) => {
        const priorHp = block.hp;
        block.hp -= stats.damage;
        hitBall.hp -= 1;
        const combo = incrementBallCombo(hitBall);

        if (block.hp <= 0) {
          const rewards = getDestroyedBlockRewards(block.reward, stats.rewardMultiplier, combo);
          state.currency += rewards.creditReward;
          state.totalBlockValue += rewards.prestigeValue;
          state.blockIndex.remove(block);
        } else {
          state.totalBlockValue += Math.max(1, Math.min(priorHp, stats.damage));
        }
      }
    });
  }

  state.balls = state.balls.filter(ball => ball.hp > 0);
  if (state.blockIndex.size !== state.blocks.length) {
    state.blocks = state.blocks.filter(block => state.blockIndex.has(block));
  }
  if (state.blocks.length === 0) completeLevel();
}

function launchBall(paddle, stats) {
  const spread = state.prestigeUnlocks.has("angleSpread") ? 1.08 : CONFIG.ball.launchAngleSpread;
  const laneBias = ((paddle.x / CONFIG.stage.width) - 0.5) * spread;
  const baseVx = stats.speed * laneBias + paddle.dir * 42;
  const baseVy = Math.sqrt(Math.max(80, stats.speed * stats.speed - baseVx * baseVx));
  const launchAngle = Math.atan2(baseVy, baseVx) + (Math.random() * 2 - 1) * CONFIG.ball.launchAngleVariance;
  state.balls.push({
    x: paddle.x,
    y: paddle.y + 24,
    vx: Math.cos(launchAngle) * stats.speed,
    vy: Math.sin(launchAngle) * stats.speed,
    r: CONFIG.ball.radius,
    hp: stats.ballHp,
    maxHp: stats.ballHp,
    combo: 1,
    color: paddle.hue
  });
}

function completeLevel() {
  const stats = getStats();
  const clearBonus = Math.floor((CONFIG.economy.clearBonusBase + state.level * 8) * state.levelConfig.rewardMultiplier * stats.rewardMultiplier);
  state.currency += clearBonus;
  state.totalBlockValue += clearBonus;
  state.clearSnapshot = { level: state.level, clearBonus };
  state.mode = "shop";
  closeUtilityOverlays();
  ui.nextLevel.textContent = state.level + 1;
  ui.clearSummary.textContent = `Level ${state.level} clear bonus: ${formatInteger(clearBonus)} credits. Buy upgrades, then start level ${state.level + 1}.`;
  ui.shopOverlay.classList.remove("hidden");
  renderShops();
  renderUi();
}

function buyUpgrade(id) {
  const upgrade = UPGRADES.find(item => item.id === id);
  const current = state.upgrades[id];
  if (!upgrade || current >= upgrade.max) return false;
  const cost = upgrade.cost(current);
  if (state.currency < cost) return false;
  state.currency -= cost;
  state.upgrades[id] += 1;

  const stats = getStats();
  if (id === "paddles") {
    state.paddles = buildPaddles(stats.paddles);
  }

  renderShops();
  renderUi();
  return true;
}

function canPrestige() {
  return state.highestLevel >= CONFIG.economy.prestigeUnlockLevel;
}

function getPrestigeGain() {
  if (!canPrestige()) return 0;
  const levelPart = Math.max(0, state.highestLevel - CONFIG.economy.prestigeUnlockLevel + 1);
  const valuePart = Math.floor(Math.sqrt(state.totalBlockValue / 900));
  return Math.max(1, Math.floor(levelPart / 3) + valuePart);
}

function openPrestige() {
  if (!canPrestige()) return;
  closeUtilityOverlays();
  state.mode = "prestige";
  state.prestigeShopOnly = false;
  ui.prestigeOverlay.classList.remove("hidden");
  renderPrestige();
}

function doPrestige() {
  const gain = getPrestigeGain();
  if (gain <= 0) return;
  state.prestigeCurrency += gain;
  resetRun();
  state.mode = "prestigeShop";
  state.prestigeShopOnly = true;
  ui.prestigeOverlay.classList.remove("hidden");
  renderPrestige();
}

function buyPrestigeUnlock(id) {
  const unlock = PRESTIGE_UNLOCKS.find(item => item.id === id);
  if (!unlock || state.prestigeUnlocks.has(id) || state.prestigeCurrency < unlock.cost) return;
  state.prestigeCurrency -= unlock.cost;
  state.prestigeUnlocks.add(id);
  renderPrestige();
  renderShops();
  renderUi();
}

function renderShops() {
  const stats = getStats();
  ui.shopGrid.innerHTML = "";

  for (const groupId of Object.keys(UPGRADE_GROUPS)) {
    const groupTitle = document.createElement("div");
    groupTitle.className = "eyebrow";
    groupTitle.textContent = UPGRADE_GROUPS[groupId];
    ui.shopGrid.append(groupTitle);

    for (const upgrade of UPGRADES.filter(item => item.group === groupId)) {
      ui.shopGrid.append(createUpgradeCard(upgrade));
    }
  }

  ui.damage.textContent = formatInteger(stats.damage);
}

function createUpgradeCard(upgrade) {
  const level = state.upgrades[upgrade.id];
  const cost = upgrade.cost(level);
  const maxed = level >= upgrade.max;
  const card = document.createElement("article");
  card.className = "upgrade-card";
  card.innerHTML = `
    <div>
      <h3>${upgrade.label} <strong>${level}/${upgrade.max}</strong></h3>
      <p>${upgrade.desc}</p>
      <p>${upgrade.display(level)}</p>
    </div>
    <button type="button">${maxed ? "Maxed" : formatInteger(cost)}</button>
  `;
  const button = card.querySelector("button");
  button.disabled = maxed || state.currency < cost;
  button.addEventListener("click", () => buyUpgrade(upgrade.id));
  return card;
}

function renderPrestige() {
  const gain = getPrestigeGain();
  if (state.prestigeShopOnly) {
    ui.prestigePreview.textContent = `Prestige complete. Spend permanent currency now, then close this panel to start the new run.`;
    ui.confirmPrestigeButton.style.display = "none";
    ui.cancelPrestigeButton.textContent = "Close";
  } else {
    ui.prestigePreview.textContent = `Prestiging now grants ${formatInteger(gain)} prestige currency. Highest level this run: ${state.highestLevel}.`;
    ui.confirmPrestigeButton.style.display = "";
    ui.cancelPrestigeButton.textContent = "Keep Pushing";
  }

  ui.prestigeGrid.innerHTML = "";

  for (const unlock of PRESTIGE_UNLOCKS) {
    const owned = state.prestigeUnlocks.has(unlock.id);
    const card = document.createElement("article");
    card.className = "upgrade-card";
    card.innerHTML = `
      <div>
        <h3>${unlock.label} <strong>${owned ? "Owned" : `${unlock.cost} PP`}</strong></h3>
        <p>${unlock.desc}</p>
      </div>
      <button type="button">${owned ? "Owned" : "Unlock"}</button>
    `;
    const button = card.querySelector("button");
    button.disabled = owned || state.prestigeCurrency < unlock.cost;
    button.addEventListener("click", () => buyPrestigeUnlock(unlock.id));
    ui.prestigeGrid.append(card);
  }
}

function renderUi() {
  const stats = getStats();
  ui.version.textContent = `v${GAME_VERSION}`;
  ui.level.textContent = state.level;
  ui.currency.textContent = formatInteger(state.currency);
  ui.prestige.textContent = formatInteger(state.prestigeCurrency);
  ui.damage.textContent = formatInteger(stats.damage);
  ui.blocks.textContent = state.blocks.length;
  ui.balls.textContent = `${state.balls.length} / ${stats.ballCap}`;
  ui.ballHp.textContent = stats.ballHp;
  ui.cooldown.textContent = `${formatNumber(stats.cooldown)}s`;
  ui.speed.textContent = Math.round(stats.speed);
  ui.zoom.textContent = `${Math.round(state.levelConfig.zoom * 100)}%`;

  const prestigeReady = canPrestige();
  ui.prestigeButton.disabled = !prestigeReady;
  ui.prestigeButton.textContent = prestigeReady
    ? `Prestige: +${formatInteger(getPrestigeGain())} PP`
    : `Prestige: Level ${CONFIG.economy.prestigeUnlockLevel}`;
}

function draw() {
  ctx.clearRect(0, 0, CONFIG.stage.width, CONFIG.stage.height);
  drawBackground();
  drawBlocks();
  drawPaddles();
  drawBalls();
  drawHudLines();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, CONFIG.stage.height);
  gradient.addColorStop(0, "#081121");
  gradient.addColorStop(1, "#050812");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CONFIG.stage.width, CONFIG.stage.height);

  ctx.strokeStyle = "rgba(145, 160, 183, 0.16)";
  ctx.lineWidth = 1;
  for (let x = CONFIG.stage.wallInset; x <= CONFIG.stage.width - CONFIG.stage.wallInset; x += 56) {
    ctx.beginPath();
    ctx.moveTo(x, 20);
    ctx.lineTo(x, CONFIG.stage.height - 18);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(79, 209, 197, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(CONFIG.stage.wallInset, 22, CONFIG.stage.width - CONFIG.stage.wallInset * 2, CONFIG.stage.height - 40);
}

function drawBlocks() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "12px ui-sans-serif, system-ui";

  for (const block of state.blocks) {
    const healthRatio = block.hp / block.maxHp;
    ctx.fillStyle = shadeColor(CONFIG.colors[block.colorIndex], -30 + healthRatio * 22);
    ctx.fillRect(block.x, block.y, block.w, block.h);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.1 + healthRatio * 0.22})`;
    ctx.fillRect(block.x, block.y, block.w, Math.max(3, block.h * 0.16));
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.strokeRect(block.x + 0.5, block.y + 0.5, block.w - 1, block.h - 1);

    ctx.fillStyle = "#081121";
    ctx.fillText(block.hp, block.x + block.w / 2, block.y + block.h / 2);
  }
}

function drawPaddles() {
  for (const paddle of state.paddles) {
    ctx.fillStyle = paddle.hue;
    roundRect(ctx, paddle.x - paddle.w / 2, paddle.y - paddle.h / 2, paddle.w, paddle.h, 5);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(paddle.x - paddle.w / 2 + 6, paddle.y - paddle.h / 2 + 2, paddle.w - 12, 2);
  }
}

function drawBalls() {
  for (const ball of state.balls) {
    ctx.beginPath();
    ctx.fillStyle = ball.color;
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.42)";
    ctx.stroke();

    const hpRatio = ball.hp / ball.maxHp;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(ball.x - 10, ball.y - 18, 20, 3);
    ctx.fillStyle = hpRatio > 0.35 ? "#74d680" : "#f97373";
    ctx.fillRect(ball.x - 10, ball.y - 18, 20 * hpRatio, 3);

    const multiplier = getBallMultiplier(ball.combo);
    if (multiplier > 1) {
      ctx.fillStyle = "rgba(232, 237, 247, 0.9)";
      ctx.font = "11px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`x${multiplier}`, ball.x, ball.y - 24);
    }
  }
}

function drawHudLines() {
  ctx.fillStyle = "rgba(232, 237, 247, 0.72)";
  ctx.font = "14px ui-sans-serif, system-ui";
  ctx.textAlign = "left";
  ctx.fillText(`Block HP base ${state.levelConfig.baseHp} | Grid ${state.levelConfig.cols}x${state.levelConfig.rows}`, 50, CONFIG.stage.height - 28);
  if (state.paused) {
    ctx.textAlign = "center";
    ctx.font = "36px ui-sans-serif, system-ui";
    ctx.fillText("Paused", CONFIG.stage.width / 2, CONFIG.stage.height / 2);
  }
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect?.();
  const displayWidth = rect?.width || canvas.clientWidth || CONFIG.stage.width;
  const displayHeight = rect?.height || canvas.clientHeight || CONFIG.stage.height;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const backingWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
  const backingHeight = Math.max(1, Math.round(displayHeight * pixelRatio));

  if (canvas.width !== backingWidth || canvas.height !== backingHeight) {
    canvas.width = backingWidth;
    canvas.height = backingHeight;
  }

  ctx.setTransform(
    backingWidth / CONFIG.stage.width,
    0,
    0,
    backingHeight / CONFIG.stage.height,
    0,
    0
  );
}

function frame(time) {
  const seconds = time / 1000;
  const delta = Math.min(0.1, seconds - (state.lastTime || seconds));
  state.lastTime = seconds;
  state.accumulator += delta * state.simSpeed;

  while (state.accumulator >= CONFIG.fixedStep) {
    tick(CONFIG.fixedStep);
    state.accumulator -= CONFIG.fixedStep;
  }

  draw();
  renderUi();
  requestAnimationFrame(frame);
}

function seededRandom(seed) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = value * 16807 % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function shadeColor(hex, amount) {
  const color = hex.replace("#", "");
  const r = Math.max(0, Math.min(255, parseInt(color.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(color.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(color.slice(4, 6), 16) + amount));
  return `rgb(${r}, ${g}, ${b})`;
}

function formatInteger(value) {
  return Math.floor(value).toLocaleString("en-US");
}

function formatNumber(value) {
  return Number(value).toFixed(2);
}

function closeUtilityOverlays() {
  ui.runOverlay.classList.add("hidden");
  ui.sandboxOverlay.classList.add("hidden");
  ui.toolbarOverflow.open = false;
}

function openUtilityOverlay(overlay) {
  closeUtilityOverlays();
  overlay.classList.remove("hidden");
}

ui.runButton.addEventListener("click", () => openUtilityOverlay(ui.runOverlay));
ui.sandboxButton.addEventListener("click", () => openUtilityOverlay(ui.sandboxOverlay));
ui.mobileSandboxButton.addEventListener("click", () => openUtilityOverlay(ui.sandboxOverlay));
ui.closeRunButton.addEventListener("click", closeUtilityOverlays);
ui.closeSandboxButton.addEventListener("click", closeUtilityOverlays);

ui.pauseButton.addEventListener("click", () => {
  state.paused = !state.paused;
  ui.pauseButton.textContent = state.paused ? "Resume" : "Pause";
});

ui.continueButton.addEventListener("click", () => startLevel(state.level + 1));
ui.prestigeButton.addEventListener("click", openPrestige);
ui.confirmPrestigeButton.addEventListener("click", doPrestige);
ui.cancelPrestigeButton.addEventListener("click", () => {
  ui.prestigeOverlay.classList.add("hidden");
  state.prestigeShopOnly = false;
  state.mode = "playing";
});

ui.speedSlider.addEventListener("input", () => {
  state.simSpeed = Number(ui.speedSlider.value);
  ui.speedOutput.textContent = `${formatNumber(state.simSpeed)}x`;
});

ui.jumpButton.addEventListener("click", () => startLevel(state.level + 1));
ui.resetButton.addEventListener("click", () => {
  state.prestigeCurrency = 0;
  state.prestigeUnlocks.clear();
  resetRun();
});

document.addEventListener("visibilitychange", () => {
  state.pageHidden = document.hidden === true;
  state.lastTime = 0;
  state.accumulator = 0;
});

resizeCanvas();
new ResizeObserver(resizeCanvas).observe(canvas);
window.addEventListener("resize", resizeCanvas);
resetRun();
requestAnimationFrame(frame);
