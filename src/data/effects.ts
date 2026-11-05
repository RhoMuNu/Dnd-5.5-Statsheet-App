import { customModifierTotal } from "./customModifiers";
import type { DieRoller } from "./physicalDice";
import { hasFeat } from "./advancement";
import type { Character } from "./characters";

export type ActiveEffect = { durationOwnerId?: string; sourceCharacterId?: string; sourceConcentrationId?: string; sourceSpell?: string; id: string; name: string; rounds: number | null; ac: number; attack: number; damage: number; save: number; check: number; speed: number; initiative: number; hpPerLevel: number; attackDie: number; saveDie: number; concentrationAdvantage: boolean; initiativeProficiency: boolean };
export const EFFECT_PRESETS: Record<string, Partial<ActiveEffect>> = {
  "Custom modifier": {},
  Bless: { attackDie: 4, saveDie: 4, rounds: 10 },
  Bane: { attackDie: -4, saveDie: -4, rounds: 10 },
  Shield: { ac: 5, rounds: 1 },
  "Tough feat": { hpPerLevel: 2 },
  "Alert feat": { initiativeProficiency: true },
  "War Caster feat": { concentrationAdvantage: true },
};
export function makeEffect(name: string, id: string): ActiveEffect {
  return { id, name, rounds: null, ac: 0, attack: 0, damage: 0, save: 0, check: 0, speed: 0, initiative: 0, hpPerLevel: 0, attackDie: 0, saveDie: 0, concentrationAdvantage: false, initiativeProficiency: false, ...EFFECT_PRESETS[name] };
}
export function activeEffects(character: Character): ActiveEffect[] {
  const names = new Set<string>();
  const invocationEffects = character.features.some((feature) => !feature.manualOnly && feature.name === "Eldritch Mind") ? [makeEffect("War Caster feat", "eldritch-mind")] : [];
  const automatic = ["Tough", "Alert", "War Caster"].filter((name) => hasFeat(character, name)).map((name) => makeEffect(`${name} feat`, `automatic-${name}`));
  return [...automatic, ...invocationEffects, ...(character.combat?.effects ?? [])].filter((effect) => {
    const name = effect.name.trim().toLowerCase();
    if (names.has(name) || (effect.rounds !== null && effect.rounds <= 0)) return false;
    names.add(name); return true;
  });
}
export function effectTotal(character: Character, key: "ac" | "attack" | "damage" | "save" | "check" | "speed" | "initiative" | "hpPerLevel") {
  return activeEffects(character).reduce((sum, effect) => sum + effect[key], customModifierTotal(character, key));
}
export function effectDice(character: Character, kind: "attack" | "save", die: DieRoller) {
  const rolls = activeEffects(character).flatMap((effect) => {
    const sides = kind === "attack" ? effect.attackDie : effect.saveDie;
    return sides ? [die(Math.abs(sides), `${character.name}: ${effect.name} ${kind} bonus die`) * Math.sign(sides)] : [];
  });
  return { rolls, total: rolls.reduce((sum, value) => sum + value, 0) };
}
export function advanceEffects(character: Character): ActiveEffect[] {
  return activeEffects(character).filter((effect) => !effect.id.startsWith("automatic-") && effect.id !== "eldritch-mind").map((effect) => effect.rounds === null || (effect.durationOwnerId && character.combat?.turn?.enabled && character.combat.turn.key.startsWith("lan-")) ? effect : { ...effect, rounds: effect.rounds - 1 }).filter((effect) => effect.rounds === null || effect.rounds > 0);
}
export function normalizeEffects(value: unknown): ActiveEffect[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object" && typeof item.id === "string" && typeof item.name === "string").slice(0, 50).map((item) => {
    const base = makeEffect("Custom modifier", item.id);
    const number = (key: string, min = -100, max = 100) => Number.isInteger(item[key]) ? Math.min(max, Math.max(min, item[key])) : 0;
    return { ...base, durationOwnerId: typeof item.durationOwnerId === "string" ? item.durationOwnerId : undefined, sourceCharacterId: typeof item.sourceCharacterId === "string" ? item.sourceCharacterId : undefined, sourceConcentrationId: typeof item.sourceConcentrationId === "string" ? item.sourceConcentrationId : undefined, sourceSpell: typeof item.sourceSpell === "string" ? item.sourceSpell : undefined, name: item.name.slice(0, 80), rounds: item.rounds === null || item.rounds === undefined ? null : Math.max(1, number("rounds", 1, 10000)),
      ac: number("ac"), attack: number("attack"), damage: number("damage"), save: number("save"), check: number("check"), speed: number("speed", -500, 500), initiative: number("initiative"), hpPerLevel: number("hpPerLevel", -10, 10),
      attackDie: [0, 4, 6, 8, 10, 12, -4, -6, -8, -10, -12].includes(item.attackDie) ? item.attackDie : 0,
      saveDie: [0, 4, 6, 8, 10, 12, -4, -6, -8, -10, -12].includes(item.saveDie) ? item.saveDie : 0,
      concentrationAdvantage: item.concentrationAdvantage === true, initiativeProficiency: item.initiativeProficiency === true };
  });
}
