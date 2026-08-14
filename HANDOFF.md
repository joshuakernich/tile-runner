# Tile Runner — Handoff (for continuing level design in a new chat)

This doc is written so a fresh Claude session can pick up **level creation** without re-deriving anything. Paste it (or point the new chat at the project doc `claude/HANDOFF.md`) at the start of a new conversation.

_Last shipped: **v4.4**, service-worker cache `tile-runner-v45`, **21 levels**._

**Local project directory:** `/Users/josh/Documents/tile-runner` (on `joshuas-macbook-air-local`). This is a git repo — all the files below live here. In a new chat, connect this folder so Claude can read/write it directly.

---

## What this is

**Tile Runner** is a single-file HTML5 canvas puzzle game. A runner auto-runs forward; it never stops. The player has **3 reusable track tiles** and drags them to lay track ahead. When the runner passes a tile, that tile frees up and can be re-dragged to the front — so a whole level is solved by cycling just 3 tiles. Reach the exit flag to win.

Everything is in **`index.html`** (game + logic + audio, one file). **`sw.js`** is the service worker (offline cache).

## Files in this folder

| File | What it is |
|---|---|
| `index.html` | The whole game. Level data lives in a `const LEVELS = [ … ]` array near the top (~line 250). |
| `sw.js` | Service worker. `const CACHE = "tile-runner-vNN"` must be bumped every ship so clients fetch fresh. |
| `level-editor.html` | Visual level editor (open in a browser). Paint walls/stones, drag every element, exports the exact `levels.js` format. Autosaves to the browser. |
| `stone-generator.html` | Design reference that renders the 3 stone crack variations × 3 damage states. Not needed to make levels; keep for tweaking stone art. |
| `levels.js` | The current 21 levels as a CommonJS module (source of truth, mirrors what's in `index.html`). |
| `TILE-REFERENCE.md` | Older feature reference (some parts predate the manual levels; treat this HANDOFF as authoritative). |

## The workflow (how to create levels in a new chat)

1. Open **`level-editor.html`** in a browser. Design a level (or edit an existing one from the Load dropdown). It autosaves as you go.
2. When ready, click **“Copy full levels.js”** (or Download). This gives the complete levels array.
3. Paste it to Claude and say “ship these.” Claude will:
   - Write the array into the `const LEVELS = [ … ]` block in `index.html` (stripping the `n` field — the game indexes by array position),
   - Bump `const VERSION = "vX.Y"` and the `sw.js` cache string,
   - Deliver the updated `index.html` + `sw.js`.
4. Drop those two files in place and reload. (The editor also has a live “reachable ✓ / UNREACHABLE ✗” check per level.)

The editor’s reachability check only tests **walls** connect start→goal; it ignores sliders/saws/keys (those are timing/logic, validated in play). Ask Claude to run the deeper checks (below) if a level uses them.

---

## Level data format

Coordinates are `[col, row]`, origin **top-left**. One level object:

```js
{
  n: 7,                       // level number (editor-only; game ignores it, uses array order)
  start: [c, r],              // runner's start cell (pre-laid tile #1)
  init: [[c,r], [c,r]],       // the two other pre-laid tiles; init[1] is the HEAD (runner's front)
  goal: [c, r],               // exit flag
  cols: 8, rows: 8,           // board size
  intro: ["block"],           // which mechanic intro pop-ups to show on entry (see list below); [] = none
  walls:  [[c,r], …],         // impassable metal plates (static)
  blocks: [{axis:'h'|'v', r|c, lo, hi, pos0}],     // movable "sliding wall" (optional)
  hazards:[{kind:'saw', axis:'h'|'v', c|r, lo, hi, speed}],  // saws (optional)
  doors:  [[c,r,"#hex"], …],  // colored key-doors (optional)
  keys:   [[c,r,"#hex"], …],  // colored keys (optional; a key opens the door of the SAME hex)
  stone:  [[c,r,hp], …],      // breakable stone blocks, hp = taps to smash (optional)
  platforms:[[c,r,"ns"], …]   // fixed FREE track cast into a wall plinth (optional)
}
```

Notes / gotchas that matter for design:

- **Pace is fixed** at `0.8` tiles/sec for every level (`DEFAULT_CPS`). No progressive speed ramp, no progressive board-size growth. Keep maps “just big enough” for the puzzle, but **≥ 5×8** so they fill the screen.
- **The 3 pre-laid tiles** are `start`, `init[0]`, `init[1]`. `init[1]` (the head) seeds the runner’s heading — point it toward where you want the runner to go first.
- **No U-turns.** The runner can’t re-enter the cell it’s on or the one it just left (foldsBack rule). So a **dead-end pocket doesn’t work** — the runner must be able to *flow through*. A key/coin/etc. must sit on a pass-through path, not at the end of a spur. To make the runner “come back,” give it a loop (e.g. an open band it can serpentine through).
- **Sliding block (`blocks`)** gates a 1-wide gap. The block sits on the *mouth* (`pos0`) and slides along its rail (`lo..hi`) into a **dead-end nook** that is walled on the goal-ward side (no bypass). A block **cannot** sit inside a bare wall gap — it needs that side nook to slide into. Verify: block-on-mouth must disconnect start↔goal; sliding it off must reconnect.
- **Saws (`hazards`)** are **timing** hazards, not reachability blockers — you *can* now lay track across a saw’s rail (as of v3.4). `axis:'h'` moves along row `r` between cols `lo..hi`; `axis:'v'` along col `c` between rows `lo..hi`. `speed` = ms for one direction (full period = 2×speed). The runner dies only if it shares the saw’s cell at that instant.
- **Keys & doors** match by **color hex**. Default door color and default key color differ, so **always set matching hex** on a pair (e.g. both `"#ffd24a"`). The exit unlocks once *all* keys are held; each door opens when its color key is collected. A door tile is a wall until opened; dropping a tile on an opened door clears its padlock with a sound.
- **Stone (`stone`)** blocks tile placement until smashed by tapping; `hp` = taps (1–3 typical). Crack art is keyed to **remaining hp** (3 = light wear, 2 = one fissure, 1 = shattered), with 3 random variations per stone.
- **Platforms auto-link, so never leave an OPEN cell with two platform mouths facing it.** `linkParkedTiles` checks platforms before parked tiles and takes the first match in array order, so the runner is *forced* onto a platform the moment one touches the front — the player gets no say. Two candidates at once looks like randomness. A platform's own two ends are fine (one is always behind the runner). Corollary for verification: plain reachability BFS is not enough, because it will happily route through a turn the engine would override — model the forced chain (see `claude/` scratch scripts or ask for `forced.js` again).
- **Fixed platform (`platforms`)** is pre-laid track bolted into the level: the cell is a **wall for placement** (you can never drop a tile on it) but the runner **rides it for free**, spending nothing from the 3-tile pool, and it never wears out — a level can legitimately route the runner back across the same platform on a later loop. The third field is its **shape**: exactly two compass connectors, `"ns"`/`"ew"` for a straight or `"ne"`/`"es"`/`"sw"`/`"wn"` for an elbow. The path may only enter or leave through a drawn end — a tile parked against a closed face simply never links, which is the whole puzzle. A platform touching the track's front **latches on by itself** (there's nothing to place), so it can steal a route you wanted: check what's adjacent to the front before you place. The editor's reachability check is connector-aware, so it will catch a platform pointed the wrong way. **Art:** deliberately just the rail line in a recessed groove on the steel plate — no coloured body fill, so the plinth stays visible and it never reads as a tile you could have placed. Live vs idle lives entirely on the line (dim → bright + bloom), never as a wash over the cell.

