# Portable Windows releases

The player/DM guide is packaged as `START HERE.txt`. The host extracts the complete ZIP, runs `Start TaleForge Host.bat`, and creates or resumes a LAN campaign. Players only need a browser on the same network. The release targets Windows x64 and does not install a service, change firewall rules, require administrator access, or modify system Node installations.

## Build a release

On Windows x64 with Node 24+ and project dependencies installed:

```powershell
npm ci
npm run release:windows
```

The command runs the production build, regression tests, and production-host smoke test. It packages a verified runtime, generates the ZIP, extracts that ZIP outside the source checkout, and tests its bundled runtime with system Node/npm removed from the host process's PATH. The release test covers assets, startup validation, reopening an existing host, campaign creation, disk-failure rollback, and restart/resume.

Outputs are `releases/TaleForge-<version>-windows-x64.zip` and its `.sha256` checksum. Share the ZIP; do not share your campaign-data folder or a source checkout with private exports. The archive uses a whitelist: built assets/rules, required server modules, bundled runtime, launcher, default settings, guide, release manifest, and license notices. `src`, `node_modules`, screenshots, caches, and campaign files are excluded.

The build reuses an installed runtime only if its version and SHA-256 match the pinned official binary. Otherwise it downloads the pinned binary from nodejs.org and checks its SHA-256 before packaging. The first build also downloads the runtime's license; verified runtime files are cached under `.release-cache`. Release users need no internet connection to launch. To verify an existing archive again:

```powershell
node scripts/verify-release.mjs releases/TaleForge-0.3.0-windows-x64.zip
```

## Runtime and notices

`packaging/runtime.json` pins Node.js 24.22.1 Windows x64 and its checksum, checked against the [official release checksums](https://nodejs.org/en/blog/release/v24.22.1/). The package includes the [Node.js and embedded dependencies license text](https://github.com/nodejs/node/blob/v24.22.1/LICENSE), React/React DOM/Scheduler licenses, and SRD attribution. When updating the runtime pin, verify the new binary and checksum using the official release before building. Maintain the current rules-content distribution scope when sharing this beta.

## Startup and upgrades

- The launcher uses port 4173 by default and opens `http://localhost:4173`, preserving the existing browser origin. LAN URLs are printed in the host window and displayed in the campaign UI.
- Reopening the launcher reuses a healthy TaleForge service on that port. It does not stop or replace an existing host. Stop the old host before launching an update or changing ports. Run only one host per data directory.
- A port conflict never silently switches ports; the error asks the host to close the conflicting app or edit `host-settings.json`.
- `openBrowser: false` disables automatic browser opening. `TALEFORGE_PORT`, `TALEFORGE_OPEN_BROWSER`, and `TALEFORGE_DATA_DIR` remain available as environment overrides.
- Campaign files stay in the Windows user's AppData folder, outside the release directory. Extract an update into a new folder after stopping the host and taking a private backup. Browser local libraries and saved room credentials are separate from campaign files.
- A release is portable app code, not portable user data. Moving it to a different PC does not move campaigns, local sheets, or room access automatically.
- On the host, Windows Firewall may ask permission for the bundled runtime. The app does not grant that permission automatically. Use a trusted private network; this is not a public internet hosting package.
- Windows may mark a downloaded ZIP as coming from the internet. This ZIP is not a signed installer; test your distribution channel on a second Windows PC before treating it as a public release. The app does not bypass Windows prompts.
