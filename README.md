# D&D Statsheet Maker

A personal character sheet maker for the 2024 Dungeons & Dragons rules.

## Stack

- React + TypeScript
- Vite for local development and builds
- Node.js built-in HTTP server for LAN campaigns
- Plain CSS for the interface

## Getting started

1. Install dependencies with `npm install`.
2. Start the development server with `npm run dev`.

Use `npm run dev:lan` when working on LAN sharing; it starts Vite and the campaign API together.

## LAN campaign sharing

The LAN host and party dashboard are available from the **LAN party** menu.

### Development host

1. On the DM's PC, open PowerShell in this project folder and run `npm run dev:lan`.
2. On that PC, open `http://localhost:5173` and choose **LAN party → Host a campaign**.
3. Share the room code and one of the LAN addresses shown on the DM dashboard.
4. Players on the same private Wi-Fi open that address and choose **Join a campaign**.

### Production host

**Easy Windows launch:** double-click `Start TaleForge Host.bat`. It checks for Node.js, installs app dependencies the first time, builds TaleForge, and opens it on the host PC. Keep the terminal window open while playing; press Ctrl+C there to stop the host. Node.js LTS is a one-time install on the DM's PC only. Players need no install; they open the invite address in a browser.

You can also run `npm run host` from a terminal. This builds the app and starts the combined web and campaign server at port `4173`; open `http://localhost:4173` on the host PC, then give players a LAN address displayed in the DM dashboard.

On Windows, allow Node.js through Windows Defender Firewall for **Private networks** if prompted. The host and players need to be on the same network, and the host PC must stay awake with the server running. The DM can stop a development host with Ctrl+C; for a production host, stop its PowerShell process with Ctrl+C.

Players can create a character or copy one of their local sheets into the room. They control and edit their own campaign characters. Each character has a **Share with DM** switch; only opted-in sheets appear in the DM's live, read-only dashboard. Player changes save to the host immediately when connected. If a connection drops, edits are kept in that browser and retried after reconnecting. If the host has a newer copy, the player gets a choice between the host version and their offline version.

Campaigns are stored on the host PC in `%APPDATA%\TaleForge\lan-campaigns.json` on Windows. The LAN version uses HTTP and room codes, so use it on a trusted private network. Do not forward the host port to the public internet.

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

Characters autosave to this browser's local storage. The collection supports selecting, editing, and deleting characters. Use **Export library** to download a versioned JSON backup, or export one character from its roster card. **Import backup** merges characters into the current library and skips IDs already present; it never overwrites an existing local character. Keep a downloaded backup somewhere separate from the browser for recovery or transfer to another device.

Character sections include class features and custom traits, a quantity and weight inventory with coin tracking, a spellbook with ready-state and spell-slot spending, and a backstory with a dated journal. These fields are included in character backups.

## Calculated stats

### Table play controls

The abilities page includes damage and healing amounts, temporary HP absorption, death saves (including natural 1/20, stabilization, and massive damage), concentration reminders and Constitution saves, and skill/save/initiative rolls with advantage or disadvantage. Enter damage before resistance/vulnerability and select **Damage defense**; the app applies that multiplier once, including Petrified resistance. Apply other damage reductions yourself first. Resolve each concentration check before entering the next damage event.

**Attacks & damage:** add a common weapon preset, then check proficiency, ability, and one/two-handed damage dice. Edit profiles for custom attacks, magic bonuses, or off-hand attacks without an ability damage modifier. Attack rolls handle natural 1/20, optional target AC, condition disadvantage, exhaustion, and active bonus dice. Critical damage doubles dice, including selected Sneak Attack dice, and adds fixed modifiers once. Sneak Attack and Rage damage switches require you to confirm the feature's requirements; ammunition, weapon mastery, range restrictions, and attack counts are not enforced.

**Conditions & exhaustion:** select conditions to see short rule reminders. The app handles derived incapacitation, zero speed where applicable, automatic Strength/Dexterity save failures, unconditional roll disadvantage, and concentration loss. The 2024 exhaustion penalty applies to checks, saves, attacks, initiative, and speed; a Long Rest removes one level when recovery is allowed. Contextual effects (fear source in sight, who can see an invisible attacker, grapple target, etc.) require situational advantage/disadvantage input. Exhaustion does not change spell save DC or damage.

