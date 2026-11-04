# D&D Statsheet Maker

A personal character sheet maker for the 2024 Dungeons & Dragons rules.

## Stack

- React + TypeScript
- Vite for local development and builds
- Plain CSS for the interface

## Getting started

1. Install dependencies with `npm install`.
2. Start the development server with `npm run dev`.

## Project layout

```text
src/
  components/
    Overview.tsx       Character collection landing screen
    SectionPage.tsx    Starter screens for menu destinations
    Sidebar.tsx        Main navigation
  data/
    navigation.ts      Menu labels, sections, and URL helpers
  App.tsx              App shell and section navigation
  main.tsx             Browser entry point
  styles.css           Global styles and responsive layout
index.html             HTML shell
vite.config.ts         Vite configuration
```

## Navigation

Menu sections use URL hashes (for example `/#inventory`), so they can be bookmarked and browser back/forward navigation works.

## Character records

Characters autosave to this browser's local storage. The collection supports selecting, editing, and deleting characters. Use **Export library** to download a versioned JSON backup, or export one character from its roster card. **Import backup** merges characters into the current library and skips IDs already present; it never overwrites an existing local character. Keep a downloaded backup somewhere separate from the browser for recovery or transfer to another device.

## Calculated stats

The Abilities & Skills page derives ability modifiers, proficiency bonus, saving throws, skill bonuses (including expertise), passive Perception, initiative, armor class, fixed-average hit point maximum, speed, carrying limits, spell save DC, spell attack bonus, class resources, and multiclass spell slots. Inputs are saved with the character, and derived values recalculate from the current inputs.

The formulas follow the [2024 Basic Rules: Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), and [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). Scores begin at 10 as placeholders. Species speed and armor details are entered manually; AC features not covered by the common formulas can use Custom AC. Local saves and versioned JSON backups are implemented. LAN hosting and reconnect conflict handling are planned for a later phase and are not part of this local-only version.
