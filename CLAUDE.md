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
| `copy.js` | Every line the game **says** that is not part of a level: the mechanic cards, and the headings and bylines on a fall, a pause and a clear. Same dual-format arrangement as `levels.js`, same reasons, and edited on the editor's **Copy** tab. Chapter verses are *not* here — they belong to their level. |
| `level-editor.html` | Visual level editor, on two tabs. **Levels: Level list on the left (drag to reorder — that renumbers the campaign), map in the middle (drag its edges to resize), tool matrix on the right. **Save to levels.js** writes the real file via the File System Access API. **Copy:** every line of writing outside the levels — mech cards, fall, pause, clear — writing `copy.js` through the same machinery under its own file handle. Both tabs autosave drafts to `localStorage`. |
| `runner-lab.html` | Live editor for the runner. A slider per `RUNNER` key, onion skin, stride scrub, guides, real-size previews standing on real track. **Copy RUNNER block** → paste wholesale. |
| `icon-lab.html` | App-icon composer. Hands the **running game** a canvas and a size and lets it paint the icon with the board's own routines — the cosmos, two tiles and the runner mid-stride — so the icon can't drift from the game. Exports `icon-1024/512/192/180.png` named for the manifest. `tools/check.mjs` fails if this page ever grows its own copy of the art again. |
| `music-lab.html` | Backing-track editor with per-level overrides and a piano roll. Not yet wired into the game. |
| `coin-lab.html` | The golden coin: float, rock, shine and its inscribed panel. **Copy COIN block**. |
| `eye-lab.html` | The one pair of eyes every face wears — runner, monsters, walls, stones. **Copy EYES block**. |
| `talisman-lab.html` | The five charms: loop, inscribed panel, raised icon. **Copy TAL block**. |
| `crumble-lab.html` | The **Singularity** — the hole in the floor that swallows the tile you cross it on. Same iframe pattern: six of them on a three-column board with the runner crawling up the middle, so every hole is the size it is in a level. The tile carries no colour at all: three black plates inset into the cell, sub-tiles off a grid cut across the whole cell that appear on the tile's rim and are pulled smoothly to the middle, one sheet of the game's grain over the lot, and a white-to-yellow glow behind it that is the only thing allowed past the cell's edge. Sliders for the three insets and their inks, the draw, the glow, and a tremble that scales by size so the outer plate never moves and the smallest things move most. **Copy RIFT block**. Must be *served*. (The file and the block still say crumble/rift; the mechanic was renamed and they were not.) |
| `radius-lab.html` | The one corner radius. Drives the **running game** in an iframe over a board carrying one of everything — free tiles, walls, stone, doors, platforms, the rift, monsters — via `__TR.tile()` and `__TR.demo()`, so it shows the shipped renderer rather than a copy that can drift. **Copy radius line**. Must be *served*, not opened off the filesystem. |
| `hammer-lab.html` | The **Hammer's beam** — the line of tiles the Hammer of God throws. Drives the running game in an iframe over a pen of stone with the runner crawling in the middle of it, swinging on a loop; eight buttons aim the swing so a diagonal doesn't mean steering him into a corner. Sliders for the pixel grid, the lane weights, the ripple and the timing. **Copy HAMMER block**. Must be *served*. |
| `bell-lab.html` | The **Bell of Unmaking** — the sweep it turns around the runner. Same iframe pattern: a field of stone the Bell can't break, so the circle always has something to fall across, ringing on a loop. Sliders for the circle, the sweep, the weight and the tones, and a **Check what it unmakes** button that stands monsters at one, two and three tiles and reports which survived. **Copy BELL block**. Must be *served*. |
| `tiloid-lab.html` | The **Tiloid's two sides** — the charms cut into the standing solid, and the chapters revealed as it unfolds. Parks the story on a frame you scrub to and pushes `SIGIL` (the panel and the mark) and `TILOID` (which side you are looking at, and when it turns over) into it live. A **warped / flat** switch puts the lattice warp beside the old single-affine map that sheared the mark off the face. **Copy SIGIL block** — it writes both blocks. Must be *served*. |
| `magnet-lab.html` | The **Lodestone's field** — the reach it pulls coins in from, drawn as rings falling inward through the world's own quarter-tiles. Iframe pattern: coins on a lattice around a crawling runner, in and out of reach, pulling on a loop, with a button that puts the coins back. **Copy MAGNET block**. Must be *served*. |
| `spare-lab.html` | The **spare tile** — the disconnected tile a level leaves lying out, unusable until the track reaches it. Drives the running game in an iframe over a three-column board carrying two spares, crawling at 0.05 tiles/s so it holds still. Sliders for the red wash, the dots and the breath, six presets, and a button that plays the claim sound. **Copy SPARE block**. Must be *served*. |
| `pile-lab.html` | The **heap** at the bottom of a fall — everyone who died on this chapter. Iframe pattern: it walks the runner off the end of a stub of track and then holds the landing clock just short of the words, so the mound is on screen the whole time you tune. Every body in it is drawn **body only** — no legs, no kicks, just the square and its eyes, which is what lets the rows pack without a thicket of shins across the gaps. Sliders for the stacking, the bodies, how they lie and the cold wash, plus four buttons that stage the heap at the 1st/4th/7th/10th death. **Copy PILE block**. Must be *served*. |
| `tile-lab.html` / `junction-lab.html` | The laid tile's cross-section and the leading tile's 3-way junction. **Copy TILE / JUNCTION block**. |
| `stone-generator.html` | Design reference for the stone crack art. |
| `tools/` | The two check scripts. |

## Every lab saves your settings

Each lab writes its own controls to `localStorage` under `tilerunner:<lab-name>` as you move
them, puts them back when the page opens, and carries a **Restore** button for after you have
wandered off into the presets. **Reset** goes back to the shipped block; **Restore** goes back to
yours. Where a Reset used to delete the autosave (icon-lab did), it now copies it to
`tilerunner:<lab>:kept` first, so Restore can still reach it. Build this into any new lab — it is
not a follow-up.

## Traps

Each of these has actually bitten. They are not hypothetical.

**`RUNNER` exists in two files.** `index.html` (`RUNNER`) and `runner-lab.html` (`SHIPPED`).
They're meant to be pasted between each other whole, never hand-patched. Drift is silent — the lab
happily shows you a runner the game no longer draws. `tools/check.mjs` diffs both. (icon-lab used
to carry a third copy; it now asks the game to draw the icon instead, and the checker fails if a
copy ever reappears there.)

**The writing lives in `copy.js`, the levels in `levels.js`.** Neither has a second copy. The
game loads both with a plain `<script src>`, so it must be **served**; both must stay in `sw.js`'s
precache or an offline launch comes up with an empty campaign and blank cards. `tools/check.mjs`
guards the wiring for both and fails if `index.html` grows its own `MECHS` or `*_QUIPS` back.

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
