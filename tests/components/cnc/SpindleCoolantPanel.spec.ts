import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import * as VuetifyComponents from 'vuetify/components'
import SpindleCoolantPanel from '@/components/panels/Cnc/SpindleCoolantPanel.vue'

const mocks = vi.hoisted(() => ({
    klipperReady: true,
    spindleEnabled: true,
    coolantEnabled: true,
    requireConfirm: false,
    toastError: vi.fn(),
    spindle: vi.fn(),
    coolant: vi.fn(),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        get klipperReadyForGui() {
            return mocks.klipperReady
        },
    }),
}))

vi.mock('@/composables/useCncProfile', () => ({
    useCncProfile: () => ({
        get spindleEnabled() {
            return mocks.spindleEnabled
        },
        get coolantEnabled() {
            return mocks.coolantEnabled
        },
        get requireConfirmForSpindleStart() {
            return {
                get value() {
                    return mocks.requireConfirm
                },
            }
        },
    }),
}))

vi.mock('@/composables/useControl', () => ({
    useControl: () => ({}),
}))

vi.mock('@/store/files/cncApi', () => ({
    setCncSpindle: mocks.spindle,
    setCncCoolant: mocks.coolant,
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ error: mocks.toastError }),
}))

beforeAll(() => {
    const MockResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    if (!(globalThis as Record<string, unknown>).ResizeObserver) {
        ;(globalThis as Record<string, unknown>).ResizeObserver = MockResizeObserver
    }
})

beforeEach(() => {
    mocks.klipperReady = true
    mocks.spindleEnabled = true
    mocks.coolantEnabled = true
    mocks.requireConfirm = false
    mocks.spindle.mockReset()
    mocks.spindle.mockResolvedValue(null)
    mocks.coolant.mockReset()
    mocks.coolant.mockResolvedValue(null)
    mocks.toastError.mockReset()
})

function createTestWrapper() {
    const vuetify = createVuetify({
        components: Object.values(VuetifyComponents) as never,
    })
    const store = createStore({
        modules: {
            socket: {
                namespaced: true,
                getters: { getUrl: () => 'http://moonraker:7125' },
            },
            server: {
                namespaced: true,
                actions: { addEvent: () => {} },
            },
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')
    const wrapper = mount(SpindleCoolantPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot name="buttons" /><slot /></div>' },
                ConfirmationDialog: {
                    name: 'ConfirmationDialog',
                    template: '<div data-testid="confirm-dialog" />',
                    props: ['modelValue', 'title', 'text', 'actionButtonText', 'cancelButtonText'],
                },
                VIcon: { template: '<span><slot /></span>' },
                VDivider: { template: '<div />' },
            },
        },
    })
    return { wrapper, store, dispatchSpy }
}

type TestWrapper = ReturnType<typeof createTestWrapper>['wrapper']

function buttonLabel(b: { text: () => string }) {
    return b.text().replace(/\s+/g, ' ').trim()
}

function findButton(wrapper: TestWrapper, text: string) {
    const btns = wrapper.findAll('button')
    // Exact match first (SET has no icon). Otherwise the label sits at the
    // end after the stubbed VIcon's raw mdi path (which itself may contain
    // spaces), so match the trailing suffix. For bare labels like ON/OFF,
    // prefer the candidate whose remainder is just the icon path rather
    // than another label word (Flood/Mist ON).
    const exact = btns.find((b) => buttonLabel(b) === text)
    if (exact) return exact
    const suffix = ` ${text}`
    const candidates = btns.filter((b) => buttonLabel(b).endsWith(suffix))
    const bare = candidates.find((b) => !/(Flood|Mist)$/.test(buttonLabel(b).slice(0, -suffix.length)))
    const found = bare ?? candidates[0]
    if (!found) throw new Error(`button "${text}" not found, got: [${btns.map((b) => buttonLabel(b)).join(' | ')}]`)
    return found
}

