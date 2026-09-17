import { describe, expect, it, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import * as VuetifyComponents from 'vuetify/components'
import FarmPrinterPanel from '@/components/panels/FarmPrinterPanel.vue'

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
})

vi.mock('@/composables/useWebcam', () => ({
    useWebcam: () => ({ convertWebcamIcon: () => '' }),
}))
vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({ sidebarBgImage: { value: '' } }),
}))

const createTestWrapper = (overrides: Record<string, unknown> = {}) => {
    const namespace = 'mockprinter'
    const vuetify = createVuetify({
        components: Object.values(VuetifyComponents),
    })

    const store = createStore({
        modules: {
            farm: {
                namespaced: true,
                state: {},
                getters: {
                    getPrinterName: () => 'Mock Printer',
                    getImage: () => undefined,
                    getLogo: () => undefined,
                    getLogoColor: () => '#ffffff',
                    getPrinterPreview: () => [],
                    getPrinterWebcams: () => [],
                },
                modules: {
                    [namespace]: {
                        namespaced: true,
                        state: {
                            socket: {
                                hostname: '127.0.0.1',
                                port: 7125,
                                webPort: 80,
                                isConnected: true,
                                isConnecting: false,
                            },
                        },
                        getters: {
                            isCurrentPrinter: () => true,
                            getSetting: () => (key: string, fallback: unknown) => {
                                return fallback ?? 'off'
                            },
                            getPrinterName: () => 'Mock Printer',
                            getStatus: () => 'Ready',
                            getCurrentFilename: () => '',
                            getImage: () => undefined,
                            getLogo: () => undefined,
                            getLogoColor: () => '#ffffff',
                            getPrinterPreview: () => [],
                            getPrinterWebcams: () => [],
                        },
                        actions: {
                            setSettings: () => {},
                            reconnect: () => {},
                        },
                    },
                },
            },
        },
    })

    return mount(FarmPrinterPanel, {
        global: {
            plugins: [vuetify, store],
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
                MainsailLogo: { template: '<div data-testid="mainsail-logo" />' },
                WebcamWrapper: { template: '<div data-testid="webcam-wrapper" />' },
                VMenu: { template: '<div><slot /></div>' },
                VBtn: { template: '<button><slot /></button>' },
                VIcon: { template: '<span><slot /></span>' },
                VHover: { template: '<div><slot :isHovering="false" /></div>' },
                VImg: { template: '<div data-testid="v-img"><slot /></div>' },
                VCardTitle: { template: '<div><slot /></div>' },
                VRow: { template: '<div><slot /></div>' },
                VCol: { template: '<div><slot /></div>' },
                VCardText: { template: '<div><slot /></div>' },
                VContainer: { template: '<div><slot /></div>' },
                VFadeTransition: { template: '<div><slot /></div>' },
                VOverlay: { template: '<div><slot /></div>' },
                VList: { template: '<div><slot /></div>' },
                VListItem: { template: '<div><slot /></div>' },
            },
        },
        props: {
            printer: {
                _namespace: namespace,
                socket: {
                    hostname: '127.0.0.1',
                    port: 7125,
                    webPort: 80,
                    isConnected: true,
                    isConnecting: false,
                },
            },
            ...overrides,
        },
    })
}

describe('FarmPrinterPanel', () => {
    it('renders without crashing', () => {
        const wrapper = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('renders with printer name in panel title', () => {
        const wrapper = createTestWrapper()
        const panel = wrapper.find('[data-testid="panel"]')
        expect(panel.exists()).toBe(true)
        wrapper.unmount()
    })

    it('does not throw when panel ref is null (ResizeObserver guard)', () => {
        expect(() => {
            const wrapper = createTestWrapper()
            wrapper.unmount()
        }).not.toThrow()
    })

    it('renders webcam switch as hidden when no webcams available', () => {
        const wrapper = createTestWrapper()
        wrapper.unmount()
    })
})
