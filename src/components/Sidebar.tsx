import { navigationGroups, type SectionId } from "../data/navigation";
import { Icon } from "./Icon";

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
        <span className="brand-mark"><Icon name="dice" /></span>
        <span className="brand-copy">
          <strong>TALEFORGE</strong>
          <small>YOUR ADVENTURE. CONNECTED.</small>
        </span>
      </a>

      <button className="campaign-switcher" type="button" aria-label="Open LAN campaign menu" title="Open LAN campaign menu" onClick={() => { onNavigate(); onCampaignClick(); }}>
        <span className="campaign-avatar"><Icon name="lan" /></span>
        <span className="campaign-copy">
          <small>PLAY WITH FRIENDS</small>
          <strong>LAN campaign</strong>
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
                <span className="nav-icon"><Icon name={item.id} /></span>
                <span>{item.label}</span>
              </a>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="rules-badge"><span className="rules-dot" /> 2024 RULESET <span className="rules-check">✓</span></div>
        <div className="sidebar-note"><Icon name="shield" /><p>Your story, kept close.<small>Local saves. Private LAN play.</small></p></div>
      </div>
    </aside>
  );
}
