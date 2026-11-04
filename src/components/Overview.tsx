type OverviewProps = {
  onCreate: () => void;
  onExplore: () => void;
};

export function Overview({ onCreate, onExplore }: OverviewProps) {
  return (
    <>
      <section className="featured-card" aria-labelledby="first-hero-title">
        <div className="featured-art" aria-hidden="true">
          <div className="moon" />
          <div className="mountain mountain-back" />
          <div className="mountain mountain-front" />
          <div className="art-rune">✧</div>
          <div className="art-caption">A NEW TALE AWAITS</div>
        </div>
        <div className="featured-info">
          <div className="featured-topline">
            <span className="status-pill"><i /> FIRST ADVENTURE</span>
            <span className="last-played">Your next session is waiting</span>
          </div>
          <div className="feature-heading">
            <div>
              <p className="character-kicker">YOUR ACTIVE CHARACTER</p>
              <h2 id="first-hero-title">Make your first hero</h2>
            </div>
            <span className="level-seal" aria-hidden="true">✦</span>
          </div>
          <p className="feature-description">Every great adventure begins with a character. Build yours and we’ll help keep all the numbers in order.</p>
          <div className="feature-meta">
            <span><i className="meta-icon">⚔</i> 2024 rules</span>
            <span><i className="meta-icon">◷</i> A few minutes to begin</span>
          </div>
          <div className="feature-actions">
            <button className="primary-button" onClick={onCreate}>Start character builder <span>→</span></button>
            <button className="text-button" onClick={onExplore}>Explore the sheet <span>↗</span></button>
          </div>
        </div>
      </section>

      <section className="collection-section" aria-labelledby="collection-title">
        <div className="section-title-row">
          <div>
            <p className="eyebrow">YOUR COLLECTION</p>
            <h2 id="collection-title">Characters <span className="count-chip">0</span></h2>
          </div>
          <span className="sort-label">Ready for your first hero</span>
        </div>
        <button className="empty-card" onClick={onCreate}>
          <span className="empty-icon" aria-hidden="true">＋</span>
          <span className="empty-title">Your character roster is empty</span>
          <span className="empty-caption">Create a character to see them here.</span>
          <span className="empty-link">Make your first character <b>→</b></span>
        </button>
      </section>

      <section className="quick-links">
        <div className="quick-copy">
          <span className="quick-spark" aria-hidden="true">✧</span>
          <div><strong>New to character sheets?</strong><span>Start with a guided build. We’ll take it one step at a time.</span></div>
        </div>
        <button onClick={onCreate}>See how it works <span>→</span></button>
      </section>
    </>
  );
}
