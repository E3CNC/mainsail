import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import MacroButton from '@/components/inputs/MacroButton.vue'

const mocks = vi.hoisted(() => ({
    emit: vi.fn(),
    loadings: { value: [] as string[], __v_isRef: true },
    isMobile: { value: false, __v_isRef: true },
}))

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ loadings: mocks.loadings, isMobile: mocks.isMobile }),
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
                removeEventListener: () => {},
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.emit.mockReset()
    mocks.loadings.value = []
    mocks.isMobile.value = false
})

interface MacroParam {
    type: 'int' | 'double' | 'string' | null
    default: string | number | null
}

const makeMacroEntry = (params: Record<string, MacroParam> = {}, description = 'Test macro') => ({
    name: 'TEST_MACRO',
    description,
    params,
})

const createTestWrapper = (
    macroProps: Record<string, unknown> = {},
    klipperMacroParams: Record<string, MacroParam> = {},
    options: { isMobile?: boolean; loadings?: string[]; description?: string } = {}
) => {
    mocks.isMobile.value = options.isMobile ?? false
    mocks.loadings.value = options.loadings ?? []
    const macroEntry = makeMacroEntry(klipperMacroParams, options.description ?? 'Test macro')
    const vuetify = createVuetify()
    const addEventCalls: unknown[] = []
    const store = createStore({
        state: {},
        getters: {
            'printer/getMacro': () => () => macroEntry,
        },
        actions: {
            'server/addEvent': (_ctx: never, payload: never) => {
                addEventCalls.push(payload)
            },
        },
    })
    const wrapper = mount(MacroButton, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div><slot /></div>' },
                VTooltip: {
                    template: '<div><slot name="activator" :props="{}" /><slot /></div>',
                },
                VMenu: {
                    template: '<div><slot name="activator" :props="{}" /><slot /></div>',
                },
                VDialog: {
                    template: '<div><slot /></div>',
                },
            },
        },
        props: {
            macro: { name: 'TEST_MACRO' },
            ...macroProps,
        } as never,
    })
    return { wrapper, addEventCalls, macroEntry }
}

describe('MacroButton', () => {
    it('renders the macro name with underscores as spaces', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('TEST MACRO')
        wrapper.unmount()
    })

    it('prefers alias over macro name', () => {
        const { wrapper } = createTestWrapper({ alias: 'My Alias' })
        expect(wrapper.text()).toContain('My Alias')
        wrapper.unmount()
    })

    it('renders an icon when given', () => {
        const { wrapper } = createTestWrapper({ icon: 'mdi-test' })
        expect(wrapper.findComponent({ name: 'VIcon' }).exists()).toBe(true)
        wrapper.unmount()
    })

    it('sends the macro on click with an echo event', async () => {
        const { wrapper, addEventCalls } = createTestWrapper()
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith(
            'printer.gcode.script',
            { script: 'TEST_MACRO' },
            { loading: 'macro_TEST_MACRO' }
        )
        expect(addEventCalls).toEqual([{ message: 'TEST_MACRO', type: 'command' }])
        wrapper.unmount()
    })

    it('disables buttons when disabled', () => {
        const { wrapper } = createTestWrapper({ disabled: true })
        const buttons = wrapper.findAll('button')
        expect(buttons[0].attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })

    it('shows loading state for the macro', () => {
        const { wrapper } = createTestWrapper({}, {}, { loadings: ['macro_TEST_MACRO'] })
        const btn = wrapper.findComponent({ name: 'VBtn' })
        expect(btn.props('loading')).toBe(true)
        wrapper.unmount()
    })

    it('parses params and ignores underscore-prefixed internals', async () => {
        const { wrapper } = createTestWrapper(
            {},
            {
                SPEED: { type: 'int', default: 100 },
                _hidden: { type: 'string', default: 'x' },
            }
        )
        await nextTick()
        // param menu button appears when params exist
        expect(wrapper.find('.btnMacroMenu').exists()).toBe(true)
        expect(wrapper.text()).toContain('SPEED')
        expect(wrapper.text()).not.toContain('_hidden')
        wrapper.unmount()
    })

    it('hides the param menu when no params exist', () => {
        const { wrapper } = createTestWrapper({}, {})
        expect(wrapper.find('.btnMacroMenu').exists()).toBe(false)
        wrapper.unmount()
    })

    it('sends params with equals for normal macros', async () => {
        const { wrapper } = createTestWrapper({}, { SPEED: { type: 'int', default: 100 } })
        await nextTick()
        const inputs = wrapper.findAll('input')
        expect(inputs.length).toBeGreaterThan(0)
        await inputs[0].setValue('150')
        const sendButtons = wrapper.findAll('button').filter((b) => b.text().includes('Send'))
        expect(sendButtons.length).toBeGreaterThan(0)
        await sendButtons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'TEST_MACRO SPEED=150' }, {
            loading: expect.anything(),
        } as never)
        wrapper.unmount()
    })

    it('quotes param values containing spaces', async () => {
        const { wrapper } = createTestWrapper({}, { MSG: { type: 'string', default: '' } })
        await nextTick()
        await wrapper.find('input').setValue('hello world')
        const sendButtons = wrapper.findAll('button').filter((b) => b.text().includes('Send'))
        await sendButtons[0].trigger('click')
        const script = (mocks.emit.mock.calls[0][1] as { script: string }).script
        expect(script).toContain('MSG="hello world"')
        wrapper.unmount()
    })

    it('skips empty params', async () => {
        const { wrapper } = createTestWrapper({}, { SPEED: { type: 'int', default: 100 } })
        await nextTick()
        const sendButtons = wrapper.findAll('button').filter((b) => b.text().includes('Send'))
        await sendButtons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'TEST_MACRO ' }, {
            loading: expect.anything(),
        } as never)
        wrapper.unmount()
    })

    it('uses gcode style without equals for G/M macros', async () => {
        const { wrapper } = createTestWrapper({ macro: { name: 'M104' } }, { S: { type: 'int', default: 0 } })
        await nextTick()
        await wrapper.find('input').setValue('200')
        const sendButtons = wrapper.findAll('button').filter((b) => b.text().includes('Send'))
        await sendButtons[0].trigger('click')
        const script = (mocks.emit.mock.calls[0][1] as { script: string }).script
        // G/M style concatenates without '='
        expect(script).toBe('M104 S200')
        wrapper.unmount()
    })

    it('opens the mobile dialog when isMobile', async () => {
        const { wrapper } = createTestWrapper({}, { SPEED: { type: 'int', default: 100 } }, { isMobile: true })
        await nextTick()
        const menuBtn = wrapper.find('.btnMacroMenu')
        expect(menuBtn.exists()).toBe(true)
        await menuBtn.trigger('click')
        await nextTick()
        expect(wrapper.find('input').exists()).toBe(true)
        wrapper.unmount()
    })
})
