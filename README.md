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
launcher creates a replacement when capacity is available. Destroying blocks grants
credits. Clearing every block opens the shop, where credits can be spent before
starting the next level.

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

The project is intentionally small:

| Path | Purpose |
| --- | --- |
| `index.html` | Game shell, canvas, menus, and startup fallback values |
| `src/game.js` | Game state, simulation, rendering, economy, and upgrades |
| `styles/main.css` | Layout and visual styling |
| `server.mjs` | Minimal static development server |

See [Project.md](Project.md) for the current technical brief and tuning reference.
