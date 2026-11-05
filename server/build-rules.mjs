import { build } from "esbuild";
await build({ entryPoints: ["server/rules-entry.ts"], bundle: true, platform: "node", format: "esm", target: "node24", outfile: "dist/rules.mjs" });
