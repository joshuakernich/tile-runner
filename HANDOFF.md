# Tile Runner — Handoff (for continuing level design in a new chat)

The long-form design doc: the *why* behind the level rules, the saw maths, the runner and the audio engine. **`CLAUDE.md` is the short operational one** — Claude Code reads that automatically every session; this is what it points at for depth. Paste this doc (or connect the folder) at the start of a new Cowork chat.

_Last shipped: **v6.6**, service-worker cache `tile-runner-v67`, **24 levels**, 6 talismans._

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
| `runner-lab.html` | Live editor for the runner's animation. Sliders for every number in `index.html`'s `RUNNER` block, onion-skin, stride scrub, real-size previews, and a **Copy RUNNER block** button. Paste its output over the block in `index.html` **wholesale**. |
| `icon-lab.html` | Composer for the app icon. Places the runner on a single tile-with-platform over a Tile Runner backdrop; drag on the canvas to move the runner or the tile, sliders for every colour and position, mask preview (square/rounded/circle), safe-area ring, live 180/120/64/32 previews, and PNG export at 1024/512/192/180 named to match `manifest.webmanifest`. The config is a flat JSON block of fractions, so one setup renders identically at every size — Copy it into the handoff when a look is settled. |
| `music-lab.html` | Live editor for the backing track, per level. Runs the game's own synth voices against an exposed parameter block, with a piano roll of the 16-step melody over the chord bars, a seed dice, per-level overrides, and an export block. Autosaves to the browser. |
| `levels.js` | The current 24 levels as a CommonJS module (source of truth, mirrors what's in `index.html`). |
| `CLAUDE.md` | Project instructions for Claude Code — the ship ritual, the check commands, the traps, and how Josh works. Claude Code reads this automatically every session; keep it short and operational, and put depth here in HANDOFF.md instead. |
| `tools/check.mjs` | Static checks, zero dependencies: every HTML file parses, the `RUNNER` block matches across all three copies, the music lab's generator still matches the game's for all 24 levels, `levels.js` matches `index.html` and the editor, every level has a valid `cps`/`intro`/bounds, and `sw.js` precaches only files that exist. `node tools/check.mjs` |
| `tools/check_browser.py` | Headless smoke test: boots all 24 levels and opens every tool, failing on any page error. Needs Playwright; skips cleanly without it. Catches what a parser can't — a renamed function with a stale call site. `python3 tools/check_browser.py` |
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
  cps: 0.88,                  // starting pace in tiles/sec — every shipped level declares one
  walls:  [[c,r], …],         // impassable metal plates (static)
  blocks: [{axis:'h'|'v', r|c, lo, hi, pos0}],     // movable "sliding wall" (optional)
  hazards:[{kind:'saw', axis:'h'|'v', c|r, lo, hi, speed, phase}],  // saws (optional)
  doors:  [[c,r,"#hex"], …],  // colored key-doors (optional)
  keys:   [[c,r,"#hex"], …],  // colored keys (optional; a key opens the door of the SAME hex)
  stone:  [[c,r,hp], …],      // breakable stone blocks, hp = taps to smash (optional)
  platforms:[[c,r,"ns"], …], // fixed FREE track cast into a wall plinth (optional)
  talismans:[[c,r,"ember"], …] // one-off collectibles (optional; ids below)
}
```

Notes / gotchas that matter for design:

- **Pace is per level** via `cps` (tiles/sec), set explicitly on all 24. As of v4.7 it **ramps 0.80 → 1.00**, stepped at the curriculum arc boundaries: 1–3 `0.80`, 4–7 `0.84`, 8–11 `0.88`, 12–14 `0.91`, 15–16 `0.94`, 17–18 `0.97`, 19–24 `1.00`. `DEFAULT_CPS` (0.8) is now only a fallback for generated/editor levels. The editor has a **speed** box that round-trips `cps`. New levels should continue the ramp or hold at `1.00`. No progressive board-size growth — keep maps “just big enough” for the puzzle, but **≥ 5×8** so they fill the screen.
- **Saw levels are timing-tuned to their pace.** 12–14 run at `0.91`; changing a saw level's `cps` shifts every collision window, so re-play them by hand after touching it. **Pace can make a saw level literally unsolvable.** Simulating level 24 (six saws, cols 3–8, rows 0–5, speed 4000) against the engine's own saw maths: with the saws **in phase** a route survives from all 32 sampled start offsets at `cps 1.00` and from **none** at `cps 0.80`; after staggering them `0 → 0.5` it was 24/32 at `1.00` and still **0/32 at `0.80`**. The shipped v5.4 layout — a taller 13×8 board, two banks of three with a clean column between them, phases `.07/.14/.21` and `.43/.36/.29` — is solvable from **32/32 offsets at every speed tested**, including 0.80, so the geometry matters as much as the phases. A slower runner dwells in each column longer than the saws take to sweep a row, so it can never get ahead — faster is not always harder here. Note the <32/32 figures mean some start offsets have *no* route, and saws keep ticking through the intro animation, so the offset at play-start isn't fixed. If a saw level ever feels randomly impossible, that's the cause; giving the saws slightly different `speed` values de-syncs them permanently and removes the cliff.
- **New levels default to the last level's pace.** The editor's "+ New blank" used to hand out `cps 0.8`, which silently broke the ramp on every new level; as of v5.0 it inherits the highest-numbered level's `cps` instead.
- **The 3 pre-laid tiles** are `start`, `init[0]`, `init[1]`. `init[1]` (the head) seeds the runner’s heading — point it toward where you want the runner to go first.
- **No U-turns.** The runner can’t re-enter the cell it’s on or the one it just left (foldsBack rule). So a **dead-end pocket doesn’t work** — the runner must be able to *flow through*. A key/coin/etc. must sit on a pass-through path, not at the end of a spur. To make the runner “come back,” give it a loop (e.g. an open band it can serpentine through).
- **Saw `phase` (as of v5.1)** is where in the ping-pong cycle a saw starts, as 0..1 of the FULL period: `0` = parked at `lo` heading for `hi`, `0.5` = at `hi` heading back, `>0.5` = returning (its `dir` starts at −1). Every shipped saw carries an explicit `phase: 0`, which is exactly the old behaviour — nothing changed in play. Without it a row of same-speed saws sweeps as one solid line, which is what makes level 24 hard; staggering them (e.g. `0, .15, .30, .45, .60, .75`) turns that line into a wave. In the editor the blade is **drawn where the saw starts**, so phase is visible at a glance; set it by dragging the blade along the rail, or by typing it in the *saw phase* box and clicking an existing saw (that re-applies both the speed and phase boxes).
- **Editing a block or saw (as of v5.0):** one click drops it on a **3-cell rail** — for a block that means a nook each side, for a saw a three-cell sweep. After that, drag either **end handle** (ringed dot) to lengthen or shorten the rail, drag it *past* the block to grow the other side, or drag it perpendicular to **rotate** the rail — the axis follows whichever offset from the block is larger. Dragging the block itself **slides it along the rail** (that sets `pos0`, its parked cell); pull it past either end or sideways off the rail's line and the whole structure moves instead — the switch is sticky for the rest of that drag. **Saws work the same way for reshaping**, except a saw has no block cell to pivot on, so an end-drag pivots on the *opposite* end and saw rails clamp to a 3-cell minimum. Dragging a saw's **blade** slides its starting phase along the rail, the same way a block slides; past an end or off the line moves the whole saw. The blade takes priority over an end handle when they share a cell — at `phase 0` the blade sits *on* the `lo` end, so end-first would make it permanently ungrabbable; slide the blade inboard and that end frees up for resizing. Both tools are now single-click — the old click-mouth-then-nook `twoClick` flow is gone. Internally the drag works in extents (cells either side of the block) so the shape survives a rotation. Two pick-order notes: the pre-laid Start/Tile/Head/Goal markers sit above blocks, so a handle underneath one can't be grabbed (move the marker first); and if you park the block *on* a rail end, the block wins that cell and that end handle goes dead — resize from the other end, or slide the block inboard first.
- **Sliding block (`blocks`)** gates a 1-wide gap. The block sits on the *mouth* (`pos0`) and slides along its rail (`lo..hi`) into a **dead-end nook** that is walled on the goal-ward side (no bypass). A block **cannot** sit inside a bare wall gap — it needs that side nook to slide into. Verify: block-on-mouth must disconnect start↔goal; sliding it off must reconnect.
- **Saws (`hazards`)** are **timing** hazards, not reachability blockers — you *can* now lay track across a saw’s rail (as of v3.4). `axis:'h'` moves along row `r` between cols `lo..hi`; `axis:'v'` along col `c` between rows `lo..hi`. `speed` = ms for one direction (full period = 2×speed). The runner dies only if it shares the saw’s cell at that instant.
- **Keys & doors** match by **color hex**. Default door color and default key color differ, so **always set matching hex** on a pair (e.g. both `"#ffd24a"`). The exit unlocks once *all* keys are held; each door opens when its color key is collected. A door tile is a wall until opened; dropping a tile on an opened door clears its padlock with a sound.
- **Stone (`stone`)** blocks tile placement until smashed by tapping; `hp` = taps (1–3 typical). Crack art is keyed to **remaining hp** (3 = one short fissure, 2 = two, 1 = all four), with 3 variations per stone. As of v4.5 the variation is **dealt round-robin** (rotated per level from the first stone's position) rather than drawn from a position hash, so any level with 3+ stones is guaranteed to show all three sets. Crack weight lives in `STONE_TUNE` at the top of the stone block in `index.html`, mirrored exactly in `stone-generator.html` — `BASE_W` is the half-width per damage state, `WOB_A`/`WOB_B` the along-length wobble (small = even hairline). There are no offshoots/spurs any more; damage reads purely as more and longer fissures.
- **Platforms auto-link, so never leave an OPEN cell with two platform mouths facing it.** `linkParkedTiles` checks platforms before parked tiles and takes the first match in array order, so the runner is *forced* onto a platform the moment one touches the front — the player gets no say. Two candidates at once looks like randomness. A platform's own two ends are fine (one is always behind the runner). Corollary for verification: plain reachability BFS is not enough, because it will happily route through a turn the engine would override — model the forced chain (see `claude/` scratch scripts or ask for `forced.js` again).
- **Fixed platform (`platforms`)** is pre-laid track bolted into the level: the cell is a **wall for placement** (you can never drop a tile on it) but the runner **rides it for free**, spending nothing from the 3-tile pool, and it never wears out — a level can legitimately route the runner back across the same platform on a later loop. The third field is its **shape**: exactly two compass connectors, `"ns"`/`"ew"` for a straight or `"ne"`/`"es"`/`"sw"`/`"wn"` for an elbow. The path may only enter or leave through a drawn end — a tile parked against a closed face simply never links, which is the whole puzzle. A platform touching the track's front **latches on by itself** (there's nothing to place), so it can steal a route you wanted: check what's adjacent to the front before you place. The editor's reachability check is connector-aware, so it will catch a platform pointed the wrong way. **Art:** deliberately just the rail line in a recessed groove on the steel plate — no coloured body fill, so the plinth stays visible and it never reads as a tile you could have placed. Live vs idle lives entirely on the line (dim → bright + bloom), never as a wash over the cell.

## Talismans (added v5.3)

Six unique collectibles: `ember` (Emberdrop), `tide` (Tidestone), `cog` (Brass Cog), `sun` (Sunwheel), `shard` (Nightshard), `sprig` (Green Sprig). Defined in one `TALISMANS` table near the top of `index.html` — id, name, colour, a `draw(g,x,y,r)` function, and **`perk: null`**, the hook for giving one a gameplay effect later without reshaping any of this. They're cosmetic today.

- **Collecting:** run over the cell and it's unlocked **forever**, even if that run then fails. Stored in `localStorage` under `tilerunner:talismans`; the worn one is `settings.talisman`. A "NEW TALISMAN" banner flashes on pickup.
- **Wearing:** menu → **Talismans** shows all six, locked ones as grey silhouettes with `???`. Click an unlocked one to wear it, click again (or "Take it off") to remove. The worn one is drawn as a pendant on a cord across the runner's chest, and rotates with him.
- **A talisman does NOT block track** — it's a floor pickup, so it never enters the occupancy set.
- **Placement is the fiddly part.** The runner can't U-turn and can't revisit a live cell, so "reachable" is *not* the same as "collectable": a cell in a far corner is often impossible to route through and back out of. Three of my first six picks failed this. Verify with a simple-path search for `head → talisman → goal` (no revisits, no U-turns, connector-aware) rather than a plain BFS. The six shipped placements are all confirmed collectable, each on a real detour: L3 `5,2`, L6 `8,1`, L10 `8,0`, L16 `7,0`, L20 `0,0`, L23 `4,7`.
- The editor has a **Talisman** tool (`T`) with a dropdown; click to place, click again to cycle which one, right-click to remove.

## The runner's animation

Everything the runner's look and motion depends on lives in one **`RUNNER`** object in `index.html`, immediately above `drawRunner` — stride speed and reach, body/leg proportions, eye placement, glance and blink cycles, the talisman pendant, and the two colours. All lengths are fractions of the cell, so he scales with the board.

Edit it with **`runner-lab.html`**: it runs a faithful copy of `drawRunner` against the same values, with a slider per knob, onion-skinned stride ghosts, a scrub slider for one step cycle, guides for the track surface / hip line / body box / knee and foot points, a talisman picker to check the pendant, and a strip showing him at real in-game cell sizes. **Each of those stands on real track** — `drawPathTile` is lifted from the game's `drawGlass` + `drawPlatformBody` + `drawPlatformRail`, so the tile, the body fill and the rail (at `cell*0.06`) all scale with the cell. That matters more than it sounds: the rail is *proportionally* much fatter under the 56px runner than the 133px one, and a leg width or foot lift that looks right against a 1px line can vanish against the real thing. Hit **Copy RUNNER block** and paste the whole block over the one in `index.html`.

**Feet lift in v5.9.** Before this the feet were pinned to `y = 0` and only their x swung, so he skated. `footLift` is the peak height of the *swinging* foot as a fraction of a cell, and `footLiftPow` shapes the arc. The rule is: a foot lifts while it travels **forward** and is planted while it travels back. Foot x is `sin(phase)`, so its direction of travel is `cos(phase)` — hence `lift = footLift * max(0, cos(phase))^footLiftPow`, with the second leg reading the same curve at `phase + PI`. That guarantees exactly one foot is up at a time and both touch down at the extremes of the stride, with no discontinuity. `footLiftPow` of 1 is a broad hump; higher keeps the foot down longer and snaps it up late.

The lifted foot is passed into `solveKnee` as a real `fy`, so the knee re-solves against the shorter hip-to-foot distance instead of the leg stretching. Turn on **Guides** in the lab to see the orange loop the foot travels in one cycle, with a ring on each foot's current position.

One thing this does *not* fix: the planted foot still slides, because foot x is a sine of the animation phase rather than being locked to ground the runner has actually covered. True no-slip planting would mean driving the foot from distance travelled, not from `stepMs` — a bigger change, and at these cell sizes the slide is not really visible once the foot lifts.

**Hips shipped in v5.8.** `hipRise` moves the hip joint **up inside the body**, as a fraction of body height — 0 puts it on the body's bottom edge (the original), 1 puts it at the top. The body itself doesn't move; the legs simply get longer upward and their tops are hidden behind the body, which is drawn after them. Two things follow from that: the leg is measured hip-to-foot, so raising the hips lengthens the stride's apparent leg without touching `legLen`, and the knee IK re-solves against the new distance so `kneeBend` still means what it says. The lab's slider stops at 0.85 on purpose — above that the leg stroke's round cap pokes out over the body's top edge.

**Knees shipped in v5.6.** `drawRunner` bends each leg with two-bone IK via `solveKnee`, controlled by `knees` (0/1), `kneeBend`, `kneeSplit` (thigh's share of the leg), `kneeLead` (extra forward push past what the IK gives) and `kneeR` (optional knee cap). Set `knees: 0` for the old straight hip-to-foot line.

The bones are sized **relative to the current hip-to-foot distance** (`total = d * (1 + kneeBend)`) rather than being a fixed length. Fixed-length bones were the obvious first attempt and they look wrong: over a stride that distance nearly doubles (about 23px to 42px at a 170px cell), so a fixed bone gives an almost-straight leg at full reach and a knee folded right under the body at mid-step. Scaling with `d` holds the knee at a constant fraction of the leg's length — 0.274 across every phase — and makes `kneeBend` mean what it says.

## The music

**One cleared tile is one beat.** There is no music clock anywhere in the game — `Sound.clearTile()` is called by the tile-clear event and fires the melody note, the bass, the kick and (every 4th beat) the pad, all at `ac.currentTime`. The hat and off-beat bass are scheduled half a beat ahead on the *audio* clock. Two consequences worth holding onto:

- **Tempo is the runner's pace**, and it can never drift out of sync, because there is nothing to drift against. `setTempo(msPerCell)` doesn't set a tempo — it only tells the sub-beat events where "half a beat" is.
- **A level's `cps` is also its BPM.** The speed ramp 0.80 → 1.00 is a 48 → 60 bpm ramp across the campaign.

`setSong(seed)` derives the song from `hashSeed(String(levelIndex+1))` — the same FNV-1a that seeds the background theme. From that one number it picks a transpose, walks a 16-note melody over a major pentatonic, and picks one of five chord progressions. Everything else — key centre A3/220 Hz, the triangle/square lead alternation, the echo send, the kick and hat tuning — is hard-coded and identical on every level.

### Subdivided lead (v6.3)

A cleared tile is still one beat, but the lead now plays **`SUBDIV` (4) melody notes per tile**. Only the note on the clear itself gets the full detuned two-oscillator `voice()`; the other three are scheduled ahead on the audio clock at 1/4, 2/4, 3/4 of a beat and drawn as a **single oscillator** at `MID_VEL` (0.42 vs 0.8). That timbre difference — two detuned oscillators beating against each other versus one dead-straight tone — is what keeps the clear reading as the downbeat now that the gaps are filled. `voice()` gained a trailing `mono` flag for it.

The melody generator went **16 → 32 notes** at the same time. At 16 the tune looped every 4 cleared tiles, which is unlistenable once the gaps are filled; 32 gives an 8-tile phrase. Both `WAVES` entries are now `sine`.

`music-lab.html` mirrors all of this (`beatsPerTile: 4`, `midVel`, sine/sine) and its piano roll draws the downbeats full-height and the in-between notes at reduced height, so you can see the 4-to-1 grouping. Parity against the game's `setSong` is re-verified across all 24 levels.

### Per-tile speed ramp (v6.3)

`RAMP_PER_TILE = 0.005` tiles/sec is added to `state.cpsNow` on every clear, and `msPerCell` is derived back from it (`1000 / cpsNow`), then handed to `Sound.setTempo` so the sub-beat notes track. `RAMP_MAX_CPS = 3.0` is a hard ceiling — past that the runner animation stops reading. A level's `cps` is now a **starting** pace, not its pace: 40 tiles adds 0.2 tiles/sec. The speed HUD went to **3 decimals** because a single tile's ramp is invisible at 2.

The combo multiplier tag is gone — `drawCombo` and `comboFlash` were deleted with it. `state.combo` still exists and still drives the score.

The **speed-up and talisman intro pop-ups** were removed in v6.3, along with `SPEED_QUIPS`, the `#mechpop.speed` CSS, and both mechanics' icon branches. `intro: ["speed"]` / `["talisman"]` are dead keys now — the shipped levels had them stripped.

