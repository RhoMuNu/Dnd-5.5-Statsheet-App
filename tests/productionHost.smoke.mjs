import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, rename, mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("built production host serves assets, rejects missing routes, recovers from failed saves, and resumes rooms after restart", { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleforge-production-"));
  let child;
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const stopped = once(child, "exit"); child.kill(); await stopped; child = null;
  }
  async function start() {
    child = spawn(process.execPath, ["server/index.mjs", "--production"], { env: { ...process.env, TALEFORGE_OPEN_BROWSER: "0", TALEFORGE_PORT: "0", TALEFORGE_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "", errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk; });
    return await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => { output += chunk; const port = output.match(/listening on 0\.0\.0\.0:(\d+)/)?.[1]; if (port) resolve(`http://127.0.0.1:${port}`); });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Production host exited ${code}: ${errors}`)));
    });
  }
  try {
    let base = await start();
    const request = async (path, body, token) => {
      const response = await fetch(base + path, { method: body ? "POST" : "GET", headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, data: await response.json() };
    };
    const page = await fetch(base + "/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    const asset = (await page.text()).match(/src="([^"]+\.js)"/)?.[1];
    assert.ok(asset, "Built page must reference a JavaScript asset");
    const javascript = await fetch(base + asset);
    assert.equal(javascript.status, 200);
    assert.match(javascript.headers.get("content-type"), /javascript/);
    assert.equal(javascript.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await fetch(base + "/assets/missing.js")).status, 404);
    assert.equal((await request("/api/missing")).status, 404);
    const dm = await request("/api/campaigns", { name: "Production restart check" });
    assert.equal(dm.status, 201);
    const route = `/api/campaigns/${dm.data.code}`;
    const player = await request(route + "/join", { name: "Returning player" });
    assert.equal(player.status, 201);
    const file = join(directory, "lan-campaigns.json");
    const saved = JSON.parse(await readFile(file, "utf8"));
    assert.equal(saved.campaigns[0].players.length, 1);
    assert.ok(JSON.parse(await readFile(file + ".bak", "utf8")).campaigns[0]);

    // Make the destination unwritable without depending on OS account permissions.
    await rename(file, file + ".held"); await mkdir(file);
    assert.equal((await request(route + "/join", { name: "Must not be committed" })).status, 503);
    assert.equal((await request(route, undefined, dm.data.token)).data.players.length, 1);
    await rmdir(file); await rename(file + ".held", file);
    assert.equal((await request(route + "/join", { name: "Retry succeeds" })).status, 201);
    await stop(); base = await start();
    const resumed = await request(route, undefined, player.data.token);
    assert.equal(resumed.status, 200);
    assert.equal(resumed.data.players.length, 2);
    assert.equal(resumed.data.campaign.name, "Production restart check");
    assert.equal((await request(route, undefined, dm.data.token)).data.role, "dm");
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
