export type Character = {
  id: string;
  name: string;
  concept: string;
  species: string;
  characterClass: string;
  background: string;
  level: number;
  createdAt: string;
  updatedAt: string;
};

export type CharacterDraft = Omit<Character, "id" | "createdAt" | "updatedAt">;

const CHARACTERS_KEY = "taleforge.characters.v1";
const ACTIVE_CHARACTER_KEY = "taleforge.activeCharacter.v1";

export function loadCharacters(): Character[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(CHARACTERS_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter(isCharacter);
  } catch {
    return [];
  }
}

export function saveCharacters(characters: Character[]): boolean {
  try {
    localStorage.setItem(CHARACTERS_KEY, JSON.stringify(characters));
    return true;
  } catch {
    return false;
  }
}

export function loadActiveCharacterId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_CHARACTER_KEY);
  } catch {
    return null;
  }
}

export function saveActiveCharacterId(id: string | null): boolean {
  try {
    if (id) localStorage.setItem(ACTIVE_CHARACTER_KEY, id);
    else localStorage.removeItem(ACTIVE_CHARACTER_KEY);
    return true;
  } catch {
    return false;
  }
}

export function makeCharacterId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `hero-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isCharacter(value: unknown): value is Character {
  if (!value || typeof value !== "object") return false;
  const character = value as Partial<Character>;
  return typeof character.id === "string"
    && typeof character.name === "string"
    && typeof character.concept === "string"
    && typeof character.species === "string"
    && typeof character.characterClass === "string"
    && typeof character.background === "string"
    && typeof character.level === "number"
    && typeof character.createdAt === "string"
    && typeof character.updatedAt === "string";
}