### `music-lab.html`

Reproduces that generator **byte-for-byte at its shipped defaults** — verified against all 24 levels' melodies and chords — so it can be trusted as a reference, and then exposes the parts the game currently fixes: scale, chord quality, progression, key lock, swing, notes-per-tile, beats-per-chord, per-layer on/off and volume, and the whole tone section (echo, filters, kick and hat tuning). Per-level overrides are stored as a diff against the defaults, so a level's block only ever lists what it actually changes.

Ordered by how much they change the feel:

1. **scale** — `pentaMajor` is the shipped can't-sound-wrong sound. `pentaMinor` or `aeolian` reads as danger instantly; `hirajoshi` reads as somewhere else entirely. Best varied by chapter, not by level, or it stops meaning anything.
2. **layers** — muting the pad makes a level feel exposed; muting the kick makes it float. Cheaper and far more legible than changing notes.
3. **swing** — pushes the off-beat hat and bass later. Even 0.06 stops it sounding like a machine.
4. **notes/tile** — the only knob that decouples music from movement. At 2 the melody double-times without the runner speeding up, so the six levels at `cps 1.00` needn't all sound the same tempo.

**Not yet wired into the game.** `index.html` still has the original fixed `Sound` module; the lab defines the extended generator and parameter block that a `MUSIC_DEFAULTS` + per-level `music: {...}` would use. Porting it means replacing `setSong`/`clearTile` with the lab's versions and reading `L.music` in `beginLevel`.

