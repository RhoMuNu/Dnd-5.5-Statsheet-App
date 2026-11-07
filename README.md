# D&D Statsheet Maker

A personal character sheet maker for the 2024 Dungeons & Dragons rules.

## Easiest way to play on Windows

1. Download the **TaleForge Windows x64 ZIP** from your distributor and choose **Extract All**.
2. Open the extracted folder and double-click **Start TaleForge Host.bat**. The browser opens automatically.
3. Choose **LAN campaign → Host a campaign**, then **Copy invite** to share the address and room code with friends on the same Wi-Fi.

The portable release includes its runtime and built app. The host needs no Node.js installation, npm commands, build step, or internet download. Players only need a browser and the invite. Keep the host window open and PC awake during play. Allow Windows Firewall access on Private networks if prompted. Only the host needs the ZIP; players can use Windows, macOS, Linux, or mobile browsers.

Double-clicking the launcher again reopens the running host. If another application uses the configured port, the launcher explains how to resolve the conflict. Use `host-settings.json` for the port and automatic browser opening; keep the same port to retain the browser's storage origin.

Campaign data remains in `%APPDATA%\TaleForge` when you replace the app folder. **Open campaign data.bat** opens it for backups. Stop the host and back up that folder before updates. Local sheets and room identities also depend on browser storage: export local character libraries and keep using the same browser/address. Run only one host per data folder, and stop it before changing ports.

See [Windows release packaging](docs/WINDOWS-RELEASE.md) to build a distributable ZIP from this repository.

## Stack

- React + TypeScript
- Vite for local development and builds
- Node.js built-in HTTP server for LAN campaigns
- Plain CSS for the interface

## Getting started

1. Install dependencies with `npm install`.
2. Start the development server with `npm run dev`.

Use Node.js 24 or newer. For a deployment checkout, install the locked dependencies with `npm ci`, then run `npm run verify` before starting the host. Keep development dependencies installed: the host command builds the browser app and server rules bundle.

Use `npm run dev:lan` when working on LAN sharing; it starts Vite and the campaign API together.

## LAN campaign sharing

The LAN host and party dashboard are available from the **LAN campaign** menu. Saved rooms on this device let DMs and players resume the same identity after leaving a room. Use the same browser and host address: browser storage contains the access credentials, so clearing it removes access from that device.

### Development host

1. On the DM's PC, open PowerShell in this project folder and run `npm run dev:lan`.
2. On that PC, open `http://localhost:5173` and choose **LAN party → Host a campaign**.
3. Share the room code and one of the LAN addresses shown on the DM dashboard.
4. Players on the same private Wi-Fi open that address and choose **Join a campaign**.

### Production host

**Portable release:** double-click `Start TaleForge Host.bat`; no dependency setup or compilation is needed. **Source checkout:** the same launcher checks for Node.js, installs locked dependencies the first time, and builds the app. Keep the host window open while playing; press Ctrl+C there to stop it. Players need no install; they open the invite address in a browser.

You can also run `npm run host` from a terminal. This builds the app and starts the combined web and campaign server at port `4173`; open `http://localhost:4173` on the host PC, then give players a LAN address displayed in the DM dashboard.

On Windows, allow Node.js through Windows Defender Firewall for **Private networks** if prompted. The host and players need to be on the same network, and the host PC must stay awake with the server running. The DM can stop a development host with Ctrl+C; for a production host, stop its PowerShell process with Ctrl+C.

Players can create a character or copy one of their local sheets into the room. They control and edit their own campaign characters. Each character has a **Share with DM** switch; only opted-in sheets appear in the DM's live, read-only dashboard. Player changes save to the host immediately when connected. If a connection drops, edits are kept in that browser and retried after reconnecting. If the host has a newer copy, the player gets a choice between the host version and their offline version.

Campaigns are stored on the host PC in `%APPDATA%\TaleForge\lan-campaigns.json` on Windows. The LAN version uses HTTP and room codes, so use it on a trusted private network. Do not forward the host port to the public internet.

