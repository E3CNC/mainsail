import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import TopCornerMenuService from '@/components/ui/TopCornerMenuService.vue'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    printerIsPrinting: null as unknown as { value: boolean },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/composables/useBase', async () => {
    const { ref } = await import('vue')
    mocks.printerIsPrinting = ref(false)
    return { useBase: () => ({ printerIsPrinting: mocks.printerIsPrinting }) }
})

vi.mock('vue-i18n', () => ({
    useI18n: () => ({ t: (key: string) => key }),
}))

const ConfirmationStub = {
    props: ['modelValue', 'title', 'text', 'actionButtonText'],
    emits: ['update:modelValue', 'action'],
    template:
        '<div class="confirmation-stub">{{ title }}<button data-testid="confirm-action" @click="$emit(\'action\')" /></div>',
}

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
    mocks.printerIsPrinting.value = false
})

const createTestWrapper = (
    service = 'klipper',
    serviceState: Record<string, unknown> = { active_state: 'active', sub_state: 'running' }
) => {
    const vuetify = createVuetify()
    const store = createStore({
        state: {
            server: {
                system_info: {
                    service_state: { [service]: serviceState },
                    instance_ids: { klipper: 'klipper', moonraker: 'moonraker' },
                },
            },
            gui: { uiSettings: { hideOtherInstances: false } },
        },
    })
    const wrapper = mount(TopCornerMenuService, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: { 'confirmation-dialog': ConfirmationStub },
        },
        props: { service } as never,
    })
    return { wrapper }
}

describe('TopCornerMenuService', () => {
    it('renders the service name', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Klipper')
        expect(wrapper.findComponent({ name: 'VTooltip' }).exists()).toBe(true)
        wrapper.unmount()
    })

    it('starts an inactive service and closes the menu', async () => {
        const { wrapper } = createTestWrapper('klipper', { active_state: 'inactive', sub_state: 'dead' })
        const buttons = wrapper.findAll('.v-btn')
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('machine.services.start', { service: 'klipper' })
        expect(wrapper.emitted('close-menu')).toBeTruthy()
        wrapper.unmount()
    })

    it('disables stop for an inactive service', () => {
        const { wrapper } = createTestWrapper('klipper', { active_state: 'inactive', sub_state: 'dead' })
        const buttons = wrapper.findAll('.v-btn')
        const stop = buttons[buttons.length - 1]
        expect((stop.element as HTMLButtonElement).disabled).toBe(true)
        wrapper.unmount()
    })

    it('restarts an active service directly when idle', async () => {
        const { wrapper } = createTestWrapper()
        const buttons = wrapper.findAll('.v-btn')
        // restart is the first action button for an active service
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('machine.services.restart', { service: 'klipper' })
        expect(wrapper.emitted('close-menu')).toBeTruthy()
        wrapper.unmount()
    })

    it('asks for restart confirmation while printing', async () => {
        mocks.printerIsPrinting.value = true
        const { wrapper } = createTestWrapper()
        const buttons = wrapper.findAll('.v-btn')
        await buttons[0].trigger('click')
        expect(mocks.emit).not.toHaveBeenCalled()
        const dialogs = wrapper.findAllComponents(ConfirmationStub)
        expect(dialogs[0].props('modelValue')).toBe(true)
        wrapper.unmount()
    })

    it('restarts after confirming the restart dialog', async () => {
        mocks.printerIsPrinting.value = true
        const { wrapper } = createTestWrapper()
        const buttons = wrapper.findAll('.v-btn')
        await buttons[0].trigger('click')
        const dialogs = wrapper.findAllComponents(ConfirmationStub)
        await dialogs[0].find('[data-testid="confirm-action"]').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('machine.services.restart', { service: 'klipper' })
        expect(wrapper.emitted('close-menu')).toBeTruthy()
        wrapper.unmount()
    })

    it('stops the service directly when idle', async () => {
        const { wrapper } = createTestWrapper()
        const buttons = wrapper.findAll('.v-btn')
        await buttons[buttons.length - 1].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('machine.services.stop', { service: 'klipper' })
        expect(wrapper.emitted('close-menu')).toBeTruthy()
        wrapper.unmount()
    })

    it('hides the stop button for the moonraker service', () => {
        const { wrapper } = createTestWrapper('moonraker')
        const buttons = wrapper.findAll('.v-btn')
        const stop = buttons[buttons.length - 1]
        expect(stop.attributes('style')).toContain('visibility: hidden')
        wrapper.unmount()
    })
})
