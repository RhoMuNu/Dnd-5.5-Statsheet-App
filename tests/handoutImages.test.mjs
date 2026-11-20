import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import assert from "node:assert/strict";
import test from "node:test";

const directory = mkdtempSync(join(tmpdir(), "tf-handout-"));
async function startHost() {
  const child = spawn(process.execPath, ["server/index.mjs"], { env: { ...process.env, TALEFORGE_PORT: "0", TALEFORGE_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  const port = await new Promise((resolve) => child.stdout.on("data", (d) => { output += d; const m = output.match(/listening on 0\.0\.0\.0:(\d+)/); if (m) resolve(Number(m[1])); }));
  return { child, base: `http://127.0.0.1:${port}` };
}
test("handout images are served by URL, kept on DM edits, restored after restart, and cleared", { timeout: 20000 }, async () => {
let host = await startHost();
const call = async (path, method = "GET", body, token) => {
  const response = await fetch(host.base + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
};
try {
  const dm = (await call("/api/campaigns", "POST", { name: "Handout check" })).data;
  const player = (await call(`/api/campaigns/${dm.code}/join`, "POST", { name: "Ann" })).data;
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";
  const published = (await call(`/api/campaigns/${dm.code}/board`, "POST", { revision: 0, title: "Map", text: "", privateNotes: "secret", image: `data:image/png;base64,${png}` }, dm.token)).data.board;
  assert.match(published.image, /^\/api\/campaigns\/[A-Z0-9]+\/board-image\?v=/);

  const snapshot = (await call(`/api/campaigns/${dm.code}`, "GET", undefined, player.token)).data;
  assert.equal(snapshot.board.image, published.image, "players get the same image URL");
  assert.equal(snapshot.board.privateNotes, undefined, "players still never see DM notes");
  const image = await fetch(`${host.base}${published.image}&token=${encodeURIComponent(player.token)}`);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await image.arrayBuffer()), Buffer.from(png, "base64"));
  assert.equal((await fetch(`${host.base}${published.image}`)).status, 401, "image needs a campaign session");

  // The DM editor sends back the URL it was given: the image is kept and its URL is unchanged.
  const edited = (await call(`/api/campaigns/${dm.code}/board`, "POST", { ...published, title: "Map v2" }, dm.token)).data.board;
  assert.equal(edited.title, "Map v2");
  assert.equal(edited.image, published.image);
  assert.equal(readdirSync(join(directory, "board-images")).length, 1);
  assert.ok(!readFileSync(join(directory, "lan-campaigns.json"), "utf8").includes(png), "the campaign file holds only a reference");

  // Restart: the image is restored from board-images/.
  host.child.kill(); await new Promise((r) => host.child.on("exit", r));
  host = await startHost();
  const restored = (await call(`/api/campaigns/${dm.code}`, "GET", undefined, dm.token)).data.board;
  assert.equal(restored.image, published.image);
  assert.equal(restored.privateNotes, "secret");
  const cleared = (await call(`/api/campaigns/${dm.code}/board`, "POST", { ...restored, image: "" }, dm.token)).data.board;
  assert.equal(cleared.image, "");
  assert.equal((await fetch(`${host.base}${published.image}&token=${encodeURIComponent(dm.token)}`)).status, 404);
} finally {
  host.child.kill(); await new Promise((r) => setTimeout(r, 300)); rmSync(directory, { recursive: true, force: true });
}
});
