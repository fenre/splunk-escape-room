#!/usr/bin/env python3
"""Tiny static file server that disables browser caching.

The default ``python -m http.server`` sends ``Last-Modified`` headers, which
lets browsers serve a stale copy of ``game.html`` via ``If-Modified-Since``.
During a live game we edit ``game.html`` on the host (bind-mounted into the
container) and need every reload to fetch the current file. This handler sends
``Cache-Control: no-store`` and omits validators so the browser never reuses a
cached response.

Usage:
    python3 serve_nocache.py [PORT] [DIRECTORY]
Defaults: PORT=8800, DIRECTORY=current working directory.
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_header(self, keyword, value):
        # Drop Last-Modified so browsers can't do a conditional (304) fetch.
        if keyword.lower() == "last-modified":
            return
        super().send_header(keyword, value)


def main() -> int:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
    directory = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    handler = functools.partial(NoCacheHandler, directory=directory)
    with http.server.ThreadingHTTPServer(("0.0.0.0", port), handler) as httpd:
        print(f"Serving {directory} on 0.0.0.0:{port} with no-store caching", flush=True)
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
