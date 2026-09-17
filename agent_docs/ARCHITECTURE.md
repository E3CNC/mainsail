# Architecture

**Stack:** Vue 3.5, Vuetify 3, Vuex 4, vue-router 4, TypeScript (strict), Vite 7

## Project Structure

| Directory                        | Purpose                                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------------------- |
| `src/components/`                | Vue components by feature (dialogs/, panels/, inputs/, webcams/, console/, charts/)            |
| `src/components/panels/Cnc/`     | CNC panels: WCS preview, DRO, jog, MDI, spindle & coolant, CNC status, host bash               |
| `src/composables/`               | Vue 3 composables (state + logic, incl. `useCncOffsets`, `useCncProfile`)                      |
| `src/pages/`                     | Page components (Dashboard, Console, Files, Viewer, History, Timelapse, Machine, Farm, Webcam) |
| `src/store/`                     | Vuex modules                                                                                   |
| `src/store/files/cncApi.ts`      | HTTP client for `/server/cnc/*` endpoints (spindle, coolant, WCS, settings, bash)              |
| `src/store/files/cncMetadata.ts` | Parser for `.cnc-meta.json` job metadata                                                       |
| `src/store/runtime.ts`           | Runtime socket/toast singletons                                                                |
| `src/plugins/`                   | Vue plugins and utilities                                                                      |
| `src/locales/`                   | Translation JSON files                                                                         |
| `src/types/`                     | TypeScript type definitions                                                                    |
| `src/utils/`                     | Standalone utilities (`cfgValidator`)                                                          |

## Vuex Store Modules

### `src/store/socket/`

WebSocket connection state

### `src/store/server/`

Moonraker API state with submodules:

- `history/` - Print history and statistics
- `jobQueue/` - Print job queue
- `power/` - Power device management
- `sensor/` - Sensor data
- `timelapse/` - Timelapse recording

Removed upstream modules (`announcements/`, `spoolman/`, `updateManager/`) are
empty directories kept out of git. There is no update-manager UI; updates to
this fork are managed through Moonraker, see
[docs/examples/update-manager.conf](../../docs/examples/update-manager.conf).

### `src/store/printer/`

Printer state (temperatures, toolhead, extruders, `gcode_move`)

### `src/store/gui/`

UI state with submodules:

- `console/` - Console settings
- `gcodehistory/` - G-code command history
- `macros/` - Macro management
- `maintenance/` - Maintenance tracking
- `miscellaneous/` - Misc UI settings
- `navigation/` - Navigation state
- `notifications/` - UI notifications
- `presets/` - Types only (actions/getters removed upstream of this fork)
- `reminders/` - User reminders
- `remoteprinters/` - Multi-printer config
- `webcams/` - Webcam configuration

### `src/store/files/`

File browser state plus CNC API client and metadata parser

### `src/store/farm/`

Multi-printer management

### `src/store/editor/`

Config file editor state

### `src/store/gcodeviewer/`

G-code viewer state
