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
                // Global backstop: matches current reality (~5% lines across
                // 401 src files). Ratchet upward as coverage phases land.
                // See docs/prd/test-coverage-expansion.md R1.
                lines: 5,
                functions: 50,
                branches: 80,
                statements: 5,
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
            },
        },
    },
})
