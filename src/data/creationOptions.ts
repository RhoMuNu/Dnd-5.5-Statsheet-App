import type { AbilityName, ArmorMode, SkillName } from "./characters";

export const BACKGROUNDS: Record<string, {
  abilities: AbilityName[];
  feat: string;
  skills: SkillName[];
  tool: string;
  equipmentA: string;
  equipmentB: string;
}> = {
  Acolyte: {
    abilities: ["Intelligence", "Wisdom", "Charisma"], feat: "Magic Initiate (Cleric)",
    skills: ["Insight", "Religion"], tool: "Calligrapher’s Supplies",
    equipmentA: "Calligrapher’s Supplies, book of prayers, holy symbol, parchment, robe, 8 GP",
    equipmentB: "50 GP",
  },
  Criminal: {
    abilities: ["Dexterity", "Constitution", "Intelligence"], feat: "Alert",
    skills: ["Sleight of Hand", "Stealth"], tool: "Thieves’ Tools",
    equipmentA: "2 Daggers, Thieves’ Tools, Crowbar, 2 Pouches, Traveler’s Clothes, 16 GP",
    equipmentB: "50 GP",
  },
  Sage: {
    abilities: ["Constitution", "Intelligence", "Wisdom"], feat: "Magic Initiate (Wizard)",
    skills: ["Arcana", "History"], tool: "Calligrapher’s Supplies",
    equipmentA: "Quarterstaff, Calligrapher’s Supplies, book, parchment, robe, 8 GP",
    equipmentB: "50 GP",
  },
  Soldier: {
    abilities: ["Strength", "Dexterity", "Constitution"], feat: "Savage Attacker",
    skills: ["Athletics", "Intimidation"], tool: "Gaming Set (your choice)",
    equipmentA: "Spear, Shortbow, 20 Arrows, Gaming Set, Healer’s Kit, Quiver, Traveler’s Clothes, 14 GP",
    equipmentB: "50 GP",
  },
};

export const SPECIES: Record<string, { size: "Small" | "Medium"; speed: number; note: string }> = {
  Aasimar: { size: "Medium", speed: 30, note: "Celestial Resistance, Darkvision, Healing Hands, and Celestial Revelation." },
  Dragonborn: { size: "Medium", speed: 30, note: "Draconic Ancestry, Breath Weapon, Damage Resistance, and Darkvision." },
  Dwarf: { size: "Medium", speed: 30, note: "Darkvision, Dwarven Resilience, Dwarven Toughness, and Stonecunning." },
  Elf: { size: "Medium", speed: 30, note: "Darkvision, Elven Lineage, Fey Ancestry, and Trance." },
  Gnome: { size: "Small", speed: 30, note: "Darkvision and Gnomish Cunning; choose Forest or Rock lineage." },
  Goliath: { size: "Medium", speed: 35, note: "Giant Ancestry, Large Form, and Powerful Build." },
  Halfling: { size: "Small", speed: 30, note: "Brave, Halfling Nimbleness, Luck, and Naturally Stealthy." },
  Human: { size: "Medium", speed: 30, note: "Resourceful, Skillful, and Versatile." },
  Orc: { size: "Medium", speed: 30, note: "Adrenaline Rush, Darkvision, and Relentless Endurance." },
  Tiefling: { size: "Medium", speed: 30, note: "Darkvision and Fiendish Legacy; choose Abyssal, Chthonic, or Infernal." },
};

