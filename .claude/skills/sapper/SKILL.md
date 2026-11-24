---
name: sapper
description: Everything needed to keep working on SAPPER, Jonathan's falling-sand WW1/Vietnam-tunnels bunker survival game (Sapper-iOS). Use whenever he mentions Sapper, the bunker/digging game, miners, generators, drills, rooms, the share GIF, the debug menu, or asks to change, fix, test or publish the game.
---

# SAPPER — project handbook

A fun game Jonathan plays with friends. **Not a money project**: don't pitch pricing, ads, ASO or the £2k/month goal. Pitch fun, feel and playing with friends.

- Repo: `~/Developer/Sapper-iOS` → github.com/JonathanWilson1/Sapper-iOS (public)
- Live: **https://jonathanwilson1.github.io/Sapper-iOS/**. Jonathan plays it on iPhone as a home-screen web app, often away from his Mac.
- The whole game is **one file**: `web/index.html` (~2,200 lines of vanilla JS + canvas, no dependencies, works offline).
- iOS shell: `Sources/SapperApp.swift` (SwiftUI + WKWebView, haptics + share-sheet bridge), `project.yml` (XcodeGen). It builds, but has never been run on a device. Jonathan uses the web version.

## How to work with Jonathan on this
- He sends terse feedback from his phone, often with screenshots. Interpret generously, then build it, test it, publish it and report back briefly. Don't ask permission for normal game changes.
- After every change: **commit to `main` and publish** (`scripts/deploy.sh`). Then tell him the build number, which shows on the menu as `BUILD MMDD-HHMM`.
- If he says something isn't showing, his home-screen copy is stale. Tell him: with signal, swipe the app away, reopen it and check the build line. Failing that, delete the icon and re-add it from Safari.
- Be concise. Lead with what changed. Keep the sound off unless asked.

## Publish
```bash
cd ~/Developer/Sapper-iOS && git add -A && git commit -m "…" && git push -q origin main && scripts/deploy.sh
```
`deploy.sh` copies `web/*` onto the `gh-pages` branch. It stamps `const BUILD = 'dev'` with a UTC timestamp and gives the service-worker cache a new name. Pages goes live in about a minute (`curl -s https://jonathanwilson1.github.io/Sapper-iOS/ | grep BUILD`).

Offline/update machinery:
- `web/sw.js`: network-first, same-origin, caches only the app's own files.
- `web/manifest.json` and icons.
- `checkForUpdate()` runs on visibility change and reloads on the menu or game-over screen when a newer BUILD exists.

## Test (always before publishing)
Run the tests as a **separate step and read the output before publishing**. Don't chain `deploy.sh` after a test command: twice, a broken build went live that way (attacks commented out by a trailing `//`; a null-prototype object that PeerJS couldn't send). For any Trench War change, run `tests/trench-war.js`.
`tests/` holds headless scripts (playwright-core driving the system Chrome at `/Applications/Google Chrome.app`, plus Playwright WebKit). Run them with `cd tests && npm i && npm run smoke`, or `node <file>.js` one at a time. Screenshots and GIFs go to `/tmp/sapper-out/`. Read the PNGs to check visuals.

The page exposes `window.__sapper` (`fast(n)` steps the sim n ticks, plus getters). Top-level `let`/`const` are reachable from `page.evaluate`: `g`, `gens`, `rooms`, `diggers`, `mark`, `place()`, `spawnShell()` and so on.

Set `localStorage.sapper.tut='1'` first so the tutorial doesn't block attacks. Simulate touch with CDP `Input.dispatchTouchEvent`. The baseline idle survival time (no input) is about **3–4 minutes**. If a change moves it a lot, tell him.

