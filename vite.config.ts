import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

import Components from 'unplugin-vue-components/vite'
import { Vuetify3Resolver } from 'unplugin-vue-components/resolvers'
import path from 'path'
import buildVersion from './src/plugins/build-version'
import buildReleaseInfo from './src/plugins/build-release_info'
import { VitePWA, VitePWAOptions } from 'vite-plugin-pwa'
import postcssNesting from 'postcss-nesting'

const devProxyTarget = process.env.VITE_DEV_PROXY_TARGET ?? process.env.DEV_PROXY_TARGET ?? 'http://192.168.0.239'
const devProxyPaths = [
    '/access',
    '/api',
    '/machine',
    '/printer',
    '/server',
    '/webcam',
    '/webcam2',
    '/webcam3',
    '/webcam4',
    '/websocket',
]
const devServerProxy = Object.fromEntries(
    devProxyPaths.map((pathname) => [
        pathname,
        {
            target: devProxyTarget,
            changeOrigin: true,
            ws: pathname === '/websocket',
        },
    ])
)

const PWAConfig: Partial<VitePWAOptions> = {
    registerType: 'autoUpdate',
    includeAssets: ['fonts/**/*.woff2', 'img/**/*.svg', 'img/**/*.png'],
    manifest: {
        name: 'E3CNC UI',
        short_name: 'E3CNC UI',
        description: 'Web interface for Klipper-based CNC machines',
        theme_color: '#D51F26',
        display: 'standalone',
        start_url: '/',
        background_color: '#121212',
        icons: [
            {
                src: '/img/icons/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/img/icons/icon-192-maskable.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'maskable',
            },
            {
                src: '/img/icons/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
            },
            {
                src: '/img/icons/icon-512-maskable.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable',
            },
        ],
    },
    workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg}'],
        navigateFallbackDenylist: [/^\/(access|api|printer|server|websocket)/, /^\/webcam[2-4]?/],
        runtimeCaching: [
            {
                urlPattern: /\/config\.json$/,
                handler: 'StaleWhileRevalidate',
                options: {
                    cacheName: 'config.json',
                    cacheableResponse: {
                        statuses: [0, 200],
                    },
                },
            },
        ],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    },
    /* disable sw on development to avoid workbox precaching noise */
    devOptions: {
        enabled: false,
        type: 'module',
        suppressWarnings: true,
    },
}

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        VitePWA(PWAConfig),
        buildVersion(),
        buildReleaseInfo(),
        vue(),
        Components({
            dts: true,
            resolvers: [Vuetify3Resolver()],
        }),
    ],

    css: {
        preprocessorOptions: {
            sass: {
                silenceDeprecations: ['import', 'global-builtin', 'slash-div', 'if-function'],
                quietDeps: true,
            },
            scss: {
                silenceDeprecations: ['import', 'global-builtin', 'slash-div', 'if-function'],
                quietDeps: true,
            },
        },
        postcss: {
            plugins: [postcssNesting()],
        },
    },

    build: {
        target: 'safari12',
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            output: {
                manualChunks: (id: string) => {
                    if (id.includes('node_modules')) {
                        // split codemirror into its own chunk
                        if (id.includes('/codemirror/') || id.includes('/@codemirror/')) {
                            return 'codemirror'
                        }

                        // split vuetify (largest UI dep)
                        if (id.includes('/vuetify/')) {
                            return 'vuetify'
                        }

                        // split vue core + ecosystem
                        if (
                            id.includes('/vue/') &&
                            !id.includes('/vue-router/') &&
                            !id.includes('/vuex/') &&
                            !id.includes('/vue-i18n/')
                        ) {
                            return 'vue-core'
                        }

                        // split echarts and overlayscrollbars into their own chunks
                        const chunkedLibs = ['echarts', 'overlayscrollbars']
                        for (const lib of chunkedLibs) {
                            if (id.includes(`/node_modules/${lib}/`)) {
                                return lib.replace('.js', '')
                            }
                        }
                    }
                },
            },
        },
        commonjsOptions: {
            transformMixedEsModules: true,
        },
    },

    envPrefix: 'VUE_',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            stream: 'stream-browserify',
            events: 'events',
        },
    },

    optimizeDeps: {
        include: ['events'],
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },

    server: {
        host: '0.0.0.0',
        port: 8080,
        proxy: devServerProxy,
    },

    test: {
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
        globals: true,
        setupFiles: ['tests/setup.ts'],
        pool: 'threads',
        poolOptions: {
            threads: {
                minThreads: 1,
                maxThreads: 2,
            },
        },
        css: true,
        deps: {
            inline: ['vuetify'],
        },
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary'],
            include: ['src/**/*.{ts,vue}'],
            exclude: [
                'node_modules/',
                'tests/',
                '**/*.d.ts',
                '**/*.config.ts',
                'src/main.ts',
                'src/plugins/**',
                'src/types/**',
                'src/routes/**',
                'src/store/runtime.ts',
                'src/store/variables.ts',
            ],
            thresholds: {
                // Global backstop: tracks measured reality (68% lines after
                // the store-logic closure). Ratchet upward as coverage phases
                // land. See docs/prd/test-coverage-expansion.md R1 and
                // docs/prd/full-coverage-closure.md R1.
                lines: 65,
                functions: 95,
                branches: 85,
                statements: 65,
                // Scoped floors: lock in the CNC-critical gains (all files
                // currently at or above these values). Prevents backsliding
                // while the global floor stays low.
                'src/store/files/cnc*.ts': {
                    lines: 90,
                    functions: 90,
                    branches: 70,
                    statements: 90,
                },
                'src/composables/useCnc*.ts': {
                    lines: 85,
                    functions: 85,
                    branches: 70,
                    statements: 85,
                },
                'src/utils/mockMoonrakerDb.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 80,
                    statements: 95,
                },
                // Full-coverage-closure R1+R2: the server/* + printer/* layer
                // and the store-logic tail closed in R2. Floors sit just below
                // measured reality; later phases raise them. socket/index.ts
                // is intentionally unfloored (import.meta.env/wss branches
                // depend on the deployment environment, covered by
                // tests/store/socket/index.spec.ts as far as jsdom allows).
                // editor/actions.ts functions stay at 80 (axios
                // upload/download progress callbacks need a heavier harness).
                'src/store/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 80,
                    statements: 95,
                },
                'src/store/socket/actions.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/socket/getters.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/socket/mutations.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/files/*.ts': {
                    lines: 95,
                    functions: 90,
                    branches: 85,
                    statements: 95,
                },
                'src/store/editor/*.ts': {
                    lines: 90,
                    functions: 80,
                    branches: 95,
                    statements: 90,
                },
                'src/store/farm/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 90,
                    statements: 95,
                },
                'src/store/farm/printer/actions.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 90,
                    statements: 95,
                },
                'src/store/farm/printer/getters.ts': {
                    lines: 90,
                    functions: 95,
                    branches: 85,
                    statements: 90,
                },
                'src/store/farm/printer/mutations.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/farm/printer/index.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 50,
                    statements: 95,
                },
                'src/store/gui/*.ts': {
                    lines: 90,
                    functions: 95,
                    branches: 85,
                    statements: 90,
                },
                'src/store/gui/*/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 80,
                    statements: 95,
                },
                'src/store/server/actions.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/server/getters.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 50,
                    statements: 95,
                },
                'src/store/server/mutations.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/server/history/*.ts': {
                    lines: 95,
                    functions: 85,
                    branches: 80,
                    statements: 95,
                },
                'src/store/server/jobQueue/*.ts': {
                    lines: 95,
                    functions: 90,
                    branches: 90,
                    statements: 95,
                },
                'src/store/server/power/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/server/sensor/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 95,
                    statements: 95,
                },
                'src/store/server/timelapse/*.ts': {
                    lines: 90,
                    functions: 85,
                    branches: 65,
                    statements: 90,
                },
                'src/store/printer/actions.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 90,
                    statements: 95,
                },
                'src/store/printer/getters.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 90,
                    statements: 95,
                },
                'src/store/printer/mutations.ts': {
                    lines: 90,
                    functions: 90,
                    branches: 90,
                    statements: 90,
                },
                'src/store/printer/tempHistory/*.ts': {
                    lines: 95,
                    functions: 95,
                    branches: 80,
                    statements: 95,
                },
                // Full-coverage-closure R4: CNC panels are the fork's
                // differentiator (all files currently >=96% lines).
                'src/components/panels/Cnc/*': {
                    lines: 90,
                    functions: 70,
                    branches: 70,
                    statements: 90,
                },
            },
        },
    },
})
