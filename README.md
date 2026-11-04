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
    SectionPage.tsx    Starter screens for menu destinations
    Sidebar.tsx        Main navigation
  data/
    navigation.ts      Menu labels, sections, and URL helpers
    lan.ts             LAN API types and request helper
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

## Calculated stats

The Abilities & Skills page derives ability modifiers, proficiency bonus, saving throws, skill bonuses (including expertise), passive Perception, initiative, armor class, fixed-average hit point maximum, speed, carrying limits, spell save DC, spell attack bonus, class resources, and multiclass spell slots. Inputs are saved with the character, and derived values recalculate from the current inputs.

The formulas follow the [2024 Basic Rules: Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), and [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). Scores begin at 10 as placeholders. Species speed and armor details are entered manually; AC features not covered by the common formulas can use Custom AC. Local saves, versioned JSON backups, and LAN campaign sharing are implemented.
