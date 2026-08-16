#!/usr/bin/env python3
"""Tile Runner — headless smoke test.

    pip install playwright && playwright install chromium
    python3 tools/check_browser.py

Boots the game, walks every level, and opens each tool, failing on any page
error. This is the check the static pass cannot do: `node --check` only proves
the file *parses*, not that a renamed function still has a valid call site.

Set PLAYWRIGHT_CHROMIUM to point at a specific binary if you need to.
"""

import os
import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed — skipping browser checks.")
    print("  pip install playwright && playwright install chromium")
    sys.exit(0)

ROOT = Path(__file__).resolve().parent.parent
url = lambda f: (ROOT / f).as_uri()

TOOLS = ["level-editor.html", "runner-lab.html", "icon-lab.html",
         "music-lab.html", "stone-generator.html"]
# offline sandboxes can't fetch webfonts; that isn't a code fault
IGNORE = ("ERR_TUNNEL", "ERR_NAME", "ERR_INTERNET", "ERR_CONNECTION", "Failed to load resource")

errors = []


def watch(page, where):
    page.on("pageerror", lambda e: errors.append(f"{where}: {e}"))
    page.on("console", lambda m: (
        errors.append(f"{where} console: {m.text}")
        if m.type == "error" and not any(s in m.text for s in IGNORE) else None))


launch = {}
if os.environ.get("PLAYWRIGHT_CHROMIUM"):
    launch["executable_path"] = os.environ["PLAYWRIGHT_CHROMIUM"]

with sync_playwright() as p:
    browser = p.chromium.launch(**launch)
    ctx = browser.new_context(viewport={"width": 760, "height": 1000})

    # ---- the game: boot, then walk every level ----
    page = ctx.new_page()
    watch(page, "index.html")
    page.goto(url("index.html"))
    page.wait_for_timeout(800)

    count = page.evaluate("() => (window.__TR && window.__TR.levelCount) ? __TR.levelCount() : 0")
    if not count:
        errors.append("index.html: the __TR debug API is missing — has it been removed?")
    for i in range(count):
        page.evaluate("i => __TR.load(i)", i)
        page.wait_for_timeout(60)
    print(f"  index.html — booted {count} levels")
    page.close()

    # ---- each tool: it must load and actually draw something ----
    for f in TOOLS:
        if not (ROOT / f).exists():
            errors.append(f"{f}: missing")
            continue
        page = ctx.new_page()
        watch(page, f)
        page.goto(url(f))
        page.wait_for_timeout(700)
        blank = page.evaluate("""() => {
            const cv = document.querySelector('canvas');
            if (!cv) return 'no canvas';
            const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
            const seen = new Set();
            for (let i = 0; i < d.length; i += 4 * 97) seen.add(d[i]+','+d[i+1]+','+d[i+2]+','+d[i+3]);
            return seen.size < 2 ? 'canvas is blank' : null;
        }""")
        if blank:
            errors.append(f"{f}: {blank}")
        else:
            print(f"  {f} — loads and draws")
        page.close()

    browser.close()

if errors:
    print(f"\n\033[31m{len(errors)} problem(s)\033[0m")
    for e in errors:
        print("  ✗ " + e)
    sys.exit(1)
print("\n\033[32mno page errors\033[0m")