## The app icon

**`icon-lab.html`** composes it. It re-uses the game's own drawing code, not a lookalike: `tileSurface` + `drawTile` are lifted from `drawPlatformTile`/`drawPlatformBody`/`drawPlatformRail`, and `paintRunner` carries the same `RUNNER` block and `solveKnee` the game ships. That means the icon can't drift from the game's art — but it also means the `RUNNER` block at the top of `icon-lab.html` is a **third copy** (game, runner-lab, icon-lab). If you retune the runner, paste the block into all three.

Two things worth knowing before you fiddle with it:

- **Every position and size is a fraction of the icon's width**, so one config renders identically at 1024 and at 32. Never hard-code a pixel.
- **The tile's solid body fills the side away from the running surface**, and which side that is depends on the *order* of the two directions in `SHAPES`. `ew` is `["w","e"]`, not `["e","w"]` — reverse them and the yellow fills the top half and the runner appears to be standing in a box rather than on a platform. Same trap in the game's `tileSurface`, where `entry` is the direction toward the *previous* node.

**The shipped icon** is a red field, a single east-west platform tile filling most of the square, and the runner mid-stride on the rail. Its exact config — paste into the lab's Config box and hit **Load from box** to get it back:

```json
{
 "bgStyle": "flat", "bg1": "#b42d2d", "bg2": "#241f4a", "bgAngle": 35, "stripes": 5, "vignette": 0.25,
 "tileOn": 1, "tileX": 0.5, "tileY": 0.5, "tileSize": 0.765, "tileRot": 0, "tileShape": "ew",
 "track": "#ffcf4d", "rail": "#fff2c4", "glass": 0.55, "glassCol": "#b4aeeb", "tileR": 0.16,
 "runOn": 1, "runX": 0.5, "runY": 0.5, "runScale": 0.685, "runRot": 0, "runStride": 5.38,
 "knees": 1, "body": "#bfe6ff", "ink": "#17263f", "runShadow": 1, "talisman": ""
}
```

