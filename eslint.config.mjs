import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import eslintConfigPrettier from 'eslint-config-prettier'
import pluginJsonc from 'eslint-plugin-jsonc'
import globals from 'globals'

export default defineConfigWithVueTs(
    {
        ignores: ['dist/', 'dev-dist/', 'i18n-extract/', 'components.d.ts', 'cypress/'],
    },

    eslint.configs.recommended,
    ...pluginVue.configs['flat/recommended'],

    // TypeScript setup
    // base = parser setup for .ts and .vue files
    // eslintRecommended = disables core ESLint rules that conflict with TS
    vueTsConfigs.base,
    vueTsConfigs.eslintRecommended,
    vueTsConfigs.recommended,

    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
    },

    // dev/CI tooling scripts run in Node, not the browser
    {
        files: ['**/*.cjs', '**/*.mjs'],
        languageOptions: {
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            '@typescript-eslint/no-require-imports': 'off',
        },
    },

    {
        files: ['**/*.vue'],
        rules: {
            'vue/no-v-html': 'off',
            'vue/block-order': 'off',
            'vue/no-v-text-v-html-on-component': 'off',
            'vue/valid-v-slot': ['error', { allowModifiers: true }],
            // single-word names are the router-page convention and a set of
            // established components; new components must still be multi-word
            'vue/multi-word-component-names': [
                'error',
                {
                    ignores: [
                        'Codemirror',
                        'Desktop',
                        'Gcodefiles',
                        'History',
                        'Hlsstreamer',
                        'Jobqueue',
                        'Mjpegstreamer',
                        'Mobile',
                        'Panel',
                        'Printstatus',
                        'Responsive',
                        'Sortable',
                        'Tablet',
                        'Viewer',
                        'Wcs',
                        'Widescreen',
                    ],
                },
            ],
        },
    },

    // Router pages are single-word by convention (route component names).
    {
        files: ['src/pages/**/*.vue'],
        rules: {
            'vue/multi-word-component-names': 'off',
        },
    },

    // LEGACY DEBT — no-explicit-any ratchet.
    // New files are held to `error`. The files below predate this fork's
    // eslint switch (de2398b3 inherited upstream's untyped Vuex payload/getter
    // idiom); they are downgraded to `warn` until re-typed. FIXING A FILE MEANS
    // REMOVING IT FROM THIS LIST — the list must never grow.
    {
        files: [
            'src/components/TheSettingsMenu.vue',
            'src/components/TheTopCornerMenu.vue',
            'src/components/dialogs/MiscellaneousLightNeopixelDialog.vue',
            'src/components/gcodeviewer/Viewer.vue',
            'src/components/inputs/Codemirror.vue',
            'src/components/inputs/ColorPicker.vue',
            'src/components/panels/FarmPrinterPanel.vue',
            'src/components/panels/Machine/SystemPanel.vue',
            'src/components/panels/MinSettingsPanel.vue',
            'src/components/panels/Status/Gcodefiles.vue',
            'src/components/panels/Timelapse/TimelapseFilesPanel.vue',
            'src/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsForm.vue',
            'src/components/settings/Miscellaneous/SettingsMiscellaneousTabLightGroupsListEntry.vue',
            'src/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsForm.vue',
            'src/components/settings/Miscellaneous/SettingsMiscellaneousTabLightPresetsListEntry.vue',
            'src/components/settings/SettingsMacrosTabExpert.vue',
            'src/components/ui/Panel.vue',
            'src/components/ui/VueLoadImage.vue',
            'src/composables/useCncProfile.ts',
            'src/composables/useToast.ts',
            'src/main.ts',
            'src/pages/Console.vue',
            'src/plugins/webSocketClient.ts',
            'src/store/actions.ts',
            'src/store/editor/actions.ts',
            'src/store/editor/getters.ts',
            'src/store/editor/mutations.ts',
            'src/store/farm/index.ts',
            'src/store/farm/printer/actions.ts',
            'src/store/farm/printer/getters.ts',
            'src/store/farm/printer/mutations.ts',
            'src/store/files/actions.ts',
            'src/store/files/getters.ts',
            'src/store/files/mutations.ts',
            'src/store/gcodeviewer/actions.ts',
            'src/store/gcodeviewer/mutations.ts',
            'src/store/getters.ts',
            'src/store/gui/actions.ts',
            'src/store/gui/console/actions.ts',
            'src/store/gui/console/getters.ts',
            'src/store/gui/console/mutations.ts',
            'src/store/gui/gcodehistory/actions.ts',
            'src/store/gui/gcodehistory/mutations.ts',
            'src/store/gui/getters.ts',
            'src/store/gui/macros/actions.ts',
            'src/store/gui/macros/mutations.ts',
            'src/store/gui/maintenance/actions.ts',
            'src/store/gui/maintenance/getters.ts',
            'src/store/gui/maintenance/mutations.ts',
            'src/store/gui/miscellaneous/actions.ts',
            'src/store/gui/miscellaneous/getters.ts',
            'src/store/gui/mutations.ts',
            'src/store/gui/notifications/actions.ts',
            'src/store/gui/notifications/getters.ts',
            'src/store/gui/notifications/mutations.ts',
            'src/store/gui/reminders/actions.ts',
            'src/store/gui/reminders/getters.ts',
            'src/store/gui/reminders/mutations.ts',
            'src/store/gui/remoteprinters/actions.ts',
            'src/store/gui/remoteprinters/getters.ts',
            'src/store/gui/remoteprinters/mutations.ts',
            'src/store/gui/webcams/actions.ts',
            'src/store/gui/webcams/getters.ts',
            'src/store/gui/webcams/mutations.ts',
            'src/store/mutations.ts',
            'src/store/printer/actions.ts',
            'src/store/printer/getters.ts',
            'src/store/printer/mutations.ts',
            'src/store/printer/tempHistory/actions.ts',
            'src/store/printer/tempHistory/getters.ts',
            'src/store/printer/tempHistory/mutations.ts',
            'src/store/server/actions.ts',
            'src/store/server/getters.ts',
            'src/store/server/history/actions.ts',
            'src/store/server/history/getters.ts',
            'src/store/server/history/mutations.ts',
            'src/store/server/jobQueue/actions.ts',
            'src/store/server/jobQueue/getters.ts',
            'src/store/server/mutations.ts',
            'src/store/server/power/actions.ts',
            'src/store/server/power/mutations.ts',
            'src/store/server/sensor/actions.ts',
            'src/store/server/sensor/mutations.ts',
            'src/store/server/timelapse/actions.ts',
            'src/store/server/timelapse/mutations.ts',
            'src/store/socket/actions.ts',
            'src/store/socket/getters.ts',
            'src/store/socket/mutations.ts',
            'src/types/sindarius-gcodeviewer.d.ts',
        ],
        rules: {
            '@typescript-eslint/no-explicit-any': 'warn',
        },
    },

    ...pluginJsonc.configs['flat/base'],
    {
        files: ['src/locales/*.json'],
        rules: {
            'jsonc/no-dupe-keys': 'error',
            'jsonc/sort-keys': ['error', 'asc', { caseSensitive: false, natural: false }],
        },
    },

    // Prettier must be last (disables conflicting rules)
    eslintConfigPrettier
)
