export type CustomSubclass = { name: string; description: string };
export type CustomSubclassFeature = { name: string; description: string };

export function validCustomSubclass(value: unknown): value is CustomSubclass {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<CustomSubclass>;
  return typeof entry.name === "string" && entry.name.trim().length > 0 && entry.name.length <= 80 && typeof entry.description === "string" && entry.description.trim().length > 0 && entry.description.length <= 10000;
}
export function validCustomSubclassMap(value: unknown): value is Record<string, CustomSubclass> {
  return !!value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length <= 12 && Object.entries(value).every(([name, entry]) => /^[A-Za-z ]{1,80}$/.test(name) && validCustomSubclass(entry));
}
