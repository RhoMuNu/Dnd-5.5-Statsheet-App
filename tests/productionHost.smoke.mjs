import test from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, rename, mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";

test("built production host serves assets, rejects missing routes, recovers from failed saves, and resumes rooms after restart", { timeout: 30000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleforge-production-"));
  const releaseRoot = process.env.TALEFORGE_RELEASE_ROOT;
  const executable = releaseRoot ? join(releaseRoot, "runtime/node.exe") : process.execPath;
  const workingDirectory = releaseRoot ?? process.cwd();
  const hostScript = releaseRoot ? "server/launch.mjs" : "server/index.mjs";
  const hostEnvironment = { ...process.env, TALEFORGE_OPEN_BROWSER: "0", TALEFORGE_PORT: "0", TALEFORGE_DATA_DIR: directory, ...(releaseRoot ? { PATH: join(process.env.SystemRoot ?? "C:\\Windows", "System32") } : {}) };
  let child;
  async function stop() {
    if (!child || child.exitCode !== null) return;
    const stopped = once(child, "exit"); child.kill(); await stopped; child = null;
  }
  async function start() {
    child = spawn(executable, [hostScript, "--production"], { cwd: workingDirectory, env: hostEnvironment, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let output = "", errors = "";
    child.stderr.on("data", (chunk) => { errors += chunk; });
    return await new Promise((resolve, reject) => {
      child.stdout.on("data", (chunk) => { output += chunk; const port = output.match(/listening on 0\.0\.0\.0:(\d+)/)?.[1]; if (port) resolve(`http://127.0.0.1:${port}`); });
      child.once("error", reject);
      child.once("exit", (code) => reject(new Error(`Production host exited ${code}: ${errors}`)));
    });
  }
  try {
    if (releaseRoot) {
      assert.equal(existsSync(join(releaseRoot, "node_modules")), false);
      assert.equal(existsSync(join(releaseRoot, "src")), false);
      assert.equal(existsSync(join(releaseRoot, "lan-campaigns.json")), false);
      for (const file of ["Start TaleForge Host.bat", "START HERE.txt", "host-settings.json", "licenses/Node.js-LICENSE.txt", "licenses/SRD-ATTRIBUTION.md"]) assert.ok(existsSync(join(releaseRoot, file)), `Missing ${file}`);
      const manifest = JSON.parse(await readFile(join(releaseRoot, "release.json"), "utf8"));
      const runtime = await readFile(executable);
      assert.equal(createHash("sha256").update(runtime).digest("hex"), manifest.nodeSha256);
      const check = spawnSync(executable, ["server/launch.mjs", "--check"], { cwd: workingDirectory, env: hostEnvironment, encoding: "utf8", windowsHide: true });
      assert.equal(check.status, 0, check.stderr);
      assert.match(check.stdout, /launch files are ready/);
      assert.equal(existsSync(join(directory, "lan-campaigns.json")), false);
    }
    let base = await start();
    const conflict = spawnSync(executable, ["server/index.mjs", "--production"], { cwd: workingDirectory, env: { ...hostEnvironment, TALEFORGE_PORT: new URL(base).port, TALEFORGE_DATA_DIR: join(directory, "conflict-check") }, encoding: "utf8", timeout: 5000, windowsHide: true });
    assert.equal(conflict.status, 1, conflict.stderr);
    assert.match(conflict.stderr, /already used by another app/);
    assert.doesNotMatch(conflict.stderr, /Unhandled 'error' event/);
    if (releaseRoot) {
      const reopened = spawnSync(executable, ["server/launch.mjs"], { cwd: workingDirectory, env: { ...hostEnvironment, TALEFORGE_PORT: new URL(base).port }, encoding: "utf8", timeout: 5000, windowsHide: true });
      assert.equal(reopened.status, 0, reopened.stderr);
      assert.match(reopened.stdout, /already running/);
    }
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
    const chat = { requestId: 'chat-retry', text: 'Ready for the session', actor: 'Forged DM' };
    assert.equal((await request(route + '/messages', chat)).status, 401);
    assert.equal((await request(route + '/messages', chat, player.data.token)).data.message.actor, 'Returning player');
    await request(route + '/messages', chat, player.data.token);
    const board = { revision: 0, title: 'Old ruins', text: 'The bridge is broken.', privateNotes: 'Secret encounter', image: '' };
    assert.equal((await request(route + '/board', board, player.data.token)).status, 403);
    assert.equal((await request(route + '/board', board, dm.data.token)).status, 200);
    assert.equal((await request(route + '/board', board, dm.data.token)).status, 409);
    const playerView = (await request(route, undefined, player.data.token)).data;
    assert.equal(playerView.messages.length, 1);
    assert.equal(playerView.board.text, board.text);
    assert.equal('privateNotes' in playerView.board, false);
    const eventsController = new AbortController();
    const events = await fetch(`${base}${route}/events?token=${player.data.token}`, { signal: eventsController.signal });
    const eventsReader = events.body.getReader();
    try {
      let event = new TextDecoder().decode((await eventsReader.read()).value);
      assert.doesNotMatch(event, /Secret encounter|privateNotes/);
      await request(route + '/board', { ...board, revision: 1, text: 'An updated handout.' }, dm.data.token);
      event = '';
      while (!event.includes('An updated handout.')) event += new TextDecoder().decode((await eventsReader.read()).value);
      assert.doesNotMatch(event, /Secret encounter|privateNotes/);
    } finally { eventsController.abort(); await eventsReader.cancel().catch(() => {}); }
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
    assert.equal(resumed.data.messages.length, 1);
    assert.equal(resumed.data.board.text, 'An updated handout.');
    assert.equal('privateNotes' in resumed.data.board, false);
    assert.equal((await request(route, undefined, dm.data.token)).data.board.privateNotes, 'Secret encounter');
    assert.equal((await request(route, undefined, dm.data.token)).data.role, "dm");
  } finally { await stop(); await rm(directory, { recursive: true, force: true }); }
});
