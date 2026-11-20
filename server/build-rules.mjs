import { build } from "esbuild";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { BUILD_STAMP } from "./build-stamp.mjs";
await build({ entryPoints: ["server/rules-entry.ts"], bundle: true, platform: "node", format: "esm", target: "node24", outfile: "dist/rules.mjs" });
// Runs last in every build, so the stamp marks dist/ as matching the current sources.
mkdirSync(dirname(BUILD_STAMP), { recursive: true });
writeFileSync(BUILD_STAMP, new Date().toISOString());