Regenerating: load that config, hit **Save all four**, and drop `icon-1024/512/192/180.png` into the folder. `manifest.webmanifest` points at 192 and 512, `index.html` links 180 (apple-touch) and 192, and `sw.js` precaches 180/192/512 — so bump the cache string or the old icons stay installed on anyone's home screen.

One caveat baked into this composition: the manifest declares `"purpose": "any maskable"`, and Android crops maskable icons to roughly the centre 80% circle. At `tileSize: 0.765` the tile's *corners* sit outside that circle (0.54 from centre vs a 0.40 safe radius), so on Android the rounded tile bleeds to the edge and loses its corner radius. Everything that matters — runner, rail, the yellow band — survives. Drop `tileSize` to about 0.62 if you'd rather keep the tile reading as a discrete tile under the crop.

The composition autosaves to `localStorage` under `tilerunner:icon` (same pattern as the level editor), merged over `DEFAULT` on load so an older save can't break a newer tool; **Reset** clears it. Exports are always full-bleed squares regardless of the mask preview, because iOS and Android round the corners themselves. The four sizes and filenames match what `manifest.webmanifest` already asks for, so the PNGs drop straight into the project folder.

The shipped tune is deliberately restrained: `kneeBend: 0.045` with a hair of *negative* `kneeLead`, so the bend reads as a soft articulation rather than a cartoon crouch, alongside a heavier `bob: 0.064` and thinner `legWidth: 0.05`. **v6.0 added `hipRise: 0.06` and `footLift: 0.098` at `footLiftPow: 1`** — a barely-there hip raise, and a foot lift that is large relative to the other numbers because the runner is small on screen and a subtle lift simply doesn't read at a 56px cell.

