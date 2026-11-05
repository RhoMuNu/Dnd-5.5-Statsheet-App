import test from "node:test";
import assert from "node:assert/strict";
import { loadCharacters, saveCharacters, characterLibraryRecovery, defaultCharacterStats } from "../src/data/characters.ts";

const key = "taleforge.characters.v1", recoveryKey = "taleforge.characters.recovery.v1";
function storageTest(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try { run(values, storage); }
  finally {
    values.clear(); loadCharacters();
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
  }
}
test("damaged browser JSON is retained before an empty library can be autosaved", () => storageTest((values) => {
  values.set(key, '{"damaged":');
  assert.deepEqual(loadCharacters(), []);
  assert.equal(characterLibraryRecovery(), '{"damaged":');
  assert.equal(saveCharacters([]), true);
  assert.equal(values.get(recoveryKey), '{"damaged":');
}));
test("one bad record does not hide valid heroes and the full original is recoverable", () => storageTest((values) => {
  const hero = { ...defaultCharacterStats(), id: "hero", name: "Hero", concept: "", species: "Human", characterClass: "Fighter", background: "Soldier", level: 1, createdAt: "2026-11-05", updatedAt: "2026-11-05" };
  const raw = JSON.stringify([hero, null]); values.set(key, raw);
  assert.equal(loadCharacters()[0].name, "Hero");
  assert.equal(characterLibraryRecovery(), raw);
}));
test("recovery failure or an existing different recovery copy blocks destructive autosave", () => storageTest((values, storage) => {
  values.set(key, "broken");
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  loadCharacters();
  assert.equal(saveCharacters([]), false);
  assert.equal(values.get(key), "broken");
  storage.setItem = (key, value) => values.set(key, value);
  values.set(recoveryKey, "earlier original"); loadCharacters();
  assert.equal(saveCharacters([]), false);
  assert.equal(values.get(key), "broken");
  assert.equal(values.get(recoveryKey), "earlier original");
}));
