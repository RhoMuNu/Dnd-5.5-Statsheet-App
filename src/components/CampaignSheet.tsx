import { useState } from "react";
import type { Character } from "../data/characters";
import { AbilitiesPage } from "./AbilitiesPage";
import { FeaturesPage, InventoryPage, NotesPage, SpellbookPage } from "./CharacterSections";

const tabs = ["Play sheet", "Features", "Inventory", "Spellbook", "Journal"] as const;
export function CampaignSheet({ character, onChange }: { character: Character; onChange: (updates: Partial<Character>) => void }) {
  const [tab, setTab] = useState<typeof tabs[number]>("Play sheet");
  const props = { character, onChange };
  return <>
    <nav className="campaign-sheet-tabs" aria-label="Campaign character sections">{tabs.map((name) => <button type="button" key={name} aria-current={tab === name ? "page" : undefined} onClick={() => setTab(name)}>{name}</button>)}</nav>
    {tab === "Play sheet" ? <AbilitiesPage {...props} /> : tab === "Features" ? <FeaturesPage {...props} /> : tab === "Inventory" ? <InventoryPage {...props} /> : tab === "Spellbook" ? <SpellbookPage {...props} /> : <NotesPage {...props} />}
  </>;
}
