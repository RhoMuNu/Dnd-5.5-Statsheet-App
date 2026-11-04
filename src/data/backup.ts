import { normalizeCharacter, type Character } from "./characters";

const BACKUP_FORMAT = "taleforge-character-backup";
const BACKUP_VERSION = 1;

type CharacterBackup = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  activeCharacterId: string | null;
  characters: Character[];
};

export function createCharacterBackup(characters: Character[], activeCharacterId: string | null): string {
  const backup: CharacterBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    activeCharacterId,
    characters,
  };
  return JSON.stringify(backup, null, 2);
}

export function parseCharacterBackup(contents: string): CharacterBackup {
  const data: unknown = JSON.parse(contents);
  if (!data || typeof data !== "object") throw new Error("That file is not a TaleForge backup.");
  const backup = data as Partial<CharacterBackup>;
  if (backup.format !== BACKUP_FORMAT || backup.version !== BACKUP_VERSION || !Array.isArray(backup.characters)) {
    throw new Error("This backup format or version is not supported.");
  }

  const characters = backup.characters.map(normalizeCharacter);
  if (characters.some((character) => character === null)) {
    throw new Error("The backup contains a character record that could not be read. No characters were imported.");
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: typeof backup.exportedAt === "string" ? backup.exportedAt : "",
    activeCharacterId: typeof backup.activeCharacterId === "string" ? backup.activeCharacterId : null,
    characters: characters as Character[],
  };
}
