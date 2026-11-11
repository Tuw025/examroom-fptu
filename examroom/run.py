"""Examroom local server. Run: python run.py (no third-party packages)."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse
import mimetypes
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent
IMAGES = ROOT.parent / 'FE'

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'web'), **kwargs)

    def do_GET(self):
        route = unquote(urlsplit(self.path).path)
        if route.startswith(('/assets/fe/', '/assets/retake/')):
            group = route.split('/')[2]
            name = route.removeprefix('/assets/' + group + '/')
            path = (IMAGES if group == 'fe' else ROOT.parent / 'retake') / name
            if '/' in name or '\\' in name or not path.is_file() or path.suffix.lower() not in {'.jpg', '.jpeg', '.png', '.webp'}:
                self.send_error(404)
                return
            content = path.read_bytes()
            self.send_response(200)
            self.send_header('Content-Type', mimetypes.guess_type(name)[0] or 'application/octet-stream')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return
        if route not in {'/', '/index.html', '/app.js', '/core.mjs', '/style.css', '/demo.json', '/retake.json'}:
            self.send_error(404)
            return
        super().do_GET()

    def end_headers(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

if __name__ == '__main__':
    from prepare_demo import prepare
    prepare()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    print(f'Examroom: http://127.0.0.1:{args.port}', flush=True)
    try:
        ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
    except KeyboardInterrupt:
        print('\nExamroom stopped.')
