import { spendTurn } from "./economy";
import type { Character } from "./characters";
import { calculateCharacterStats } from "./calculations";
import { healCharacter, rollDie } from "./gameplay";
import { isIncapacitated } from "./conditions";

export function useHealingFeature(character: Character, feature: "second-wind" | "lay-on-hands", amount = 1, die = rollDie) {
  if (isIncapacitated(character)) throw new Error("Cannot use this feature while incapacitated.");
  const stats = calculateCharacterStats(character);
  const key = feature === "second-wind" ? "fighter.second-wind" : "paladin.lay-on-hands";
  const resource = stats.classResources.find((entry) => entry.key === key);
  const cost = feature === "second-wind" ? 1 : amount;
  if (!resource || !Number.isInteger(cost) || cost <= 0 || cost > (resource.maxUses ?? 0) - (resource.used ?? 0)) throw new Error("Not enough uses remain.");
  const fighterLevel = stats.classBreakdown.find((entry) => entry.name === "Fighter")?.level ?? 0;
  const costUpdates = spendTurn(character, "bonus");
  const healing = feature === "second-wind" ? die(10, `${character.name}: Second Wind healing`) + fighterLevel : amount;
  return { updates: { ...costUpdates, ...healCharacter({ ...character, ...costUpdates }, healing), resourceUses: { ...character.resourceUses, [key]: (resource.used ?? 0) + cost } }, healing };
}
