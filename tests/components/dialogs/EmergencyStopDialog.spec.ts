import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import EmergencyStopDialog from '@/components/dialogs/EmergencyStopDialog.vue'

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
})

beforeEach(() => {
    mocks.emit.mockReset()
})

const createTestWrapper = (modelValue = true) => {
    const vuetify = createVuetify()
    const wrapper = mount(EmergencyStopDialog, {
        props: { modelValue },
        global: {
            plugins: [vuetify],
            mocks: { $t: (s: string) => s },
            stubs: {
                VDialog: { template: '<div><slot /></div>' },
                Panel: { template: '<div><slot /><slot name="buttons" /></div>' },
            },
        },
    })
    return { wrapper }
}

const findButtonByText = (wrapper: ReturnType<typeof mount>, text: string) => {
    const found = wrapper.findAll('button').find((b) => b.text().includes(text))
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

describe('EmergencyStopDialog', () => {
    it('renders the confirmation prompt', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('EmergencyStopDialog.AreYouSure')
        wrapper.unmount()
    })

    it('sends printer.emergency_stop and closes on Yes', async () => {
        const { wrapper } = createTestWrapper()
        await findButtonByText(wrapper, 'Buttons.Yes').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.emergency_stop', {}, { loading: 'topbarEmergencyStop' })
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })

    it('closes without emitting on No', async () => {
        const { wrapper } = createTestWrapper()
        await findButtonByText(wrapper, 'Buttons.No').trigger('click')
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })
})
