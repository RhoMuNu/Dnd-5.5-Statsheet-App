import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { existingHost, hostPort } from "./startup.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
function openBrowser(port) {
  if (process.platform !== "win32") { console.log(`Open http://localhost:${port} in your browser.`); return; }
  const browser = spawn(process.env.ComSpec ?? "cmd.exe", ["/c", "start", "", `http://localhost:${port}`], { detached: true, stdio: "ignore", windowsHide: true });
  browser.on("error", () => console.log(`Open http://localhost:${port} in your browser.`));
  browser.unref();
}
try {
  if (Number(process.versions.node.split(".")[0]) < 24) throw new Error("TaleForge needs Node.js 24 or newer. Use the bundled runtime in the Windows release.");
  for (const file of ["dist/index.html", "dist/rules.mjs"]) if (!existsSync(join(root, file))) throw new Error("The app files are incomplete. Extract the entire release ZIP before starting TaleForge. Source checkouts need npm run build first.");
  const settingsFile = join(root, "host-settings.json");
  const settings = existsSync(settingsFile) ? JSON.parse(readFileSync(settingsFile, "utf8")) : {};
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) throw new Error("host-settings.json must contain an object with a port and openBrowser setting.");
  if (settings.openBrowser !== undefined && typeof settings.openBrowser !== "boolean") throw new Error("Set openBrowser to true or false in host-settings.json.");
  const port = hostPort(process.env.TALEFORGE_PORT ?? settings.port ?? 4173, process.env.TALEFORGE_PORT === "0");
  const shouldOpen = process.env.TALEFORGE_OPEN_BROWSER !== undefined ? process.env.TALEFORGE_OPEN_BROWSER === "1" : settings.openBrowser !== false;
  if (process.argv.includes("--check")) {
    console.log(`TaleForge launch files are ready. Configured port: ${port}.`);
  } else if (await existingHost(port)) {
    console.log(`TaleForge is already running at http://localhost:${port}. Using the existing host; no second server was started.`);
    if (process.env.TALEFORGE_DATA_DIR) console.log("The existing host keeps its current data directory.");
    if (shouldOpen) openBrowser(port);
  } else {
    process.env.TALEFORGE_PORT = String(port);
    process.env.TALEFORGE_OPEN_BROWSER = shouldOpen ? "1" : "0";
    process.env.NODE_ENV = "production";
    await import("./index.mjs");
  }
} catch (error) {
  console.error(`\nTaleForge could not start: ${error instanceof SyntaxError ? "host-settings.json is not valid JSON. Restore the copy supplied with the release." : error.message}`);
  process.exitCode = 1;
}
