# How SAPPER works

A plain web page: `web/index.html` (the screens), `web/css/style.css`, and 13 scripts in `web/js/`. There's no build step and no framework.

The scripts are ordinary `<script>` tags, loaded in the order `index.html` lists them, and they **share one global scope**. So a `let gens` in `core.js` is the same variable everywhere. Anything a file does at the top level may only use things defined in itself or in an earlier file; function bodies can use anything.

| File | What it owns |
|---|---|
| `core.js` | Build id, cell materials and their property tables, the world arrays, seeded noise, colours, map generation and the starting base |
| `buildings.js` | Generators (income, the Glow, crowding, overcharge), ore value, the drill, bulkhead hatches, upgrades, rooms, construction sites, `place()` / `stampFor()` |
| `physics.js` | Ceiling support map, the cell automaton (sand, rubble, water, soil collapse, fire), falling rock bodies, `explode()` |
| `combat.js` | Shells and meteors (incl. buster and driller), raiders, enemy tunnellers, pumps and MG nests, particles |
| `miners.js` | Dig marks and zones, miners (BFS pathfinding, digging, building), medics, wounded miners |
| `director.js` | Boot Camp tutorial steps; the attack director (`EVENTS`, timing, rain) |
| `render.js` | Camera and zoom, the world renderer with lighting, entity sprites, overlays, the dig loupe, the minimap |
| `ui.js` | Synthesised sound (`sfx`), toasts and banners, tray and HUD, all touch/mouse input |
| `flow.js` | `startGame()`, `gameOver()`, pause/resume, menu |
| `share.js` | Replay capture, the GIF encoder, the share card and Share button |
| `multiplayer.js` | Trench War: lobby, PeerJS messages, bunker snapshots, rival pages, attacks |
| `debug.js` | Debug menu (shown after visiting the page once with `?debug`), plus wiring for every menu button |
| `main.js` | Title art, the main loop (`frame` → `update` / `render`), update check, the `window.__sapper` test hook, start-up |

## One frame
`frame()` runs `update()` at a fixed 60 ticks a second, then `render()` once.

`update()` runs these in order:
1. `stepSim()` (cells)
2. support map
3. rock checks
4. falling bodies
5. shells
6. soldiers
7. machines
8. particles
9. generators
10. drills
11. rooms
12. medics
13. hatches
14. miners
15. network tick

In play it also processes dig marks and runs the director.

## The world
- The grid is `W×H` = 192×440 cells, indexed `i = y*W + x`. Rows 0 to about 44 are sky.
- Per-cell arrays (all `Uint8Array(W*H)`):

  | Array | Holds |
  |---|---|
  | `g` | material id: `E SOIL SAND ROCK WATER TIMBER BAGS CONC GOLD RUBBLE FIRE HQ(generator) PUMP MG BED GRASS LAMP DRILL ROOM DOOR` |
  | `hp` | dig progress or fire life |
  | `sh` | colour noise per cell |
  | `st` | "already moved this tick" stamp |
  | `bgc` | back-wall type |
  | `sup` | whether the ceiling here is supported |
  | `prop` | background timber bracing |
  | `ladder` | 1 = rail, 2 = rung |
  | `secret` | hidden enemy tunnel |
  | `mark` | dig order |
  | `zone` | area the player asked to keep dug |

- Material behaviour comes from tables indexed by material id: `SOLID`, `RES` (blast resistance), `HARD` (blast threshold), `DIGT` (dig time; 0 = not diggable), `SUPPORTS`, `PAL` (colour).
- The things that move or act are entity lists: `gens rooms diggers medics soldiers shells flashes particles pumps mgs drills doors sites`.

## Adding things
- **A material:** add an id in `core.js`, extend `NT` and every table, add a colour, and give it behaviour in `stepSim()` if it moves.
- **A room:** add it to `ROOMDEFS` (`buildings.js`), give it an interior in the room drawing in `render.js`, and put its effect in `updateRooms()`.
- **A threat:** add it to `EVENTS` (`director.js`). For Trench War, add an entry to `ATTACKS` and a branch in `incomingAttack()` (`multiplayer.js`).
- **An upgrade:** add it to `UPGRADES` and read `up.<id>` where it applies.

## Multiplayer (Trench War)
- **Connection:** PeerJS. The host's id is `sapper-war-<CODE>`; the others connect to the host, and the host relays.
- **Own game, shared seed:** each phone simulates only its own bunker, on the same seed.
- **Messages:**
  - `status`: once a second.
  - `snap`: run-length-encoded cells plus entity tuples, every 0.5 s; the whole map every 5 s.
  - `attack` and `dead`.
- **Untrusted input:** everything received is cleaned (`cleanName`, `validId`, `cleanEnt`) before use.
- **Rival pages:** to draw one, `renderRival()` temporarily swaps their cells and entities into the globals, calls the normal renderer, and swaps yours back.

## Testing and publishing
- `tests/`: headless Chrome and WebKit scripts (`npm i`, then `node <test>.js`; `trench-war.js` needs `web/` served on :8799). Read the results before publishing.
- `scripts/deploy.sh`: copies `web/` to the `gh-pages` branch and stamps the build id in `js/core.js`. The live site is https://jonathanwilson1.github.io/Sapper-iOS/
- `sw.js`: makes the home-screen app work offline. **Any new file must be added to its `FILES` list.**
- iOS shell: `Sources/SapperApp.swift` + `project.yml` (XcodeGen) bundle the whole `web/` folder into a WKWebView.
