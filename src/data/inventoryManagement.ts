import type { CharacterInventory, InventoryCurrency, InventoryItem } from "./characters";

export function itemIsCarried(item: InventoryItem, items: InventoryItem[], visited = new Set<string>()): boolean {
  if (item.carried === false || item.quantity <= 0 || visited.has(item.id)) return false;
  if (!item.containerId) return true;
  const parent = items.find((entry) => entry.id === item.containerId);
  if (!parent?.isContainer) return true;
  return itemIsCarried(parent, items, new Set([...visited, item.id]));
}
export function carriedInventoryWeight(inventory: CharacterInventory): number {
  const itemWeight = inventory.items.reduce((total, item) => {
    if (!itemIsCarried(item, inventory.items)) return total;
    const visited = new Set([item.id]);
    let parent = inventory.items.find((entry) => entry.id === item.containerId);
    while (parent) {
      if (visited.has(parent.id)) return total;
      if (parent.fixedWeight && parent.isContainer) return total;
      visited.add(parent.id);
      parent = inventory.items.find((entry) => entry.id === parent!.containerId);
    }
    return total + item.quantity * item.weight;
  }, 0);
  return itemWeight + Object.values(inventory.currency).reduce((sum, coins) => sum + coins, 0) / 50;
}
export function moveInventoryItem(items: InventoryItem[], id: string, containerId: string): InventoryItem[] {
  const item = items.find((entry) => entry.id === id);
  if (!item) throw new Error("Item no longer exists.");
  const visited = new Set([id]);
  let parent = items.find((entry) => entry.id === containerId);
  if (containerId && !parent?.isContainer) throw new Error("Choose a storage container.");
  while (parent) {
    if (visited.has(parent.id)) throw new Error("A container cannot be stored inside itself or its contents.");
    visited.add(parent.id); parent = items.find((entry) => entry.id === parent!.containerId);
  }
  return items.map((entry) => entry.id === id ? { ...entry, containerId: containerId || undefined } : entry);
}
export function removeInventoryItem(items: InventoryItem[], id: string): InventoryItem[] {
  const removed = items.find((item) => item.id === id);
  return items.filter((item) => item.id !== id).map((item) => item.containerId === id ? { ...item, containerId: removed?.containerId, carried: itemIsCarried(item, items), equipped: itemIsCarried(item, items) && item.equipped } : item);
}
export function recoverItemCharges(items: InventoryItem[], kind: "Short Rest" | "Long Rest") {
  return items.map((item) => item.charges && (item.charges.recovery === "short" || (kind === "Long Rest" && item.charges.recovery === "long")) ? { ...item, charges: { ...item.charges, used: 0 } } : item);
}
export function validInventoryExtras(item: Record<string, unknown>): boolean {
  if (!["carried", "isContainer", "fixedWeight", "attuned"].every((key) => item[key] === undefined || typeof item[key] === "boolean")) return false;
  if (item.containerId !== undefined && (typeof item.containerId !== "string" || item.containerId.length > 100)) return false;
  if (item.charges === undefined) return true;
  const charges = item.charges as InventoryItem["charges"];
  return !!charges && Number.isInteger(charges.maximum) && charges.maximum >= 1 && charges.maximum <= 9999 && Number.isInteger(charges.used) && charges.used >= 0 && charges.used <= charges.maximum && ["manual", "short", "long"].includes(charges.recovery);
}
const COPPER = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 };
export function currencyCopper(currency: InventoryCurrency) { return Object.entries(COPPER).reduce((sum, [coin, worth]) => sum + currency[coin as keyof InventoryCurrency] * worth, 0); }
export function transactCoins(currency: InventoryCurrency, coin: keyof InventoryCurrency, quantity: number, spend: boolean): InventoryCurrency {
  if (!(coin in COPPER) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 999999) throw new Error("Enter a whole number of coins from 1 to 999999.");
  const next = { ...currency };
  if (!spend) {
    if (next[coin] + quantity > 999999) throw new Error("That coin balance would exceed 999999.");
    next[coin] += quantity; return next;
  }
  let remaining = quantity * COPPER[coin];
  if (remaining > currencyCopper(currency)) throw new Error("Not enough coins. No money was spent.");
  for (const denomination of ["cp", "sp", "ep", "gp", "pp"] as const) {
    const taken = Math.min(next[denomination], Math.ceil(remaining / COPPER[denomination]));
    next[denomination] -= taken;
    const covered = taken * COPPER[denomination];
    if (covered > remaining) {
      let change = covered - remaining;
      for (const unit of ["pp", "gp", "sp", "cp"] as const) { const count = Math.floor(change / COPPER[unit]); next[unit] += count; change -= count * COPPER[unit]; }
    }
    remaining = Math.max(0, remaining - covered);
  }
  return next;
}
