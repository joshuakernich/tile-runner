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
  for (const [file, name] of [["tile-lab.html", "SHIPPED"], ["junction-lab.html", "TILE"]]) {
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
head("Song generator parity (music lab vs game)");
{
  const mul = `function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;};}
    function hashSeed(s){let h=2166136261;s=String(s);
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}`;

  const gm = read("index.html").match(/function setSong\(seed\) \{([\s\S]*?)\n    \}/);
  const lab = read("music-lab.html");
  const grab = (start, end) => { const i = lab.indexOf(start); if (i < 0) return null;
    const j = lab.indexOf(end, i); return j < 0 ? null : lab.slice(i, j + end.length); };
  const labBits = [
    grab("const SHIPPED = {", "\n};"),
    grab("const SCALES = {", "\n};"),
    grab("const PROGS = [", "\n];"),
    grab("const CHORDS_T = {", "\n};"),
    grab("const MINORISH =", "\n"),
    grab("function chordIvls()", "\n}"),
    grab("function buildSong(seed)", "\n}"),
  ];
  if (!gm || labBits.some((b) => !b)) bad("could not extract both generators — update tools/check.mjs");
  else {
    const ctxGame = { };
    vm.createContext(ctxGame);
    vm.runInContext(`${mul}\nlet MELODY,CHORDS;\nfunction setSong(seed){${gm[1]}}\n`, ctxGame);
    const ctxLab = { };
    vm.createContext(ctxLab);
    vm.runInContext(`${mul}\n${labBits.join("\n")}\nlet M={...SHIPPED};\nlet MELODY=[],CHORDS=[],KEY=0,PROGUSED=0;\n`, ctxLab);
    let mismatch = [];
    for (let i = 1; i <= 24; i++) {
      const seed = vm.runInContext(`hashSeed("${i}")`, ctxGame);
      vm.runInContext(`setSong(${seed})`, ctxGame);
      const a = vm.runInContext(`JSON.stringify([MELODY, CHORDS.map(c=>c.tones)])`, ctxGame);
      vm.runInContext(`M={...SHIPPED}; buildSong(${seed})`, ctxLab);
      const b = vm.runInContext(`JSON.stringify([MELODY, CHORDS.map(c=>c.tones)])`, ctxLab);
      if (a !== b) mismatch.push(i);
    }
    if (mismatch.length) bad(`levels differ: ${mismatch.join(", ")}`);
    else ok("all 24 levels generate an identical melody and progression");
  }
}

// ------------------------------------------------------ 4. level data x3
// levels.js is the source of truth. index.html strips `n` (it indexes by array
// position); level-editor.html keeps it. All three must agree.
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
  const truth = levelsFrom("levels.js", "module.exports =");
  const game  = levelsFrom("index.html", "const LEVELS =");
  const edit  = levelsFrom("level-editor.html", "const EMBEDDED =");
  if (!truth || !game || !edit) bad("could not parse one of levels.js / LEVELS / EMBEDDED");
  else {
    const strip = (L) => { const { n, ...rest } = L; return JSON.stringify(rest); };
    if (truth.length !== game.length) bad(`levels.js has ${truth.length}, index.html has ${game.length}`);
    else if (truth.length !== edit.length) bad(`levels.js has ${truth.length}, editor has ${edit.length}`);
    else {
      const gDiff = truth.map((L, i) => strip(L) === strip(game[i]) ? null : i + 1).filter(Boolean);
      const eDiff = truth.map((L, i) => JSON.stringify(L) === JSON.stringify(edit[i]) ? null : i + 1).filter(Boolean);
      if (gDiff.length) bad(`index.html differs at level(s) ${gDiff.join(", ")}`);
      else ok(`index.html matches levels.js (${truth.length} levels)`);
      if (eDiff.length) bad(`level-editor.html differs at level(s) ${eDiff.join(", ")}`);
      else ok(`level-editor.html matches levels.js`);
    }

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
      for (const [label, p] of [["start", L.start], ["goal", L.goal], ["init0", L.init?.[0]], ["init1", L.init?.[1]]])
        if (!p || !inside(p)) problems.push(`L${n} ${label} is outside the ${L.cols}x${L.rows} board`);
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