**Effects, feats & custom modifiers:** Bless/Bane add or subtract a d4 on attacks and saves; Shield adds AC; Tough, Alert, and War Caster templates implement their HP, initiative, and concentration-save benefits. Custom profiles support flat modifiers for other feats, items, and subclass features. Templates do not grant eligibility or implement every benefit of the named feature. Same-named effects do not stack. Round timers advance with **Advance effect timers**, independently of LAN initiative; expire effects at their actual trigger (such as the start of a turn for Shield). Recipients remove Bless/Bane when the caster loses concentration. Completed rests also expire timed effects according to elapsed time.

**Healing features:** Second Wind rolls and heals your own HP while spending a use. Lay on Hands can heal your own HP and spend the selected amount from the pool. For another target, spend the pool with its tracker and have that player apply the healing.

After completing a Short Rest, use **Short Rest · spend Hit Dice** to spend a class Hit Die and restore HP. The rest recovery buttons restore eligible class resources and spell slots. A 2024 Long Rest restores all spent Hit Dice, HP, and eligible resources and clears temporary HP. Rest benefits require at least 1 HP; the DM remains responsible for duration and interruptions.

Campaign players can switch between abilities, features, inventory, spells, and journal inside the LAN room. These tabs edit the campaign copy and use the same offline retry/conflict flow. In the spellbook, select a slot level and pool explicitly to cast or upcast, including Pact Magic. Casting a concentration spell replaces the previous concentration tracker; cantrips spend no slot.

In each spell card, **Effect automation** opts into a 2024 formula. Supported formulas are Cure Wounds, Healing Word, Fire Bolt, Sacred Flame, Guiding Bolt, Thunderwave, Shatter, and Fireball. Casting rolls the chosen formula, applies upcasting or cantrip scaling, and spends a slot once. Select the casting class for multiclass spell ability; healing can optionally apply to your own HP. Fire Bolt/Guiding Bolt also roll attacks and critical damage; other target saves, targeting, range, ongoing effects, and damage application are resolved by the recipients and DM. Other spells keep manual effects with automated slot/concentration tracking.

### Shared initiative

The LAN dashboard includes a public encounter roster. The DM adds shared sheets or named NPCs with initiative, adjusts tie priority (higher goes first), and uses **Start combat**, **Next turn**, and **End combat**. Turns and round numbers stream to every player and persist with the campaign. Players cannot change the encounter; conflicting DM-device edits are rejected. Sheet HP stays player-controlled. Adding a shared character publishes its name in the encounter until the DM removes it, even if the sheet is later unshared. The DM's **Roll initiative** uses the shared sheet's bonuses and unconditional condition effects; enter manual rolls for surprise or other situational rules.

### Verification and remaining scope

Run `npm test` using Node.js 24 LTS or newer for rules regressions and a real local HTTP/SSE campaign integration test. Tests use disposable temporary campaign data, independent of your saved campaigns. Run `npm run build` for TypeScript and production compilation.

This is a playable sheet and LAN campaign tool, not yet a complete rules engine. Full spell targeting and ongoing-effect propagation, comprehensive feat/subclass automation, action economy and attack-count enforcement, and level-up choice validation remain future work. Inventory equipment toggles do not automatically select the armor formula, and starting equipment weights require entry. Use custom modifier profiles, feature trackers, and notes for exceptions. The DM dashboard displays shared abilities, combat profiles, effects, and resources; private sheets stay hidden.

The Abilities & Skills page derives ability modifiers, proficiency bonus, saving throws, skill bonuses (including expertise), passive Perception, initiative, armor class, fixed-average hit point maximum, speed, carrying limits, spell save DC, spell attack bonus, class resources, and multiclass spell slots. Inputs are saved with the character, and derived values recalculate from the current inputs.

The formulas follow the [2024 Basic Rules: Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), and [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). The creator offers Standard Array, Point Buy, manual scores, and 4d6 rolls, with class-based Standard Array suggestions and background boosts. Species size and speed, class equipment armor, and AC features are editable. Class and species resources update with level; specific spell, feat, and subclass choices can be recorded in the character sections. Local saves, versioned JSON backups, and LAN campaign sharing are implemented.
