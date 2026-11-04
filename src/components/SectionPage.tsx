import { navigationGroups, sectionContent, type SectionId } from "../data/navigation";
import type { Character } from "../data/characters";
import { AbilitiesPage } from "./AbilitiesPage";

type SectionPageProps = {
  section: Exclude<SectionId, "overview" | "builder" | "lan">;
  character: Character | null;
  onOpenBuilder: () => void;
  onEdit: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Character>) => void;
  onOpenAbilities: () => void;
};

const sectionDetails: Record<Exclude<SectionId, "overview" | "builder" | "lan">, { intro: string; items: string[] }> = {
  abilities: {
    intro: "Your ability scores power the rest of your sheet. Skills and saving throws will update from your character choices.",
    items: ["Ability scores", "Saving throws", "Skills & proficiencies"],
  },
  features: {
    intro: "Class uses and custom feat trackers are available on the Abilities & skills sheet. A full feature and traits editor is coming next.",
    items: ["Class features", "Species traits", "Feats & other traits"],
  },
  inventory: {
    intro: "Keep your equipment and treasures close at hand while you adventure.",
    items: ["Weapons & armor", "Adventuring gear", "Treasure & currency"],
  },
  spells: {
    intro: "Spell slot tracking is available on the Abilities & skills sheet. Spell lists and prepared spells are coming next.",
    items: ["Known spells", "Prepared spells", "Spell slots & resources"],
  },
  notes: {
    intro: "Hold on to the little details that make a campaign feel like your story.",
    items: ["Session journal", "Character backstory", "Party clues & reminders"],
  },
};

export function SectionPage({ section, character, onOpenBuilder, onEdit, onUpdate, onOpenAbilities }: SectionPageProps) {
  const content = sectionContent[section];
  const navItem = navigationGroups[0].items.find((item) => item.id === section)
    ?? navigationGroups[1].items.find((item) => item.id === section);
  const detail = sectionDetails[section];

  if (section === "abilities" && character) {
    return <AbilitiesPage character={character} onChange={(updates) => onUpdate(character.id, updates)} />;
  }

  return (
    <section className="section-screen" aria-labelledby="section-page-title">
      <div className="section-intro-card">
        <div className="section-symbol" aria-hidden="true">{navItem?.icon}</div>
        <div className="section-intro-copy">
          <p className="eyebrow">{content.eyebrow}</p>
          <h2 id="section-page-title">{content.title}</h2>
          <p>{detail.intro}</p>
        </div>
      </div>
      {character && (
        <div className="selected-character-banner">
          <span className="roster-avatar" aria-hidden="true">{character.name.charAt(0).toUpperCase()}</span>
          <div><small>SELECTED CHARACTER</small><strong>{character.name}</strong><span>{[character.species, character.characterClass, character.background].filter(Boolean).join(" · ") || "New adventurer"} · Level {character.level}</span></div>
          <button className="text-button" onClick={() => onEdit(character.id)}>Edit basics <span>↗</span></button>
        </div>
      )}
      <div className="content-preview-grid">
        {detail.items.map((item, index) => (
          <article className="content-preview-card" key={item}>
            <span className="content-preview-icon" aria-hidden="true">{["✧", "◈", "❖"][index]}</span>
            <div><h3>{item}</h3><p>{character ? "This part of the sheet is ready for the next build step." : "Create a character to start filling in this section."}</p></div>
            <span className="locked-label">{character ? "UP NEXT" : "EMPTY"}</span>
          </article>
        ))}
      </div>
      {character && (section === "features" || section === "spells") && <div className="section-feature-link"><div><strong>{section === "features" ? "Track feature uses" : "Track spell slots"}</strong><span>{section === "features" ? "Manage class resources, feats, and custom limited-use features." : "Spend and restore spell slots from your character sheet."}</span></div><button className="primary-button" onClick={onOpenAbilities}>Open character sheet <span>→</span></button></div>}
      <div className="section-empty-footer">
        <div><strong>{character ? `${character.name}’s sheet is taking shape` : "No character selected yet"}</strong><span>{character ? "Your saved character is available from every menu section." : "Create your first hero to start filling in this section."}</span></div>
        {!character && <button className="primary-button" onClick={onOpenBuilder}>Create a character <span>→</span></button>}
      </div>
    </section>
  );
}
