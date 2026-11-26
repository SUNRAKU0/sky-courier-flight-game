# sky-courier-flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/SUNRAKU0/sky-courier-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/SUNRAKU0/sky-courier-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Sky Courier: a complete original 2.5D flight game in the browser — rings, cargo drops and runway landings. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC.

## Play it

```sh
# serve game/ with any static server, then open it in desktop Chrome:
python3 -m http.server 8080 --directory game
# open http://localhost:8080
```

Or run the hand-in program, which copies the game and screenshots to `out/`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## The game

You fly a little red-and-white prop plane over a seeded valley — patchwork
fields, a winding road, a river, rolling hills and one runway. Three
missions, picked on the title screen:

1. **Ring Run** — fly through all 8 glowing rings in order.
2. **Cargo Drop** — drop the supply crate (press **C**) onto the yellow zone.
3. **Landing Challenge** — touch down on the runway under 198 km/h.

Fuel drains with throttle, hard landings and terrain hits damage the
airframe, and running out of either ends the sortie. The HUD shows altitude,
speed, heading, fuel, damage, score and the nearest landmark, with a compass
strip and an artificial horizon that stay lit the whole flight.

## Controls

- **W/S** or **↑/↓** pitch · **A/D** or **←/→** bank and turn
- **Shift** throttle up · **Ctrl** throttle down · **Space** boost
- **C** drop cargo · mouse nudges the camera · click to start / restart

## Screenshots

`?scene=start|play|end&seed=7` puts the game into a fixed pose for its
screenshots: the title screen on the runway, mid-flight chasing a ring, and
the end screen after a smooth landing. Pure Canvas 2D, no libraries, no
network — every pixel is drawn by the game's own code.

---

<sub>Entered on [make.fun](https://make.fun/?ref=h4qpnq0g&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