## Game rules as they stand
- **World**: 192×440 cell grid (`W`,`H`); the screen shows about 112 cells across at zoom 1. Cell materials: `E SOIL SAND ROCK WATER TIMBER BAGS CONC GOLD RUBBLE FIRE HQ(generator) PUMP MG BED GRASS LAMP DRILL ROOM DOOR`, with per-material tables `SOLID/RES/HARD/DIGT/SUPPORTS`. Background layers: `prop` (timber bracing), `ladder`, `secret` (hidden enemy tunnels), `mark` (dig orders), `bgc` (wall type).
- **Physics**: sand pours and rubble piles. Water flows and soaks into soil. Ceilings over wide spans cave in, faster the wider they are, unless something supports them within 6 cells (timber, concrete, bags, generators, rooms, pumps, props). A rock blob with less than 20% of its underside supported falls as one piece (`processRockChecks`, `updateBodies`).
- **Controls**:
  - **One finger** marks earth to dig (yellow hatching); drag over marked earth to unmark it.
  - **Two fingers** scroll and pinch-zoom.
  - A loupe magnifier shows above the finger.
  - Tap the drill or a generator for its action.
- **Miners**: the Miners' Hut (start with one) holds **6 miners**.
  - They path with BFS through open space (they can climb) and take construction jobs before dig jobs.
  - Only earth touching open space is reachable.
  - Buried miners scramble out. Shells, fire and water knock them down; a Field Hospital medic carries them back for 8 s of treatment, otherwise they bleed out after 45 s.
  - A hut replaces a lost miner after 20 s.
