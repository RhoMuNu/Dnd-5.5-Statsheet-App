import { ABILITIES, SKILLS, type Character } from "./characters";

export type CustomModifier = { id: string; name: string; target: string; amount: number; enabled: boolean };
export function modifierTargets() {
  return [
    ["ac", "Armor class"], ["initiative", "Initiative"], ["check", "All ability checks"], ["save", "All saving throws"],
    ["attack", "Weapon and spell attacks"], ["damage", "Weapon damage"], ["spellAttack", "Spell attacks only"], ["spellDC", "Spell save DC"],
    ["speed", "Speed (feet)"], ["maxHP", "Maximum HP"], ["hpPerLevel", "Maximum HP per level"],
    ...SKILLS.map(({ name }) => [`skill:${name}`, `${name} skill`]), ...ABILITIES.map((name) => [`save:${name}`, `${name} saves`]),
  ].map(([key, label]) => ({ key, label }));
}
export function normalizeCustomModifiers(value: unknown): CustomModifier[] {
  if (!Array.isArray(value)) return [];
  const targets = new Set(modifierTargets().map(({ key }) => key));
  const ids = new Set<string>();
  return value.filter((entry) => entry && typeof entry.id === "string" && typeof entry.name === "string" && targets.has(entry.target) && Number.isInteger(entry.amount) && Math.abs(entry.amount) <= 100 && !ids.has(entry.id) && !!ids.add(entry.id)).slice(0, 100).map((entry) => ({ id: entry.id.slice(0, 100), name: entry.name.slice(0, 80), target: entry.target, amount: entry.amount, enabled: entry.enabled !== false }));
}
export function customModifierTotal(character: Character, target: string) {
  return (Array.isArray(character.customModifiers) ? character.customModifiers : []).filter((entry) => entry && entry.enabled !== false && entry.target === target && Number.isInteger(entry.amount) && Math.abs(entry.amount) <= 100).reduce((total, entry) => total + entry.amount, 0);
}
