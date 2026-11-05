import type { Character } from "../data/characters";
import { calculateCharacterStats } from "../data/calculations";
import { inventoryArmor } from "../data/equipment";

export function EquipmentSettings({ character, onChange, readOnly = false }: { character: Character; onChange?: (updates: Partial<Character>) => void; readOnly?: boolean }) {
  const equipment = inventoryArmor(character);
  const stats = calculateCharacterStats(character);
  return <fieldset disabled={readOnly} className="collection-panel">
    <label className="toggle-row"><input type="checkbox" checked={character.armorSource === "inventory"} onChange={(event) => onChange?.({ armorSource: event.target.checked ? "inventory" : "manual" })} />Calculate armor from equipped inventory</label>
    {character.armorSource === "inventory" && <>
      <p><strong>{equipment.description}</strong> · AC {stats.armorClass} · Speed {stats.speed} ft.{equipment.stealth ? " · Stealth disadvantage" : ""}</p>
      <label className="toggle-row"><input type="checkbox" checked={character.inventoryArmorTrained !== false} onChange={(event) => onChange?.({ inventoryArmorTrained: event.target.checked })} />Trained with the worn armor category</label>
      <label className="toggle-row"><input type="checkbox" checked={character.inventoryShieldTrained !== false} onChange={(event) => onChange?.({ inventoryShieldTrained: event.target.checked })} />Trained with shields</label>
      <p className="setup-note">Confirm training from your classes and features. Standard armor names and +1/+2/+3 variants are recognized. Equipping a suit or shield replaces the previous one. Donning and doffing times still apply.</p>
      {equipment.warnings.map((warning) => <p role="status" key={warning}>{warning}</p>)}
    </>}
  </fieldset>;
}
