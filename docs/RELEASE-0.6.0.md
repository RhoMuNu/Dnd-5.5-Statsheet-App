# TaleForge 0.6.0

TaleForge has a new look. Headings use the Cinzel display face and the interface uses Inter, both bundled so they work without an internet connection. Panels, buttons, fields, dropdowns, tabs and navigation share one design system, the top bar is frosted glass, and panels ease in gently. All motion switches off when your system asks for reduced motion, and every text colour meets WCAG AA contrast.

The play sheet leads with what you use most. Your six abilities sit under the character banner with the modifier large and the score small, beside hit points, Armor Class, initiative, speed, proficiency and Passive Perception. Enter an amount on the hit points card and choose **Damage** or **Heal**: Assisted and Tracked sheets apply temporary hit points, death saves and concentration, while Paper sheets simply adjust HP.

In Assisted play you can roll straight from the sheet. Tap an ability tile for an ability check, or the dice button beside any saving throw or skill, using the Normal / Advantage / Disadvantage switch at the top of the Abilities tab. Results appear as short notices in the corner (also announced to screen readers) and still post to the LAN table feed. Skill proficiency is now a pip you tap to cycle none → proficient → expertise.

Spell slots and limited features with up to eight uses show gold pips: tap a filled pip to spend a use and an empty one to restore it. Roll modes and the spellbook filter are on-screen switches, and long instructions now sit behind "?" buttons beside each panel title.

Hosting is much lighter on the network. App files are compressed and kept by browsers between sessions, so a returning player's first load drops from about 1.3 MB to about 280 KB and then mostly comes from cache. Live updates are compressed and only reach the devices whose view changed, and the handout image is fetched once instead of being resent with every update. In a test with a DM, five players and a large handout, one sheet edit went from about 5.9 MB of Wi-Fi traffic to 54 KB. Saves are faster and write compact files, with handout images stored once in a `board-images` folder beside `lan-campaigns.json`. Launching from a source checkout skips the rebuild when nothing has changed.

Existing campaign files load as before; their handout images move into `board-images` on the next save, so back up the whole TaleForge data folder as usual. An older TaleForge release would show handouts saved by 0.6 without their image.

Stop the previous host, extract the new ZIP, and launch **Start TaleForge Host.bat**. Keep the same Windows account, browser, address and port to retain saved-sheet and room access. Campaigns continue using the existing host data folder. Nothing needs to be installed by players.
