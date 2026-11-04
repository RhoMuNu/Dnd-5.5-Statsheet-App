import { useEffect, useState } from "react";
import { Overview } from "./components/Overview";
import { SectionPage } from "./components/SectionPage";
import { Sidebar } from "./components/Sidebar";
import { sectionContent, sectionFromHash } from "./data/navigation";
import type { SectionId } from "./data/navigation";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(() => sectionFromHash(window.location.hash));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const current = sectionContent[activeSection];

  useEffect(() => {
    function syncSectionFromUrl() {
      setActiveSection(sectionFromHash(window.location.hash));
      setMobileMenuOpen(false);
    }

    window.addEventListener("hashchange", syncSectionFromUrl);
    return () => window.removeEventListener("hashchange", syncSectionFromUrl);
  }, []);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileMenuOpen(false);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  function navigate(section: SectionId) {
    if (section === activeSection) {
      setMobileMenuOpen(false);
      return;
    }
    window.location.hash = section;
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-shell">
      <Sidebar
        activeSection={activeSection}
        mobileMenuOpen={mobileMenuOpen}
        onNavigate={() => setMobileMenuOpen(false)}
      />
      {mobileMenuOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} />}

      <div className="main-column">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            aria-label="Open navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="main-navigation"
            onClick={() => setMobileMenuOpen(true)}
          >
            <span aria-hidden="true">☰</span>
          </button>
          <div className="breadcrumb" aria-label={`You are in ${current.title}`}>
            <a href="#overview">MY CHARACTERS</a>
            <span className="crumb-divider" aria-hidden="true">/</span>
            <strong>{activeSection === "overview" ? "ALL CHARACTERS" : current.title.toUpperCase()}</strong>
          </div>
          <div className="topbar-actions">
            <span className="rules-status"><span /> Local draft mode</span>
            <button className="help-button" aria-label="About this app" title="About this app">?</button>
          </div>
        </header>

        <main className="page-content" id="main-content">
          <section className="welcome-row" aria-labelledby="page-title">
            <div>
              <p className="eyebrow"><span className="eyebrow-star" aria-hidden="true">✦</span> {current.eyebrow}</p>
              <h1 id="page-title" tabIndex={-1}>{current.title}</h1>
              <p className="welcome-subtitle">{current.description}</p>
            </div>
            {activeSection !== "builder" && (
              <button className="create-button" onClick={() => navigate("builder")}>
                <span aria-hidden="true">＋</span> Create a character
              </button>
            )}
          </section>

          {activeSection === "overview" ? (
            <Overview onCreate={() => navigate("builder")} onExplore={() => navigate("abilities")} />
          ) : (
            <SectionPage section={activeSection} onCreate={() => navigate("overview")} />
          )}

          <footer className="page-footer">
            <span>Made for your next great story</span>
            <span>✦ &nbsp; D&amp;D 2024 &nbsp; · &nbsp; Personal project</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
