import { useEffect, useState } from "react";
import { Overview } from "./components/Overview";
import { SectionPage } from "./components/SectionPage";
import { Sidebar } from "./components/Sidebar";
import { CharacterBuilder } from "./components/CharacterBuilder";
import {
  loadActiveCharacterId,
  loadCharacters,
  makeCharacterId,
  saveActiveCharacterId,
  saveCharacters,
} from "./data/characters";
import type { Character, CharacterDraft } from "./data/characters";
import { sectionContent, sectionFromHash } from "./data/navigation";
import type { SectionId } from "./data/navigation";

function App() {
  const [activeSection, setActiveSection] = useState<SectionId>(() => sectionFromHash(window.location.hash));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>(loadCharacters);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(loadActiveCharacterId);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const current = sectionContent[activeSection];
  const activeCharacter = characters.find((character) => character.id === selectedCharacterId) ?? characters[0] ?? null;

  useEffect(() => {
    setStorageAvailable(saveCharacters(characters));
  }, [characters]);

  useEffect(() => {
    setStorageAvailable((available) => saveActiveCharacterId(selectedCharacterId) && available);
  }, [selectedCharacterId]);

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

  function saveCharacter(draft: CharacterDraft) {
    const now = new Date().toISOString();
    if (editingCharacterId) {
      setCharacters((existing) => existing.map((character) => character.id === editingCharacterId
        ? { ...character, ...draft, updatedAt: now }
        : character));
      setSelectedCharacterId(editingCharacterId);
    } else {
      const created: Character = {
        ...draft,
        id: makeCharacterId(),
        createdAt: now,
        updatedAt: now,
      };
      setCharacters((existing) => [created, ...existing]);
      setSelectedCharacterId(created.id);
    }
    setEditingCharacterId(null);
    navigate("overview");
  }

  function editCharacter(id: string) {
    setEditingCharacterId(id);
    setSelectedCharacterId(id);
    navigate("builder");
  }

  function deleteCharacter(id: string) {
    const character = characters.find((item) => item.id === id);
    if (!character || !window.confirm(`Delete ${character.name} from this browser? This cannot be undone.`)) return;
    setCharacters((existing) => existing.filter((item) => item.id !== id));
    if (selectedCharacterId === id) setSelectedCharacterId(null);
  }

  function updateCharacter(id: string, updates: Partial<Character>) {
    setCharacters((existing) => existing.map((character) => character.id === id
      ? { ...character, ...updates, updatedAt: new Date().toISOString() }
      : character));
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
            <span className={`rules-status ${storageAvailable ? "" : "storage-warning"}`}><span /> {storageAvailable ? "Saved in this browser" : "Local save unavailable"}</span>
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
            <Overview
              characters={characters}
              selectedCharacterId={activeCharacter?.id ?? null}
              onCreate={() => { setEditingCharacterId(null); navigate("builder"); }}
              onExplore={() => navigate("abilities")}
              onSelect={setSelectedCharacterId}
              onEdit={editCharacter}
              onDelete={deleteCharacter}
            />
          ) : activeSection === "builder" ? (
            <CharacterBuilder
              key={editingCharacterId ?? "new-character"}
              character={characters.find((character) => character.id === editingCharacterId)}
              onSave={saveCharacter}
              onCancel={() => { setEditingCharacterId(null); navigate("overview"); }}
            />
          ) : (
            <SectionPage
              section={activeSection}
              character={activeCharacter}
              onOpenBuilder={() => { setEditingCharacterId(null); navigate("builder"); }}
              onEdit={editCharacter}
              onUpdate={updateCharacter}
            />
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
