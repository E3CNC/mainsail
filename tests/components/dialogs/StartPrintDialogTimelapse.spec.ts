import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import StartPrintDialogTimelapse from '@/components/dialogs/StartPrintDialogTimelapse.vue'

const mocks = vi.hoisted(() => ({ emit: vi.fn() }))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

beforeAll(() => {
    const MockResizeObserver = class {
        observe = () => {}
        unobserve = () => {}
        disconnect = () => {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
    if (!window.matchMedia) {
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            value: vi.fn(() => ({
                matches: false,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.emit.mockReset()
})

const createTestWrapper = (enabled = false) => {
    const vuetify = createVuetify()
    const store = createStore({
        state: { server: { timelapse: { settings: { enabled } } } },
    })
    const wrapper = mount(StartPrintDialogTimelapse, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: { SettingsRow: { props: ['title'], template: '<div>{{ title }}<slot /></div>' } },
        },
    })
    return { wrapper }
}

describe('StartPrintDialogTimelapse', () => {
    it('renders the timelapse switch from store state', () => {
        const { wrapper } = createTestWrapper(false)
        expect(wrapper.text()).toContain('Dialogs.StartPrint.Timelapse')
        expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('posts the new setting through the socket when toggled on', async () => {
        const { wrapper } = createTestWrapper(false)
        await wrapper.find('input[type="checkbox"]').setValue(true)
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.timelapse.post_settings',
            { enabled: true },
            { action: 'server/timelapse/initSettings' }
        )
        wrapper.unmount()
    })

    it('posts the new setting through the socket when toggled off', async () => {
        const { wrapper } = createTestWrapper(true)
        await wrapper.find('input[type="checkbox"]').setValue(false)
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.timelapse.post_settings',
            { enabled: false },
            { action: 'server/timelapse/initSettings' }
        )
        wrapper.unmount()
    })
})
