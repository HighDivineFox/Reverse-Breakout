# Reverse Breakout Incremental: Project Brief

## Current Scope

This repository contains a static browser prototype for an automated reverse-breakout
incremental game. The current implementation focuses on the complete run loop:
automatic ball launching, block clearing, between-level upgrades, prestige resets,
and sandbox controls for tuning. This document describes implemented behavior only.

## Gameplay Loop

1. A level starts with a generated block board and one or more moving launcher
   paddles near the bottom of the canvas.
2. Paddles launch balls automatically whenever their cooldown expires and active ball
   capacity is available.
3. Balls bounce inside the stage. Each block collision deals damage to the block,
   removes one HP from the ball, and raises that ball's combo. Touching any stage
   boundary resets only that ball's combo.
4. Destroyed blocks grant credits multiplied by the destroying ball's current combo.
   Combo credits do not increase prestige value. Clearing the board awards a
   level-clear bonus and opens the shop.
5. The player buys upgrades and starts the next level.
6. After reaching level 10, the player can prestige to reset the run and spend
   permanent currency on unlocks.

Balls are removed when their HP reaches zero. They do not expire on a timer.
When one block remains, its magnetism gently steers active balls toward its center
without changing their speed.

## Implemented Systems

### Level Generation

Each level uses a deterministic seed to generate its block layout. As levels increase,
the board gains rows and columns, block density rises, block HP scales upward, rewards
increase, and the board zoom gradually decreases to fit the larger grid.

### Run Upgrades

Credits earned during a run can be spent after clearing a level:

| Group | Upgrade | Effect |
| --- | --- | --- |
| Launcher | Launch Cadence | Reduces the paddle launch cooldown |
| Launcher | Ball Capacity | Raises the active ball limit |
| Launcher | Extra Paddles | Adds automatic launcher lanes |
| Ball | Ball Speed | Increases travel speed |
| Ball | Flat Strength | Adds damage to each block hit |
| Ball | Strength Multiplier | Multiplies damage after flat additions |
| Ball | Ball HP | Allows balls to survive more block collisions |
| Economy | Block Bounty | Multiplies credit rewards |

### Prestige

Prestige becomes available when the run reaches level 10. The reward is based on the
highest level reached and the total block value earned. Prestiging resets the current
run's level, credits, and upgrades while preserving permanent currency and unlocks.

The implemented permanent unlocks are:

| Unlock | Cost | Effect |
| --- | ---: | --- |
| Divergent Launchers | 2 PP | Widens the launch spread for better side coverage |
| Permanent Starter Kit | 3 PP | Starts each run with one Ball Capacity level and one Flat Strength level |

### Sandbox

The Sandbox panel exposes prototype-only controls:

- Simulation speed from `0.25x` to `8.00x`
- Jump directly to the next level
- Reset all runtime progress, including prestige currency and unlocks

## Architecture

The prototype has no build step, external runtime dependencies, or persistence layer.

| Path | Responsibility |
| --- | --- |
| `index.html` | Declares the canvas and overlay menus |
| `src/game.js` | Owns configuration, state, fixed-step simulation, canvas rendering, and UI events |
| `src/combo.js` | Owns per-ball combo updates, resets, and reward multiplication |
| `src/magnetism.js` | Applies final-block ball steering while preserving ball speed |
| `src/collision.js` | Owns swept collision detection, ordered impact resolution, and the block spatial index |
| `styles/main.css` | Styles the responsive shell, canvas, overlays, and shop cards |
| `server.mjs` | Serves static files from `http://127.0.0.1:4173/` by default |

The simulation advances at a fixed `1 / 120` second step and renders through
`requestAnimationFrame`. Block layouts use seeded randomness so a given level has a
stable board. Ball launches intentionally add a small random angle variance so
repeated launches do not follow an identical path.

Blocks are indexed in fixed-size spatial cells when each level begins. During a
simulation step, each ball queries only the cells touched by its swept path and
resolves contacts in travel order. Ball-to-ball collisions are intentionally omitted.

## Tuning Reference

The primary tuning surface is the `CONFIG` object in `src/game.js`:

| Area | Key settings |
| --- | --- |
| Stage | Canvas dimensions, wall inset, paddle position, block clearance, and block gap |
| Level | Board zoom, starting rows and columns, grid growth, and grid limits |
| Economy | Clear bonus, base block reward, and prestige unlock level |
| Block | Final-block magnetism steering strength |
| Ball | Radius, HP, speed, damage, launch spread, and launch variance |
| Paddle | Width, height, movement speed, and launch cooldown |

Upgrade cost curves and effects live in `UPGRADES`. Permanent unlock definitions live
in `PRESTIGE_UNLOCKS`. When a visible startup value changes, update the matching
fallback value in `index.html` so the first rendered panel remains consistent with the
runtime configuration.

## Local Verification

Run the syntax gate:

```powershell
npm run check
```

Run the collision regression suite:

```powershell
npm test
```

For a manual pass, start the server with `npm start`, open
[http://127.0.0.1:4173/](http://127.0.0.1:4173/), and verify the automatic run, Run
panel, between-level shop, prestige flow, and Sandbox controls.
