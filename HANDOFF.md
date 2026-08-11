# Tile Runner — Project Handoff

A retro-pixel, real-time path-laying game. The player drags a small pool of
tiles to lay track just ahead of a runner that never stops, steering it around
obstacles to a key and then the exit. Built as a single self-contained web app,
packaged as an installable PWA, and wrapped in a native iOS shell for sideloading.

_Last updated at build **v19**._

---

## 1. Where everything lives

On your Mac, everything is under **`~/Documents`**:

```
Documents/
├─ tile-runner/                 ← the web game (the thing you edit)
│  ├─ index.html                ← THE WHOLE GAME (HTML + CSS + JS, one file)
│  ├─ manifest.webmanifest      ← PWA manifest (installable, full-screen)
│  ├─ sw.js                     ← service worker (offline caching over https)
│  ├─ icon-180/192/512/1024.png ← app icons
│  ├─ README.md                 ← gameplay + tuning notes
│  └─ INSTALL-on-iphone.md      ← Add-to-Home-Screen instructions
└─ tilerunner-ios/              ← native iOS wrapper (Xcode sideload)
   ├─ TileRunner.xcodeproj
   ├─ TileRunner/…              ← SwiftUI app: a full-screen WKWebView
   └─ TileRunner/www/index.html ← a COPY of the game bundled into the app
```

`index.html` is the source of truth. The Xcode project just displays a copy of
it in a WKWebView. (We paused keeping that copy in sync — see §6.)

---

## 2. How to run / play

- **Locally:** double-click `Documents/tile-runner/index.html` — it runs in any browser.
- **Controls:** the runner auto-runs from the start gate. Drag the glass
  (fingerprint) tiles to an empty cell at the FRONT of the track to extend it.
  A tile frees up the instant the runner leaves it. Tap a **stone** tile to
  smash it open. Collect the **key** (route the track over its cell) to unlock
  the exit, then place a tile **next to** the exit to finish. Run out of track
  and the runner falls off the edge.

---

## 3. How to get it on a phone

Two paths, both documented in the folder:

1. **Add to Home Screen (PWA)** — quickest. Host the `tile-runner` folder on any
   static https host (Netlify Drop, GitHub Pages, Cloudflare Pages…), open the
   URL on the iPhone in Safari → Share → Add to Home Screen. The service worker
   makes it work offline afterward. See `INSTALL-on-iphone.md`.
   - _Status:_ not yet published anywhere. A GitHub Pages attempt was blocked
     because this cloud sandbox can't make authenticated GitHub calls — publishing
     has to be done from your Mac / browser.
2. **Native sideload (Xcode)** — open `tilerunner-ios/TileRunner.xcodeproj`, set
   your Apple ID team + a unique bundle id in Signing & Capabilities, plug in the
   iPhone, press Run. Free Apple ID builds expire after 7 days (re-run to renew);
   a $99/yr developer account removes that. See `tilerunner-ios/SIDELOAD.md`.

---

## 4. Code architecture (`index.html`)

One IIFE, canvas-rendered, `requestAnimationFrame` loop. Key pieces, roughly top
to bottom:

- **`LEVELS`** — array of level definitions. Each: `start`, `goal`, `goalDir`
  (exit facing), `key` cell, `init` (the 3 pre-laid tiles), `walls` (metal
  barriers), `stone` (breakable), `speed` (ms per cell). Grid is `COLS×ROWS` (7×13).
- **State (`loadLevel`)** — `path` (ordered nodes the runner walks: start → tiles
  → goal), `tiles` (the 3 reusable tile objects, `status: active|free`), `stones`,
  `shards`, `keyCollected`, `runIdx`/`runT` (runner position along the path),
  camera, etc.
- **Runner motion (`update`)** — advances `runT`; the runner is always moving.
  Reaching the goal node wins; reaching the last tile with nothing ahead makes it
  run to the edge and `startFall()` (no timer). `freeClearedTiles()` frees a tile
  the instant the runner crosses out of its cell (tracked per-path-node via an
  `exited` flag, NOT per shared tile — important, see §7). `collectKey()` grabs
  the key when the runner passes over its cell.
- **Placement (`dropTileOn` / `validTargets`)** — a freed tile can be dropped on
  an empty cell orthogonally adjacent to the path head. `linkExitIfReady()` auto-
  appends the exit node when a tile is placed next to it AND the key is collected.
