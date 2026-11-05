import { test } from "node:test";
import assert from "node:assert/strict";
import { rememberLanSession, savedLanSessions } from "../src/data/lanSessions.ts";

test("saved rooms preserve DM and player access when changing rooms, and update labels without duplication", () => {
  const data = new Map(); const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const dm = { code: "ABCDEF", token: "dm-secret", role: "dm", playerId: null, name: "DM" };
  const player = { code: "ABCDEF", token: "player-secret", role: "player", playerId: "p", name: "Alice" };
  rememberLanSession(dm, storage); rememberLanSession(player, storage);
  rememberLanSession({ ...dm, campaignName: "The campaign" }, storage);
  assert.equal(savedLanSessions(storage).length, 2);
  assert.equal(savedLanSessions(storage)[0].campaignName, "The campaign");
  assert.equal(savedLanSessions(storage)[1].token, "player-secret");
  storage.setItem("taleforge.lan.saved-sessions.v1", '{"unexpected":true}');
  assert.deepEqual(savedLanSessions(storage), []);
});
