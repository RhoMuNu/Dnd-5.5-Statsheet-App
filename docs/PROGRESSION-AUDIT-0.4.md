# Creation and advancement audit · 0.4

Rules were checked against the bundled 2024 SRD class/feat data and the [official 2024 class rules](https://www.dndbeyond.com/sources/dnd/br-2024/character-classes). This release addresses structured build selections and class-level replacements. Manual effect labels still describe what the app actually applies.

| Area | Added or corrected |
| --- | --- |
| Warlock creation | One eligible invocation at level 1, with descriptions |
| Warlock advancement | Correct total invocation allowance, catch-up for older incomplete records, one optional invocation replacement |
| Invocation validation | Warlock-level prerequisites, retained invocation dependencies, distinct repeatable targets, damaging/attack cantrip requirements |
| Invocation follow-up choices | Book of Shadows cantrips/rituals; Lessons Origin feat, Skilled proficiencies, Magic Initiate spell list/ability/spells |
| Mystic Arcanum | Level 6/7/8/9 selections at the proper class levels; same-level replacement and a Long Rest use counter |
| Sorcerer | Metamagic gains and one optional replacement on Sorcerer level-up; Subtle Spell reference parsing corrected |
| Fighter | Starting style, additional Champion style, optional style replacement when gaining Fighter levels |
| Cleric / Druid | Starting order, additional cantrip, Wisdom-based knowledge-skill bonus, level-7 feature choice |
| Rogue | Starting Expertise uses existing proficient skills |
| Martial classes | Weapon mastery choices at creation and increases in the class table |
| Paladin / Ranger | Blessed/Druidic Warrior and their cantrips; eligible warrior-cantrip replacements |
| Bard | Lore’s level-6 Magical Discoveries; expanded class lists for Magical Secrets from level 10 |
| Wizard | Spell Mastery and Signature Spell selections from the character’s spellbook |
| Class spell replacements | One cantrip for Bard/Cleric/Druid/Sorcerer/Warlock; one leveled spell for Bard/Sorcerer/Warlock; ownership and grant protection |
| Human / background feats | Versatile Origin-feat selection, Skilled choices, Magic Initiate list/ability/spell references |
| Interface | All ability cards collapse; choice descriptions are expandable; changing a parent choice clears incompatible follow-up choices |
| Saving | New selections survive normalization/backups; history records replacements; LAN validates and deduplicates advancement |

## Manual boundaries

- Selecting a build option does not imply automatic execution of its effects. Invocation effects other than existing supported helpers, mastery properties, Metamagic, and conditional subclass benefits use the displayed rules references.
- Magic Initiate selections are saved as build references. Its chosen casting ability and free daily casting remain manual; add spellbook entries if desired. This applies to background/Human selections and Lessons of the First Ones.
- Mystic Arcanum uses its dedicated counter and manual free casting, not a Pact Magic slot. Wizard mastery/signature free casting also remains manual.
- Book of Shadows spells are available while you possess the book. Re-conjuring the book and rest-based changes to these spells remain manual. Ordinary class starting spells cannot duplicate the additional book/order selections.
- Long-Rest preparation, Wizard cantrip changes, weapon-mastery retraining, Hunter rest-based switches, and feature-specific rest swaps use sheet/spellbook editing and feature notes. Level-up does not silently count as a rest or grant those changes.
- Training, languages, tools, ancestry/lineage spells, bespoke feats, and custom-subclass choices still need their listed manual notes where no specific helper exists. Existing free-text class notes are preserved; they are not automatically interpreted as replaceable structured selections.

This is a coverage record for the bundled options, not a claim that every published or homebrew option is automated. The release tests creation requirements, replacements, dependencies, book grants, Origin-feat follow-ups, counters, persistence, and LAN retries; browser checks cover a full Warlock creation and level-up with replacements.
