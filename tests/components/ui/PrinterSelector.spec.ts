import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import PrinterSelector from '@/components/ui/PrinterSelector.vue'

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
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
    mocks.dispatch.mockReset()
})

const printers = [
    { _namespace: 'printer1', socket: { isConnected: true } },
    { _namespace: 'printer2', socket: { isConnected: false } },
]

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const store = createStore({
        getters: {
            'farm/getPrinters': () => printers,
            'farm/printer1/getPrinterName': () => 'Shop Printer',
            'farm/printer1/getStatus': () => 'standby',
            'farm/printer2/getPrinterName': () => 'Garage Printer',
            'farm/printer2/getStatus': () => 'disconnected',
        },
        actions: {
            changePrinter: (_ctx: never, payload: never) => {
                mocks.dispatch(payload)
            },
        },
    })
    const wrapper = mount(PrinterSelector, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: { VMenu: { template: '<div><slot /><slot name="activator" /></div>' } },
        },
    })
    return { wrapper }
}

describe('PrinterSelector', () => {
    it('lists every farm printer with name and status', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Shop Printer')
        expect(wrapper.text()).toContain('standby')
        expect(wrapper.text()).toContain('Garage Printer')
        wrapper.unmount()
    })

    it('switches to a connected printer on click', async () => {
        const { wrapper } = createTestWrapper()
        const items = wrapper.findAllComponents({ name: 'VListItem' })
        await items[0].trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith({ printer: 'printer1' })
        wrapper.unmount()
    })

    it('does not switch to a disconnected printer', async () => {
        const { wrapper } = createTestWrapper()
        const items = wrapper.findAllComponents({ name: 'VListItem' })
        expect(items[1].props('disabled')).toBe(true)
        await items[1].trigger('click')
        expect(mocks.dispatch).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})