export const CLASS_SKILLS: Record<string, { count: number; options: SkillName[] }> = {
  Barbarian: { count: 2, options: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"] },
  Bard: { count: 3, options: ["Acrobatics", "Animal Handling", "Arcana", "Athletics", "Deception", "History", "Insight", "Intimidation", "Investigation", "Medicine", "Nature", "Perception", "Performance", "Persuasion", "Religion", "Sleight of Hand", "Stealth", "Survival"] },
  Cleric: { count: 2, options: ["History", "Insight", "Medicine", "Persuasion", "Religion"] },
  Druid: { count: 2, options: ["Arcana", "Animal Handling", "Insight", "Medicine", "Nature", "Perception", "Religion", "Survival"] },
  Fighter: { count: 2, options: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Persuasion", "Perception", "Survival"] },
  Monk: { count: 2, options: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"] },
  Paladin: { count: 2, options: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"] },
  Ranger: { count: 3, options: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"] },
  Rogue: { count: 4, options: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Persuasion", "Sleight of Hand", "Stealth"] },
  Sorcerer: { count: 2, options: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"] },
  Warlock: { count: 2, options: ["Arcana", "Deception", "History", "Intimidation", "Investigation", "Nature", "Religion"] },
  Wizard: { count: 2, options: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Nature", "Religion"] },
};

export const CLASS_EQUIPMENT: Record<string, string[]> = {
  Barbarian: ["A: Greataxe, 4 Handaxes, Explorer’s Pack, 15 GP", "B: 75 GP"],
  Bard: ["A: Leather Armor, 2 Daggers, Musical Instrument, Entertainer’s Pack, 19 GP", "B: 90 GP"],
  Cleric: ["A: Chain Shirt, Shield, Mace, Holy Symbol, Priest’s Pack, 7 GP", "B: 110 GP"],
  Druid: ["A: Leather Armor, Shield, Sickle, Druidic Focus (Quarterstaff), Explorer’s Pack, Herbalism Kit, 9 GP", "B: 50 GP"],
  Fighter: ["A: Chain Mail, Greatsword, Flail, 8 Javelins, Dungeoneer’s Pack, 4 GP", "B: Studded Leather, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Dungeoneer’s Pack, 11 GP", "C: 155 GP"],
  Monk: ["A: Spear, 5 Daggers, Artisan’s Tools or Musical Instrument, Explorer’s Pack, 11 GP", "B: 50 GP"],
  Paladin: ["A: Chain Mail, Shield, Longsword, 6 Javelins, Holy Symbol, Priest’s Pack, 9 GP", "B: 150 GP"],
  Ranger: ["A: Studded Leather, Scimitar, Shortsword, Longbow, 20 Arrows, Quiver, Druidic Focus, Explorer’s Pack, 7 GP", "B: 150 GP"],
  Rogue: ["A: Leather Armor, 2 Daggers, Shortsword, Shortbow, 20 Arrows, Quiver, Thieves’ Tools, Burglar’s Pack, 8 GP", "B: 100 GP"],
  Sorcerer: ["A: Spear, 2 Daggers, Arcane Focus (Crystal), Dungeoneer’s Pack, 28 GP", "B: 50 GP"],
  Warlock: ["A: Leather Armor, Sickle, 2 Daggers, Arcane Focus (Orb), Book, Scholar’s Pack, 15 GP", "B: 100 GP"],
  Wizard: ["A: 2 Daggers, Arcane Focus (Quarterstaff), Robe, Spellbook, Scholar’s Pack, 5 GP", "B: 55 GP"],
};

export const CLASS_TOOLS: Record<string, string> = {
  Bard: "Choose three Musical Instruments",
  Druid: "Herbalism Kit",
  Monk: "Choose an Artisan’s Tool or Musical Instrument",
  Rogue: "Thieves’ Tools",
};

export const CLASS_ARMOR: Record<string, Record<string, { mode: ArmorMode; baseAC: number; shield: boolean; strengthRequirement?: number }>> = {
  Barbarian: { A: { mode: "unarmored", baseAC: 10, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Bard: { A: { mode: "light", baseAC: 11, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Cleric: { A: { mode: "medium", baseAC: 13, shield: true }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Druid: { A: { mode: "light", baseAC: 11, shield: true }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Fighter: { A: { mode: "heavy", baseAC: 16, shield: false, strengthRequirement: 13 }, B: { mode: "light", baseAC: 12, shield: false }, C: { mode: "unarmored", baseAC: 10, shield: false } },
  Monk: { A: { mode: "unarmored", baseAC: 10, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Paladin: { A: { mode: "heavy", baseAC: 16, shield: true, strengthRequirement: 13 }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Ranger: { A: { mode: "light", baseAC: 12, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Rogue: { A: { mode: "light", baseAC: 11, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Sorcerer: { A: { mode: "unarmored", baseAC: 10, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Warlock: { A: { mode: "light", baseAC: 11, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
  Wizard: { A: { mode: "unarmored", baseAC: 10, shield: false }, B: { mode: "unarmored", baseAC: 10, shield: false } },
};

export const LANGUAGES = ["Common", "Common Sign Language", "Abyssal", "Celestial", "Deep Speech", "Draconic", "Dwarvish", "Elvish", "Giant", "Gnomish", "Goblin", "Halfling", "Infernal", "Orc", "Primordial", "Sylvan", "Undercommon"];
export const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

export function pointBuyCost(score: number): number {
  if (score <= 8) return 0;
  if (score <= 13) return score - 8;
  if (score === 14) return 7;
  if (score === 15) return 9;
  return 99;
}
