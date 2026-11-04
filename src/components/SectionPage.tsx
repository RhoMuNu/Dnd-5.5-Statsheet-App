import { navigationGroups, sectionContent, type SectionId } from "../data/navigation";

type SectionPageProps = { section: Exclude<SectionId, "overview">; onCreate: () => void };

const sectionDetails: Record<Exclude<SectionId, "overview" | "builder">, { intro: string; items: string[] }> = {
  abilities: {
    intro: "Your ability scores power the rest of your sheet. Skills and saving throws will update from your character choices.",
    items: ["Ability scores", "Saving throws", "Skills & proficiencies"],
  },
  features: {
    intro: "Keep the special parts of your hero easy to find at the table.",
    items: ["Class features", "Species traits", "Feats & other traits"],
  },
  inventory: {
    intro: "Keep your equipment and treasures close at hand while you adventure.",
    items: ["Weapons & armor", "Adventuring gear", "Treasure & currency"],
  },
  spells: {
    intro: "A quick, organized reference for the magic your character can use.",
    items: ["Known spells", "Prepared spells", "Spell slots & resources"],
  },
  notes: {
    intro: "Hold on to the little details that make a campaign feel like your story.",
    items: ["Session journal", "Character backstory", "Party clues & reminders"],
  },
};

export function SectionPage({ section, onCreate }: SectionPageProps) {
  const content = sectionContent[section];
  const navItem = navigationGroups[0].items.find((item) => item.id === section)
    ?? navigationGroups[1].items.find((item) => item.id === section);

  if (section === "builder") {
    return (
      <section className="section-screen" aria-labelledby="section-page-title">
        <div className="section-intro-card">
          <div className="section-symbol" aria-hidden="true">✦</div>
          <div className="section-intro-copy">
            <p className="eyebrow">YOUR GUIDED START</p>
            <h2 id="section-page-title">A few choices, one ready-to-play hero.</h2>
            <p>The builder will walk you through each decision and keep the sheet up to date as you go.</p>
          </div>
        </div>
        <div className="builder-steps" aria-label="Character builder steps">
          {["The idea", "Your origins", "Your class", "Ability scores", "Review the sheet"].map((step, index) => (
            <div className="builder-step" key={step}>
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <span>{step}</span>
              <span className="step-state">UP NEXT</span>
            </div>
          ))}
        </div>
        <div className="next-step-note"><span aria-hidden="true">✧</span><p><strong>The guided builder is the next feature phase.</strong><br />This menu and its destinations are ready for us to build into.</p></div>
        <button className="primary-button" onClick={onCreate}>Back to character collection <span>→</span></button>
      </section>
    );
  }

  const detail = sectionDetails[section];

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
      <div className="content-preview-grid">
        {detail.items.map((item, index) => (
          <article className="content-preview-card" key={item}>
            <span className="content-preview-icon" aria-hidden="true">{["✧", "◈", "❖"][index]}</span>
            <div><h3>{item}</h3><p>Appears here when you create a character.</p></div>
            <span className="locked-label">EMPTY</span>
          </article>
        ))}
      </div>
      <div className="section-empty-footer">
        <div><strong>No character selected yet</strong><span>Create your first hero to start filling in this section.</span></div>
        <button className="primary-button" onClick={onCreate}>Go to collection <span>→</span></button>
      </div>
    </section>
  );
}