The host saves the previous committed snapshot as `lan-campaigns.json.bak`. Failed disk writes roll back uncommitted changes and return a retryable error. Keep a separate copy of the entire TaleForge data folder while the host is stopped; the rotating backup does not replace an off-device backup. Room access credentials are inside these files, so keep backups private. If the main file becomes unreadable, stop the host, preserve it, then restore a known-good copy to `lan-campaigns.json` before restarting. The host deliberately stops on an unreadable store rather than silently starting empty.

Unreadable browser libraries are retained under a recovery key before autosave can replace them. A recovery notice offers the original data as a download. If a recovery copy cannot be safely saved, autosave is paused and a warning asks you to export the current session.

See the [deployment readiness review](docs/DEPLOYMENT-READINESS.md) for tested behavior, remaining scope, and the first-session rehearsal.

## Project layout

```text
src/
  components/
    Overview.tsx       Character collection landing screen
    LanGame.tsx        Host, player, and DM LAN workflows
    SectionPage.tsx    Character-section routing and empty states
    CharacterSections.tsx Feature, inventory, spellbook, and journal editors
    CharacterBuilder.tsx Guided 2024 character creator
    Sidebar.tsx        Main navigation
  data/
    navigation.ts      Menu labels, sections, and URL helpers
    lan.ts             LAN API types and request helper
    characters.ts      Character records, defaults, local saves, migrations
    creationOptions.ts  Character-creation choices and equipment
    calculations.ts    Derived stats and limited-use class/species resources
  App.tsx              App shell and section navigation
  main.tsx             Browser entry point
  styles.css           Global styles and responsive layout
server/
  index.mjs            Persistent campaign API and production web host
  dev.mjs              Starts Vite and the API together for LAN development
Start TaleForge Host.bat  Windows one-click host launcher
index.html             HTML shell
vite.config.ts         Vite configuration
```

## Navigation

Menu sections use URL hashes (for example `/#inventory`), so they can be bookmarked and browser back/forward navigation works.

## Character records

New characters start at level 1 with one class and no subclass. Use **Level up** on the character sheet (including Tracked sheet mode) for further levels, subclass choices, and multiclassing. Editing basics preserves existing levels, classes, and subclasses; imported higher-level characters retain their progression. Paper and Tracked modes let you enter a manually rolled Hit Die result during level-up or use the class average.

**Custom subclasses:** At class level 3, choose **Custom subclass** under **Features & choices** instead of a bundled subclass. Enter a name and overview, then add any features gained at that level with their descriptions. Later level-ups retain the subclass and let you add further features. The overview and editable features appear in **Features & traits**, are included in backups, and sync through LAN campaigns. Imported custom subclass names can gain an overview at their next level-up. Once selected, level-ups preserve the subclass identity and type.

Custom subclass effects are manual: use custom stat boosts, effects, and resource trackers for their benefits, and add granted spells in Spellbook. The app does not infer spellcasting progression, proficiencies, or bundled subclass behavior from a custom name. Even a custom subclass named Champion or Life Domain remains distinct from that bundled rules implementation.

Characters autosave to this browser's local storage. The collection supports selecting, editing, and deleting characters. Use **Export library** to download a versioned JSON backup, or export one character from its roster card. **Import backup** merges characters into the current library and skips IDs already present; it never overwrites an existing local character. Keep a downloaded backup somewhere separate from the browser for recovery or transfer to another device.

Character sections include class features and custom traits, a quantity and weight inventory with coin tracking, a spellbook with ready-state and spell-slot spending, and a backstory with a dated journal. These fields are included in character backups.

In 0.4, all feature and trait cards collapse, with Expand all / Collapse all controls. Creation and advancement use structured class and Origin-feat choices, including the level-1 Warlock invocation. Optional class-option and spell replacements appear in the level-up wizard and its history. See the [0.4 progression audit](docs/PROGRESSION-AUDIT-0.4.md) for supported choices and manual effects.

