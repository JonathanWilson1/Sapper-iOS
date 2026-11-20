# SAPPER — Hold the Line (prototype 0.1)

A WW1 underground-bunker survival game built on a falling-sand simulation. It's portrait-only with vertical scrolling and works fully offline.

- **Play in a browser:** open `web/index.html` (the whole game is one file).
- **Run on iOS:** `xcodegen generate`, open `Sapper.xcodeproj`, then run. It's a SwiftUI + WKWebView shell that bundles the HTML and bridges haptics.

## Loop
You get timed survival. Keep the Command Post alive while the director escalates the events: artillery barrages, heavy guns that penetrate the ground, storms that flood the tunnels, infantry raids (the raiders sap their way down to you), tremors, and meteors.

## Materials
| Material | Behaviour |
|---|---|
| Soil | Stable, but ceilings crumble into rubble unless braced within 6 cells |
| Sand | Pours. You can only hold it back with walls |
| Rock / Gold | Slow to dig. Gold ore pays ◆ |
| Water | Flows, seeps slowly into soil, and drowns the post. Aquifers sit deep |
| Timber / Bags / Concrete | Braces ceilings and absorbs blasts (the blast ray-march sums each material's resistance) |

Gold is the brake on overbuilding. You earn it by mining ore, from a slow passive supply, by holding each wave (+15) and by killing raiders (+3).

## Research notes
- **Fallout Shelter:** a vertical underground base plus incidents. This is the closest loop to Sapper.
- **Noita, Sandustry, Deepfall, Pound Sand:** falling-sand worlds. None of them are bunker defence on mobile.
- **Motherload:** dig down for ore, with risk rising as you go deeper.
- **Worms, Dig In, Trenches (iOS):** WW1 trench fantasy and destructible terrain.

## Next steps
- **Local 2-player:** MultipeerConnectivity (Bluetooth/peer Wi-Fi) in the native shell. The host runs the sim and streams the dirty rows, and each player controls one sapper character.
- A controllable sapper character (Worms-style flamethrower/shovel).
- Upgrade tree, more node types (ammo dump, generator), an app icon, and a Game Center leaderboard for survival time.
