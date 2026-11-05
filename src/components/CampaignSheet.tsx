import { useState } from "react";
import type { Character } from "../data/characters";
import { AbilitiesPage } from "./AbilitiesPage";
import { FeaturesPage, InventoryPage, NotesPage, SpellbookPage } from "./CharacterSections";

const tabs = ["Abilities", "Features", "Inventory", "Spells", "Journal"] as const;
export function CampaignSheet({ character, onChange }: { character: Character; onChange: (updates: Partial<Character>) => void }) {
  const [tab, setTab] = useState<typeof tabs[number]>("Abilities");
  const props = { character, onChange };
  return <>
    <nav className="campaign-sheet-tabs" aria-label="Campaign character sections">{tabs.map((name) => <button type="button" key={name} aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    {tab === "Abilities" ? <AbilitiesPage {...props} /> : tab === "Features" ? <FeaturesPage {...props} /> : tab === "Inventory" ? <InventoryPage {...props} /> : tab === "Spells" ? <SpellbookPage {...props} /> : <NotesPage {...props} />}
  </>;
}
