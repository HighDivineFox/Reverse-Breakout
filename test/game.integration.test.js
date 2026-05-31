import assert from "node:assert/strict";
import test from "node:test";

function createElement() {
  return {
    classList: { add() {}, remove() {} },
    style: {},
    textContent: "",
    innerHTML: "",
    disabled: false,
    open: false,
    append() {},
    addEventListener() {},
    querySelector() {
      return createElement();
    }
  };
}

function createContext() {
  return {
    arc() {},
    arcTo() {},
    beginPath() {},
    clearRect() {},
    closePath() {},
    createLinearGradient() {
      return { addColorStop() {} };
    },
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    moveTo() {},
    setTransform() {},
    stroke() {},
    strokeRect() {}
  };
}

test("game module launches balls and clears blocks through the fixed-step loop", async () => {
  const elements = new Map();
  const context = createContext();
  const canvas = {
    ...createElement(),
    width: 1120,
    height: 720,
    clientWidth: 1120,
    clientHeight: 720,
    getBoundingClientRect: () => ({ width: 1120, height: 720 }),
    getContext: () => context
  };

  globalThis.document = {
    hidden: false,
    addEventListener() {},
    createElement,
    querySelector(selector) {
      if (selector === "#gameCanvas") return canvas;
      if (!elements.has(selector)) elements.set(selector, createElement());
      return elements.get(selector);
    }
  };
  globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
  globalThis.ResizeObserver = class {
    observe() {}
  };

  let nextFrame;
  globalThis.requestAnimationFrame = callback => {
    nextFrame = callback;
    return 1;
  };

  await import(`../src/game.js?integration=${Date.now()}`);

  assert.equal(elements.get("#versionValue").textContent, "v0.2.0");
  assert.equal(elements.get("#ballsValue").textContent, "0 / 1");
  assert.equal(elements.get("#blocksValue").textContent, 6);

  for (let frame = 0; frame <= 1200; frame++) {
    const callback = nextFrame;
    callback(frame * (1000 / 60));
  }

  assert.equal(elements.get("#ballsValue").textContent, "1 / 1");
  assert.ok(Number(elements.get("#blocksValue").textContent) < 6);
});
