import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
let directory;
try {
  const archive = resolve(process.argv[2] ?? "");
  if (!archive.endsWith(".zip") || !existsSync(archive)) throw new Error("Pass a release ZIP to verify.");
  directory = mkdtempSync(join(tmpdir(), "taleforge-release-"));
  const extracted = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:TALEFORGE_ARCHIVE_SOURCE -DestinationPath $env:TALEFORGE_ARCHIVE_DEST"], { env: { ...process.env, TALEFORGE_ARCHIVE_SOURCE: archive, TALEFORGE_ARCHIVE_DEST: directory }, stdio: "inherit", windowsHide: true });
  if (extracted.error || extracted.status !== 0) throw new Error("Could not extract the release for verification.");
  const entries = readdirSync(directory);
  if (entries.length !== 1 || !entries[0].startsWith("TaleForge-")) throw new Error("The archive must contain one TaleForge app folder.");
  const releaseRoot = join(directory, entries[0]);
  console.log("Testing the extracted ZIP using its bundled runtime, outside the source checkout...");
  const result = spawnSync(process.execPath, ["--import", "./tests/register.mjs", "--test", "tests/productionHost.smoke.mjs"], { cwd: root, env: { ...process.env, TALEFORGE_RELEASE_ROOT: releaseRoot }, stdio: "inherit", windowsHide: true });
  if (result.error || result.status !== 0) throw new Error("The extracted portable release failed its production smoke test.");
} catch (error) { console.error(error.message); process.exitCode = 1; }
finally {
  if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith("taleforge-release-")) rmSync(directory, { recursive: true, force: true });
}
