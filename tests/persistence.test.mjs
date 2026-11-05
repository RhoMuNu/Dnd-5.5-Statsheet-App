import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { campaignPersistence, CampaignSaveError } from "../server/persistence.mjs";

test("campaign commits retain a readable previous snapshot for recovery", () => {
  const directory = mkdtempSync(join(tmpdir(), "taleforge-persistence-"));
  try {
    const file = join(directory, "campaigns.json");
    const store = { campaigns: [{ code: "ABC123", characters: [] }] };
    const persistence = campaignPersistence(file, store);
    persistence.save(store);
    store.campaigns[0].characters.push({ name: "Saved hero" });
    persistence.save(store);
    assert.equal(JSON.parse(readFileSync(file, "utf8")).campaigns[0].characters[0].name, "Saved hero");
    assert.deepEqual(JSON.parse(readFileSync(file + ".bak", "utf8")).campaigns[0].characters, []);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("transient Windows rename locks retry without applying a request twice", () => {
  const files = new Map(); let locks = 2; const waits = [];
  const io = {
    writeFileSync: (file, text) => files.set(file, text),
    renameSync: (from, to) => {
      if (to === "campaigns.json" && locks-- > 0) throw Object.assign(new Error("File locked"), { code: "EPERM" });
      files.set(to, files.get(from)); files.delete(from);
    },
    pause: (milliseconds) => waits.push(milliseconds),
  };
  const store = { campaigns: [] };
  const persistence = campaignPersistence("campaigns.json", store, io);
  store.campaigns.push({ code: "ABC123" });
  persistence.save(store);
  assert.deepEqual(waits, [15, 35]);
  assert.equal(JSON.parse(files.get("campaigns.json")).campaigns.length, 1);
});

test("permanent save failure rolls back sheets, new rooms and receipts while preserving in-flight campaign references", () => {
  const campaign = { code: "ABC123", characters: [{ hp: 10 }], castReceipts: [] };
  const store = { campaigns: [campaign] };
  let attempts = 0;
  const persistence = campaignPersistence("campaigns.json", store, {
    writeFileSync: () => {},
    renameSync: () => { attempts++; throw Object.assign(new Error("Disk full"), { code: "ENOSPC" }); },
    pause: () => assert.fail("Non-transient failures must not retry"),
  });
  campaign.characters[0].hp = 0;
  campaign.castReceipts.push({ id: "uncommitted-cast" });
  store.campaigns.push({ code: "UNSAVED" });
  assert.throws(() => persistence.save(store), CampaignSaveError);
  assert.equal(store.campaigns[0], campaign);
  assert.equal(campaign.characters[0].hp, 10);
  assert.deepEqual(campaign.castReceipts, []);
  assert.equal(store.campaigns.length, 1);
  assert.equal(attempts, 1);
});
