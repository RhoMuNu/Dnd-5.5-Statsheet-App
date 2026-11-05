import { SPELL_CATALOG, spellFromCatalog } from "./rulesCatalog";
import type { CharacterSpell } from "./characters";

const LISTS: Record<string, Record<number, string[]>> = {
  "Life Domain": { 3: ["Aid", "Bless", "Cure Wounds", "Lesser Restoration"], 5: ["Mass Healing Word", "Revivify"], 7: ["Aura of Life", "Death Ward"], 9: ["Greater Restoration", "Mass Cure Wounds"] },
  "Oath of Devotion": { 3: ["Protection from Evil and Good", "Shield of Faith"], 5: ["Aid", "Zone of Truth"], 9: ["Beacon of Hope", "Dispel Magic"], 13: ["Freedom of Movement", "Guardian of Faith"], 17: ["Commune", "Flame Strike"] },
  "Draconic Sorcery": { 3: ["Alter Self", "Chromatic Orb", "Command", "Dragon’s Breath"], 5: ["Fear", "Fly"], 7: ["Arcane Eye", "Charm Monster"], 9: ["Legend Lore", "Summon Dragon"] },
  "Fiend Patron": { 3: ["Burning Hands", "Command", "Scorching Ray", "Suggestion"], 5: ["Fireball", "Stinking Cloud"], 7: ["Fire Shield", "Wall of Fire"], 9: ["Geas", "Insect Plague"] },
};
export function subclassSpellNames(subclass: string, level: number): string[] { return Object.entries(LISTS[subclass] ?? {}).filter(([threshold]) => Number(threshold) <= level).flatMap(([, spells]) => spells).map((name) => SPELL_CATALOG.find((spell) => spell.name.toLowerCase().replace(/[’']/g, "") === name.toLowerCase().replace(/[’']/g, ""))?.name ?? name); }
export function subclassSpellGrants(subclass: string, level: number, className: string, id: string): CharacterSpell[] {
  return subclassSpellNames(subclass, level).flatMap((name, index) => {
    const spell = SPELL_CATALOG.find((entry) => entry.name.toLowerCase().replace(/[’']/g, "") === name.toLowerCase().replace(/[’']/g, ""));
    return spell ? [{ ...spellFromCatalog(spell.key, `${id}-subclass-${index}`, className), alwaysPrepared: true }] : [];
  });
}
