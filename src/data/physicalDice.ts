export type DieFace = { sides: number; value: number; label: string };
export type DieRequest = { index: number; sides: number; label: string };
export type DiceSource = "digital" | "physical";
export type DieRoller = (sides: number, label?: string) => number;

export class PhysicalDiceRequired extends Error {
  constructor(readonly request: DieRequest) { super(`Enter ${request.label}: d${request.sides}.`); }
}

// Replay a pure rules calculation with supplied natural faces. Never use random
// fallback: changing branches (e.g. a critical hit) requests the additional dice.
export function physicalDice(value: unknown) {
  if (!Array.isArray(value) || value.length > 1000) throw new Error("Physical dice must be a list of at most 1,000 die faces.");
  const faces = value as DieFace[];
  let index = 0;
  const roll: DieRoller = (sides, label = "Die roll") => {
    if (!Number.isInteger(sides) || sides < 2 || sides > 1000) throw new Error("Unsupported die size.");
    const face = faces[index];
    if (face === undefined) throw new PhysicalDiceRequired({ index, sides, label });
    if (!face || face.sides !== sides || face.label !== label) throw new Error("The required dice changed. Cancel and start this roll again with the current sheet.");
    if (!Number.isInteger(face.value) || face.value < 1 || face.value > sides) throw new Error(`A d${sides} face must be a whole number from 1 to ${sides}.`);
    index++; return face.value;
  };
  return { roll, finish() { if (index !== faces.length) throw new Error("Extra physical die faces were supplied. Only enter the requested dice."); } };
}
