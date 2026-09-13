#!/usr/bin/env python3
"""The preview's static server: python's own http.server, but every response carries Cache-Control: no-cache.

Plain `python3 -m http.server` sends no caching headers, so the browser guesses from Last-Modified and can keep a
levels.js or copy.js from before the last edit beside a fresh index.html — which shows up as a change that "didn't
take" (a level's guides missing, a line of copy blank). With no-cache every reload asks first, which is one cheap 304
when nothing changed.

    python3 tools/serve.py 8124
"""
import functools
import http.server
import os
import sys


class NoCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCache, directory=root)
    print(f"serving {root} on http://localhost:{port} (no-cache)", flush=True)
    http.server.ThreadingHTTPServer(("", port), handler).serve_forever()
