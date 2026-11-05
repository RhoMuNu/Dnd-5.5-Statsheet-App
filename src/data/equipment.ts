import type { ArmorMode, Character, InventoryItem } from "./characters";

type Armor = { name: string; mode: ArmorMode | "shield"; ac: number; strength: number; stealth: boolean; weight: number };
// 2024 Basic Rules, Equipment / Armor.
export const ARMOR_PRESETS: Armor[] = [
  { name: "Padded Armor", mode: "light", ac: 11, strength: 0, stealth: true, weight: 8 },
  { name: "Leather Armor", mode: "light", ac: 11, strength: 0, stealth: false, weight: 10 },
  { name: "Studded Leather Armor", mode: "light", ac: 12, strength: 0, stealth: false, weight: 13 },
  { name: "Hide Armor", mode: "medium", ac: 12, strength: 0, stealth: false, weight: 12 },
  { name: "Chain Shirt", mode: "medium", ac: 13, strength: 0, stealth: false, weight: 20 },
  { name: "Scale Mail", mode: "medium", ac: 14, strength: 0, stealth: true, weight: 45 },
  { name: "Breastplate", mode: "medium", ac: 14, strength: 0, stealth: false, weight: 20 },
  { name: "Half Plate Armor", mode: "medium", ac: 15, strength: 0, stealth: true, weight: 40 },
  { name: "Ring Mail", mode: "heavy", ac: 14, strength: 0, stealth: true, weight: 40 },
  { name: "Chain Mail", mode: "heavy", ac: 16, strength: 13, stealth: true, weight: 55 },
  { name: "Splint Armor", mode: "heavy", ac: 17, strength: 15, stealth: true, weight: 60 },
  { name: "Plate Armor", mode: "heavy", ac: 18, strength: 15, stealth: true, weight: 65 },
  { name: "Shield", mode: "shield", ac: 2, strength: 0, stealth: false, weight: 6 },
];

export function armorForItem(item: Pick<InventoryItem, "name">): (Armor & { magic: number }) | null {
  const name = item.name.trim().toLowerCase();
  const match = name.match(/^(?:\+([1-3])\s+)?(.+?)(?:\s*\+([1-3]))?$/);
  if (!match || (match[1] && match[3])) return null;
  const base = match[2].replace(/\s+armor$/, "");
  const armor = ARMOR_PRESETS.find((entry) => entry.name.toLowerCase().replace(/\s+armor$/, "") === base);
  return armor ? { ...armor, magic: Number(match[1] ?? match[3] ?? 0) } : null;
}

export function inventoryArmor(character: Character) {
  const equipped = (character.inventory?.items ?? []).filter((item) => item.equipped && item.quantity > 0);
  const known = equipped.map((item) => ({ item, armor: armorForItem(item) })).filter((entry) => entry.armor !== null);
  const suits = known.filter((entry) => entry.armor!.mode !== "shield");
  const shields = known.filter((entry) => entry.armor!.mode === "shield");
  const suit = suits[0]?.armor;
  const shield = shields[0]?.armor;
  const warnings: string[] = [];
  if (suits.length > 1) warnings.push("Multiple suits are equipped. Only the first suit is used; unequip the others.");
  if (shields.length > 1) warnings.push("Only one shield grants an AC bonus.");
  for (const item of equipped) if (item.category === "Armor" && !armorForItem(item)) warnings.push(`${item.name}: unknown armor. Choose a standard preset or use manual armor settings.`);
  if (shield && character.inventoryShieldTrained === false) warnings.push("Shield training is off: this shield grants no AC bonus.");
  const untrained = !!suit && character.inventoryArmorTrained === false;
  if (untrained) warnings.push("Untrained armor: Strength/Dexterity d20 tests have disadvantage and spellcasting is blocked.");
  return {
    armorMode: (suit?.mode ?? "unarmored") as ArmorMode,
    armorBaseAC: suit ? suit.ac + suit.magic : 10,
    armorStrengthRequirement: suit?.strength ?? 0,
    // Wielding a shield prevents Monk benefits even without shield training.
    hasShield: !!shield,
    shieldBonus: shield && character.inventoryShieldTrained !== false ? shield.ac + shield.magic : 0,
    stealth: suit?.stealth ?? false, untrained, warnings,
    description: [suits[0]?.item.name, shields[0]?.item.name].filter(Boolean).join(" + ") || "Unarmored",
  };
}

export function equipInventoryItem(items: InventoryItem[], id: string, patch: Partial<InventoryItem>): InventoryItem[] {
  const target = items.find((item) => item.id === id);
  if (!target) return items;
  const updated = { ...target, ...patch };
  const armor = updated.equipped && updated.quantity > 0 ? armorForItem(updated) : null;
  return items.map((item) => {
    if (item.id === id) return updated;
    const other = armorForItem(item);
    if (armor && other && ((armor.mode === "shield") === (other.mode === "shield"))) return { ...item, equipped: false };
    return item;
  });
}
