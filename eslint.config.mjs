import eslint from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import pluginVuejsAccessibility from 'eslint-plugin-vuejs-accessibility'
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

    // R5 a11y ratchet (frontend-performance PRD) — warn-first. Guards the
    // R5 named-control fixes (form-control-has-label, anchor-has-content)
    // plus the rest of the plugin's recommended set. Warnings must never
    // grow; promote to error once the legacy backlog is cleared.
    // Baseline 2026-10-09: 51 warnings — mostly click/keyboard-handler
    // parity on legacy clickable divs (no-static-element-interactions,
    // click-events-have-key-events); form/label/media backlog lives in
    // TheEditor, Viewer/CodeStream, Gcodefiles header, Endstop items.
    {
        files: ['src/**/*.vue'],
        plugins: { 'vuejs-accessibility': pluginVuejsAccessibility },
        rules: Object.fromEntries(
            Object.keys(pluginVuejsAccessibility.rules).map((rule) => [`vuejs-accessibility/${rule}`, 'warn'])
        ),
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
    // Shrink log: 2026-09-30 re-typed 82 of the 89 backlog files (346 any
    // sites); the 7 remaining are the farm/printer + printer/tempHistory
    // payload plumbing, which needs a store-model pass, not a mechanical one.
    {
        files: [
            'src/store/farm/printer/actions.ts',
            'src/store/farm/printer/getters.ts',
            'src/store/farm/printer/mutations.ts',
            'src/store/printer/getters.ts',
            'src/store/printer/tempHistory/actions.ts',
            'src/store/printer/tempHistory/getters.ts',
            'src/store/printer/tempHistory/mutations.ts',
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
