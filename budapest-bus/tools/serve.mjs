#!/usr/bin/env node
/**
 * A tiny, dependency-free static file server for the Budapest bus viewer.
 *
 * It serves the *repository root* so that the viewer is reachable at
 * `http://localhost:8080/budapest-bus/`, and it also serves the vendored
 * three.js and the generated assets without any extra configuration.
 *
 * Usage:
 *   node budapest-bus/tools/serve.mjs            # port 8080
 *   node budapest-bus/tools/serve.mjs --port 9000
 *
 * No third party packages are used: only `node:http`, `node:fs` and `node:path`.
 */

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Repository root: this file lives in `<root>/budapest-bus/tools/`. */
const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));

/** Minimal MIME table for everything the viewer needs. */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.obj': 'text/plain; charset=utf-8',
  '.mtl': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

/** Parse `--port <n>` / `-p <n>` / `--port=<n>`, default 8080. */
function parsePort(argv) {
  let port = 8080;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' || arg === '-p') {
      const next = Number(argv[i + 1]);
      if (Number.isInteger(next) && next > 0 && next < 65536) port = next;
      i++;
    } else if (arg.startsWith('--port=')) {
      const next = Number(arg.slice('--port='.length));
      if (Number.isInteger(next) && next > 0 && next < 65536) port = next;
    }
  }
  return port;
}

/** @param {import('node:http').ServerResponse} res */
function send(res, status, type, body) {
  const buffer = Buffer.from(body);
  res.writeHead(status, { 'Content-Type': type, 'Content-Length': buffer.length });
  res.end(buffer);
}

/** Map a request path to an absolute file path, guarding against traversal. */
function toFilePath(pathname) {
  let rel = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const filePath = resolve(join(ROOT, rel));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) return null;
  return filePath;
}

const port = parsePort(process.argv.slice(2));

const server = createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return send(res, 405, 'text/plain; charset=utf-8', 'Method Not Allowed');
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    let pathname = url.pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';

    let filePath = toFilePath(pathname);
    if (!filePath) return send(res, 403, 'text/plain; charset=utf-8', 'Forbidden');

    let info = await stat(filePath).catch(() => null);
    // Directory without a trailing slash: serve its index.html.
    if (info?.isDirectory()) {
      filePath = join(filePath, 'index.html');
      info = await stat(filePath).catch(() => null);
    }

    if (!info || !info.isFile()) {
      return send(res, 404, 'text/plain; charset=utf-8', `404 Not Found: ${pathname}`);
    }

    const type = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      'Cache-Control': 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(filePath).pipe(res);
  } catch (err) {
    send(res, 500, 'text/plain; charset=utf-8', `500 Internal Server Error\n${err?.message ?? err}`);
  }
});

server.listen(port, () => {
  const url = `http://localhost:${port}/budapest-bus/`;
  console.log(`Budapest bus viewer served from ${ROOT}`);
  console.log(`  open ${url}`);
});
