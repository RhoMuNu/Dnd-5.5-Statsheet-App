import test from 'node:test';
import assert from 'node:assert/strict';
import { carriedInventoryWeight, itemIsCarried, moveInventoryItem, removeInventoryItem, recoverItemCharges, transactCoins, currencyCopper, validInventoryExtras } from '../src/data/inventoryManagement.ts';
import { characterAttacks } from '../src/data/inventoryWeapons.ts';
import { inventoryArmor } from '../src/data/equipment.ts';
import { defaultCharacterStats } from '../src/data/characters.ts';
const coins = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
const item = (id, patch = {}) => ({ id, name: id, quantity: 1, weight: 2, equipped: false, category: '', notes: '', ...patch });
test('nested containers exclude stored contents and fixed-weight contents, with coin weight retained', () => {
  const bag = item('bag', { isContainer: true, weight: 5 });
  const box = item('box', { isContainer: true, containerId: 'bag' });
  const sword = item('sword', { containerId: 'box', weight: 6 });
  const inv = { currency: { ...coins, gp: 50 }, items: [bag, box, sword] };
  assert.equal(carriedInventoryWeight(inv), 14);
  assert.equal(carriedInventoryWeight({ ...inv, items: [{ ...bag, fixedWeight: true }, box, sword] }), 6);
  const stored = [{ ...bag, carried: false }, box, sword];
  assert.equal(itemIsCarried(sword, stored), false);
  assert.equal(carriedInventoryWeight({ ...inv, items: stored }), 1);
  assert.throws(() => moveInventoryItem(inv.items, 'bag', 'box'), /itself/);
  assert.equal(itemIsCarried({ ...bag, containerId: 'bag' }, [{ ...bag, containerId: 'bag' }]), false);
  const detached = removeInventoryItem(stored, 'bag');
  assert.equal(detached[0].carried, false);
  assert.equal(itemIsCarried(detached[1], detached), false);
});
test('stored equipped weapons and armor grant no equipment profiles', () => {
  const character = { ...defaultCharacterStats(), inventory: { currency: coins, items: [item('bag', { isContainer: true, carried: false }), item('weapon', { name: 'Longsword', equipped: true, containerId: 'bag' }), item('armor', { name: 'Plate Armor', equipped: true, containerId: 'bag' })] } };
  assert.equal(characterAttacks(character).length, 0);
  assert.equal(inventoryArmor(character).armorMode, 'unarmored');
});
test('item charge rest recovery respects each configured recovery option', () => {
  const items = ['short', 'long', 'manual'].map((recovery) => item(recovery, { charges: { maximum: 3, used: 2, recovery } }));
  assert.deepEqual(recoverItemCharges(items, 'Short Rest').map(i => i.charges.used), [0, 2, 2]);
  assert.deepEqual(recoverItemCharges(items, 'Long Rest').map(i => i.charges.used), [0, 0, 2]);
  assert.deepEqual(items.map(i => i.charges.used), [2, 2, 2]);
  assert.equal(validInventoryExtras({ charges: { maximum: 1, used: 2, recovery: 'manual' } }), false);
  assert.equal(validInventoryExtras(items[0]), true);
});
test('coin spending makes exact change without changing funds on failed transactions', () => {
  const purse = { ...coins, pp: 1, ep: 1 };
  const result = transactCoins(purse, 'gp', 1, true);
  assert.equal(currencyCopper(result), 950);
  assert.deepEqual(purse, { ...coins, pp: 1, ep: 1 });
  assert.throws(() => transactCoins(purse, 'gp', 11, true), /Not enough/);
  assert.throws(() => transactCoins(purse, 'gp', 1.5, true), /whole/);
  assert.equal(transactCoins(purse, 'gp', 3, false).gp, 3);
});
