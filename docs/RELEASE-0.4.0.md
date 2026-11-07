# TaleForge 0.4.0

Features and traits now start collapsed, including your editable features and custom-subclass references. Expand all / Collapse all works across ability cards while retaining search, descriptions, editing, and automation labels.

Character creation now requires structured starting choices: Warlock invocations, Fighter styles, Rogue Expertise, Cleric/Druid orders and bonus cantrips, and weapon mastery for applicable classes. Human characters select their extra Origin feat. Skilled and Magic Initiate have follow-up choices for supported backgrounds and the Human feat. Free-text class notes remain available for homebrew.

Level-up adds optional replacements for Eldritch Invocations, Metamagic, Fighter styles, eligible class cantrips/spells, Blessed/Druidic Warrior cantrips, and Mystic Arcanum. Replacements are separate from new selections, appear in review/history, and preserve spent resources. The LAN host validates the same rules and safely replays a retried level-up.

Invocations validate class level, dependencies, repeatability, and cantrip targets. An invocation needed by another retained invocation cannot be replaced. Older sheets missing their first invocation can make up missing recorded choices at their next Warlock level. Pact of the Tome asks for its book spells; replacing it removes those grants. Lessons of the First Ones records its Origin feat and follow-up choices.

The progression audit also added Blessed Strikes, Elemental Fury, Lore’s Magical Discoveries, Mystic Arcanum selections/counters, Wizard Spell Mastery and Signature Spells, and Bard Magical Secrets spell-list access. See [the audit](PROGRESSION-AUDIT-0.4.md) for coverage and manual boundaries.

Stop the previous host, extract the new ZIP, and launch **Start TaleForge Host.bat**. Keep the same Windows account, browser, address and port to retain saved-sheet and room access. Campaigns continue using the existing host data folder. Nothing needs to be installed by players.
