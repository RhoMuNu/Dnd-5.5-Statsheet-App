import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { defaultCharacterStats, defaultCombatState } from "../src/data/characters.ts";
import { makeEffect } from "../src/data/effects.ts";
import { SPELL_CATALOG, spellFromCatalog } from "../src/data/rulesCatalog.ts";

test("physical LAN casts stage every required die, commit only on completion and safely replay their receipt", { timeout: 25000 }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "taleforge-physical-test-"));
  const child = spawn(process.execPath, ["server/index.mjs"], { env: { ...process.env, TALEFORGE_PORT: "0", TALEFORGE_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  let output = "", errors = ""; child.stderr.on("data", (data) => { errors += data; });
  try {
    const port = await new Promise((resolve, reject) => { child.stdout.on("data", (data) => { output += data; const match = output.match(/listening on 0\.0\.0\.0:(\d+)/); if (match) resolve(Number(match[1])); }); child.once("error", reject); child.once("exit", (code) => reject(Error(`Host exited ${code}: ${errors}`))); });
    const request = async (path, body, token, method = "POST") => { const response = await fetch(`http://127.0.0.1:${port}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) }); return { status: response.status, data: await response.json() }; };
    const dm = (await request("/api/campaigns", { name: "Physical dice" })).data, route = `/api/campaigns/${dm.code}`;
    const player = (await request(`${route}/join`, { name: "Alice" })).data;
    const hero = (id, name) => ({ ...defaultCharacterStats(), id, name: id, concept: "", species: "Human", characterClass: name, classLevels: { [name]: 5 }, level: 5, background: "", combat: defaultCombatState(), createdAt: "2026-11-05T00:00:00Z", updatedAt: "2026-11-05T00:00:00Z" });
    const caster = hero("caster", "Wizard"); caster.abilityScores.Intelligence = 16;
    caster.spells = [spellFromCatalog(SPELL_CATALOG.find((spell) => spell.name === "Fire Bolt").key, "bolt", "Wizard")];
    const target = hero("target", "Fighter"); target.currentHitPoints = 25; target.combat.concentration = "Bless"; target.combat.concentrationId = "old-link"; target.combat.effects = [makeEffect("Bless", "bless")];
    for (const character of [caster, target]) assert.equal((await request(`${route}/characters`, { character, shared: true }, player.token)).status, 200);
    let revision = 0;
    for (const action of [{ type: "add", characterId: caster.id, initiative: 20 }, { type: "add", characterId: target.id, initiative: 10 }, { type: "start" }]) { const result = await request(`${route}/encounter`, { revision, action }, dm.token); assert.equal(result.status, 200); revision = result.data.encounter.revision; }
    const snapshot = async () => (await request(route, undefined, player.token, "GET")).data;
    const state = await snapshot();
    const payload = { casterId: caster.id, spellId: "bolt", className: "Wizard", targets: [{ id: target.id }], requestId: "physical-bolt", baseUpdatedAt: state.characters.find((entry) => entry.character.id === caster.id).character.updatedAt, diceMode: "physical", diceFaces: [] };
    let steps = 0, completed;
    for (;;) {
      const response = await request(`${route}/cast`, payload, player.token); assert.equal(response.status, 200, JSON.stringify(response.data));
      if (!response.data.diceRequest) { completed = response.data; break; }
      const preview = await snapshot();
      assert.equal(preview.characters.find((entry) => entry.character.id === caster.id).character.combat.turn.actionUsed, false);
      assert.equal(preview.characters.find((entry) => entry.character.id === target.id).character.currentHitPoints, 25);
      assert.equal(preview.activity.length, 0);
      const needed = response.data.diceRequest;
      assert.ok(++steps < 15); assert.equal(needed.index, payload.diceFaces.length);
      payload.targetVersions = response.data.targetVersions;
      if (steps === 1) {
        assert.equal((await request(`${route}/cast`, { ...payload, targetVersions: { [target.id]: "stale" } }, player.token)).status, 409);
        assert.equal((await request(`${route}/cast`, { ...payload, diceFaces: [{ ...needed, value: 21 }] }, player.token)).status, 400);
      }
      const value = needed.sides === 20 ? needed.label.includes("attack") ? 20 : 1 : needed.sides === 10 ? 3 : 1;
      payload.diceFaces.push({ ...needed, value });
    }
    assert.equal(steps, 7); // d20 attack, four critical damage dice, concentration d20 and Bless d4.
    assert.equal(completed.diceSource, "physical"); assert.match(completed.summary, /Physical dice/);
    const after = await snapshot();
    assert.equal(after.characters.find((entry) => entry.character.id === caster.id).character.combat.turn.actionUsed, true);
    assert.equal(after.characters.find((entry) => entry.character.id === target.id).character.currentHitPoints, 13);
    assert.equal(after.characters.find((entry) => entry.character.id === target.id).character.combat.concentration, "");
    assert.equal((await request(`${route}/cast`, payload, player.token)).data.summary, completed.summary);
    assert.equal((await snapshot()).activity.length, 1);
    const quick = { kind: "dice", expression: "1d20+5", requestId: "physical-quick", diceMode: "physical", diceFaces: [{ sides: 20, value: 20, label: "Shared roll 1d20" }] };
    const shared = await request(`${route}/activity`, quick, dm.token); assert.equal(shared.status, 200); assert.match(shared.data.entry.summary, /= 25$/); assert.equal(shared.data.entry.diceSource, "physical");
    assert.equal((await request(`${route}/activity`, quick, dm.token)).data.entry.id, shared.data.entry.id);
    assert.equal((await request(`${route}/activity`, { ...quick, requestId: "invalid-quick", diceFaces: [{ ...quick.diceFaces[0], value: 21 }] }, dm.token)).status, 400);
  } finally { const stopped = once(child, "exit"); child.kill(); await stopped; await rm(directory, { recursive: true, force: true }); }
});
