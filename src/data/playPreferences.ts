import type { DiceSource } from "./physicalDice";

export type AutomationLevel = "paper" | "tracked" | "assisted";
export const PLAY_LEVELS: { id: AutomationLevel; name: string; description: string }[] = [
  { id: "paper", name: "Paper sheet", description: "Calculated bonuses and references. Enter final HP and resource changes yourself; no roll, cast, effect, or rest helpers." },
  { id: "tracked", name: "Tracked sheet", description: "Resolve dice and effects at the table. Record casts, spend slots, track actions, and recover resources with rest controls." },
  { id: "assisted", name: "Assisted play", description: "Use supported roll, healing, and spell-effect helpers. Choose physical dice with automatic totals, or digital dice." },
];
export const AUTOMATION_KEY = "taleforge.automation.level.v1";
export function readPlayPreferences(storage: Pick<Storage, "getItem">): { automation: AutomationLevel; dice: DiceSource } {
  try {
    const stored = storage.getItem(AUTOMATION_KEY);
    return { automation: PLAY_LEVELS.some((level) => level.id === stored) ? stored as AutomationLevel : storage.getItem("taleforge.sheet.classic.v1") === "true" ? "tracked" : "assisted", dice: storage.getItem("taleforge.dice.source.v1") === "physical" ? "physical" : "digital" };
  } catch { return { automation: "assisted", dice: "digital" }; }
}