**The worn talisman** is a cord quadratic-curved across the chest with the pendant hanging off it. `talCordY` sets where the cord meets the body, `talHangY` how far the pendant drops, `talR` its size. v6.2 unpicked the rest of it from the hard-coded numbers: `talCordW` (cord thickness), `talCordA` (its opacity), `talSpan` (how far apart the cord's two ends sit, as a fraction of body width) and `talX` (the pendant's offset from centre — negative is behind him, positive toward the direction of travel).

The one coupling worth knowing: **the cord's dip follows the pendant.** `talX` moves the quadratic's control point as well as the pendant, so sliding the pendant off-centre drags the cord's low point with it. Draw them independently and the pendant appears to have come off its string.

### Wall squash (v6.5)

The run used to end one way: track runs out, runner walks to the edge, gravity. But there are two *different* endings hiding in that, and they should not look the same — running off a ledge is a fall, running into a wall is an impact. `endRun()` now splits them with `wallAhead()`, which checks the cell the runner is about to enter for a wall, a stone, or a sliding block currently parked there. Off the board is deliberately **not** a wall — the edge of the world is a ledge.

When there is something to hit, `state.status` goes to `"squash"` for `SQUASH_MS` (260) before `startFall()`. Two things make that work without touching the movement code:

- `update()` already returns early unless status is `"play"`, so the runner freezes in place for the squash on its own.
- `drawRunner`'s local frame has **+x as the direction of travel**, so the squash is just `ctx.scale(kx, ky)` with `kx < 1 < ky` — "compressed along travel, bulged across it" without caring which way he was going. It scales about the feet (y=0) so he stays on the track, and translates forward by what the width lost so he stays flush with the wall face rather than floating off it.

