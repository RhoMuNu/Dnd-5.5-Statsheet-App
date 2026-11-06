# Adventurer’s Codex comparison · 0.3.0

Reviewed November 5, 2026 against Adventurer’s Codex’s public guides. This is a documented-feature comparison, not a logged-in product audit. Implementations here were written for TaleForge; no competitor source code or content was copied. TaleForge keeps its existing 2024 rules and LAN hosting model.

The [player guide](https://adventurerscodex.com/player-tools.html) documents character tracking, containers, carried weight, item charges, attunement, treasure transactions, notes, portraits, and inspiration. The [collaboration guide](https://adventurerscodex.com/collaboration.html) describes party dashboards, chat, and shared exhibits. The [DM guide](https://adventurerscodex.com/dm.html) describes encounter preparation, NPCs, monsters, maps, and private campaign notes.

| Capability | TaleForge status for 0.3.0 |
| --- | --- |
| Character stats, skills, features, spells, equipment, journal | Already present, with 2024 descriptions and automation levels |
| Party connections and DM dashboard | Already present through LAN rooms, shared sheets, initiative and shared rolls |
| Inventory containers and stored items | Added: nested containers, carried toggles, cycle prevention and fixed-weight containers |
| Stored equipment and carried weight | Added: stored contents contribute no carried weight or equipped weapon/armor profile; coin weight remains counted |
| Magic-item bookkeeping | Added: attunement status/count and configurable charges, including optional Short/Long Rest recovery |
| Treasure transactions | Added: quick add/spend by denomination, exact change, insufficient-funds protection and GP-equivalent total |
| Inspiration tracking | Added: Heroic Inspiration checkbox with 2024 rule reference and explicit manual reroll guidance |
| Party chat | Added: authenticated plain-text messages, live updates, local drafts and retry deduplication; latest 100 messages retained |
| Shared exhibits | Added a party handout: title, text and uploaded image, with enlarged image view |
| Private DM notes | Added: campaign notebook, withheld from player API responses and live streams |
| Full encounter preparation, NPC/monster library, Donjon import | Follow-up work; current initiative and handout tools cover running a session, not a full preparation library |
| Rich Markdown journal, portraits, broad keyboard shortcuts | Follow-up work; current journal uses plain text |
| Cloud accounts, cross-device library sync, public share links, AI generation | Outside this LAN-focused release; no external service or account dependency added |

## How to use the additions

Expand an inventory row to set its container, carried status, attunement and charges. Mark an item as a storage container before placing other items inside it. Fixed weight excludes content weight; container capacity and unusual item rules stay manual. Removing a container keeps its contents and their stored status. Attunement is a tracker, not an automatic item-effect or attunement-limit validator. Apply special item boosts through custom modifiers.

Coin quick transactions sit under the individual coin balances. Spending can make change across denominations. Inventory and inspiration controls remain available at every automation level; charge counters never roll dice. Configured rest recovery applies when a rest is completed.

In a LAN campaign, expand **Party chat** or **Party handout**. The DM additionally sees **DM notebook & handout editor**. Saving publishes only the handout fields; private notes remain DM-only. Conflicting edits require reloading the host copy. Images are uploaded to the local host, not fetched from external URLs (PNG/JPEG/WebP/GIF, at most 768 KB). The host saves these campaign tools alongside its existing room data. DM editor drafts should be saved before leaving the page.

Validation: 126 regression tests plus production-host smoke checks covering chat retries, authorization, DM-note privacy in both snapshots and live streams, edit conflicts, and persistence across host restarts. Portable packaging runs the production checks again against the extracted release with its bundled runtime.
