# TaleForge 0.3.0

- The spellbook shows spell attack bonuses and save DCs for each casting class. Expanded cards also show the class used by that spell.
- Remaining spell slots show their level, pool, and remaining/maximum count. Pact Magic and regular Spellcasting remain distinct, including when they have slots at the same level.
- Attack-roll spells without a supported damage formula can roll a spell attack when cast in Assisted play. The helper supports digital dice, physical dice, advantage/disadvantage, custom attack boosts, active bonus dice, exhaustion, and natural 1/20 outcomes.
- Casting spends a slot and action once. Additional spell attacks roll remaining beams/rays without spending another slot or action. Damage and extra effects remain manual for this option; later-turn action costs still need to be recorded separately.
- Roll results are visible inside the expanded spell card. Explicit Manual effects and the Paper/Tracked automation levels remain available.

- Inventory adds containers, stored/carried status and fixed-weight storage. Stored equipment grants no equipped weapon or armor profile.
- Item rows now track attunement and charges, with manual, Short Rest or Long Rest recovery choices. Item effects and special recharge rules remain manual.
- Coin quick transactions add or spend specific denominations, make change and show total GP-equivalent value.
- Character sheets have a Heroic Inspiration tracker with manual reroll guidance in every automation mode.
- LAN rooms add party chat, a shared text/image handout, and a DM-only notebook. Chat retries avoid duplicate delivery; handout edits detect conflicts. Private notes are excluded from player snapshots and live streams.

See the [feature comparison](ADVENTURERS-CODEX-COMPARISON.md) for the documented Adventurer’s Codex gaps addressed here and larger follow-up items.

Validation includes 126 regression tests, production-host checks, and browser checks of multiclass bonuses, separate spell-slot pools, digital attack casting, and additional attacks without repeat slot spending. New host checks cover campaign tools, privacy and restart persistence. Portable release packaging smoke-tests the extracted ZIP with its bundled runtime.

Stop the old host before launching this update. Keep the same Windows account, browser, host address, and port to retain access to saved sheets and rooms.
