# TaleForge 0.2.0

- Inventory items now use collapsible rows with compact summaries, search, Expand all, and Collapse all. Quantities, equipment links, notes, and carrying calculations remain editable inside expanded rows.
- Custom subclasses can be chosen through the level-up wizard at class level 3. Add an overview and described features gained at each level; later level-ups retain the custom path. Custom records work in local sheets, exported backups, and LAN campaign saves.
- Custom features are labelled Manual effects. Configure bonuses and trackers separately; custom names do not activate similarly named bundled subclasses, spell lists, or inferred spellcasting progressions.

The Windows x64 portable release includes its runtime. Stop the previous host before starting the new version. Keep the same Windows account, browser, address, and port; campaign files remain in AppData. Back up campaign data and export local character libraries before updating.

Validation: 115 regression tests, including custom subclass validation/backups and LAN level-up persistence; production startup/restart tests; browser checks of inventory toggling, equipment-to-attack links, and a completed custom subclass level-up. The release packaging process also smoke-tests the extracted ZIP using its bundled runtime.
