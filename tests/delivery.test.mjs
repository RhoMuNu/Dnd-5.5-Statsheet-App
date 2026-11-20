import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { openEventStream, staticFiles } from "../server/delivery.mjs";
import { campaignPersistence, loadCampaignStore, pruneBoardImages } from "../server/persistence.mjs";

async function withServer(handler, run) {
  const server = createServer(handler);
  server.listen(0, "127.0.0.1"); await once(server, "listening");
  try { await run(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}
const raw = (url, headers = {}) => fetch(url, { headers }).then(async (response) => ({ response, body: Buffer.from(await response.arrayBuffer()) }));

test("app files are compressed once, hashed assets cache permanently, and index.html revalidates", async () => {
  const dist = mkdtempSync(join(tmpdir(), "taleforge-dist-"));
  try {
    const script = "console.log('TaleForge');\n".repeat(400), page = `<!doctype html><title>TaleForge</title>${" ".repeat(2000)}`;
    mkdirSync(join(dist, "assets")); writeFileSync(join(dist, "assets", "index-abc123.js"), script); writeFileSync(join(dist, "index.html"), page);
    const files = staticFiles(dist);
    await withServer((request, response) => files.serve(request, response, new URL(request.url, "http://x").pathname), async (base) => {
      // fetch() would decode the body itself; read the raw bytes through an explicit header and decode here.
      const brotli = await fetch(`${base}/assets/index-abc123.js`, { headers: { "accept-encoding": "br" } });
      assert.equal(brotli.headers.get("content-encoding"), "br");
      assert.equal(brotli.headers.get("cache-control"), "public, max-age=31536000, immutable");
      assert.equal(await brotli.text(), script);
      const gzip = await fetch(`${base}/assets/index-abc123.js`, { headers: { "accept-encoding": "gzip" } });
      assert.equal(gzip.headers.get("content-encoding"), "gzip");
      assert.ok(Number(gzip.headers.get("content-length")) < script.length / 5);
      const plain = await raw(`${base}/assets/index-abc123.js`, { "accept-encoding": "identity" });
      assert.equal(plain.response.headers.get("content-encoding"), null);
      assert.equal(plain.body.toString(), script);
      assert.equal((await raw(`${base}/assets/index-abc123.js`, { "accept-encoding": "br;q=0, gzip" })).response.headers.get("content-encoding"), "gzip");

      const index = await fetch(`${base}/`, { headers: { "accept-encoding": "identity" } });
      assert.equal(index.headers.get("cache-control"), "no-cache");
      assert.equal(await index.text(), page);
      const revalidated = await fetch(`${base}/index.html`, { headers: { "if-none-match": index.headers.get("etag") } });
      assert.equal(revalidated.status, 304);

      assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
      assert.equal((await fetch(`${base}/assets`)).status, 404);
    });
    // fetch() normalizes "..", so send raw paths straight to the handler: files beside dist/ are never served.
    writeFileSync(join(dist, "..", `${dist.split(/[\\/]/).pop()}-secret.txt`), "private");
    for (const path of [`/%2e%2e/${dist.split(/[\\/]/).pop()}-secret.txt`, `/assets/..%2f..%2f${dist.split(/[\\/]/).pop()}-secret.txt`]) {
      let status = 0;
      files.serve({ method: "GET", headers: {} }, { writeHead: (code) => { status = code; }, end() {} }, path);
      assert.ok(status === 403 || status === 404, `${path} answered ${status}`);
    }
    rmSync(join(dist, "..", `${dist.split(/[\\/]/).pop()}-secret.txt`));
    // The helpers decode what the browser receives.
    assert.equal(gunzipSync(readCompressed(files, dist, "gzip")).toString(), script);
    assert.equal(brotliDecompressSync(readCompressed(files, dist, "br")).toString(), script);
  } finally { rmSync(dist, { recursive: true, force: true }); }
});
function readCompressed(files, dist, encoding) {
  const chunks = [];
  const response = { writeHead() {}, end(body) { chunks.push(body); } };
  files.serve({ method: "GET", headers: { "accept-encoding": encoding } }, response, "/assets/index-abc123.js");
  assert.ok(existsSync(join(dist, "assets", "index-abc123.js")));
  return chunks[0];
}

test("event streams skip snapshots identical to the last one they sent", () => {
  const writes = [];
  const response = { writeHead: (status, headers) => writes.push({ status, headers }), write: (text) => writes.push(text) };
  const stream = openEventStream({ headers: {} }, response);
  assert.equal(writes[0].headers["Content-Encoding"], undefined);
  assert.equal(stream.snapshot('{"hp":10}', "retry: 1500\n\n"), true);
  assert.equal(writes[1], 'retry: 1500\n\nevent: snapshot\ndata: {"hp":10}\n\n');
  assert.equal(stream.snapshot('{"hp":10}'), false);
  assert.equal(stream.snapshot('{"hp":9}'), true);
  assert.equal(writes.length, 3);
  const compressed = openEventStream({ headers: { "accept-encoding": "gzip, deflate, br" } }, { writeHead: (status, headers) => writes.push(headers), on() {}, once() {}, emit() {}, write() { return true; }, end() {} });
  assert.equal(writes.at(-1)["Content-Encoding"], "gzip");
  compressed.close();
});

test("handout images are stored once outside the campaign file, unchanged saves skip the disk, and reloads restore images", () => {
  const directory = mkdtempSync(join(tmpdir(), "taleforge-images-"));
  try {
    const file = join(directory, "lan-campaigns.json");
    const image = "data:image/png;base64," + "A".repeat(200_000);
    const store = { campaigns: [{ code: "ABC123", characters: [], board: { revision: 1, title: "Map", text: "", privateNotes: "", image } }] };
    const persistence = campaignPersistence(file, { campaigns: [] });
    persistence.save(store);
    const saved = readFileSync(file, "utf8");
    assert.ok(saved.length < 1000, "the campaign file holds a reference, not the image");
    assert.ok(!saved.includes("\n  "), "the campaign file is compact JSON");
    assert.equal(readdirSync(join(directory, "board-images")).length, 1);
    assert.deepEqual(loadCampaignStore(file), store);

    let writes = 0;
    const counting = campaignPersistence(file, store, { writeFileSync: (...args) => { writes++; return writeFileSync(...args); } });
    counting.save(store);
    assert.equal(writes, 0, "saving identical data does not rewrite the file or its backup");
    store.campaigns[0].board = { ...store.campaigns[0].board, revision: 2, image: "" };
    counting.save(store);
    assert.equal(writes, 2, "only the backup and the campaign file are rewritten; the stored image is reused");

    writeFileSync(join(directory, "board-images", "0123456789abcdef0123456789abcdef.txt"), "orphan");
    pruneBoardImages(file);
    assert.deepEqual(readdirSync(join(directory, "board-images")).length, 1, "the backup still refers to the old image, so only the orphan is removed");
    assert.equal(loadCampaignStore(`${file}.bak`).campaigns[0].board.image, image);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("older campaign files with inline images and pretty-printed JSON still load", () => {
  const directory = mkdtempSync(join(tmpdir(), "taleforge-legacy-"));
  try {
    const file = join(directory, "lan-campaigns.json");
    const legacy = { campaigns: [{ code: "OLD123", characters: [{ character: { name: "Hero" } }], board: { revision: 3, title: "", text: "", privateNotes: "", image: "data:image/gif;base64,R0lGODlh" } }] };
    writeFileSync(file, JSON.stringify(legacy, null, 2));
    assert.deepEqual(loadCampaignStore(file), legacy);
    assert.deepEqual(loadCampaignStore(join(directory, "missing.json")), { campaigns: [] });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
