# SAPPER — Hold the Line

A falling-sand bunker survival game set in WW1-style tunnels. You dig, brace and build underground, and keep your generators running through shellfire, floods, raiders, enemy tunnellers and meteors. Lose every generator and the line falls. It plays in portrait on a phone and works offline once you add it to the home screen.

**Play:** https://jonathanwilson1.github.io/Sapper-iOS/

## Modes
- **Dig In:** endless survival. The attacks get heavier the longer you last.
- **Boot Camp:** a guided first game. It runs automatically the first time and you can skip it.
- **Daily Challenge:** the same map and attack order for everyone, once a day.
- **Trench War:** 2–4 players, each on their own phone. Swipe over to your rivals' bunkers, spend gold shelling them, and the last generator standing wins.

## How to play
- **One finger** marks earth to dig. Miners from your Miners' Hut dig it out.
- **Two fingers** scroll and pinch-zoom.
- **ROOM** builds generators, pumps, huts, a field hospital, mine heads, magazines and listening posts. Miners dig out and build each one.
- **PROP** braces tunnels, and **CONCRETE** (tap to toggle) draws blast-proof walls.
- Tap the **drill** to bore down; tap a **generator** to overcharge it.

## Code
Plain HTML, CSS and JavaScript with no build step. [ARCHITECTURE.md](ARCHITECTURE.md) maps the files. Tests are in `tests/`.

The iOS shell (`Sources/`, `project.yml`, XcodeGen) wraps `web/` in a WKWebView, adding haptics and the native share sheet.
