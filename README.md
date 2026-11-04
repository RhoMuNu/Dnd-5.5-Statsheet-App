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
