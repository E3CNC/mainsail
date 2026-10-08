import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import TheMacroPrompt from '@/components/dialogs/TheMacroPrompt.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
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
})

beforeEach(() => {
    mocks.emit.mockReset()
})

interface PromptRaw {
    type: string
    promptType: string
    message: string
    date?: Date
}

const toEvent = (raw: PromptRaw, index: number) => ({
    date: raw.date ?? new Date(1700000000000 + index * 1000),
    type: raw.type,
    message: raw.promptType === '__raw__' ? raw.message : `// action:prompt_${raw.promptType} ${raw.message}`,
    formatMessage: raw.message,
})

const createTestWrapper = (promptRaws: PromptRaw[] = []) => {
    const vuetify = createVuetify()
    const dispatch = vi.fn()
    const events = promptRaws.map((raw, index) => toEvent(raw, index))

    const store = createStore({
        state: {
            socket: { isConnected: true, hostname: '127.0.0.1', port: 7125, initializationList: [] },
            server: {
                klippy_connected: true,
                klippy_state: 'ready',
                components: [],
                events,
            },
            printer: { print_stats: { state: 'standby' } },
            gui: {},
        },
        getters: {
            'socket/getUrl': () => 'http://127.0.0.1:7125',
            'socket/getHostUrl': () => 'http://127.0.0.1',
            'server/power/getDevices': () => [],
        },
        actions: {
            'server/addEvent': (_ctx: never, payload: never) => dispatch(payload),
        },
    })

    const wrapper = mount(TheMacroPrompt, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                VDialog: {
                    props: ['modelValue'],
                    template: '<div v-if="modelValue"><slot /></div>',
                },
                VCardText: { template: '<div><slot /></div>' },
                VCardActions: { template: '<div><slot /></div>' },
                VSpacer: { template: '<div />' },
                Panel: {
                    props: ['title', 'icon'],
                    template:
                        '<div data-testid="macro-panel" :data-title="title"><div data-testid="macro-buttons"><slot name="buttons" /></div><slot /><slot name="buttons" /></div>',
                },
                MacroPromptText: {
                    props: ['event'],
                    template: '<div data-testid="prompt-text">{{ event.message }}</div>',
                },
                MacroPromptButtonGroup: {
                    props: ['groupIndex', 'children'],
                    template:
                        '<div data-testid="prompt-group" :data-count="children.length">{{ children.map(c => c.message).join("|") }}</div>',
                },
                MacroPromptFooterButton: {
                    props: ['event'],
                    template: '<div data-testid="prompt-footer">{{ event.message }}</div>',
                },
            },
        },
    })

    return { wrapper, store, dispatch, events }
}

describe('TheMacroPrompt', () => {
    it('renders nothing when no events exist', async () => {
        const { wrapper } = createTestWrapper([])
        await flushPromises()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('stays hidden for a begin without a show', async () => {
        const { wrapper } = createTestWrapper([{ type: 'action', promptType: 'begin', message: 'Pick one' }])
        await flushPromises()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('ignores non-prompt action events', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: '__raw__', message: 'M104 S200' } as unknown as PromptRaw,
            { type: 'action', promptType: 'begin', message: 'Heads' },
            { type: 'action', promptType: 'text', message: 'hello world' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="macro-panel"]').attributes('data-title')).toBe('Heads')
        expect(wrapper.find('[data-testid="prompt-text"]').text()).toBe('hello world')
        wrapper.unmount()
    })

    it('shows headline and text content for a basic prompt', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Confirm filament' },
            { type: 'action', promptType: 'text', message: 'Load PLA?' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        await nextTick()
        const panel = wrapper.find('[data-testid="macro-panel"]')
        expect(panel.exists()).toBe(true)
        expect(panel.attributes('data-title')).toBe('Confirm filament')
        expect(wrapper.find('[data-testid="prompt-text"]').text()).toBe('Load PLA?')
        wrapper.unmount()
    })

    it('groups button_group_start/end into a single group', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Choose' },
            { type: 'action', promptType: 'button_group_start', message: '' },
            { type: 'action', promptType: 'button', message: 'Yes' },
            { type: 'action', promptType: 'button', message: 'No' },
            { type: 'action', promptType: 'button_group_end', message: '' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        await nextTick()
        const groups = wrapper.findAll('[data-testid="prompt-group"]')
        expect(groups).toHaveLength(1)
        expect(groups[0].attributes('data-count')).toBe('2')
        expect(groups[0].text()).toContain('Yes')
        expect(groups[0].text()).toContain('No')
        wrapper.unmount()
    })

    it('wraps a lone button into a group of one', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Solo' },
            { type: 'action', promptType: 'button', message: 'OK' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        await nextTick()
        const groups = wrapper.findAll('[data-testid="prompt-group"]')
        expect(groups).toHaveLength(1)
        expect(groups[0].attributes('data-count')).toBe('1')
        wrapper.unmount()
    })

    it('renders footer buttons below the content', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Foot' },
            { type: 'action', promptType: 'text', message: 'body' },
            { type: 'action', promptType: 'footer_button', message: 'Cancel' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        await nextTick()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(true)
        expect(wrapper.find('[data-testid="prompt-footer"]').text()).toBe('Cancel')
        wrapper.unmount()
    })

    it('hides the dialog after a prompt_end event', async () => {
        const { wrapper } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Gone' },
            { type: 'action', promptType: 'text', message: 'bye' },
            { type: 'action', promptType: 'show', message: '' },
            { type: 'action', promptType: 'end', message: '' },
        ])
        await flushPromises()
        await nextTick()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('closes via the X button with dispatch and socket emit', async () => {
        const { wrapper, dispatch } = createTestWrapper([
            { type: 'action', promptType: 'begin', message: 'Close me' },
            { type: 'action', promptType: 'text', message: 'body text' },
            { type: 'action', promptType: 'show', message: '' },
        ])
        await flushPromises()
        await nextTick()
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(true)
        const closeBtn = wrapper.find('[data-testid="macro-buttons"] button')
        expect(closeBtn.exists()).toBe(true)
        await closeBtn.trigger('click')
        await nextTick()
        const expected = 'RESPOND type="command" msg="action:prompt_end"'
        expect(dispatch).toHaveBeenCalledWith({ message: expected, type: 'command' })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: expected })
        // dialog hides after internal close
        expect(wrapper.find('[data-testid="macro-panel"]').exists()).toBe(false)
        wrapper.unmount()
    })
})