- **Curved path (`tileSurface` / `visualAt` / `surfaceAtTile`)** — corner tiles
  render a quarter-circle arc; `visualAt(param)` maps the runner's fractional
  position to a point on the (rounded) surface so it rides curves smoothly. Both
  the platform and the runner use this, so they stay glued together.
- **Rendering (`draw`)** — parallax procedural background (`drawBackground`,
  hash-based, 3 depth layers) → walls/stones → track (`drawTrack` →
  `drawPlatformSurface`) → glass tiles / draggable tiles → shards → runner →
  gates (start/exit doors) → off-screen arrows (key + exit).
- **Input** — pointer drag for free tiles (converted to world space so it works
  under the scrolling camera); pointer-down on a stone smashes it.
- **Camera** — smooth follow (`CAM_LERP`), clamped to the world, centered when
  the map is smaller than the viewport.
- **`window.__TR`** — debug hooks used by the test harness: `state()`, `drop()`,
  `freeTiles()`, `runner()`, `stones()`, `smash()`, `cam()`, etc.

---

## 5. Tunables (top of the `<script>`, and the `:root` CSS vars)

- `LEVELS` — per-level layout, speed, key/stone/wall placement.
- `COLS, ROWS` — grid size.
- `MIN_CELL / MAX_CELL`, `VIEW_COLS / VIEW_ROWS` — tile size + how much of the map fits on screen.
- `CAM_LERP` — camera catch-up speed.
- `TILES_TOTAL` — number of reusable tiles (3).
- `TRACK_T` — platform thickness; `SAMPLE_D` — how much corners round off.
- `FALL_G, FALL_MS` — gravity + duration of the run-off-the-edge fall.
- Colours are CSS custom properties in `:root` (`--track`, `--rail`, `--runner`,
  `--goal`, `--wall`, `--free`, `--accent`, `--bg`, …). Character/key/door/stone/
  metal colours are inline hex in their draw functions.

---

## 6. Testing / iteration workflow

No build step — edit `index.html` directly. It was validated with headless
Playwright (Chromium), driving the game through `window.__TR` to: play full
levels to a win, force fails, check tile freeing timing, verify stone smashing,
and confirm level solvability with a BFS. Screenshots at `deviceScaleFactor:2`,
390×844 (iPhone-ish) were used to check every visual change. Re-using that harness
is the fastest way to verify future edits.

---

## 7. Gotchas for the next person

- **Tiles are reused objects.** The 3 tile objects cycle from placed → freed →
  re-placed. Anything that reasons about "has the runner passed this tile" must
  key off the **path node** (`node.exited`), not the shared tile's `status` —
  otherwise a re-placed tile's stale old node breaks it (this exact bug bit us
  once: platforms stopped drawing on freshly placed tiles).
- **`visualAt` uses `round(param)`** to pick the current tile and offsets by
  `±0.5` — the runner's current tile is therefore never a freed one, so it never
  stands on empty space.
- **iOS 15 has no `ctx.roundRect`** — we use a manual `rrect()` (arcTo). Keep using it.
- **Service worker only registers over https/localhost** (guarded), so plain
  file:// or LAN-http play just won't cache offline; that's expected.

---

## 8. Ideas / open items (not done)

- Publish the PWA to a real https URL (GitHub Pages / Netlify) — must be done from
  your side; the sandbox can't authenticate to GitHub.
- Keep `tilerunner-ios/TileRunner/www/index.html` in sync when you want a fresh
  native build (currently paused; just copy `index.html` over before you Run in Xcode).
- Gameplay not yet built: scoring / timer, collectible coins along the route,
  more levels, additional hazards, sound.
- The Cowork artifact reflects an earlier build (~v17); the canonical latest is
  `Documents/tile-runner/index.html` (v19).

---

## 9. Build log (high level)

v0 draggable tiles → grid snap · v1 real-time tap-to-place treadmill · v2 drag
freed tiles to the front · v3 big tiles + scrolling camera · v4 side-on track,
gravity-along-path runner · v5–v8 platform-through-centre, glass tiles, fingerprint,
per-tile platforms · v9 curved corners + start/exit gates · v10 parallax
background, rounded gap-free tiles · v11 exit-is-a-fixed-tile completion · v12
instant tile-free + collectible key + off-screen arrows · v13–14 clear platform
on exit (+ per-node fix) · v15–16 dashed line removed, pale-blue character,
pixelated fingerprint, outline-free key/doors · v17 run-off-the-edge fall, metal
walls, breakable stone · v18–19 outlines removed from all tiles.
