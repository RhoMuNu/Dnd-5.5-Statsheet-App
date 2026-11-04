export type ClassProgression = {
  features: Record<number, string[]>;
  cantrips?: number[];
  preparedSpells?: number[];
};

const fullCasterCantrips = {
  bard: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  cleric: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  druid: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
  sorcerer: [4, 4, 4, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6],
  wizard: [3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5],
  warlock: [2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4],
};

const fullCasterPrepared = [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];

export const CLASS_PROGRESSION: Record<string, ClassProgression> = {
  barbarian: {
    features: {
      1: ["Rage", "Unarmored Defense", "Weapon Mastery"], 2: ["Danger Sense", "Reckless Attack"],
      3: ["Primal Knowledge", "Choose Barbarian subclass"], 4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Fast Movement"], 6: ["Subclass feature"], 7: ["Feral Instinct", "Instinctive Pounce"],
      8: ["Ability Score Improvement"], 9: ["Brutal Strike"], 10: ["Subclass feature"], 11: ["Relentless Rage"],
      12: ["Ability Score Improvement"], 13: ["Improved Brutal Strike"], 14: ["Subclass feature"],
      15: ["Persistent Rage"], 16: ["Ability Score Improvement"], 17: ["Improved Brutal Strike"],
      18: ["Indomitable Might"], 19: ["Epic Boon"], 20: ["Primal Champion"],
    },
  },
  bard: {
    features: {
      1: ["Bardic Inspiration", "Spellcasting"], 2: ["Expertise", "Jack of All Trades"],
      3: ["Choose Bard subclass"], 4: ["Ability Score Improvement"], 5: ["Font of Inspiration"],
      6: ["Subclass feature"], 7: ["Countercharm"], 8: ["Ability Score Improvement"], 9: ["Expertise"],
      10: ["Magical Secrets"], 12: ["Ability Score Improvement"], 14: ["Subclass feature"],
      16: ["Ability Score Improvement"], 18: ["Superior Inspiration"], 19: ["Epic Boon"], 20: ["Words of Creation"],
    },
    cantrips: fullCasterCantrips.bard,
    preparedSpells: fullCasterPrepared,
  },
  cleric: {
    features: {
      1: ["Spellcasting", "Divine Order"], 2: ["Channel Divinity"], 3: ["Choose Cleric subclass"],
      4: ["Ability Score Improvement"], 5: ["Sear Undead"], 6: ["Subclass feature"], 7: ["Blessed Strikes"],
      8: ["Ability Score Improvement"], 10: ["Divine Intervention"], 12: ["Ability Score Improvement"],
      14: ["Improved Blessed Strikes"], 16: ["Ability Score Improvement"], 17: ["Subclass feature"],
      19: ["Epic Boon"], 20: ["Greater Divine Intervention"],
    },
    cantrips: fullCasterCantrips.cleric,
    preparedSpells: fullCasterPrepared,
  },
  druid: {
    features: {
      1: ["Spellcasting", "Druidic", "Primal Order"], 2: ["Wild Shape", "Wild Companion"],
      3: ["Choose Druid subclass"], 4: ["Ability Score Improvement"], 5: ["Wild Resurgence"],
      6: ["Subclass feature"], 7: ["Elemental Fury"], 8: ["Ability Score Improvement"],
      10: ["Subclass feature"], 12: ["Ability Score Improvement"], 14: ["Subclass feature"],
      15: ["Improved Elemental Fury"], 16: ["Ability Score Improvement"], 18: ["Beast Spells"],
      19: ["Epic Boon"], 20: ["Archdruid"],
    },
    cantrips: fullCasterCantrips.druid,
    preparedSpells: fullCasterPrepared,
  },
  fighter: {
    features: {
      1: ["Fighting Style", "Second Wind", "Weapon Mastery"], 2: ["Action Surge", "Tactical Mind"],
      3: ["Choose Fighter subclass"], 4: ["Ability Score Improvement"], 5: ["Extra Attack", "Tactical Shift"],
      6: ["Ability Score Improvement"], 7: ["Subclass feature"], 8: ["Ability Score Improvement"],
      9: ["Indomitable", "Tactical Master"], 10: ["Subclass feature"], 11: ["Two Extra Attacks"],
      12: ["Ability Score Improvement"], 13: ["Indomitable", "Studied Attacks"], 14: ["Ability Score Improvement"],
      15: ["Subclass feature"], 16: ["Ability Score Improvement"], 17: ["Action Surge", "Indomitable"],
      18: ["Subclass feature"], 19: ["Epic Boon"], 20: ["Three Extra Attacks"],
    },
  },
  monk: {
    features: {
      1: ["Martial Arts", "Unarmored Defense"], 2: ["Monk’s Focus", "Unarmored Movement", "Uncanny Metabolism"],
      3: ["Deflect Attacks", "Choose Monk subclass"], 4: ["Ability Score Improvement", "Slow Fall"],
      5: ["Extra Attack", "Stunning Strike"], 6: ["Empowered Strikes", "Subclass feature"], 7: ["Evasion"],
      8: ["Ability Score Improvement"], 9: ["Acrobatic Movement"], 10: ["Heightened Focus", "Self-Restoration"],
      11: ["Subclass feature"], 12: ["Ability Score Improvement"], 13: ["Deflect Energy"],
      14: ["Disciplined Survivor"], 15: ["Perfect Focus"], 16: ["Ability Score Improvement"],
      17: ["Subclass feature"], 18: ["Superior Defense"], 19: ["Epic Boon"], 20: ["Body and Mind"],
    },
  },
  paladin: {
    features: {
      1: ["Lay On Hands", "Spellcasting", "Weapon Mastery"], 2: ["Fighting Style", "Paladin’s Smite"],
      3: ["Channel Divinity", "Choose Paladin subclass"], 4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Faithful Steed"], 6: ["Aura of Protection"], 7: ["Subclass feature"],
      8: ["Ability Score Improvement"], 9: ["Abjure Foes"], 10: ["Aura of Courage"],
      11: ["Radiant Strikes"], 12: ["Ability Score Improvement"], 14: ["Restoring Touch"],
      15: ["Subclass feature"], 16: ["Ability Score Improvement"], 18: ["Aura Expansion"],
      19: ["Epic Boon"], 20: ["Subclass feature"],
    },
    preparedSpells: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  },
  ranger: {
    features: {
      1: ["Spellcasting", "Favored Enemy", "Weapon Mastery"], 2: ["Deft Explorer", "Fighting Style"],
      3: ["Choose Ranger subclass"], 4: ["Ability Score Improvement"], 5: ["Extra Attack"],
      6: ["Roving"], 7: ["Subclass feature"], 8: ["Ability Score Improvement"],
      9: ["Expertise"], 10: ["Tireless"], 11: ["Subclass feature"], 12: ["Ability Score Improvement"],
      13: ["Relentless Hunter"], 14: ["Nature’s Veil"], 15: ["Subclass feature"],
      16: ["Ability Score Improvement"], 17: ["Precise Hunter"], 18: ["Feral Senses"],
      19: ["Epic Boon"], 20: ["Foe Slayer"],
    },
    preparedSpells: [2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15],
  },
  rogue: {
    features: {
      1: ["Expertise", "Sneak Attack", "Thieves’ Cant", "Weapon Mastery"], 2: ["Cunning Action"],
      3: ["Choose Rogue subclass", "Steady Aim"], 4: ["Ability Score Improvement"],
      5: ["Cunning Strike", "Uncanny Dodge"], 6: ["Expertise"], 7: ["Evasion", "Reliable Talent"],
      8: ["Ability Score Improvement"], 9: ["Subclass feature"], 10: ["Ability Score Improvement"],
      11: ["Improved Cunning Strike"], 12: ["Ability Score Improvement"], 13: ["Subclass feature"],
      14: ["Devious Strikes"], 15: ["Slippery Mind"], 16: ["Ability Score Improvement"],
      17: ["Subclass feature"], 18: ["Elusive"], 19: ["Epic Boon"], 20: ["Stroke of Luck"],
    },
  },
  sorcerer: {
    features: {
      1: ["Spellcasting", "Innate Sorcery"], 2: ["Font of Magic", "Metamagic"],
      3: ["Choose Sorcerer subclass"], 4: ["Ability Score Improvement"],
      5: ["Sorcerous Restoration"], 6: ["Subclass feature"], 7: ["Sorcery Incarnate"],
      8: ["Ability Score Improvement"], 10: ["Metamagic"], 12: ["Ability Score Improvement"],
      14: ["Subclass feature"], 16: ["Ability Score Improvement"], 17: ["Metamagic"],
      18: ["Subclass feature"], 19: ["Epic Boon"], 20: ["Arcane Apotheosis"],
    },
    cantrips: fullCasterCantrips.sorcerer,
    preparedSpells: [2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22],
  },
  warlock: {
    features: {
      1: ["Eldritch Invocations", "Pact Magic"], 2: ["Magical Cunning"], 3: ["Choose Warlock subclass"],
      4: ["Ability Score Improvement"], 6: ["Subclass feature"], 9: ["Contact Patron"],
      10: ["Subclass feature"], 11: ["Mystic Arcanum (Level 6)"], 12: ["Ability Score Improvement"],
      13: ["Mystic Arcanum (Level 7)"], 14: ["Subclass feature"], 15: ["Mystic Arcanum (Level 8)"],
      16: ["Ability Score Improvement"], 17: ["Mystic Arcanum (Level 9)"], 19: ["Epic Boon"],
      20: ["Eldritch Master"],
    },
    cantrips: fullCasterCantrips.warlock,
    preparedSpells: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
  },
  wizard: {
    features: {
      1: ["Spellcasting", "Ritual Adept", "Arcane Recovery"], 2: ["Scholar"],
      3: ["Choose Wizard subclass"], 4: ["Ability Score Improvement"], 5: ["Memorize Spell"],
      6: ["Subclass feature"], 8: ["Ability Score Improvement"], 10: ["Subclass feature"],
      12: ["Ability Score Improvement"], 14: ["Subclass feature"], 16: ["Ability Score Improvement"],
      18: ["Spell Mastery"], 19: ["Epic Boon"], 20: ["Signature Spells"],
    },
    cantrips: fullCasterCantrips.wizard,
    preparedSpells: [4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 18, 19, 21, 22, 23, 24, 25],
  },
};

export function classProgressionAtLevel(className: string, level: number, subclass = "") {
  const progression = CLASS_PROGRESSION[className.trim().toLowerCase()];
  if (!progression) return { gainedFeatures: [] as { level: number; name: string }[], cantrips: null as number | null, preparedSpells: null as number | null };

  const gainedFeatures = Object.entries(progression.features)
    .filter(([featureLevel]) => Number(featureLevel) <= level)
    .flatMap(([featureLevel, features]) => features.map((name) => ({
      level: Number(featureLevel),
      name: name === "Subclass feature" && subclass ? `${subclass} feature` : name,
    })))
    .sort((a, b) => a.level - b.level);

  return {
    gainedFeatures,
    cantrips: progression.cantrips?.[level - 1] ?? null,
    preparedSpells: progression.preparedSpells?.[level - 1] ?? null,
  };
}
