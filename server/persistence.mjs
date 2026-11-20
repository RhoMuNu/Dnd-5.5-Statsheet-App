import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const pause = (milliseconds) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
const IMAGE_FOLDER = "board-images";
const imageFolder = (file) => join(dirname(file), IMAGE_FOLDER);
const imageFileName = (image) => `${createHash("sha256").update(image).digest("hex").slice(0, 32)}.txt`;

export class CampaignSaveError extends Error {
  constructor(cause) {
    super("The host could not save campaign data. Changes were not applied. Check disk space and folder permissions, then retry.", { cause });
    this.status = 503;
  }
}

/**
 * Handout images (up to ~1 MB each) are stored once in board-images/, named by their content,
 * so the campaign file only holds a reference and stays small. Older files with inline images
 * still load; their images move out on the next save.
 */
function encodeStore(store, images) {
  const names = new Set();
  const text = JSON.stringify(store, (key, value) => {
    if (key !== "board" || !value || typeof value.image !== "string" || !value.image.startsWith("data:")) return value;
    const name = imageFileName(value.image);
    images.set(name, value.image); names.add(name);
    return { ...value, image: "", imageFile: name };
  });
  return { text, names };
}
function decodeStore(text, readImage) {
  return JSON.parse(text, (key, value) => {
    if (key !== "board" || !value || typeof value.imageFile !== "string") return value;
    const { imageFile, ...board } = value;
    return { ...board, image: readImage(imageFile) ?? "" };
  });
}

/** Reads the campaign store, restoring handout images from board-images/. A missing file is an empty store. */
export function loadCampaignStore(file) {
  if (!existsSync(file)) return { campaigns: [] };
  return decodeStore(readFileSync(file, "utf8"), (name) => {
    const path = join(imageFolder(file), name);
    if (/^[0-9a-f]{32}\.txt$/.test(name) && existsSync(path)) return readFileSync(path, "utf8");
    console.warn(`Handout image ${name} is missing from ${imageFolder(file)}; that handout will show no image.`);
    return "";
  });
}

/** Deletes stored images that neither the campaign file nor its backup refers to (best effort). */
export function pruneBoardImages(file) {
  try {
    const folder = imageFolder(file);
    if (!existsSync(folder)) return;
    const referenced = new Set();
    for (const path of [file, `${file}.bak`]) if (existsSync(path)) for (const match of readFileSync(path, "utf8").matchAll(/"imageFile":"([0-9a-f]{32}\.txt)"/g)) referenced.add(match[1]);
    for (const name of readdirSync(folder)) if (/^[0-9a-f]{32}\.txt$/.test(name) && !referenced.has(name)) unlinkSync(join(folder, name));
  } catch { /* Unused images only take disk space; never block startup on cleanup. */ }
}

// Keep the previous committed snapshot, rather than partially mutated request data.
// Injected filesystem operations let tests exercise disk failures without risking real campaigns.
export function campaignPersistence(file, initial, overrides = {}) {
  const io = { writeFileSync, renameSync, pause, existsSync, mkdirSync, ...overrides };
  const images = new Map();
  const stored = new Set();
  let committed = encodeStore(initial, images);
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
  // Images are written before any campaign file that refers to them; content names never change, so each is written once.
  function storeImages(names) {
    for (const name of names) {
      if (stored.has(name)) continue;
      const path = join(imageFolder(file), name);
      if (!io.existsSync(path)) { io.mkdirSync(imageFolder(file), { recursive: true }); atomicWrite(path, images.get(name)); }
      stored.add(name);
    }
  }
  return {
    save(store) {
      const next = encodeStore(store, images);
      // Requests that change nothing (retries, repeated values) do not touch the disk.
      if (next.text === committed.text) return;
      try {
        storeImages(new Set([...committed.names, ...next.names]));
        atomicWrite(`${file}.bak`, committed.text);
        atomicWrite(file, next.text);
        committed = next;
      } catch (error) {
        // Preserve campaign object identities held by requests awaiting their body.
        const previous = decodeStore(committed.text, (name) => images.get(name));
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
