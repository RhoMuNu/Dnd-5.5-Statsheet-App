import { renameSync, writeFileSync } from "node:fs";

const pause = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);

export class CampaignSaveError extends Error {
  constructor(cause) {
    super("The host could not save campaign data. Changes were not applied. Check disk space and folder permissions, then retry.", { cause });
    this.status = 503;
  }
}

// Keep the previous committed snapshot, rather than partially mutated request data.
// Injected filesystem operations let tests exercise disk failures without risking real campaigns.
export function campaignPersistence(file, initial, io = { writeFileSync, renameSync, pause }) {
  let committed = JSON.stringify(initial, null, 2);
  function atomicWrite(path, contents) {
    const temporary = `${path}.tmp`;
    io.writeFileSync(temporary, contents, { encoding: "utf8", mode: 0o600, flush: true });
    for (let attempt = 0; ; attempt++) {
      try { io.renameSync(temporary, path); return; }
      catch (error) {
        if (attempt >= 3 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
        io.pause([15, 35, 75][attempt]);
      }
    }
  }
  return {
    save(store) {
      const next = JSON.stringify(store, null, 2);
      try {
        atomicWrite(`${file}.bak`, committed);
        atomicWrite(file, next);
        committed = next;
      } catch (error) {
        // Preserve campaign object identities held by requests awaiting their body.
        const previous = JSON.parse(committed);
        const restored = previous.campaigns.map((saved) => {
          const current = store.campaigns.find((entry) => entry.code === saved.code);
          if (!current) return saved;
          for (const key of Object.keys(current)) delete current[key];
          return Object.assign(current, saved);
        });
        store.campaigns.splice(0, store.campaigns.length, ...restored);
        throw new CampaignSaveError(error);
      }
    },
  };
}