- **Tray**: PROP (◆10, auto-fits wall to wall and hangs a lamp), CONCRETE (tap to toggle draw mode, ◆1 per 2 cells, diggable), MG (◆60), ROOM (menu), UPGRADE (shop).
- **ROOM menu**:
  - Every building is the **same 18×12 timber bay**: posts, two-row beam, headroom and a concrete pad. Choices: Generator, Pump, Miners' Hut, Field Hospital, Mine Head, Magazine, Listening Post.
  - Placing one lays a **construction site**, in open air or straight into earth. Miners dig out the footprint (an access passage is auto-marked if it's buried), then build it.
  - Sites are shored with props first. Pads **snap** level with the nearest neighbour's pad and butt edge to edge, for neat rows.
  - When finished, the gap above the beam is boarded up.
- **Generators**:
  - You lose when the last one is destroyed.
  - Income is 1.2◆/s × (1 − Glow loss) ÷ (1 + generators within 30 cells), × 1.25 per Dynamo level.
  - **The Glow** (old war chemicals) saps generators the deeper they sit, up to 80%. There's no hard depth line.
  - Tap to **overcharge**: ×2 output for 20 s, but sparks start fires, it takes self-damage, and there's a 30 s cooldown.
  - Flooding damages them. A generator costs ◆100, +30 for each one after.
- **Drill**: tap it to bore 20 rows (◆10), 6 cells wide.
  - It mines the ore it passes and lines the shaft with timber, leaving a 2-row gap every 10 rows for side tunnels.
  - It leaves a ladder, cross-braces, and an **automatic bulkhead hatch every 16 rows**. Hatches open for miners and medics, shut out water and block raiders.
  - If the drill is lost, a new one is parachuted in.
- **Ore**: ◆5 near the surface up to ◆15 deep, nuggets ◆40, ×1.5 near a Mine Head. The deep half of the map is gold-rich.
- **Rooms**:
  - Hospital: medic plus slow generator repair.
  - Mine Head: +50% ore nearby.
  - Magazine: ◆40 per wave, but explodes if hit.
  - Listening Post: reveals tunnellers within 90 cells.
  - Miners' Hut: +6 miners.
  - Pump: drains water within 11 cells.
- **Upgrades** (shop): Shovels (miners 40% faster), Drill Bits, Dynamos, Steel Plating, Belt Feed (MG), Big Pumps.
- **Threats** (`EVENTS`, director in `updateDirector`; ramps up from the first attack at 40 s, steady shelling from 60 s, 15–38 s between waves):
  - barrage, heavy guns, storm (rain), raid (infantry that sap down), tremor
  - **enemy tunnellers** (hidden gallery toward a generator, mine with a 6 s fuse; stopped by digging into them, MG fire or shells)
  - meteor
  - **giant meteor** after the 5th wave and every 6th after that
  - **bunker buster** when any column has 8 or more concrete cells
- **Shell targeting**: shells only land over the player's works (`columnWeights`). Hits on soil leave a 20% smaller hole: 40% stays ground, 40% becomes loose soil (some thrown up), 20% vanishes.
- **Trench War** (menu button):
  - Multiplayer for 2–4 phones. PeerJS/WebRTC (`web/peerjs.min.js`, public 0.peerjs.com broker); the host's peer id is `sapper-war-<CODE>` and the host relays.
  - Each phone runs its own bunker on the same seed. Phones exchange `status` (1 s), a `snap` (run-length-encoded cells plus entities, every 0.5 s), `attack`, and `dead`.
  - Tabs, or swiping on a rival page (an edge swipe on your own page), move between bunkers. A rival page zooms onto their generators with an attack tray: BARRAGE 60, RAID 80, TUNNEL 90, HEAVY 130, METEOR 220.
  - There are **no AI attacks** in a war; the only attacks are ones players send. The attack tray reacts on `pointerdown`, because iOS doesn't fire delegated clicks on plain divs. Last generator standing wins; a fallen player can "Watch the others".
  - Test with `tests/trench-war.js` (serve `web/` on :8799 first; headless pauses background tabs, so the test ticks them by hand). Code is in the `// ---------- TRENCH WAR` section.
- **Modes**: Boot Camp tutorial (runs automatically the first time, skippable), Daily Challenge (seeded map + attack order, per-day best), Debug menu (Pause → Debug: fire any event, +gold, god mode, etc.).
- **Score and share**:
  - Score = time×5 + waves×100 + kills×25 + meteors×150 + mined/2.
  - Game over builds an **animated 720×900 GIF**: the last ~6 s at 8 fps, cell-snapped, palette taken from the replay. It's shared on its own via the share sheet, with the caption copied to the clipboard.
- **UI hints**: the "DRILL ◆10" and "TAP ⚡" labels hide for good once used (`localStorage sapper.learned`).
- **Look**: dark gritty WW1, with rooms as Vietnam-style dug-out chambers (bare dark earth behind). Pixel art with lighting: lamps, helmet lamps, fire, flares. Depth darkens with a floor at 0.34 ambient, plus a green Glow tint deep down.

## Feedback history (keep honouring it)
- Digging was too fiddly: marking plus miners replaced finger digging. Miners were too squat, then too few (raised 3 → 6).
- The tray drag was janky, so the tray became fixed-width with drag-out items, and concrete became a toggle.
- He hated the hard depth line → the Glow. Generators were stackable to win → crowding rule and richer deep ore.
- Wants **neat rows** of same-size buildings, all lined up on the same pad.
- Wants rooms built by miners, not plopped in; propped first so soil doesn't fall.
- The share image was text-only on iOS → share the image alone. The GIF was low quality, then janky; both fixed.
- Text is too small on a phone → keep fonts ≥14 px and labels short.
- Friends found it too easy at times and too hard at others. The current pacing is the agreed balance. Change difficulty only when asked, and report idle survival time.

## Backlog (ideas he's seen; build on request)
- **Water in drill shafts**: the drill pumps its own shaft, and pumps drain a whole connected pool. This was recommended and he leaned toward it but hasn't confirmed.
- **Game-over cause**: "last generator flooded / mined / shelled" plus a warning when only one generator is left. Offered, awaiting a yes.
- Rivals via share links (no server), Game Center when the native app ships.
- Sectors/levels: Flanders mud, chalk, mountain pass (more attack area, less gold), desert.
- Mine the enemy trench (an enemy you can attack), which is the path to multiplayer: seeded challenges → local co-op over MultipeerConnectivity → head-to-head tunnel war.
- Gas attacks, supply drops, day/night, morale, boss events (tank, zeppelin), relics, weather, more room types (Workshop, Canteen, Barracks, Signal Room).
