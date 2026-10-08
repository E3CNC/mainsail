import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import KlippyStatePanel from '@/components/panels/KlippyStatePanel.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        open: vi.fn(),
    }
})

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
    if (!(globalThis as Record<string, unknown>).open) {
        Object.defineProperty(window, 'open', { value: mocks.open, writable: true })
    } else {
        window.open = mocks.open as never
    }
})

beforeEach(() => {
    mocks.emit.mockReset()
    mocks.open.mockReset()
})

interface WrapperOptions {
    klippyState?: string
    klippyConnected?: boolean
    socketConnected?: boolean
    klippyMessage?: string | null
    powerDevices?: { device: string; status: string }[]
    powerDeviceName?: string | null
}

const createTestWrapper = (options: WrapperOptions = {}) => {
    const {
        klippyState = 'error',
        klippyConnected = true,
        socketConnected = true,
        klippyMessage = 'Something failed',
        powerDevices = [],
        powerDeviceName = null,
    } = options

    const vuetify = createVuetify()

    const store = createStore({
        state: {
            socket: { isConnected: socketConnected, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: klippyConnected,
                klippy_state: klippyState,
                klippy_message: klippyMessage,
                components: [],
            },
            printer: { print_stats: { state: 'standby' } },
            gui: { uiSettings: { powerDeviceName } },
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/power/getDevices': () => powerDevices,
        },
        actions: {},
    })

    const wrapper = mount(KlippyStatePanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                ConnectionStatus: { template: '<div data-testid="connection-status" />' },
            },
        },
    })

    return { wrapper, store }
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
    const buttons = wrapper.findAll('button, a')
    const found = buttons.find((b) => b.text().includes(text))
    if (!found)
        throw new Error(`button with text "${text}" not found, got: ${buttons.map((b) => b.text()).join(' | ')}`)
    return found
}

describe('KlippyStatePanel', () => {
    it('renders nothing when klipper is ready', () => {
        const { wrapper } = createTestWrapper({ klippyState: 'ready', klippyConnected: true })
        expect(wrapper.html()).not.toContain('ServiceReports')
        wrapper.unmount()
    })

    it('renders nothing when the socket is disconnected', () => {
        const { wrapper } = createTestWrapper({ socketConnected: false, klippyState: 'error' })
        expect(wrapper.html()).not.toContain('ServiceReports')
        wrapper.unmount()
    })

    it('reports Klipper errors with restart actions', async () => {
        const { wrapper } = createTestWrapper({ klippyState: 'error', klippyMessage: 'shutdown boom' })
        expect(wrapper.text()).toContain('shutdown boom')
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.ServiceReports')
        await findButtonByText(wrapper as never, 'Panels.KlippyStatePanel.Restart').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.restart', {}, { loading: 'restart' })
        await findButtonByText(wrapper as never, 'Panels.KlippyStatePanel.FirmwareRestart').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.firmware_restart', {}, { loading: 'firmwareRestart' })
        wrapper.unmount()
    })

    it('shows a spinner while the klippy message is missing', () => {
        const { wrapper } = createTestWrapper({ klippyState: 'startup', klippyMessage: null })
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.ServiceReports')
        wrapper.unmount()
    })

    it('opens log links in a new window', async () => {
        const { wrapper } = createTestWrapper({ klippyState: 'shutdown', klippyMessage: 'oops' })
        await findButtonByText(wrapper as never, 'Panels.KlippyStatePanel.KlipperLog').trigger('click')
        expect(mocks.open).toHaveBeenCalled()
        expect(String(mocks.open.mock.calls[0][0])).toContain('klippy.log')
        wrapper.unmount()
    })

    it('shows the power-off state with a power-on action', async () => {
        const { wrapper } = createTestWrapper({
            klippyState: 'disconnected',
            klippyConnected: false,
            klippyMessage: 'x',
            powerDevices: [{ device: 'printer', status: 'off' }],
        })
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.PrinterSwitchedOff')
        await findButtonByText(wrapper as never, 'Panels.KlippyStatePanel.PowerOn').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'machine.device_power.post_device',
            { device: 'printer', action: 'on' },
            { action: 'server/power/responseToggle' }
        )
        wrapper.unmount()
    })

    it('shows the moonraker connection state when klippy is disconnected without power devices', () => {
        const { wrapper } = createTestWrapper({
            klippyState: 'disconnected',
            klippyConnected: false,
            socketConnected: true,
            klippyMessage: 'x',
            powerDevices: [],
        })
        expect(wrapper.text()).toContain('Panels.KlippyStatePanel.MoonrakerCannotConnect')
        expect(wrapper.find('[data-testid="connection-status"]').exists()).toBe(true)
        wrapper.unmount()
    })
})
