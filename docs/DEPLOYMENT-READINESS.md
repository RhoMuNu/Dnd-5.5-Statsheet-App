# Deployment readiness review — November 5, 2026

## Decision

Suitable for a supervised private LAN beta after a two-device rehearsal. The app supports character sheets, guided progression, manual bookkeeping, and selected rules automation. It does not yet meet the broader goal of automating all 2024 rules. Public internet hosting is outside the current deployment model.

## Verification

- `npm run verify`: production build passed, all 102 rules/storage/LAN tests passed, and the built-production-host smoke test passed. The smoke test uses disposable data, exercises failed saves, and restarts the host to check room/identity recovery.
- `npm audit`: zero known vulnerabilities reported in the installed dependency tree at review time. Repeat before a later release.
- Browser smoke check against the production host: digital, physical, and classic modes render; health controls remain present; features load; the LAN page reports the host ready. No browser console warnings or errors were captured during this check.
- Existing integration tests cover ownership, private/shared sheets, stale-save conflicts, HTTP/SSE updates, targeted casts, physical dice, turn order, and request deduplication.
- Character backups round-trip feature descriptions, custom modifiers, inventory, currency, and journal content. Corrupt or inconsistent progression is rejected on import.

These are automated and single-computer checks. They do not prove Wi-Fi/firewall behavior on another device or replace a campaign playtest.

## Issues fixed during this sweep

| Issue | Result |
|---|---|
| Damaged browser saves could be silently replaced by an empty library | Preserve original data in a recovery copy, expose a download notice, retain readable heroes, and block autosave if preservation fails |
| Disk failures could leave host memory ahead of disk | Roll back changes, retain a previous committed `.bak`, retry brief Windows rename locks, and return HTTP 503 without broadcasting success |
| Launcher accepted Node 18 despite newer server tooling | Require Node 24+, declare package engines, and use the lockfile with `npm ci` |
| Missing production API/assets returned the HTML app with HTTP 200 | Return 404 and serve assets with `nosniff` |
| Imported levels could be huge, fractional, or disagree with class levels | Reject invalid progression before rendering or level-dependent allocation |
| A room could be created but its response discarded if credential storage failed | Keep the active session usable and show an explicit persistence warning |
| No single production verification command | Add `npm run verify`, including production assets, save-failure rollback, and restart/resume tests |

## Remaining additions, in priority order

1. **Run a real first-session rehearsal.** Use a second computer/phone on the actual Wi-Fi and test the steps below. This is the remaining operational gate for the private LAN beta.
2. **Improve campaign backup and identity recovery.** The rotating host backup and stopped-host folder copy work, but a DM-facing campaign export/restore workflow and a way to recover a player identity after browser storage is cleared would make regular use much easier. Character exports do not contain room identities or restore a whole campaign.
3. **Make automation coverage visible at the point of use.** Spell automation is opt-in and limited to eleven targeted formulas. Add a consistent indication of automatic, partially automatic, and manual abilities so players can see which rules they must resolve themselves.
4. **Expand build coverage for the group's actual characters.** The bundle has 12 classes, 12 subclasses (one per class), 17 feat entries, 10 species, and 339 spells. More subclasses/feats and their choices need data and validation before unsupported builds can be guided entirely by the app. Species/feat descriptions do not imply execution of every benefit; check granted spells, proficiencies, ancestry benefits, Metamagic, invocations, weapon mastery, and special action exceptions for each planned build.
5. **Broaden combat automation only where the group needs it.** NPC stat blocks and target HP, positioning/range/cover, movement, opportunity triggers, and many ongoing spell or condition exceptions still require DM handling. Current targeting operates on shared player sheets in the encounter.
6. **Complete device/accessibility testing.** Check touch controls, the level-up wizard, long spell lists, keyboard navigation, larger text, and screen readers on the devices the group actually uses. Local libraries in multiple tabs do not have the host's conflict-resolution workflow; use one editing tab per local library.
7. **Polish packaging and startup.** A prebuilt Windows release, clear port-in-use/startup errors, and a simpler update flow would improve distribution. The current launcher requires Node and an initial internet connection for dependencies. The build's main JavaScript chunk is slightly over Vite's 500 kB advisory; this is a performance improvement, not a failed build.

For public hosting, first design authentication and account recovery, HTTPS, join/abuse controls, request/schema hardening, credential/session management, operational backups, and content distribution review. A private-LAN room-code service should not simply be port-forwarded onto the internet.

## First-session rehearsal

1. On the host PC, install Node 24+, run `npm ci`, then `npm run verify`. Start `Start TaleForge Host.bat` or `npm run host`.
2. Open the host address, create a campaign, and join from a different device using the LAN address and room code. Confirm Private-network firewall access.
3. Create or copy a level-1 sheet, select starting spells, and share it with the DM. Confirm an unshared sheet stays hidden and a second player cannot edit it.
4. Try digital dice, physical dice entry/cancellation, and classic bookkeeping. Check HP, temporary HP, skills, inventory-linked weapons, modifiers, and resource/rest tracking.
5. Run one encounter with initiative, one attack, one targeted spell, concentration, and a rest. Verify the expected actions/resources are spent once.
6. Disconnect a player device briefly, edit its sheet, reconnect, and confirm queued changes sync. If two devices edit the same identity, review a conflict instead of overwriting blindly.
7. Level a spellcaster and a martial character; check HP, spell selections, ASI/feat options, and subclass selection at the appropriate level.
8. Export a character library and import it in a separate browser profile. Verify descriptions, equipment, modifiers, and notes.
9. Stop and restart the host. Resume the same saved DM/player rooms in the same browsers and verify sheets and encounter state. Stop it again and copy the data folder to a private backup location.

## Deployment boundaries

- Use the same host address, port, and browser profile each session. `localhost` and a LAN IP are different browser storage origins. Reserve the host's LAN address on the router if it changes frequently.
- Browser character saves are separate from campaign data. Clearing browser storage removes local sheets and stored room access. Keep character exports as well as host backups.
- The host PC must remain running and awake. After dependencies are installed, bundled rules and LAN play do not need the internet; the browser must still be able to reach the host. There is no installed offline/PWA cache for starting the app while the host is off.
- `TALEFORGE_PORT` changes the production port. `TALEFORGE_DATA_DIR` selects a different persistent data directory. Preserve that directory across updates.
- Updates should be done with the host stopped and a separate backup of the data directory. Do not use disposable test directories for a real campaign.
