// Prepares dist/ for `npm run host` (and Start TaleForge Host.bat in a source checkout).
// Hosting does not need the TypeScript type-check, and an unchanged checkout does not need a rebuild:
// the full checked build stays in `npm run build` / `npm run verify` / releases.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BUILD_STAMP } from "../server/build-stamp.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const inputs = ["src", "server/rules-entry.ts", "server/build-rules.mjs", "index.html", "vite.config.ts", "package.json", "package-lock.json"];

function newest(path) {
  if (!existsSync(path)) return 0;
  const stats = statSync(path);
  if (!stats.isDirectory()) return stats.mtimeMs;
  return readdirSync(path).reduce((latest, name) => Math.max(latest, newest(join(path, name))), stats.mtimeMs);
}
function run(script, args) {
  const result = spawnSync(process.execPath, [join(root, script), ...args], { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const stamp = join(root, BUILD_STAMP);
const complete = ["dist/index.html", "dist/rules.mjs"].every((file) => existsSync(join(root, file)));
const builtAt = complete && existsSync(stamp) ? statSync(stamp).mtimeMs : 0;
if (builtAt >= Math.max(...inputs.map((input) => newest(join(root, input))))) {
  console.log("TaleForge app files are up to date; skipping the build.");
} else {
  console.log("Building TaleForge app files...");
  run("node_modules/vite/bin/vite.js", ["build", "--logLevel", "warn"]);
  run("server/build-rules.mjs", []);
}
