import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import ConsoleTextarea from '@/components/inputs/ConsoleTextarea.vue'

const mocks = vi.hoisted(() => ({
    isTouchDevice: { value: false, __v_isRef: true },
    helplist: { value: [] as { command: string; help: string }[] },
    lastCommands: { value: [] as string[] },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isTouchDevice: mocks.isTouchDevice }),
}))

vi.mock('@/composables/useConsole', () => ({
    useConsole: () => ({ helplist: mocks.helplist, lastCommands: mocks.lastCommands }),
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
    mocks.isTouchDevice.value = false
    mocks.helplist.value = [
        { command: 'G28', help: 'Home' },
        { command: 'G29', help: 'Bed mesh' },
        { command: 'M104', help: 'Set temp' },
    ]
    mocks.lastCommands.value = []
})

const createTestWrapper = () => {
    const vuetify = createVuetify()
    const dispatched: { action: string; payload: unknown }[] = []
    const store = createStore({
        state: {},
        actions: {
            'printer/sendGcode': (_ctx: never, payload: never) => {
                dispatched.push({ action: 'printer/sendGcode', payload })
            },
            'gui/gcodehistory/addToHistory': (_ctx: never, payload: never) => {
                dispatched.push({ action: 'gui/gcodehistory/addToHistory', payload })
            },
            'server/addEvent': (_ctx: never, payload: never) => {
                dispatched.push({ action: 'server/addEvent', payload })
            },
        },
    })
    const wrapper = mount(ConsoleTextarea, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                VTextarea: {
                    props: ['modelValue', 'rows'],
                    emits: ['update:modelValue'],
                    template:
                        '<textarea ref="input" :value="modelValue" :rows="rows" @input="$emit(\'update:modelValue\', $event.target.value)" />',
                },
            },
        },
    })
    return { wrapper, dispatched }
}

const setGcode = async (wrapper: ReturnType<typeof mount>, value: string) => {
    await wrapper.find('textarea').setValue(value)
    await nextTick()
}

describe('ConsoleTextarea', () => {
    it('renders the console input', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('textarea').exists()).toBe(true)
        wrapper.unmount()
    })

    it('computes rows from newlines', async () => {
        const { wrapper } = createTestWrapper()
        await setGcode(wrapper as never, 'G28\nG29\nM104')
        // 3 lines -> rows 3 on the textarea
        expect(wrapper.find('textarea').attributes('rows')).toBe('3')
        wrapper.unmount()
    })

    it('sends gcode on enter and clears history cursor', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        await setGcode(wrapper as never, 'G28')
        await wrapper.find('textarea').trigger('keydown.enter')
        expect(dispatched).toContainEqual({ action: 'printer/sendGcode', payload: 'G28' })
        expect(dispatched).toContainEqual({ action: 'gui/gcodehistory/addToHistory', payload: 'G28' })
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
        wrapper.unmount()
    })

    it('does nothing when gcode is empty', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        await setGcode(wrapper as never, '')
        await wrapper.find('textarea').trigger('keydown.enter')
        expect(dispatched).toHaveLength(0)
        wrapper.unmount()
    })

    it('appends newline on shift+enter instead of sending', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        await setGcode(wrapper as never, 'G28')
        await wrapper.find('textarea').trigger('keydown.enter', { shiftKey: true })
        expect(dispatched).toHaveLength(0)
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain('\n')
        wrapper.unmount()
    })

    it('navigates history with up and down', async () => {
        mocks.lastCommands.value = ['G28', 'M104 S200']
        const { wrapper } = createTestWrapper()
        await wrapper.find('textarea').trigger('keydown.up')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('M104 S200')
        await wrapper.find('textarea').trigger('keydown.up')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('G28')
        await wrapper.find('textarea').trigger('keydown.down')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('M104 S200')
        await wrapper.find('textarea').trigger('keydown.down')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
        wrapper.unmount()
    })

    it('does nothing on down when history cursor is null', async () => {
        mocks.lastCommands.value = ['G28']
        const { wrapper } = createTestWrapper()
        await wrapper.find('textarea').trigger('keydown.down')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
        wrapper.unmount()
    })

    it('does nothing on up when history is empty', async () => {
        mocks.lastCommands.value = []
        const { wrapper } = createTestWrapper()
        await setGcode(wrapper as never, 'typed')
        await wrapper.find('textarea').trigger('keydown.up')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('typed')
        wrapper.unmount()
    })

    it('autocompletes a single matching command', async () => {
        const { wrapper } = createTestWrapper()
        mocks.helplist.value = [{ command: 'G28', help: 'Home' }]
        await setGcode(wrapper as never, 'G2')
        const el = wrapper.find('textarea').element as HTMLTextAreaElement
        el.selectionStart = 2
        await wrapper.find('textarea').trigger('keydown.tab')
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain('G28')
        wrapper.unmount()
    })

    it('does nothing on autocomplete with empty input or no matches', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        await setGcode(wrapper as never, '')
        await wrapper.find('textarea').trigger('keydown.tab')
        expect(dispatched).toHaveLength(0)
        await setGcode(wrapper as never, 'ZZZ')
        const el = wrapper.find('textarea').element as HTMLTextAreaElement
        el.selectionStart = 3
        await wrapper.find('textarea').trigger('keydown.tab')
        expect(dispatched).toHaveLength(0)
        wrapper.unmount()
    })

    it('lists multiple matches and completes the common prefix', async () => {
        const { wrapper, dispatched } = createTestWrapper()
        await setGcode(wrapper as never, 'G')
        const el = wrapper.find('textarea').element as HTMLTextAreaElement
        el.selectionStart = 1
        await wrapper.find('textarea').trigger('keydown.tab')
        const events = dispatched.filter((d) => d.action === 'server/addEvent')
        expect(events.length).toBe(1)
        // longest common prefix of G28/G29 is G2
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toContain('G2')
        wrapper.unmount()
    })
})
