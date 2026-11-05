import type { Character } from "./characters";

/** Creation starts at one; editing basics cannot bypass the level-up workflow. */
export function creationProgression(className: string, existing?: Character): Pick<Character, "characterClass" | "level" | "classLevels" | "subclass" | "classSubclasses"> {
  if (existing) return {
    characterClass: existing.characterClass,
    level: existing.level,
    classLevels: Object.keys(existing.classLevels ?? {}).length ? { ...existing.classLevels } : { [existing.characterClass]: existing.level },
    subclass: existing.subclass ?? "",
    classSubclasses: { ...(existing.classSubclasses ?? {}), ...(existing.subclass && !existing.classSubclasses?.[existing.characterClass] ? { [existing.characterClass]: existing.subclass } : {}) },
  };
  return { characterClass: className, level: 1, classLevels: className ? { [className]: 1 } : {}, subclass: "", classSubclasses: {} };
}