Inventory also supports nested containers, carried/stored status, fixed-weight containers, attunement tracking and item charges with configurable rest recovery. Coin quick transactions make change and display GP-equivalent funds. Heroic Inspiration has a manual reroll tracker on the character sheet. LAN rooms include party chat, a shared text/image handout and a private DM notebook. See the [Adventurer’s Codex feature comparison](docs/ADVENTURERS-CODEX-COMPARISON.md) for usage and remaining gaps.

**Features & traits:** Search offline descriptions of class, subclass, species, background feats, and recorded build choices. Each supported species has individual trait descriptions, including lineage tables and level-based unlocks. Expand spell references and rules reminders directly inside a trait. Existing characters receive these references automatically. Unknown homebrew abilities can be described under **Your features**. See [source attribution](docs/SRD-ATTRIBUTION.md).

## Calculated stats

### Table play controls

**Play settings** separates automation level from dice source. Every level keeps calculated bonuses, editable HP, resource counters, inventory, custom boosts, and rules references. Switching levels preserves your sheet and remaining resources.

| Automation level | Behavior |
|---|---|
| Paper sheet | Resolve rolls and effects at the table. Enter final HP, conditions, death saves, concentration, and resource changes manually. Cast, action, roll, effect-template, and rest helpers are hidden. |
| Tracked sheet | Roll and resolve ability/spell effects yourself, without entering die faces. Use casting records, action tracking, slot spending, resource counters, basic damage/healing bookkeeping, and rest controls. |
| Assisted play | Enable the supported attack, healing, and spell helpers. Choose Physical dice to enter natural faces and let the app calculate totals, or Digital dice to let the app roll as well. |

The former Classic sheet preference migrates to Tracked sheet. Existing digital/physical preferences migrate to Assisted play. Settings persist on this device; they do not change other players’ settings or prevent incoming host updates to campaign sheets. Assisted play remains limited to implemented formulas and rules.

**Automation labels** appear in Features & traits and collapsed spell rows. Automatic means a calculated benefit is applied; Partial automation means only the listed parts are handled; Manual effects means effects must be resolved at the table, even when a counter or cast record is available. Open an entry for **App handles** and **At the table** explanations. Labels follow the selected play settings and spell formula. Unknown homebrew defaults to manual resolution.

The abilities page includes damage and healing amounts, temporary HP absorption, death saves (including natural 1/20, stabilization, and massive damage), concentration reminders and Constitution saves, and skill/save/initiative rolls with advantage or disadvantage. Enter damage before resistance/vulnerability and select **Damage defense**; the app applies that multiplier once, including Petrified resistance. Apply other damage reductions yourself first. Resolve each concentration check before entering the next damage event.

