#!/usr/bin/env node
// Tile Runner — static regression checks. No dependencies, no browser.
//
//   node tools/check.mjs
//
// Every check here exists because the corresponding mistake was actually made
// during development. They are cheap; run them before every ship.

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");
const HTML = ["index.html", "level-editor.html", "runner-lab.html", "icon-lab.html", "music-lab.html", "stone-generator.html"];

let failures = 0, checks = 0;
const ok   = (m) => { checks++; console.log("  \x1b[32m✓\x1b[0m " + m); };
const bad  = (m) => { checks++; failures++; console.log("  \x1b[31m✗\x1b[0m " + m); };
const head = (m) => console.log("\n\x1b[1m" + m + "\x1b[0m");

const scripts = (src) => [...src.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);

// ---------------------------------------------------------------- 1. syntax
head("Syntax");
for (const f of HTML) {
  if (!existsSync(join(ROOT, f))) { bad(`${f} — missing`); continue; }
  const body = scripts(read(f)).join("\n;\n");
  try { new vm.Script(body, { filename: f }); ok(`${f} parses`); }
  catch (e) { bad(`${f} — ${e.message}`); }
}

// ------------------------------------------------- 2. the RUNNER block x3
// The runner's numbers live in three files (game, runner lab, icon lab) and are
// meant to be pasted between them wholesale. Drift here is silent: the labs keep
// showing you a runner the game no longer draws.
head("RUNNER block parity");
function runnerBlock(file, name) {
  const src = read(file);
  const m = src.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\n\\s*\\};`));
  if (!m) return null;
  const body = m[1].replace(/\/\/[^\n]*/g, "");
  const out = {};
  for (const [, k, v] of body.matchAll(/(\w+)\s*:\s*("[^"]*"|-?[\d.]+)/g))
    out[k] = v.startsWith('"') ? JSON.parse(v) : Number(v);
  return out;
}
{
  const game = runnerBlock("index.html", "RUNNER");
  const lab  = runnerBlock("runner-lab.html", "SHIPPED");
  const icon = runnerBlock("icon-lab.html", "RUNNER");
  if (!game || !lab || !icon) bad("could not extract one of the three RUNNER blocks");
  else {
    for (const [label, other] of [["runner-lab", lab], ["icon-lab", icon]]) {
      const diff = [...new Set([...Object.keys(game), ...Object.keys(other)])]
        .filter((k) => game[k] !== other[k])
        .map((k) => `${k}: game=${game[k]} ${label}=${other[k]}`);
      if (diff.length) bad(`${label} differs from the game — ${diff.join("; ")}`);
      else ok(`${label} matches the game (${Object.keys(game).length} keys)`);
    }
  }
}

// -------------------------------------------------- 2b. the junction block
// junction-lab.html carries a copy of the game's JUNCTION tuning as its starting
// point. If they drift, the lab is tuning a junction the game no longer draws —
// the same trap the RUNNER block has fallen into before.
head("JUNCTION block parity");
{
  const game = runnerBlock("index.html", "JUNCTION");
  // tile-lab draws a junction too, so it carries its own mirror of the block
  for (const [file, name] of [["junction-lab.html", "SHIPPED"], ["tile-lab.html", "JUNCTION"]]) {
    const lab = runnerBlock(file, name);
    if (!game || !lab) { bad(`could not extract the JUNCTION block from index.html or ${file}`); continue; }
    const diff = [...new Set([...Object.keys(game), ...Object.keys(lab)])]
      .filter((k) => game[k] !== lab[k])
      .map((k) => `${k}: game=${game[k]} lab=${lab[k]}`);
    if (diff.length) bad(`${file} differs from the game — ${diff.join("; ")}`);
    else ok(`${file} matches the game (${Object.keys(game).length} keys)`);
  }
}

// -------------------------------------------------- 2c. the tile block
// Same story as JUNCTION: tile-lab.html starts from the game's TILE block, and a drift
// means the lab is tuning a tile the game no longer draws.
head("TILE block parity");
{
  const game = runnerBlock("index.html", "TILE");
  // junction-lab carries a mirror too — the junction rides on the same cross-section
  // icon-lab draws the app icon's tile with the same cross-section, so it carries a mirror too
  for (const [file, name] of [["tile-lab.html", "SHIPPED"], ["junction-lab.html", "TILE"],
                              ["icon-lab.html", "TILE"]]) {
    const lab = runnerBlock(file, name);
    if (!game || !lab) { bad(`could not extract the TILE block from index.html or ${file}`); continue; }
    const diff = [...new Set([...Object.keys(game), ...Object.keys(lab)])]
      .filter((k) => game[k] !== lab[k])
      .map((k) => `${k}: game=${game[k]} lab=${lab[k]}`);
    if (diff.length) bad(`${file} differs from the game — ${diff.join("; ")}`);
    else ok(`${file} matches the game (${Object.keys(game).length} keys)`);
  }
}

// -------------------------------------------------- 2d. the coin block
head("EYES block parity");
{
  const game = runnerBlock("index.html", "EYES");
  const lab  = runnerBlock("eye-lab.html", "SHIPPED");
  if (!game || !lab) bad("could not extract the EYES block from index.html or eye-lab.html");
  else {
    const diff = [...new Set([...Object.keys(game), ...Object.keys(lab)])]
      .filter((k) => game[k] !== lab[k])
      .map((k) => `${k}: game=${game[k]} lab=${lab[k]}`);
    if (diff.length) bad(`eye-lab differs from the game — ${diff.join("; ")}`);
    else ok(`eye-lab matches the game (${Object.keys(game).length} keys)`);
  }
}

head("TAL block parity");
{
  const game = runnerBlock("index.html", "TAL");
  const lab  = runnerBlock("talisman-lab.html", "SHIPPED");
  if (!game || !lab) bad("could not extract the TAL block from index.html or talisman-lab.html");
  else {
    const diff = [...new Set([...Object.keys(game), ...Object.keys(lab)])]
      .filter((k) => game[k] !== lab[k])
      .map((k) => `${k}: game=${game[k]} lab=${lab[k]}`);
    if (diff.length) bad(`talisman-lab differs from the game — ${diff.join("; ")}`);
    else ok(`talisman-lab matches the game (${Object.keys(game).length} keys)`);
  }
}

head("COIN block parity");
{
  const game = runnerBlock("index.html", "COIN");
  const lab  = runnerBlock("coin-lab.html", "SHIPPED");
  if (!game || !lab) bad("could not extract the COIN block from index.html or coin-lab.html");
  else {
    const diff = [...new Set([...Object.keys(game), ...Object.keys(lab)])]
      .filter((k) => game[k] !== lab[k])
      .map((k) => `${k}: game=${game[k]} lab=${lab[k]}`);
    if (diff.length) bad(`coin-lab differs from the game — ${diff.join("; ")}`);
    else ok(`coin-lab matches the game (${Object.keys(game).length} keys)`);
  }
}

// -------------------------------------------------- 3. the song generator
// music-lab.html reimplements setSong so it can extend it. At its shipped
// defaults it must still produce the exact tune the game plays, or the lab is
// auditioning music that will never ship.
head("Music engine parity (music lab vs game)");
{
  // The game no longer has its own arrangement of the song generator — index.html carries the
  // lab's blocks verbatim, with two mechanical renames applied on the way in (the live config
  // is MU there because ambTick() already has a local M, and hz() is mhz() for the same kind
  // of reason). So the honest check is that the SOURCE still matches, not that two separate
  // implementations happen to agree today.
  // Indentation is the one thing that legitimately differs — the game's copy sits four levels
  // deep inside the Sound module — so both files are flattened before anything is looked for.
  const flat = (t) => t.replace(/^[ \t]+/gm, "");
  const lab  = flat(read("music-lab.html"));
  const game = flat(read("index.html"));
  const pull = (src, start, end) => { const i = src.indexOf(start); if (i < 0) return null;
    const j = src.indexOf(end, i); return j < 0 ? null : src.slice(i, j + end.length); };
  // MU. and MU[ both have to come back, or a bracket access would read as a difference
  const norm = (t) => t.replace(/\bMU(?=[.[])/g, "M").replace(/\bmhz\(/g, "hz(")
                       .replace(/function setSong\(/, "function buildSong(").trim();
  const PAIRS = [
    ["const SCALES = {",   "\n};"],
    ["const PROGS = [",    "\n];"],
    ["const CHORDS_T = {", "\n};"],
    ["const MINORISH =",   "\n"],
    ["function chordIvls()", "\n}"],
    ["const ENV = pre =>", "\n}"],
    ["const VOWELS = {",   "\n};"],
    ["const VOX_STYLES = {", "\n};"],
    ["function voxVoice(t, semi, dur, vel){", "\n}"],
    ["function bassHeavy(t, semi, dur, vel){", "\n}"],
    ["function bgNotes(s, chord){", "\n}"],
  ];
  let drift = [], missing = [];
  for (const [a, b] of PAIRS) {
    const L = pull(lab, a, b), G = pull(game, a, b);
    if (!L || !G) { missing.push(a.slice(0, 28)); continue; }
    if (norm(L) !== norm(G)) drift.push(a.slice(0, 28));
  }
  // the song generator itself is named differently in each
  const Lsong = pull(lab, "function buildSong(seed)", "\n}");
  const Gsong = pull(game, "function setSong(seed)", "\n}");
  if (!Lsong || !Gsong) missing.push("buildSong/setSong");
  else if (norm(Lsong) !== norm(Gsong)) drift.push("buildSong/setSong");

  if (missing.length) bad(`could not find in one of the two files: ${missing.join(", ")}`);
  if (drift.length)   bad(`music lab and game have drifted: ${drift.join(", ")}`);
  if (!missing.length && !drift.length) ok(`${PAIRS.length + 1} music blocks identical in both`);

  // and every key the lab can emit must exist in the game's defaults, or a level block that
  // sets it would land on nothing
  const shipped = pull(lab, "const SHIPPED = {", "\n};");
  const defs    = pull(game, "const MUSIC_DEFAULTS = {", "\n};");
  if (!shipped || !defs) bad("could not read SHIPPED / MUSIC_DEFAULTS");
  else {
    // several settings share a line, so this has to find every key, not the first per line
    const keys = (t) => new Set([...t.matchAll(/[{,]\s*"?([A-Za-z_][A-Za-z0-9_]*)"?\s*:/g)].map(m => m[1]));
    const L = keys(shipped), G = keys(defs);
    const gone = [...L].filter((k) => !G.has(k));
    if (gone.length) bad(`MUSIC_DEFAULTS is missing ${gone.length} lab key(s): ${gone.slice(0,6).join(", ")}`);
    else ok(`MUSIC_DEFAULTS covers all ${L.size} lab settings`);
  }
}

head("Level data parity");
// Pull the array literal that follows `marker` by balancing brackets, so it works
// whether the array is one line (the editor) or many (levels.js and the game).
function levelsFrom(file, marker) {
  const src = read(file), i = src.indexOf(marker);
  if (i < 0) return null;
  const start = src.indexOf("[", i + marker.length);
  if (start < 0) return null;
  let depth = 0, inStr = false, end = -1;
  for (let k = start; k < src.length; k++) {
    const ch = src[k];
    if (inStr) { if (ch === "\\") k++; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") { if (--depth === 0) { end = k; break; } }
  }
  if (end < 0) return null;
  try { return vm.runInNewContext(src.slice(start, end + 1)); } catch { return null; }
}
{
  const truth = levelsFrom("levels.js", "var LEVELS_DATA =");
  if (!truth) bad("could not parse levels.js");
  else {
    // levels.js is the ONLY copy now: the game and the editor both pull it in with a
    // <script src>, so there is no parity left to enforce — only the wiring that replaced it.
    for (const [file, why] of [["index.html", "the game"], ["level-editor.html", "the editor"]]) {
      const src = read(file);
      if (!src.includes('<script src="levels.js">'))
        bad(`${file} no longer loads levels.js — ${why} would boot with an empty campaign`);
      else if (/\n\s*(const|let)\s+(LEVELS|EMBEDDED)\s*=\s*\[\s*\{/.test(src))
        bad(`${file} has grown its own inline copy of the levels again`);
      else ok(`${file} reads levels.js directly (${truth.length} levels)`);
    }
    if (!read("sw.js").includes('"./levels.js"'))
      bad("sw.js does not precache levels.js — the game would be empty offline");
    else ok("sw.js precaches levels.js");

    // ---- per-level sanity ----
    const VALID_INTRO = new Set(["recycle","turn","offscreen","flag","wall","block","saw","key",
      "door","stone","platform","mdoor","coin","boost","slow","crumble","switch","monster","slider"]);
    const problems = [];
    truth.forEach((L, i) => {
      const n = i + 1;
      if (typeof L.cps !== "number") problems.push(`L${n} has no cps`);
      if (!Array.isArray(L.intro)) problems.push(`L${n} has no intro array`);
      else for (const k of L.intro) if (!VALID_INTRO.has(k)) problems.push(`L${n} intro "${k}" is not a live key`);
      const inside = ([c, r]) => c >= 0 && r >= 0 && c < L.cols && r < L.rows;
      for (const [label, p] of [["start", L.start], ["init0", L.init?.[0]], ["init1", L.init?.[1]]])
        if (!p || !inside(p)) problems.push(`L${n} ${label} is outside the ${L.cols}x${L.rows} board`);
      // A level may have no exit at all — it then runs until he falls. If it HAS one it
      // still has to be on the board.
      if (L.goal && !inside(L.goal)) problems.push(`L${n} goal is outside the ${L.cols}x${L.rows} board`);
    });
    if (problems.length) problems.forEach(bad);
    else ok("every level has cps, a valid intro list, and in-bounds start/init/goal");
  }
}

// --------------------------------------------------------- 5. ship ritual
head("Ship ritual");
{
  const v = read("index.html").match(/const VERSION = "(v[\d.]+)"/);
  const c = read("sw.js").match(/const CACHE = "(tile-runner-v\d+)"/);
  if (!v) bad("index.html has no VERSION string");
  else if (!c) bad("sw.js has no CACHE string");
  else ok(`VERSION ${v[1]}, cache ${c[1]} — bump BOTH on every ship`);

  const assets = read("sw.js").match(/const ASSETS = \[([\s\S]*?)\]/);
  if (assets) {
    const missing = [...assets[1].matchAll(/"\.\/([^"]+)"/g)].map((m) => m[1])
      .filter((f) => f && !existsSync(join(ROOT, f)));
    if (missing.length) bad(`sw.js precaches files that don't exist: ${missing.join(", ")}`);
    else ok("every file sw.js precaches exists");
  }
}

// ------------------------------------------------------------------ done
console.log(`\n${failures ? "\x1b[31m" : "\x1b[32m"}${checks - failures}/${checks} checks passed\x1b[0m`);
process.exit(failures ? 1 : 0);