`squashK()` is the profile: compress over the first 45%, then relax to 55% of full as he peels off. `SQUASH_X` (0.52) and `SQUASH_Y` (1.26) are the extremes. A saw strike still calls `startFall()` directly — being cut down is not the same beat as running into a wall.

### Shadow (v6.5)

Was one number and three hard-coded ones. Now `shadow` (vertical radius), `shadowW` (width, fraction of body width), `shadowA` (opacity), `shadowY` (offset below the track), and `shadowBob` — which ties the shadow's size to the body's rise, so at 1 it shrinks as he bobs up and he reads as leaving the ground rather than sliding along it. **v6.6 shipped `shadowBob: 0.48`** — a flatter, wider, slightly dropped shadow (0.026 / 0.65 / +0.01) that shrinks about halfway in step with the bob. Combined with `footLift`, that is what sells him as pushing off the track rather than gliding over it: the feet leave the ground and the shadow acknowledges it.

### Mechanic intro keys (`intro`)
`recycle`, `turn`, `offscreen`, `flag`, `wall`, `block`, `saw`, `key`, `door`, `stone`, `platform`, `talisman`, `mdoor`, `coin`, `boost`, `slow`, `crumble`, `switch`, `monster`, `slider`, plus `tile` and `speed`. Put the key on the first level that teaches that mechanic; leave `[]` otherwise.

