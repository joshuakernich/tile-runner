# Tile Runner

A retro-pixel path-laying game, built as a web app so it can be wrapped into
an iPhone app later.

## The game (v9)
Each level starts with THREE tiles already laid on the path from the start.
The runner sets off along the path and moves continuously in real-time.

The path is drawn as a SIDE-ON TRACK: each platform tile has a frosted-glass
cell background, and the running surface (top of the platform) sits on the
tile's centre line, with the beam body hanging into the lower half of the
cell. The runner is a little platformer character stuck to that surface.
Gravity is oriented along the path -- "down" always points into the track --
so as the track climbs or turns the runner reorients (running sideways or
upside-down) instead of falling off. Run out of track ahead and it tumbles
off under gravity (a fail).

When the runner clears a tile, that tile's platform disappears and it becomes
a draggable glass tile marked with a FINGERPRINT icon (pulsing border). Drag
those freed tiles to an empty cell at the FRONT of the path -- the cell you
drop on chooses the next direction -- to keep laying track ahead of the moving
runner and steer it, around the walls, to the green goal. Drop somewhere
invalid and the tile snaps back.

Tiles are large and the map is bigger than the screen; the camera scrolls to
follow the runner (and the freed tiles just behind it). Three levels
(7 x 13 each), faster and more maze-like as you go.


## Start & end gates
Each level's start and goal cells are permanent 'gates': a little door with a
platform already oriented in the direction that tile operates (the start
points toward the first tile; the goal toward its approach). These platforms
are never cleared. Corner tiles use a curved (quarter-circle) running surface
and the runner rides the curve.

## Run it
Open `index.html` in any browser. Drag the glass (fingerprint) tiles to the
cells highlighted at the front of the track.

## Tuning (top of the <script> in index.html)
- LEVELS         start/goal/walls/speed AND `init` (the 3 pre-laid tiles) per level
- COLS, ROWS     map size (currently 7 x 13)
- MIN_CELL/MAX_CELL, VIEW_COLS/VIEW_ROWS   tile size + how much of the map is on screen
- CAM_LERP       how quickly the camera catches up to the runner
- TRACK_T        platform thickness (hangs below the centre line)
- SAMPLE_D       how much corners round off
- FALL_G, FALL_MS  the tumble-off-the-end gravity fall
- TILES_TOTAL    how many tiles exist (currently 3)
- GRACE_MS       how long the runner waits at a dead end before falling

## Packaging for iPhone (later)
Single self-contained `index.html`, no external dependencies -- drops cleanly
into a native wrapper. Easiest path to the App Store is Capacitor:

    npm create @capacitor/app
    # copy index.html into the web assets folder
    npx cap add ios
    npx cap open ios      # builds/signs in Xcode

## Files
- index.html   the whole game (HTML + CSS + JS in one file)
