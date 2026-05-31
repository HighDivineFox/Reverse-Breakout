# Reverse Breakout Incremental

Reverse Breakout Incremental is a browser-based prototype that turns Breakout into an
automated incremental game. Moving paddles launch balls upward, blocks absorb damage,
and each cleared level awards credits for upgrades before the next board begins.

## Quick Start

Requirements:

- Node.js
- npm

Start the local server:

```powershell
npm start
```

Open [http://127.0.0.1:4173/](http://127.0.0.1:4173/) in a browser.

## How It Works

The active run plays automatically. Each ball loses HP when it hits a block, and a
launcher creates a replacement when capacity is available. Each ball builds a combo
by hitting blocks without touching a stage boundary. Destroyed blocks grant credits
multiplied by that ball's combo. Every ball displays its multiplier starting at `x1`.
Clearing every block opens the shop, where credits
can be spent before starting the next level.

The canvas menu provides three panels:

- **Run** shows current block count, ball capacity, ball HP, launch cooldown, speed,
  and board zoom. It also contains the pause control.
- **Prestige** becomes available after reaching level 10. Prestiging resets the
  current run in exchange for permanent currency and unlocks.
- **Sandbox** provides prototype tools for changing simulation speed, jumping to the
  next level, and resetting all runtime progress.

Progress is stored in memory only. Reloading the page starts a fresh prototype
session.

## Development

Run the syntax check:

```powershell
npm run check
```

Run the automated regression suite:

```powershell
npm test
```

Publish a new feature branch after the previous pull request has merged:

```powershell
npm run push -- "Add final-block magnetism" codex/add-final-block-magnetism
```

For another commit on the current feature branch, omit the branch argument:

```powershell
npm run push -- "Tune final-block magnetism"
```

The publish task shows the affected files, asks for confirmation, runs the syntax
checks and tests, commits the listed files, and pushes the feature branch. It refuses
to publish directly from `main` or `master`.

The project is intentionally small:

| Path | Purpose |
| --- | --- |
| `index.html` | Game shell, canvas, menus, and startup fallback values |
| `src/game.js` | Game state, simulation, rendering, economy, and upgrades |
| `src/combo.js` | Per-ball credit combo tracking and reward multiplication |
| `src/magnetism.js` | Final-block ball steering that preserves ball speed |
| `src/collision.js` | Swept collision solver and block spatial index |
| `test/collision.test.js` | Collision correctness and dense-board regression tests |
| `styles/main.css` | Layout and visual styling |
| `server.mjs` | Minimal static development server |

See [Project.md](Project.md) for the current technical brief and tuning reference.
