import type { Character, CharacterAttack, InventoryItem } from "./characters";
import { makeWeaponAttack, WEAPON_PRESETS } from "./attacks";

export function weaponForItem(item: Pick<InventoryItem, "name">) {
  const match = item.name.trim().toLowerCase().replace(/\s+/g, " ").match(/^(?:\+([1-3])\s+)?(.+?)(?:\s*\+([1-3]))?$/);
  if (!match || (match[1] && match[3])) return null;
  const base = match[2].replace(/^(?:arcane|druidic) focus \(quarterstaff\)$/, "quarterstaff");
  const weapon = WEAPON_PRESETS.find((entry) => (entry.name.toLowerCase() === base || `${entry.name.toLowerCase()}s` === base) && entry.name !== "Unarmed Strike");
  return weapon ? { name: weapon.name, magic: Number(match[1] ?? match[3] ?? 0) } : null;
}

/** Inventory attacks are derived for old/imported/LAN sheets as well as new edits. */
export function characterAttacks(character: Character): CharacterAttack[] {
  const saved = character.attacks ?? [];
  const manual = saved.filter((attack) => !attack.inventoryItemId);
  const equipped = character.inventory.items.filter((item) => item.equipped && item.quantity > 0);
  const linked = equipped.flatMap((item) => {
    const weapon = weaponForItem(item);
    if (!weapon) return [];
    const key = `${weapon.name}:${weapon.magic}`;
    const existing = saved.find((attack) => attack.inventoryItemId === item.id && attack.inventoryWeaponKey === key);
    if (existing) return [existing];
    const base = makeWeaponAttack(character, weapon.name, `inventory-weapon:${item.id}`);
    return [{ ...base, name: item.name.trim(), inventoryItemId: item.id, inventoryWeaponKey: key, attackBonus: weapon.magic, damageBonus: base.damageBonus + weapon.magic }];
  });
  return [...linked, ...manual];
}

export function removeCharacterAttack(character: Character, id: string): Partial<Character> {
  const attack = characterAttacks(character).find((entry) => entry.id === id);
  return { attacks: (character.attacks ?? []).filter((entry) => entry.id !== id && (!attack?.inventoryItemId || entry.inventoryItemId !== attack.inventoryItemId)),
    ...(attack?.inventoryItemId ? { inventory: { ...character.inventory, items: character.inventory.items.map((item) => item.id === attack.inventoryItemId ? { ...item, equipped: false } : item) } } : {}) };
}
