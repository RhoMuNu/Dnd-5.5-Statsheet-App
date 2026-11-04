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

Menu sections use URL hashes (for example `/#inventory`), so they can be bookmarked and browser back/forward navigation works. Rules calculations are planned for a later step.

## Character records

The first character flow saves a character's name, concept, species, class, background, and level in this browser's local storage. The collection supports selecting, editing, and deleting a character. The remaining sheet sections are connected to the selected character and ready for their data-entry features.

## Calculated stats

The Abilities & Skills page derives ability modifiers, proficiency bonus, saving throws, skill bonuses (including expertise), passive Perception, initiative, armor class, fixed-average hit point maximum, speed, carrying limits, spell save DC, spell attack bonus, and single-class spell slots. It also displays level-based resources for the selected class. Inputs are saved with the character, and the derived values recalculate from the current inputs.

The formulas follow the [2024 Basic Rules: Playing the Game](https://www.dndbeyond.com/sources/dnd/br-2024/playing-the-game), [Creating a Character](https://www.dndbeyond.com/sources/dnd/br-2024/creating-a-character), and [Character Classes](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). Scores begin at 10 as placeholders. Species speed and armor details are entered manually; AC features not covered by the common formulas can use Custom AC. Multiclass progression, subclass features and choices, prepared-spell counts, and full class feature descriptions still need their own data and UI.
