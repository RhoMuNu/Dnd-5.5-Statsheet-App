import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const viteEntry = resolve(root, "node_modules", "vite", "bin", "vite.js");
const processes = [
  spawn(process.execPath, [viteEntry, "--host", "0.0.0.0"], { cwd: root, stdio: "inherit" }),
  spawn(process.execPath, [resolve(root, "server", "index.mjs")], { cwd: root, stdio: "inherit" }),
];
let shuttingDown = false;

function stopAll(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of processes) if (child.exitCode === null) child.kill();
  process.exitCode = code;
}

for (const child of processes) {
  child.on("error", (error) => { console.error(error); stopAll(1); });
  child.on("exit", (code) => { if (!shuttingDown) stopAll(code ?? 1); });
}
process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));
