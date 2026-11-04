export const navigationGroups = [
  {
    label: "CHARACTER",
    items: [
      { id: "overview", label: "Overview", icon: "⌂" },
      { id: "builder", label: "Character builder", icon: "✦" },
      { id: "abilities", label: "Abilities & skills", icon: "◈" },
      { id: "features", label: "Features & traits", icon: "❖" },
    ],
  },
  {
    label: "ADVENTURE",
    items: [
      { id: "inventory", label: "Inventory", icon: "▣" },
      { id: "spells", label: "Spells", icon: "✧" },
      { id: "notes", label: "Notes & journal", icon: "▤" },
    ],
  },
] as const;

export type SectionId = (typeof navigationGroups)[number]["items"][number]["id"];

export const sectionContent: Record<SectionId, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "YOUR ADVENTURE",
    title: "Welcome back, adventurer.",
    description: "Pick up where you left off, or start a brand-new story.",
  },
  builder: {
    eyebrow: "CHARACTER BUILDER",
    title: "Bring a hero to life.",
    description: "A guided path from your first idea to a ready-to-play character.",
  },
  abilities: {
    eyebrow: "CHARACTER DETAILS",
    title: "Abilities & skills",
    description: "Ability scores, saving throws, skills, and proficiencies in one place.",
  },
  features: {
    eyebrow: "CHARACTER DETAILS",
    title: "Features & traits",
    description: "Class features, species traits, feats, and the things that make your hero unique.",
  },
  inventory: {
    eyebrow: "ADVENTURE KIT",
    title: "Inventory",
    description: "Gear, treasure, and the curious things you pick up along the way.",
  },
  spells: {
    eyebrow: "ADVENTURE KIT",
    title: "Spellbook",
    description: "Spells and magical resources, gathered in one easy-to-use place.",
  },
  notes: {
    eyebrow: "ADVENTURE KIT",
    title: "Notes & journal",
    description: "Session recaps, clues, character ideas, and unfinished business.",
  },
};

export function sectionFromHash(hash: string): SectionId {
  const candidate = hash.replace(/^#\/?/, "");
  return navigationGroups.some((group) => group.items.some((item) => item.id === candidate))
    ? (candidate as SectionId)
    : "overview";
}