**Equipped weapons:** Standard equipped weapons automatically appear in attacks and attack references in Paper and Tracked sheets, including +1/+2/+3 bonuses. Unequipping, deleting, or reducing an item to zero quantity hides its linked attack. Manual attacks remain independent. Edit linked profiles for proficiency, off-hand attacks, versatile damage, and custom adjustments. Custom weapon names need a manual attack profile. Weapon profiles follow the [2024 Basic Rules equipment table](https://www.dndbeyond.com/sources/dnd/br-2024/equipment/).

**Compact spellbook:** Spell rows start collapsed. Open a row for its description and casting controls, search by name or school, filter readiness, or use Expand all / Collapse all. General casting options are under Cast settings.

The spellbook displays **Spell attack bonus** and **Spell save DC** for each casting class, plus **remaining / maximum slots for every level and pool**. Pact Magic stays separate from regular Spellcasting, even when both use the same spell level. Expanded spell cards show the selected casting class’s bonus and DC as well.

**Spell attack rolls:** In Assisted play, attack-roll spells without a supported damage formula use **Spell attack roll only**. Casting rolls one attack, adds the selected class’s bonus and active effect dice, and records the slot/action/concentration once. This works with digital dice or physical die entry. **Additional spell attack · no slot** rolls each remaining ray/beam or an attack for an already-cast ongoing spell without spending another slot or action; record later-turn action costs separately on the play sheet. Results appear next to the spell’s controls. Damage, critical damage dice, range, extra effects, and target eligibility remain manual for attack-only spells. Fire Bolt and Guiding Bolt retain their existing attack-and-damage formulas. Choose **Manual effects** to disable the attack helper for a spell; Paper and Tracked sheets continue to leave all attack dice to the table.

**Compact inventory:** Item rows also start collapsed, showing name, type, quantity, total weight, and equipped/carried/depleted status. Expand a row to edit quantities, weight, equipment, or notes. Search includes names, types, and notes; Expand all and Collapse all operate on the listed items. Equipment links, carrying load, coins, and armor settings continue to work independently of which rows are open.

**Attacks & damage:** add a common weapon preset, then check proficiency, ability, and one/two-handed damage dice. Edit profiles for custom attacks, magic bonuses, or off-hand attacks without an ability damage modifier. Attack rolls handle natural 1/20, optional target AC, condition disadvantage, exhaustion, and active bonus dice. Critical damage doubles dice, including selected Sneak Attack dice, and adds fixed modifiers once. Sneak Attack and Rage damage switches require you to confirm the feature's requirements; ammunition, weapon mastery, and range restrictions are resolved with the DM. Attack counts are enforced while turn tracking is active.

**Conditions & exhaustion:** select conditions to see short rule reminders. The app handles derived incapacitation, zero speed where applicable, automatic Strength/Dexterity save failures, unconditional roll disadvantage, and concentration loss. The 2024 exhaustion penalty applies to checks, saves, attacks, initiative, and speed; a Long Rest removes one level when recovery is allowed. Contextual effects (fear source in sight, who can see an invisible attacker, grapple target, etc.) require situational advantage/disadvantage input. Exhaustion does not change spell save DC or damage.

**Effects, feats & custom modifiers:** Bless/Bane add or subtract a d4 on attacks and saves; Shield adds AC; Tough, Alert, and War Caster templates implement their HP, initiative, and concentration-save benefits. Custom profiles support flat modifiers for other feats, items, and subclass features. Templates do not grant eligibility or implement every benefit of the named feature. Same-named effects do not stack. Manual effect templates advance with **Advance effect timers**, independently of LAN initiative; expire effects at their actual trigger (such as the start of a turn for Shield). For manually added effects, recipients remove Bless/Bane when the caster loses concentration. Host-targeted casts link their recipients automatically. Completed rests also expire timed effects according to elapsed time.

**Healing features:** Second Wind rolls and heals your own HP while spending a use. Lay on Hands can heal your own HP and spend the selected amount from the pool. For another target, spend the pool with its tracker and have that player apply the healing.

After completing a Short Rest, use **Short Rest · spend Hit Dice** to spend a class Hit Die and restore HP. The rest recovery buttons restore eligible class resources and spell slots. A 2024 Long Rest restores all spent Hit Dice, HP, and eligible resources and clears temporary HP. Rest benefits require at least 1 HP; the DM remains responsible for duration and interruptions.

Campaign players can switch between abilities, features, inventory, spells, and journal inside the LAN room. These tabs edit the campaign copy and use the same offline retry/conflict flow. In the spellbook, select a slot level and pool explicitly to cast or upcast, including Pact Magic. Casting a concentration spell replaces the previous concentration tracker; cantrips spend no slot.

In each spell card, **Effect automation** opts into a 2024 formula. Dice may be digital or physically entered. Supported formulas are Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Guiding Bolt, Thunderwave, Shatter, and Fireball. Casting rolls the chosen formula, applies upcasting or cantrip scaling, and spends a slot once. Select the casting class for multiclass spell ability; healing can optionally apply to your own HP. Fire Bolt/Guiding Bolt also roll attacks and critical damage; other target saves, targeting, range, ongoing effects, and damage application are resolved by the recipients and DM. Other spells keep manual effects with automated slot/concentration tracking.

### Physical dice at the table

Use the **Play mode** selector in the top bar to choose **Physical dice**, **Digital dice**, or **Classic sheet** at any time. The preference is saved in this browser. The level-up dialog also includes this selector. Physical mode asks for each natural die face, without modifiers; the app applies bonuses, penalties, advantage/disadvantage, critical rules, and resource costs using the same rules as digital rolls. You can switch an individual pending roll to digital dice without changing the saved preference.

**Classic sheet** uses the full sheet layout, tabs, health bar, ability/proficiency editing, conditions, resources, rests, attack editing, and setup. Dice stay at the table: there are no automatic rolls or natural-face prompts during play. Mark attacks, Second Wind, and casts as used to track action costs and resources; resolve rolled effects yourself and record the final HP. Casting records spell slots and concentration without applying rolled damage or healing. Damage/healing buttons, condition toggles, and rest buttons still perform their usual bookkeeping. The preference is per browser; other LAN players can use their own dice mode.

**Custom stat boosts:** Open Custom stat boosts above the sheet tabs in any mode. Add a named source, select a stat, and enter a bonus or penalty. Sources can be edited, toggled, or removed. Boosts stack with existing sheet modifiers and support AC, initiative, individual skills and saves, all checks/saves, weapon and spell attacks, weapon damage, spell save DC, speed, and maximum HP. They persist through saves, backups, level-ups, and rests and are validated and shared on LAN sheets. Toggle a source off when it no longer applies.

Physical entry is available for skill checks, saves, initiative, attacks, weapon/spell damage and healing, death saves, concentration saves, Second Wind, Short Rest Hit Dice, character-creation 4d6 rolls, level-up HP, and shared dice expressions. For 4d6 creation, the app drops the lowest die of each group and sorts the resulting scores. Automatic rule outcomes (such as maximum healing or an automatic failed save) do not require rolling a die.

LAN spell cards have a **Dice for this cast** override. Physical mode covers the entire cast: the caster’s attack/damage dice and each target’s saves, bonus dice, and concentration checks. Players can roll their own physical dice and provide their natural faces through the casting screen. The host requests the next required die and validates the final calculation. No action, slot, HP change, or effect is committed until all requested dice are entered. If a sheet changes during entry, review it and start again; previously entered faces may be reused where appropriate.

Canceling an unfinished entry leaves the sheet unchanged. If a network failure makes the final cast status uncertain, use **Retry the same cast**: the original request receipt prevents spending twice. Pending physical cast entries survive refreshes. Shared history labels entered results as **Physical dice**; digital results stay available. Manual damage/healing fields and NPC initiative entry remain available for effects resolved outside the app.

### Guided level-ups

Use **Level up ✦** in the character sheet header. The four-step dialog lets you choose one class level, read new features, select a subclass at class level 3, choose a feat or Ability Score Improvement when granted, select class feature options, learn spells, and review the resulting stats. Nothing changes until confirmation. At level 20 the button is disabled. Finish combat before leveling up.

The included choices use the 12 2024 SRD classes and their 12 SRD subclasses. All 339 SRD spells are available offline, filtered by class and that class’s own slot progression (combined multiclass slots never unlock higher-level spell choices). Wizard book additions and Evoker’s Evocation Savant extras are validated. Prepared casters may add newly available spells without treating their full list as permanently learned spells. Existing custom subclasses are retained, and additional book/house-rule choices can be recorded as custom features and spells.

Validation covers the total level cap, multiclass ability prerequisites, subclass class/level, feat prerequisites and ability caps, unique eligible spell choices, required selection counts, and supported feature choices (Expertise, Scholar, fighting styles, Divine/Primal Order, Metamagic, Eldritch Invocations, Hunter options, and Lore skills). The spell list does not implement spell replacement or every subclass-specific expansion such as Magical Secrets; use the spellbook for those changes. Magic Initiate is not offered as a level-up feat in this version because its additional spell-list/free-cast choices need a separate flow.

HP uses the fixed class average or a selected Hit Die roll. Constitution increases apply retroactively. Current damage and spent resources are preserved; level-up is not a rest. Class/subclass feature descriptions and a history of each advancement are saved under **Features**. Life, Devotion, Draconic, and Fiend always-prepared spells are granted as those subclass levels unlock. LAN level-ups validate on the host, reject stale sheets, enforce ownership, and safely reuse a repeated request ID.

### Turn enforcement and automatic benefits

Starting LAN initiative enables turn tracking for linked character sheets; the DM advances turns. Each turn tracks an Action, Bonus Action, Reaction, remaining Extra Attacks, Action Surge, Sneak Attack use, and whether a spell slot has been spent for casting during the current global turn. Reactions remain spent until the start of your next turn. Fighter’s Action Surge can grant another Attack action but cannot grant a Magic action under the 2024 rules. Local sheets can enable enforcement in **Action economy** and advance their own turns.

Weapon attacks spend an attack from the Attack action. Mark an eligible bonus attack in its editor to spend a Bonus Action instead; this flag requires you to verify the Light/feature prerequisites. Damage rolls follow the attack and do not spend another action. Second Wind and Lay on Hands spend a Bonus Action. Generic action/bonus/reaction buttons cover other declared actions. Movement, reaction triggers, Haste, Nick, and other action-economy exceptions remain with the DM; manual resource adjustments remain available for corrections.

Automated passive benefits include Tough, Alert, War Caster, Resilient, Speedy, Archery, Defense, Great Weapon Fighting, and Two-Weapon Fighting; check the attack’s ranged/two-handed/bonus-attack flags. Champion critical ranges and Remarkable Athlete, Draconic Resilience, Life Domain healing, Evoker damage benefits, Paladin’s self Aura of Protection, and high-level Monk/Rogue save proficiencies are applied. Conditional benefits not listed here are recorded as feature descriptions, not silently treated as automated.

### Host-targeted spells

In a spell card, opt into its matching formula and open **Cast on LAN targets**. Share the caster with the DM. Other targets must be shared sheets added to the public initiative roster (combat need not be running). Choose targets, situational save modes, damage defenses, and confirm range/visibility/components/eligibility before casting. The host rolls and commits the caster and all targets together, spends one slot/action cost, and broadcasts the result. Target edits still pending in another browser may need the normal conflict review.

Supported formulas: Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Guiding Bolt, Thunderwave, Shatter, Fireball, Bless, Bane, and Shield. Saves, target AC, critical hits, immediate concentration saves after damage, healing limits, resistance/vulnerability/immunity, Petrified resistance, and Evasion on applicable saves are handled. Spell descriptions still govern positioning, pushes, ongoing riders such as Guiding Bolt’s next-attack advantage, special immunities, and other target exceptions.

Bless/Bane applied this way are linked to the caster’s concentration instance: losing or replacing concentration removes the old recipients’ effects. Timed targeted effects count down at the caster’s turn starts in LAN initiative; Shield expires at the caster’s next turn start. Outside combat, expire timed effects when the duration ends. Targeted cast requests have receipts retained for the last 1,000 casts; a lost-response retry reuses the original result. An unconfirmed request survives a refresh and must be retried or explicitly discarded before starting another cast.

### Equipped armor

In **Inventory**, enable **Calculate armor from equipped inventory**. Standard armor presets include their 2024 weights. Equip a suit and shield to derive AC, including Dexterity caps, +1/+2/+3 variants, heavy-armor Strength speed penalties, Stealth disadvantage, and Monk/Barbarian armor restrictions. Equipping another suit or shield replaces the previous one. Quantity-zero items grant no benefit. Unknown armor names show a warning; use manual settings for special armor formulas.

Confirm the worn armor and shield training checkboxes against your classes and features. Untrained armor applies disadvantage to Strength/Dexterity tests and blocks spellcasting; an untrained shield grants no AC bonus. Existing sheets retain their manual armor settings until this option is enabled. The separate Other AC bonus and effect modifiers still apply. Donning/doffing time and special item properties remain with the DM.

### Shared table rolls

DMs and players can use **Shared rolls** for host-generated or physically entered dice such as `1d20+5` or `8d6`. Dice expressions support 1–50 dice with d4/d6/d8/d10/d12/d20/d100 and an optional integer modifier. The host persists and streams the latest 100 public results to everyone.

Players can opt into publishing play results from their shared sheets: checks, saves, weapon attacks/damage, healing features, Hit Dice, and spell casts. These are labeled **Sheet result**, since character calculations run in the player's browser. Private characters do not publish. Published character names and results remain in the public history even after unsharing the sheet. Pending requests survive refreshes and can be retried or discarded; retries within retained history reuse the original roll. Sheet saving and result publishing are separate operations. Turning off publishing affects future results; pending results can be discarded separately.

### Shared initiative

The LAN dashboard includes a public encounter roster. The DM adds shared sheets or named NPCs with initiative, adjusts tie priority (higher goes first), and uses **Start combat**, **Next turn**, and **End combat**. Turns and round numbers stream to every player and persist with the campaign. Players cannot change the encounter; conflicting DM-device edits are rejected. Sheet HP stays player-controlled. Adding a shared character publishes its name in the encounter until the DM removes it, even if the sheet is later unshared. The DM's **Roll initiative** uses the shared sheet's bonuses and unconditional condition effects; enter manual rolls for surprise or other situational rules.

### Verification and remaining scope

Run `npm test` using Node.js 24 LTS or newer for rules regressions and a real local HTTP/SSE campaign integration test. Tests use disposable temporary campaign data, independent of your saved campaigns. Run `npm run build` for TypeScript and production compilation.

This is a playable sheet and LAN campaign tool, not yet a complete rules engine. Guided level-ups, turn enforcement, selected passive feat/subclass benefits, and eleven targeted spell formulas are implemented. Automatic targeting is limited to those formulas and shared character sheets; NPC stat blocks, battlefield positioning, full Metamagic/invocation execution, and every feat/subclass exception remain outside the automation. Inventory armor automation is available as an opt-in setting; other equipment benefits and non-armor starting weights require entry. Use custom modifier profiles, feature trackers, and notes for exceptions. The DM dashboard displays shared abilities, combat profiles, effects, and resources; private sheets stay hidden.

The Abilities & Skills page derives ability modifiers, proficiency bonus, saving throws, skill bonuses (including expertise), passive Perception, initiative, armor class, fixed-average hit point maximum, speed, carrying limits, spell save DC, spell attack bonus, class resources, and multiclass spell slots. Inputs are saved with the character, and derived values recalculate from the current inputs.

The formulas follow the [2024 Basic Rules: Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), and [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). The creator offers Standard Array, Point Buy, manual scores, and 4d6 rolls, with class-based Standard Array suggestions and background boosts. Species size and speed, class equipment armor, and AC features are editable. Class and species resources update with level; specific spell, feat, and subclass choices can be recorded in the character sections. Local saves, versioned JSON backups, and LAN campaign sharing are implemented.

## Open rules attribution

The bundled spell, class, subclass, and feat catalogs contain SRD 5.2 material obtained through [Open5e](https://open5e.com/), with selected mechanics checked against the [2024 Basic Rules](https://www.dndbeyond.com/sources/dnd/br-2024). See [SRD attribution](docs/SRD-ATTRIBUTION.md). No runtime internet access is needed for the catalogs.
