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
    title: "My characters",
    description: "",
  },
  builder: {
    eyebrow: "CHARACTER BUILDER",
    title: "Character builder",
    description: "",
  },
  abilities: {
    eyebrow: "CHARACTER DETAILS",
    title: "Character sheet",
    description: "",
  },
  features: {
    eyebrow: "CHARACTER DETAILS",
    title: "Features & traits",
    description: "",
  },
  inventory: {
    eyebrow: "ADVENTURE KIT",
    title: "Inventory",
    description: "",
  },
  spells: {
    eyebrow: "ADVENTURE KIT",
    title: "Spellbook",
    description: "",
  },
  notes: {
    eyebrow: "ADVENTURE KIT",
    title: "Notes & journal",
    description: "",
  },
  lan: {
    eyebrow: "LOCAL NETWORK GAME",
    title: "LAN campaign",
    description: "Host a campaign on this PC or join one on your local network.",
  },
};

export function sectionFromHash(hash: string): SectionId {
  const candidate = hash.replace(/^#\/?/, "").split("?")[0];
  return navigationGroups.some((group) => group.items.some((item) => item.id === candidate))
    ? (candidate as SectionId)
    : "overview";
}
