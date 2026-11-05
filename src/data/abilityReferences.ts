// Concise reference summaries; sources and SRD licensing are listed in docs/SRD-ATTRIBUTION.md.
export const ORIGIN_REFERENCES: Record<string, string> = {
  Crafter: "Gain three Artisan’s Tool proficiencies from the list below and a 20% discount on nonmagical purchases. After a Long Rest, use a listed tool you own and are proficient with to make one listed item. It falls apart after your next Long Rest.\n\n| Tools | Temporary item choices |\n|---|---|\n| Carpenter | Ladder, torch |\n| Leatherworker | Map case, scroll case, pouch |\n| Mason | Block and tackle |\n| Potter | Jug, lamp |\n| Smith | Ball bearings, bucket, caltrops, grappling hook, iron pot |\n| Tinker | Bell, shovel, tinder box |\n| Weaver | Basket, rope, net, tent |\n| Woodcarver | Club, greatclub, quarterstaff |",
  Healer: "Utilize action: spend a Healer’s Kit use on a creature within 5 feet. It spends a Hit Die and heals the roll plus your Proficiency Bonus. Reroll healing dice showing 1 when using this feature or a spell; keep the replacement roll.",
  Lucky: "Luck Points equal your Proficiency Bonus, replenished by a Long Rest. Spend one for Advantage on your D20 Test, or to impose Disadvantage on an attack roll against you.",
  Musician: "Gain proficiency with three instruments. Play a proficient instrument when finishing a Short or Long Rest to give Heroic Inspiration to listening allies, up to your Proficiency Bonus in allies.",
  "Tavern Brawler": "Unarmed Strike damage can be 1d4 + Strength modifier. Reroll unarmed damage dice showing 1; keep the replacement. Gain improvised-weapon proficiency. Once per turn, a damaging Unarmed Strike during your Attack action can also push its target 5 feet away.",
};

export const RULE_TERM_REFERENCES: Record<string, string> = {
  Darkvision: "Within the stated range, treat Dim Light as Bright Light and Darkness as Dim Light. Darkness reveals shades of gray, rather than colors.",
  Tremorsense: "Locate creatures and moving objects within range that touch the same surface or liquid as you. Airborne targets are not detected, and this sense does not count as sight.",
  "Heroic Inspiration": "Spend it immediately after rolling a die to reroll that die; keep the replacement. You can hold only one. If you gain it while already holding it, you can pass it to another player character in your group who lacks it.",
  Resistance: "Halve damage of the specified type, rounding down. Multiple sources of resistance to the same damage type do not stack.",
  Expertise: "Double your Proficiency Bonus for checks using the chosen skill proficiency. Multiple sources of Expertise do not multiply that bonus again.",
};
