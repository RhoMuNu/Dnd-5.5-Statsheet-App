import { navigationGroups, type SectionId } from "../data/navigation";

type SidebarProps = {
  activeSection: SectionId;
  mobileMenuOpen: boolean;
  onNavigate: () => void;
  onCampaignClick: () => void;
};

export function Sidebar({ activeSection, mobileMenuOpen, onNavigate, onCampaignClick }: SidebarProps) {
  return (
    <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
      <a className="brand" href="#overview" onClick={onNavigate} aria-label="Taleforge home">
        <span className="brand-mark" aria-hidden="true">✦</span>
        <span className="brand-copy">
          <strong>TALEFORGE</strong>
          <small>CHARACTER COMPANION</small>
        </span>
      </a>

      <button className="campaign-switcher" type="button" aria-label="Open LAN campaign menu" title="Open LAN campaign menu" onClick={() => { onNavigate(); onCampaignClick(); }}>
        <span className="campaign-avatar" aria-hidden="true">✧</span>
        <span className="campaign-copy">
          <small>YOUR CAMPAIGN</small>
          <strong>Personal collection</strong>
        </span>
        <span className="chevron" aria-hidden="true">⌄</span>
      </button>

      <nav className="side-nav" id="main-navigation" aria-label="Main navigation">
        {navigationGroups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-heading">{group.label}</p>
            {group.items.map((item) => (
              <a
                className={`nav-link ${activeSection === item.id ? "active" : ""}`}
                key={item.id}
                href={`#${item.id}`}
                onClick={onNavigate}
                aria-current={activeSection === item.id ? "page" : undefined}
              >
                <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="rules-badge"><span className="rules-dot" /> 2024 RULESET <span className="rules-check">✓</span></div>
        <div className="profile-row">
          <div className="profile-avatar" aria-hidden="true">P</div>
          <div><strong>Local player</strong><small>Personal collection</small></div>
        </div>
      </div>
    </aside>
  );
}
