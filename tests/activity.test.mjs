import { test } from "node:test";
import assert from "node:assert/strict";
import { makeActivity } from "../server/activity.mjs";

const auth = (overrides = {}) => ({ role: "player", player: { id: "alice", name: "Alice" }, campaign: { dmName: "DM", characters: [{ ownerId: "alice", shared: true, character: { id: "hero", name: "Hero" } }], activity: [] }, ...overrides });
test("host dice validate expressions, apply modifiers once, and include a breakdown", () => {
  const entry = makeActivity(auth(), { kind: "dice", expression: " 2d8 + 3 ", requestId: "request-1" }, "id", () => 4);
  assert.equal(entry.summary, "2d8+3: [4, 4] + 3 = 11");
  assert.equal(entry.actor, "Alice");
  for (const expression of ["0d6", "51d6", "999999d20", "1d3", "1d20+1000", "1d20;process.exit()", "1d20+NaN"]) assert.throws(() => makeActivity(auth(), { kind: "dice", expression, requestId: "bad" }, "id", () => 1));
});
test("retried requests return the same roll without rolling again; request IDs are scoped to actors", () => {
  const original = makeActivity(auth(), { kind: "dice", expression: "1d20", requestId: "same" }, "id", () => 7);
  const state = auth(); state.campaign.activity = [original];
  assert.equal(makeActivity(state, { kind: "dice", expression: "1d20", requestId: "same" }, "new-id", () => { throw Error("Rerolled!"); }), original);
  state.player = { id: "bob", name: "Bob" };
  assert.equal(makeActivity(state, { kind: "dice", expression: "1d20", requestId: "same" }, "bob-id", () => 9).summary, "1d20: [9] = 9");
});
test("sheet results require shared ownership and cannot forge actor or character names", () => {
  const body = { kind: "sheet", requestId: "report", characterId: "hero", summary: "Attack = 18", actor: "Someone else", characterName: "Fake" };
  const entry = makeActivity(auth(), body, "id", () => 1);
  assert.equal(entry.actor, "Alice"); assert.equal(entry.characterName, "Hero");
  const state = auth(); state.campaign.characters[0].shared = false;
  assert.throws(() => makeActivity(state, body, "id", () => 1), /shared character/);
  state.campaign.characters[0].shared = true; state.player.id = "bob";
  assert.throws(() => makeActivity(state, body, "id", () => 1), /shared character/);
  assert.throws(() => makeActivity(auth(), { ...body, summary: "x".repeat(1501) }, "id", () => 1));
});
