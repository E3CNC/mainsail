<!-- Maintained manually with git-cliff at release time (see RELEASES.md). -->
# Changelog
All notable changes to Mainsail will be documented in this file.


## [0.10.6](https://github.com/E3CNC/mainsail/releases/tag/e3cnc-mainsail-v0.10.6) - 2026-09-25
### Bug Fixes and Improvements

- **config**: Default hostname/port to null so remote browsers connect to host


## [0.10.5](https://github.com/E3CNC/mainsail/releases/tag/e3cnc-mainsail-v0.10.5) - 2026-09-20
### Bug Fixes and Improvements

- **release**: Set project_owner to E3CNC so Moonraker polls correct repo

### Documentation

- Add E3CNC v0.3.0 changelog and release notes


## [0.3.0](https://github.com/E3CNC/mainsail/releases/tag/e3cnc-mainsail-v0.3.0) - 2026-09-17
### Features

- **farm**: Show empty state when no machines registered

### Bug Fixes and Improvements

- **farm**: Center empty state vertically and horizontally
- **i18n**: Reword Z-offset post-job hint for CNC focus

### Other

- Add unit tests for mock moonraker DB and FarmPrinterPanel


## [0.2.0](https://github.com/E3CNC/mainsail/releases/tag/e3cnc-mainsail-v0.2.0) - 2026-09-17
### Features

- **mock**: Simulate toolhead motion on gcode.script

### Bug Fixes and Improvements

- **mock**: Make CNC WCS state stateful
- **printer**: Guard configfile settings in getMacros

### Documentation

- Describe E3CNC Vue 3 fork accurately

### Other

- **build**: Zip dist into mainsail.zip on build
- **deps**: Set legacy-peer-deps for Vite 7 / plugin-vue peer conflict
- **frontend**: Replace Vue 2 Mainsail frontend with E3CNC Vue 3 frontend


