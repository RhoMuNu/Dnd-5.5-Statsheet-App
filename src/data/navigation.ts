export const navigationGroups = [
  { label: "WORKSPACE", items: [
    { id: "overview", label: "My characters", icon: "⌂" },
    { id: "builder", label: "Character builder", icon: "✦" },
  ] },
  { label: "CHARACTER", items: [
    { id: "abilities", label: "Play sheet", icon: "◈" },
    { id: "spells", label: "Spellbook", icon: "✧" },
    { id: "inventory", label: "Inventory", icon: "▣" },
    { id: "features", label: "Features & traits", icon: "❖" },
    { id: "notes", label: "Journal", icon: "▤" },
  ] },
  { label: "CAMPAIGNS", items: [
    { id: "lan", label: "LAN campaign", icon: "⌁" },
  ] },
] as const;

export type SectionId = (typeof navigationGroups)[number]["items"][number]["id"];

export const sectionContent: Record<SectionId, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "YOUR ADVENTURE",
    title: "Your next chapter.",
    description: "Your heroes, your stories, your next great adventure.",
  },
  builder: {
    eyebrow: "CHARACTER BUILDER",
    title: "Bring a hero to life.",
    description: "A guided path from your first idea to a ready-to-play character.",
  },
  abilities: {
    eyebrow: "CHARACTER DETAILS",
    title: "Character sheet",
    description: "Everything you need at the table, right where you need it.",
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
  lan: {
    eyebrow: "LOCAL NETWORK GAME",
    title: "Gather your party.",
    description: "Host a campaign on this PC or join one on your local network.",
  },
};

export function sectionFromHash(hash: string): SectionId {
  const candidate = hash.replace(/^#\/?/, "").split("?")[0];
  return navigationGroups.some((group) => group.items.some((item) => item.id === candidate))
    ? (candidate as SectionId)
    : "overview";
}
