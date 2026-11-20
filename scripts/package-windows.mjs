import { createHash } from "node:crypto";
import { cpSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const runtime = JSON.parse(readFileSync(join(root, "packaging/runtime.json"), "utf8"));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const hash = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");
let stagingDirectory;
function run(command, args, env = {}) {
  const result = spawnSync(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Release step failed (${result.status}): ${command}`);
}
async function download(url, destination) {
  const response = await fetch(url, { signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}
try {
  if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Build and smoke-test this Windows x64 release on Windows x64.");
  if (!/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(pkg.version)) throw new Error("Use a valid package version before packaging.");
  for (const file of ["dist/index.html", "dist/rules.mjs"]) if (!existsSync(join(root, file))) throw new Error("Build the app before packaging (npm run release:windows does this automatically).");
  const cache = join(root, ".release-cache");
  mkdirSync(cache, { recursive: true });
  const executable = join(cache, `node-${runtime.version}-${runtime.platform}.exe`);
  if (!existsSync(executable) || hash(executable) !== runtime.sha256) {
    if (process.versions.node === runtime.version && hash(process.execPath) === runtime.sha256) {
      console.log("Using installed runtime; its SHA-256 matches the pinned official Windows binary.");
      copyFileSync(process.execPath, executable);
    } else {
      console.log(`Downloading Node.js ${runtime.version} from nodejs.org...`);
      await download(runtime.source, executable);
    }
  }
  if (hash(executable) !== runtime.sha256) throw new Error("Runtime checksum mismatch. Nothing was packaged. Check the official runtime checksum before retrying.");
  const nodeLicense = join(cache, `node-${runtime.version}-LICENSE.txt`);
  if (!existsSync(nodeLicense)) await download(runtime.license, nodeLicense);
  if (!readFileSync(nodeLicense, "utf8").includes("Node.js is licensed")) throw new Error("The runtime license download is incomplete.");
  const name = `TaleForge-${pkg.version}-windows-x64`;
  const stageParent = mkdtempSync(join(cache, "stage-"));
  stagingDirectory = stageParent;
  const stage = join(stageParent, name);
  for (const directory of ["runtime", "server", "licenses"]) mkdirSync(join(stage, directory), { recursive: true });
  copyFileSync(executable, join(stage, "runtime/node.exe"));
  cpSync(join(root, "dist"), join(stage, "dist"), { recursive: true });
  // Whitelist executable app files. Never include campaign data, browser exports,
  // development sources, screenshots, caches, or node_modules in a distribution.
  for (const file of ["index.mjs", "launch.mjs", "startup.mjs", "activity.mjs", "encounters.mjs", "persistence.mjs", "partyTools.mjs", "delivery.mjs"]) copyFileSync(join(root, "server", file), join(stage, "server", file));
  copyFileSync(join(root, "Start TaleForge Host.bat"), join(stage, "Start TaleForge Host.bat"));
  for (const file of ["host-settings.json", "START HERE.txt", "Open campaign data.bat"]) copyFileSync(join(root, "packaging", file), join(stage, file));
  for (const file of ["Start TaleForge Host.bat", "Open campaign data.bat"]) writeFileSync(join(stage, file), readFileSync(join(stage, file), "utf8").replace(/\r?\n/g, "\r\n"));
  writeFileSync(join(stage, "package.json"), JSON.stringify({ name: pkg.name, version: pkg.version, private: true, type: "module" }, null, 2));
  copyFileSync(nodeLicense, join(stage, "licenses/Node.js-LICENSE.txt"));
  copyFileSync(join(root, "docs/SRD-ATTRIBUTION.md"), join(stage, "licenses/SRD-ATTRIBUTION.md"));
  for (const dependency of ["react", "react-dom", "scheduler"]) copyFileSync(join(root, "node_modules", dependency, "LICENSE"), join(stage, "licenses", `${dependency}-LICENSE.txt`));
  // Bundled fonts are SIL Open Font License 1.1; the licence text travels with the release.
  for (const [font, folder] of [["Cinzel", "@fontsource/cinzel"], ["Inter", "@fontsource-variable/inter"]]) copyFileSync(join(root, "node_modules", folder, "LICENSE"), join(stage, "licenses", `${font}-OFL.txt`));
  writeFileSync(join(stage, "release.json"), JSON.stringify({ appVersion: pkg.version, platform: "windows-x64", nodeVersion: runtime.version, nodeSha256: runtime.sha256, builtAt: new Date().toISOString() }, null, 2));
  const releases = join(root, "releases"); mkdirSync(releases, { recursive: true });
  const archive = resolve(releases, name + ".zip");
  console.log("Creating portable ZIP...");
  run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "$ErrorActionPreference='Stop'; Compress-Archive -LiteralPath $env:TALEFORGE_ARCHIVE_SOURCE -DestinationPath $env:TALEFORGE_ARCHIVE_DEST -CompressionLevel Optimal -Force"], { TALEFORGE_ARCHIVE_SOURCE: stage, TALEFORGE_ARCHIVE_DEST: archive });
  run(process.execPath, ["scripts/verify-release.mjs", archive]);
  writeFileSync(archive + ".sha256", `${hash(archive)}  ${name}.zip\n`);
  console.log(`\nReady to share: ${archive}`);
} catch (error) {
  console.error(`Packaging failed: ${error.message}`);
  process.exitCode = 1;
}
finally {
  if (stagingDirectory && dirname(resolve(stagingDirectory)) === resolve(root, ".release-cache") && basename(stagingDirectory).startsWith("stage-")) rmSync(stagingDirectory, { recursive: true, force: true });
}