**Every level here sets `intro` explicitly, which disables the auto-detect fallback in `levelMechs`** — so a mechanic with no key on its first level is simply never taught. Audit after adding levels. Two prompts are deliberately unused: `tile` (its text is a strict subset of `recycle`, so showing both would be two near-identical cards back to back) and `speed` (nothing sets the per-level `cps` override, so it can never fire).

---

## Current 24 levels (curriculum)

1–3 movement basics (recycle / turn / off-screen goal) · 4–7 walls (single gap → 3 gaps → cross-maze → 8×8 room maze) · 8–11 sliding blocks (intro → 3 gates → vertical climb → 14×14 room maze) · 12–14 saws (one sweeper → 3 stacked → 4-saw cross) · 15–16 keys & doors (intro → 2×3 room puzzle, two color pairs) · 17–18 stone (intro → stone maze) · 19–21 fixed platforms (intro, then two that route the runner through chained elbows) · 22 blocks + stone gauntlet · 23 a solid 4-row stone wall to chew through · 24 two banks of three phase-staggered saws with a safe column between them.

## Modes (removed in v4.8)

The game is **campaign only**. Endless, Daily Challenge, the in-game Level Editor and the Zen (no-fall) option were all removed, along with their machinery: the procedural level generator (`genLevel` / `solvableGen`), the endless/daily starters, the whole in-game editor block (~7.5k chars incl. its `#editbar` DOM + CSS and share-code import/export), the `mode` variable and every `mode === …` branch, and `__TR.modes` / `__TR.ed` / `__TR.ui.setZen`. The pause menu is now Resume · Restart Level · Levels · Sound · Colorblind. `index.html` shrank ~13k chars.

Two knock-on notes: `mulberry32` / `hashSeed` / `genTheme` / `genTrackPal` / `hslHex` were kept — they look like generator code but drive the per-level background theme and track colour in normal play. And the in-game editor was the only thing that could author `coins` / `boost` / `slow` / `crumble`; `level-editor.html` still can't paint those, so introducing one of those mechanics now needs an editor tool added first (or hand-written JSON).

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