### Mechanic intro keys (`intro`)
`recycle`, `turn`, `offscreen`, `wall`, `block`, `saw`, `key`, `door`, `stone`, `platform`, `mdoor`, `coin`, `boost`, `slow`, `crumble`, `switch`, `monster`, `slider`. Put the key on the first level that teaches that mechanic; leave `[]` otherwise.

---

## Current 21 levels (curriculum)

1–3 movement basics (recycle / turn / off-screen goal) · 4–7 walls (single gap → 3 gaps → cross-maze → 8×8 room maze) · 8–11 sliding blocks (intro → 3 gates → vertical climb → 14×14 room maze) · 12–14 saws (one sweeper → 3 stacked → 4-saw cross) · 15–16 keys & doors (intro → 2×3 room puzzle, two color pairs) · 17–18 stone (intro → stone maze) · 19–21 fixed platforms (intro, then two that route the runner through chained elbows).

## Win screen (as of v4.4)

No score, no stars. Clearing a level shows the heading plus one **backhanded compliment**, drawn from `WIN_QUIPS` (first attempt) or `WIN_QUIPS_RETRY` (`state.attempts > 1`) — add to those arrays to add jokes. Clearing the **last** level shows "That's All of Them" and a **Level Select** button that opens the levels menu instead of silently wrapping round to level 1. The level grid marks cleared levels with a green ✓ (`best["L<i>"] = {done:true}`); the old `{score, stars}` records still read as cleared, so existing saves aren't wiped. The scoring internals (`computeScore`, `par`, combo, coins) still run — they're simply no longer displayed.

