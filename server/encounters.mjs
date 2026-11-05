export const emptyEncounter = () => ({ revision: 0, round: 0, activeId: null, entries: [] });

export function changeEncounter(previous, action, sharedCharacters, id) {
  if (!action || typeof action !== "object") throw new Error("Choose an encounter action.");
  const next = structuredClone(previous);
  const integer = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  if (action.type === "add") {
    if (next.entries.length >= 100) throw new Error("An encounter can contain up to 100 combatants.");
    const source = action.characterId ? sharedCharacters.find((entry) => entry.character.id === action.characterId) : null;
    if (action.characterId && !source) throw new Error("Only a shared character can be added from a sheet.");
    const name = source?.character.name ?? action.name;
    if (typeof name !== "string" || !name.trim() || name.length > 80 || !integer(action.initiative, -100, 100)) throw new Error("Enter a name and an initiative between −100 and 100.");
    next.entries.push({ id, name: name.trim(), initiative: action.initiative, tieOrder: 0, characterId: source?.character.id ?? null });
  } else if (action.type === "update") {
    const entry = next.entries.find((entry) => entry.id === action.id);
    if (!entry) throw new Error("Combatant no longer exists.");
    if (!integer(action.initiative, -100, 100) || !integer(action.tieOrder, -100, 100)) throw new Error("Initiative and tie priority must be whole numbers between −100 and 100.");
    entry.initiative = action.initiative;
    entry.tieOrder = action.tieOrder;
  } else if (action.type === "remove") {
    const index = next.entries.findIndex((entry) => entry.id === action.id);
    if (index < 0) throw new Error("Combatant no longer exists.");
    if (next.activeId === action.id) {
      next.activeId = next.entries[(index + 1) % next.entries.length]?.id ?? null;
      if (index === next.entries.length - 1 && next.round > 0) next.round += 1;
    }
    next.entries.splice(index, 1);
    if (!next.entries.length) { next.activeId = null; next.round = 0; }
  } else if (action.type === "start") {
    if (!next.entries.length) throw new Error("Add combatants before starting combat.");
    next.round = 1;
    next.activeId = next.entries[0].id;
  } else if (action.type === "next") {
    if (!next.activeId || !next.entries.length) throw new Error("Start combat before advancing turns.");
    const index = next.entries.findIndex((entry) => entry.id === next.activeId);
    next.activeId = next.entries[(index + 1) % next.entries.length].id;
    if (index === next.entries.length - 1) next.round += 1;
  } else if (action.type === "stop") { next.activeId = null; next.round = 0; }
  else if (action.type === "clear") { next.activeId = null; next.round = 0; next.entries = []; }
  else throw new Error("Unknown encounter action.");
  next.entries.sort((a, b) => b.initiative - a.initiative || b.tieOrder - a.tieOrder);
  next.revision = previous.revision + 1;
  return next;
}
