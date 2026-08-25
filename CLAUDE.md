# Tile Runner — working notes for Claude Code

A single-file HTML5 canvas puzzle game. A runner auto-runs and never stops; the player has
**3 reusable track tiles** and drags them to lay track ahead. When the runner passes a tile it
frees up and can be re-dragged to the front — so a whole level is solved by cycling three tiles.

Everything is `index.html` (game, logic and audio, one file). No build step, no framework, no
dependencies. `HANDOFF.md` is the long-form design doc — read it before touching level data,
saw timing, the platform system, or the audio engine.

## Run it

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

Serve it rather than opening the file directly: the service worker and the manifest need a real
origin. Open the `*-lab.html` tools straight off the filesystem if you prefer — they're standalone.

## Check it

```sh
node tools/check.mjs           # static: syntax, the three parity checks, level sanity. No deps.
python3 tools/check_browser.py # headless: boots all 24 levels + every tool, fails on page errors
```

Run both before every ship. The static pass is instant. The browser pass needs
`pip install playwright && playwright install chromium`; it skips cleanly if Playwright is absent,
and it's the one that catches a renamed function whose call site you missed — `node --check` only
proves a file *parses*.

## Ship ritual

Every ship, without exception, bump **both**:

- `const VERSION = "vX.Y"` in `index.html`
- `const CACHE = "tile-runner-vNN"` in `sw.js`

The service worker is network-first, but its precache only refreshes when `CACHE` changes. Miss the
bump and installed home-screen copies keep serving the old icons and manifest.

## Files

| File | What it is |
|---|---|
| `index.html` | The whole game. `const LEVELS = [ … ]` near the top; `const RUNNER = { … }` above `drawRunner`; the `Sound` module around line 300. |
| `sw.js` | Service worker. Bump `CACHE` every ship. |
| `levels.js` | The campaign, and the only copy of it. Loaded by the game and the editor as a `<script src>`, and by Node via `require()`. |
| `level-editor.html` | Visual level editor. Level list on the left (drag to reorder — that renumbers the campaign), map in the middle (drag its edges to resize), tool matrix on the right. **Save to levels.js** writes the real file via the File System Access API. Autosaves drafts to `localStorage`. |
| `runner-lab.html` | Live editor for the runner. A slider per `RUNNER` key, onion skin, stride scrub, guides, real-size previews standing on real track. **Copy RUNNER block** → paste wholesale. |
| `icon-lab.html` | App-icon composer. Exports `icon-1024/512/192/180.png` named for the manifest. |
| `music-lab.html` | Backing-track editor with per-level overrides and a piano roll. Not yet wired into the game. |
| `coin-lab.html` | The golden coin: float, rock, shine and its inscribed panel. **Copy COIN block**. |
| `eye-lab.html` | The one pair of eyes every face wears — runner, monsters, walls, stones. **Copy EYES block**. |
| `talisman-lab.html` | The five charms: loop, inscribed panel, raised icon. **Copy TAL block**. |
| `crumble-lab.html` | The **Singularity** — the hole in the floor that swallows the tile you cross it on. Sliders for the swirl, the eye and its tremble. **Copy RIFT block**. (The file and the block still say crumble/rift; the mechanic was renamed and they were not.) |
| `radius-lab.html` | The one corner radius. Drives the **running game** in an iframe over a board carrying one of everything — free tiles, walls, stone, doors, platforms, the rift, monsters — via `__TR.tile()` and `__TR.demo()`, so it shows the shipped renderer rather than a copy that can drift. **Copy radius line**. Must be *served*, not opened off the filesystem. |
| `tile-lab.html` / `junction-lab.html` | The laid tile's cross-section and the leading tile's 3-way junction. **Copy TILE / JUNCTION block**. |
| `stone-generator.html` | Design reference for the stone crack art. |
| `tools/` | The two check scripts. |

## Traps

Each of these has actually bitten. They are not hypothetical.

**`RUNNER` exists in three files.** `index.html` (`RUNNER`), `runner-lab.html` (`SHIPPED`) and
`icon-lab.html` (`RUNNER`). They're meant to be pasted between each other whole, never hand-patched.
Drift is silent — the labs happily show you a runner the game no longer draws. `tools/check.mjs`
diffs all three.

**Level data now lives in ONE file.** `levels.js` is loaded by both `index.html` and
`level-editor.html` with a plain `<script src>`, so there is nothing to keep in sync — the old
`LEVELS`/`EMBEDDED` copies are gone. The file is dual-format on purpose: `var LEVELS_DATA = [...]`
for the browser, `module.exports = LEVELS_DATA` for `require()`. Two consequences: the game must be
**served**, never opened off the filesystem, and `levels.js` has to stay in `sw.js`'s precache or
the campaign is empty offline. `tools/check.mjs` guards both, and fails if either page grows its
own inline copy again.

**No U-turns.** The runner can't re-enter the cell it's on or the one it just left (the `foldsBack`
rule). A dead-end pocket therefore doesn't work — the runner must be able to *flow through*. This
makes "reachable" ≠ "collectable": a plain BFS will happily route through a talisman the engine can
never actually reach. Three of the six talismans were placed wrong for exactly this reason.

**Platforms force the runner.** Fixed platforms auto-link and *override* the player's chosen route,
so a route found by ordinary reachability search may be one the engine would override. Validating a
platform level needs the forced-chain BFS described in `HANDOFF.md`.

**Pace can make a saw level unsolvable**, and slower is sometimes harder — a slow runner dwells in
each column longer than a saw takes to sweep it, so it can never get ahead. Level 24 has been
simulated at every speed; don't retune a saw level's `cps` casually. `HANDOFF.md` has the numbers.

**`cps` is a *starting* pace.** Since v6.3 every cleared tile adds `RAMP_PER_TILE` (0.005 tiles/sec),
capped at `RAMP_MAX_CPS` (3.0). A 40-tile level ends 0.2 faster than it began.

**The app icon is declared `purpose: "any maskable"`**, and Android crops maskable icons to roughly
the centre 80% circle. At the shipped `tileSize: 0.765` the tile's corners fall outside that circle.
Everything that matters survives; just don't be surprised.

## Working with Josh

- **He designs the levels, not you.** He builds them in `level-editor.html` and pastes the JSON.
  Don't invent level layouts unless he asks.
- **Don't play-test his level designs.** He verifies those by hand. Static validation (parity,
  bounds, solvability maths) is welcome; simulated playthroughs of his layouts are not.
- **He tunes the runner, the icon and the music in the labs** and pastes the resulting block back.
  Your job is to commit it to all the files that carry a copy, and to verify they match.
- **Show a rendered preview**, not a PNG diff, when he asks to see something before it ships.
- Flag it when you change something he didn't ask for, and say why.