describe('SpindleCoolantPanel', () => {
    it('renders the panel when klipper is ready and features are enabled', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', () => {
        mocks.klipperReady = false
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('hides the panel when both spindle and coolant are disabled', () => {
        mocks.spindleEnabled = false
        mocks.coolantEnabled = false
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('renders spindle controls only when coolant is disabled', () => {
        mocks.coolantEnabled = false
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(findButton(wrapper, 'ON').exists()).toBe(true)
        expect(wrapper.findAll('button').some((b) => b.text().includes('Flood'))).toBe(false)
        wrapper.unmount()
    })

    it('renders coolant controls only when spindle is disabled', () => {
        mocks.spindleEnabled = false
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(findButton(wrapper, 'Flood ON').exists()).toBe(true)
        expect(wrapper.find('input').exists()).toBe(false)
        wrapper.unmount()
    })

    it('sends spindle CW with rpm 0 by default and logs the event', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'ON').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'cw', rpm: 0 })
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'CNC spindle cw 0',
            type: 'command',
        })
        wrapper.unmount()
    })

    it('sends spindle OFF and logs the event', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'OFF').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'off', rpm: 0 })
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'CNC spindle off',
            type: 'command',
        })
        wrapper.unmount()
    })

    it('sends spindle CCW', async () => {
        const { wrapper } = createTestWrapper()
        await findButton(wrapper, 'CCW').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'ccw', rpm: 0 })
        wrapper.unmount()
    })

    it('sends spindle CW with the entered speed on SET', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input').setValue('12000')
        await findButton(wrapper, 'SET').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'cw', rpm: 12000 })
        wrapper.unmount()
    })

    it('sends spindle OFF on SET when the speed is zero', async () => {
        const { wrapper } = createTestWrapper()
        await wrapper.find('input').setValue('0')
        await findButton(wrapper, 'SET').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'off', rpm: 0 })
        wrapper.unmount()
    })

    it('disables SET while the speed input is empty and sends nothing', async () => {
        const { wrapper } = createTestWrapper()
        const setBtn = findButton(wrapper, 'SET')
        expect((setBtn.element as HTMLButtonElement).disabled).toBe(true)
        await setBtn.trigger('click')
        await flushPromises()
        expect(mocks.spindle).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('defers spindle start behind the confirm dialog when required', async () => {
        mocks.requireConfirm = true
        const { wrapper } = createTestWrapper()
        await findButton(wrapper, 'ON').trigger('click')
        await flushPromises()
        expect(mocks.spindle).not.toHaveBeenCalled()
        const dialog = wrapper.findComponent({ name: 'ConfirmationDialog' })
        expect(dialog.props('modelValue')).toBe(true)
        await dialog.vm.$emit('action')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'cw', rpm: 0 })
        wrapper.unmount()
    })

    it('does not require confirmation for spindle OFF', async () => {
        mocks.requireConfirm = true
        const { wrapper } = createTestWrapper()
        await findButton(wrapper, 'OFF').trigger('click')
        await flushPromises()
        expect(mocks.spindle).toHaveBeenCalledWith('http://moonraker:7125', { state: 'off', rpm: 0 })
        expect(wrapper.findComponent({ name: 'ConfirmationDialog' }).props('modelValue')).toBe(false)
        wrapper.unmount()
    })

    it('confirming without a pending spindle command sends nothing', async () => {
        mocks.requireConfirm = true
        const { wrapper } = createTestWrapper()
        await wrapper.findComponent({ name: 'ConfirmationDialog' }).vm.$emit('action')
        await flushPromises()
        expect(mocks.spindle).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('toggles flood coolant on and off', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'Flood ON').trigger('click')
        await flushPromises()
        expect(mocks.coolant).toHaveBeenCalledWith('http://moonraker:7125', { flood: true, mist: false })
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'CNC coolant flood on',
            type: 'command',
        })
        await findButton(wrapper, 'Flood OFF').trigger('click')
        await flushPromises()
        expect(mocks.coolant).toHaveBeenCalledWith('http://moonraker:7125', { flood: false, mist: false })
        wrapper.unmount()
    })

    it('toggles mist coolant on and off', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'Mist ON').trigger('click')
        await flushPromises()
        expect(mocks.coolant).toHaveBeenCalledWith('http://moonraker:7125', { flood: false, mist: true })
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', {
            message: 'CNC coolant mist on',
            type: 'command',
        })
        await findButton(wrapper, 'Mist OFF').trigger('click')
        await flushPromises()
        expect(mocks.coolant).toHaveBeenLastCalledWith('http://moonraker:7125', { flood: false, mist: false })
        expect(dispatchSpy).toHaveBeenLastCalledWith('server/addEvent', {
            message: 'CNC coolant off',
            type: 'command',
        })
        wrapper.unmount()
    })

    it('toasts spindle errors and skips the event log', async () => {
        mocks.spindle.mockRejectedValueOnce(new Error('spindle boom'))
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'ON').trigger('click')
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith('spindle boom')
        expect(dispatchSpy).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('toasts coolant errors with the fallback message for non-Error failures', async () => {
        mocks.coolant.mockRejectedValueOnce('plain failure' as never)
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButton(wrapper, 'Flood ON').trigger('click')
        await flushPromises()
        expect(mocks.toastError).toHaveBeenCalledWith('Failed to update coolant')
        expect(dispatchSpy).not.toHaveBeenCalled()
        wrapper.unmount()
    })
})
