import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
import { brotliCompressSync, constants, createGzip, gzipSync } from "node:zlib";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const COMPRESSIBLE = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg"]);

/** True when the request's Accept-Encoding lists `encoding` without q=0. */
function accepts(request, encoding) {
  return String(request.headers["accept-encoding"] ?? "").split(",").some((part) => {
    const [name, ...parameters] = part.trim().toLowerCase().split(";");
    if (name.trim() !== encoding) return false;
    const quality = parameters.map((parameter) => parameter.trim()).find((parameter) => parameter.startsWith("q="));
    return !quality || Number(quality.slice(2)) > 0;
  });
}

/**
 * Serves the built app. The files never change while the host runs, so each one is read and
 * compressed once. Vite's content-hashed files under assets/ are cached by browsers permanently;
 * other files (index.html) are revalidated with an ETag so a new release is picked up immediately.
 */
export function staticFiles(distRoot) {
  const cache = new Map();
  function load(file) {
    let entry = cache.get(file);
    if (entry) return entry;
    const body = readFileSync(file);
    const extension = extname(file);
    const compress = COMPRESSIBLE.has(extension) && body.length > 1024;
    entry = {
      body, mime: MIME[extension] ?? "application/octet-stream",
      etag: `"${createHash("sha256").update(body).digest("base64url").slice(0, 27)}"`,
      gzip: compress ? gzipSync(body, { level: 9 }) : null,
      brotli: compress ? brotliCompressSync(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } }) : null,
      immutable: relative(distRoot, file).startsWith(`assets${sep}`),
    };
    cache.set(file, entry);
    return entry;
  }

  function serve(request, response, pathname) {
    let requestPath;
    try { requestPath = decodeURIComponent(pathname); } catch { response.writeHead(400); response.end("Bad request"); return; }
    if (requestPath === "/") requestPath = "/index.html";
    const candidate = resolve(distRoot, `.${normalize(requestPath)}`);
    const relativePath = relative(distRoot, candidate);
    if (relativePath.startsWith("..") || isAbsolute(relativePath)) { response.writeHead(403); response.end("Forbidden"); return; }
    if (!cache.has(candidate) && (!existsSync(candidate) || !statSync(candidate).isFile())) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found"); return;
    }
    const entry = load(candidate);
    const headers = { "Content-Type": entry.mime, "X-Content-Type-Options": "nosniff", "Cache-Control": entry.immutable ? "public, max-age=31536000, immutable" : "no-cache", ETag: entry.etag, Vary: "Accept-Encoding" };
    if (request.headers["if-none-match"] === entry.etag) { response.writeHead(304, headers); response.end(); return; }
    const encoding = entry.brotli && accepts(request, "br") ? "br" : entry.gzip && accepts(request, "gzip") ? "gzip" : null;
    const body = encoding === "br" ? entry.brotli : encoding === "gzip" ? entry.gzip : entry.body;
    response.writeHead(200, { ...headers, ...(encoding ? { "Content-Encoding": encoding } : {}), "Content-Length": body.length });
    response.end(request.method === "HEAD" ? undefined : body);
  }

  /** Reads and compresses every file ahead of the first visitor (best effort). */
  function warm(directory = distRoot) {
    try {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) warm(path); else load(path);
      }
    } catch { /* Files are loaded on first request instead. */ }
  }

  return { serve, warm };
}

/**
 * Opens a Server-Sent Events stream, gzip-compressed (flushed after every event) when the browser
 * accepts it. Snapshots identical to the last one sent on this stream are skipped.
 */
export function openEventStream(request, response) {
  const gzip = accepts(request, "gzip");
  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no", ...(gzip ? { "Content-Encoding": "gzip", Vary: "Accept-Encoding" } : {}) });
  let compressor = null;
  if (gzip) {
    compressor = createGzip({ flush: constants.Z_SYNC_FLUSH });
    compressor.on("error", () => response.destroy());
    compressor.pipe(response);
  }
  let lastSnapshot = null;
  const write = (text) => { if (compressor) compressor.write(text); else response.write(text); };
  return {
    write,
    /** Sends a snapshot unless this stream already has exactly this data. `prefix` is sent in the same chunk. */
    snapshot(data, prefix = "") {
      if (data === lastSnapshot) return false;
      lastSnapshot = data;
      write(`${prefix}event: snapshot\ndata: ${data}\n\n`);
      return true;
    },
    close() { compressor?.end(); },
  };
}
