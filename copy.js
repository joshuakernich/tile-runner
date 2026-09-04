// Tile Runner copy — every line of writing the game says that is NOT part of a level.
// Edited in level-editor.html (the COPY tab), which writes this file the same way it writes
// levels.js. The verses on the chapter cards are NOT here: they belong to their level and live
// in levels.js with it.
//
// Loaded two ways, and it has to answer to both: `require()` from Node (tools/check.mjs) and a
// plain <script src> from the game and the editor, which is why this is a global and not an
// ES module.
var COPY_DATA = {
  // The card that introduces a mechanic the first time a chapter uses one. `name` is the
  // heading, `desc` the line under it. The KEY is what a level's `intro` list names, so
  // renaming one orphans every level that asks for it — change the text, not the key.
  mechs: {
    "tile": { name: "Track Tiles",
              desc: "The runner never stops! Drag cleared tiles to lay track ahead." },
    "key": { name: "Colour Key",
             desc: "Find a key to unlock a matching padlock." },
    "flag": { name: "The Exit",
              desc: "Lay a tile on the flag to finish the chapter." },
    "wall": { name: "Wall Entity",
              desc: "Passive entities whose noble purpose is simply to get in the way." },
    "stone": { name: "Stone Block",
               desc: "Tap to smash. Maybe twice. Maybe thrice." },
    "boost": { name: "Boost",
               desc: "Grab it for a short burst of speed. Keep those tiles flowing!" },
    "singularity": { name: "Singularity",
                     desc: "Lay a tile over a black hole to run over it. Lose that tile forever." },
    "slow": { name: "Slow",
              desc: "Grab it and the runner drags for a few seconds — plan around it." },
    "switch": { name: "Buttons & Doors",
                desc: "Tap the arcade buttons to slide their door open. Follow the wires — some doors need EVERY linked button pressed." },
    "monster": { name: "Flying Menace",
                 desc: "A little monster flitting to and fro. Time your run so the runner never touches it!" },
    "hunter": { name: "The Hunter",
                desc: "A malevolent entity. It is coming for you. Keep moving." },
    "slider": { name: "Sliding Platform",
                desc: "The wall only opens where this platform sits. Drag it along its rail to line up the crossing, then build across it." },
    "block": { name: "Movable Block",
               desc: "A heavy block. Drag it aside to clear the way, then build through." },
    "platform": { name: "Fixed Rail",
                  desc: "A ready path, bolted to the chapter. You can't build on it — but you can run through it." },
    "mdoor": { name: "Sliding Door",
               desc: "Slide it open by dragging BOTH panels apart — push each side away from the centre." },
    "recycle": { name: "Drag Tiles",
                 desc: "The runner never stops! Drag cleared tiles to lay track ahead." },
    "turn": { name: "Take a Turn",
              desc: "Lay a tile to the SIDE of the path to steer toward the flag." },
  },
  // A FALL. The heading is picked from these and the line under it from the next
  // list — both fresh every death, and never the same one twice running.
  loseTitles: [
    "You Fell",
    "Death",
    "Wipeout",
    "Splat",
    "Down You Go",
    "Ouch",
  ],
  // ...and what it says under that heading.
  loseQuips: [
    "Physics: One. You: Zero.",
    "If at first you don't succeed, give up.",
    "Have you tried trying?",
    "Where were you when a tile was needed?",
    "Death is just another state of being.",
    "If you stare into the abyss long enough, the abyss stares back.",
  ],
  // A PAUSE. One heading, always — it is a state rather than an event, and a state that
  // renamed itself every time you stopped would read as a different screen each time.
  pauseTitle: "Paused",
  // ...but the line under it is drawn from these, one per pause.
  pauseQuips: [
    "Rest is for the weak.",
    "The track isn't going anywhere. Probably.",
    "He's still running. In his head.",
    "Take your time. He won't.",
    "Somewhere, a tile is getting cold.",
    "This counts as part of your run, you know.",
    "Gathering your thoughts. Both of them.",
    "The flag has been informed of the delay.",
    "A tactical pause. That's the story.",
    "Nobody's timing this. Nobody's timing anything.",
    "Breathe. He can't.",
    "You stopped. He noticed.",
    "The Tileverse waits. It's good at that.",
    "Planning, is it.",
    "Even the abyss is on a break.",
    "Nothing moves until you say so. Enjoy it.",
    "Momentum: gone. Dignity: negotiable.",
    "He'd like it on record that this was your idea.",
    "Studying the level. Sure.",
    "Second thoughts are still thoughts.",
    "The stillness is unnerving him.",
    "You'll want to remember where you were going.",
    "This is where the good runs go to think.",
    "Whenever you're ready. No rush. None at all.",
    "The price of inaction is greater than the cost of making a mistake.",
    "The still centre of the spinning world. It's pretty dull here.",
  ],
  // A CLEAR. Two headings, and which you get depends on whether there is any campaign left.
  winTitle: "Chapter Clear",
  winTitleLast: "That's All of Them",
  // `winBylineLast` takes {n}, which is filled in with how many chapters there are.
  winBylineLast: "All {n} chapters. You've run out of track — and excuses.",
  // first go
  winQuips: [
    "First go. Don't get used to it.",
    "Clean. Suspiciously clean.",
    "That was almost elegant.",
    "You made it look harder than it was.",
    "Textbook — if the textbook had typos.",
    "Efficient. Not the word I'd have picked, but efficient.",
    "Nicely done. The flag was getting bored.",
    "Great instincts. We'll work on the pace.",
    "Barely a wasted tile. Barely.",
    "Confidence like that can't be taught. Timing can.",
    "Smooth. Ish.",
    "The runner never doubted you. Not out loud.",
    "Solid work, by the standards you've set.",
    "You had a plan the whole time. Obviously.",
  ],
  // ...and after more than one attempt.
  winQuipsRetry: [
    "Got there in the end. Emphasis on 'end'.",
    "Persistence is a kind of talent.",
    "That's the one. We'll ignore the others.",
    "Practice makes… this.",
    "Beautiful. Let's never speak of the attempts.",
    "You wore it down. That counts.",
    "Whichever try that was, it's the one that counts.",
    "The floor forgives you.",
    "A masterclass in trial and error. Mostly error.",
    "Took a few goes, but the last one was lovely.",
    "Every failure taught you something. Allegedly.",
    "Worth the wait. For you, anyway.",
  ],
};
if (typeof module !== "undefined") module.exports = COPY_DATA;