## Mechanics that EXIST in the engine but aren’t introduced yet
These already render + work in code — “introducing” one is pure level design:
- **coin** — optional score pickup, off the main route.
- **boost** / **slow** pads — timed ×1.8 / ×0.5 speed.
- **crumble** — fragile floor; the tile laid on it is consumed from your 3-tile pool once passed (resource pressure).
- **switch door (`gates`)** — colored sliding door opened by tapping arcade buttons wired to it.
- **manual sliding door (`mdoors`)** — two-panel door you drag both halves apart (no key/switch).
- **flying monster (`hazards` kind `monster`)** — patrols a waypoint path, pausing at corners; fatal.
- **sliding platform (`sliders`)** — a wall band with a single crossing point you drag along a rail; distinct from `blocks`, which plug a tunnel. Has its own intro copy already written.

Also never set on any level: **`cps`** (per-level pace override — everything runs the `0.8` default, and the `speed` intro pop-up can therefore never fire), **`par`** (scoring par time, all default `24000`), **`goalDir`** (flag facing), and **`loop`** on monster paths.

Note the **authoring gap**: `level-editor.html` can paint walls, stones, platforms, blocks, saws, keys and doors. The in-game editor (pause → Level Editor) covers coin/boost/slow/crumble. Nothing can author `gates`, `mdoors`, `monster`, `sliders`, `cps` or `par` — those are hand-written JSON until an editor grows the tool.

Natural next intros: platform→(coin/boost/slow), then crumble, then the two remaining door types, then monster as the capstone hazard.

## Shipping mechanics (for Claude)
- `LEVELS` array is in `index.html` (~line 250). Replace it wholesale from the editor export (strip `n`).
- Bump `const VERSION = "vX.Y"` (shown on title/menu) and `sw.js` `CACHE = "tile-runner-vNN"` **every** ship.
- Deliver `index.html` + `sw.js`. For editor/tool changes, re-deliver those files too.
- Optional verification scripts (headless, in the working dir during the original build): BFS head→goal reachability, and slider-essentialness (block-on-mouth must disconnect). Re-create as needed; the editor covers wall reachability inline.

## Verify with a browser
Playwright + the preinstalled Chromium at `/opt/pw-browsers/chromium` was used to boot-test and screenshot. Boot the game headless, watch for `pageerror`, and use the level-select menu (pause → Levels) to jump to a specific level for a screenshot.
