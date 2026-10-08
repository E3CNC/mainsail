import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import Codemirror from '@/components/inputs/Codemirror.vue'

const mocks = vi.hoisted(() => ({
    docContent: 'initial',
    updateListenerCb: null as ((update: unknown) => void) | null,
    setStateCalls: [] as unknown[],
    dispatchCalls: [] as unknown[],
    destroyCount: 0,
    themeMode: { value: 'dark', __v_isRef: true },
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

vi.mock('@/composables/useTheme', () => ({
    useTheme: () => ({ themeMode: mocks.themeMode }),
}))

vi.mock('codemirror', () => ({
    basicSetup: {},
}))

vi.mock('@codemirror/view', () => {
    class MockWidgetType {}
    const Decoration = {
        none: {},
        widget: () => ({ range: () => ({}) }),
        mark: () => ({ range: () => ({}) }),
        set: () => ({}),
    }
    const keymap = { of: (x: unknown) => x }
    class MockEditorView {
        static updateListener = {
            of: (cb: (update: unknown) => void) => {
                mocks.updateListenerCb = cb
                return { mockedUpdateListener: true }
            },
        }
        static theme = () => ({ mockedTheme: true })
        parent: unknown
        state: {
            doc: {
                toString: () => string
                lines: number
                line: (n: number) => { from: number; to: number }
                lineAt: (pos: number) => { number: number }
            }
            selection: { main: { head: number } }
        }
        scrollDOM = null
        constructor(opts: { parent: unknown }) {
            this.parent = opts.parent
            this.state = {
                doc: {
                    toString: () => mocks.docContent,
                    lines: 5,
                    line: () => ({ from: 0, to: 5 }),
                    lineAt: () => ({ number: 2 }),
                },
                selection: { main: { head: 0 } },
            }
        }
        setState = (state: { doc: string }) => {
            mocks.setStateCalls.push(state)
            const content = typeof state.doc === 'string' ? state.doc : ''
            mocks.docContent = content
            this.state = {
                doc: {
                    toString: () => mocks.docContent,
                    lines: 5,
                    line: () => ({ from: 0, to: 5 }),
                    lineAt: () => ({ number: 2 }),
                },
                selection: { main: { head: 0 } },
            }
        }
        destroy = () => {
            mocks.destroyCount += 1
        }
        dispatch = (tr: unknown) => {
            mocks.dispatchCalls.push(tr)
        }
        focus = vi.fn()
        coordsAtPos = () => null
    }
    return { EditorView: MockEditorView, keymap, WidgetType: MockWidgetType, Decoration }
})

vi.mock('@codemirror/state', () => ({
    EditorState: {
        create: (opts: { doc: string }) => ({ doc: opts.doc }),
    },
    StateEffect: {
        define: () => ({ of: (v: unknown) => ({ value: v }) }),
    },
    StateField: {
        define: (def: unknown) => def,
    },
}))

vi.mock('@uiw/codemirror-theme-vscode', () => ({
    vscodeDark: { mocked: 'dark' },
    vscodeLight: { mocked: 'light' },
}))

vi.mock('@codemirror/language', () => ({
    StreamLanguage: { define: (x: unknown) => x },
    indentUnit: { of: (x: unknown) => x },
}))

vi.mock('@/plugins/StreamParserKlipperConfig', () => ({
    klipper_config: { mocked: 'klipper' },
}))

vi.mock('@/plugins/StreamParserGcode', () => ({
    gcode: { mocked: 'gcode' },
}))

vi.mock('@codemirror/commands', () => ({
    insertTab: () => true,
    indentLess: () => true,
}))

vi.mock('@codemirror/lang-json', () => ({
    json: () => ({ mocked: 'json' }),
}))

vi.mock('@codemirror/lang-css', () => ({
    css: () => ({ mocked: 'css' }),
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
    if (!(globalThis as Record<string, unknown>).requestAnimationFrame) {
        ;(globalThis as Record<string, unknown>).requestAnimationFrame = (cb: () => void) => {
            cb()
            return 0
        }
    }
})

beforeEach(() => {
    mocks.docContent = 'initial'
    mocks.updateListenerCb = null
    mocks.setStateCalls = []
    mocks.dispatchCalls = []
    mocks.destroyCount = 0
    mocks.themeMode.value = 'dark'
})

const createTestWrapper = (props: Record<string, unknown> = {}, tabSize = 2) => {
    const vuetify = createVuetify()
    const store = createStore({
        state: {
            gui: {
                editor: { tabSize },
                uiSettings: { mode: 'dark' },
            },
        },
    })
    const wrapper = mount(Codemirror, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            directives: {
                'observe-visibility': {},
            },
        },
        props: { ...props } as never,
    })
    return { wrapper }
}

describe('Codemirror', () => {
    it('emits ready on mount', async () => {
        const { wrapper } = createTestWrapper({ modelValue: 'hello' })
        await nextTick()
        await nextTick()
        expect(wrapper.emitted('ready')).toBeTruthy()
        wrapper.unmount()
    })

    it('initializes with modelValue', async () => {
        const { wrapper } = createTestWrapper({ modelValue: 'G28' })
        await nextTick()
        await nextTick()
        expect(mocks.setStateCalls.length).toBeGreaterThan(0)
        const last = mocks.setStateCalls[mocks.setStateCalls.length - 1] as { doc: string }
        expect(last.doc).toBe('G28')
        wrapper.unmount()
    })

    it('falls back to code prop when modelValue is absent', async () => {
        const { wrapper } = createTestWrapper({ code: 'M104' })
        await nextTick()
        await nextTick()
        const last = mocks.setStateCalls[mocks.setStateCalls.length - 1] as { doc: string }
        expect(last.doc).toBe('M104')
        wrapper.unmount()
    })

    it('falls back to value prop and empty string', async () => {
        const withValue = createTestWrapper({ value: 'V1' })
        await nextTick()
        await nextTick()
        expect((mocks.setStateCalls[mocks.setStateCalls.length - 1] as { doc: string }).doc).toBe('V1')
        withValue.wrapper.unmount()

        mocks.setStateCalls = []
        const empty = createTestWrapper({})
        await nextTick()
        await nextTick()
        expect((mocks.setStateCalls[mocks.setStateCalls.length - 1] as { doc: string }).doc).toBe('')
        empty.wrapper.unmount()
    })

    it('updates editor when modelValue changes', async () => {
        const { wrapper } = createTestWrapper({ modelValue: 'A' })
        await nextTick()
        await nextTick()
        mocks.setStateCalls = []
        mocks.docContent = 'A'
        await wrapper.setProps({ modelValue: 'B' } as never)
        await nextTick()
        expect(mocks.setStateCalls.length).toBeGreaterThan(0)
        wrapper.unmount()
    })

    it('does not reset when new value equals editor content', async () => {
        const { wrapper } = createTestWrapper({ modelValue: 'same' })
        await nextTick()
        await nextTick()
        mocks.docContent = 'same'
        mocks.setStateCalls = []
        await wrapper.setProps({ modelValue: 'same' } as never)
        await nextTick()
        expect(mocks.setStateCalls).toHaveLength(0)
        wrapper.unmount()
    })

    it('emits input and update:modelValue on doc change', async () => {
        const { wrapper } = createTestWrapper({ modelValue: 'x' })
        await nextTick()
        await nextTick()
        expect(mocks.updateListenerCb).toBeTruthy()
        mocks.updateListenerCb!({ selectionSet: false, state: { doc: { toString: () => 'new content' } } })
        await nextTick()
        expect(wrapper.emitted('input')).toEqual([['new content']])
        expect(wrapper.emitted('update:modelValue')).toEqual([['new content']])
        wrapper.unmount()
    })

    it('does not emit when content is empty', async () => {
        const { wrapper } = createTestWrapper({})
        await nextTick()
        await nextTick()
        mocks.updateListenerCb!({ selectionSet: false, state: { doc: { toString: () => '' } } })
        await nextTick()
        expect(wrapper.emitted('input')).toBeFalsy()
        wrapper.unmount()
    })

    it('emits lineChange on selection change', async () => {
        const { wrapper } = createTestWrapper({})
        await nextTick()
        await nextTick()
        mocks.updateListenerCb!({ selectionSet: true, state: { doc: { toString: () => 'abc' } } })
        await nextTick()
        expect(wrapper.emitted('lineChange')).toBeTruthy()
        wrapper.unmount()
    })

    it('dispatches annotations for validationErrors', async () => {
        const { wrapper } = createTestWrapper({ validationErrors: [{ line: 1, severity: 'error' }] })
        await nextTick()
        await nextTick()
        expect(mocks.dispatchCalls.length).toBeGreaterThan(0)
        wrapper.unmount()
    })

    it('clears annotations when errors are empty', async () => {
        const { wrapper } = createTestWrapper({ validationErrors: [] })
        await nextTick()
        await nextTick()
        // clearAnnotations dispatches empty effects
        expect(mocks.dispatchCalls.length).toBeGreaterThan(0)
        wrapper.unmount()
    })

    it('supports cfg, gcode, json and css extensions without crashing', async () => {
        for (const ext of ['cfg', 'gcode', 'json', 'css']) {
            const { wrapper } = createTestWrapper({ modelValue: 'x', fileExtension: ext })
            await nextTick()
            await nextTick()
            expect(wrapper.emitted('ready')).toBeTruthy()
            wrapper.unmount()
        }
    })

    it('exposes gotoLine and handles out-of-range gracefully', async () => {
        const { wrapper } = createTestWrapper({})
        await nextTick()
        await nextTick()
        const vm = wrapper.vm as unknown as { gotoLine: (n: number) => void }
        expect(() => vm.gotoLine(1)).not.toThrow()
        expect(() => vm.gotoLine(999)).not.toThrow()
        wrapper.unmount()
    })

    it('destroys the editor on unmount', async () => {
        const { wrapper } = createTestWrapper({})
        await nextTick()
        wrapper.unmount()
        expect(mocks.destroyCount).toBeGreaterThan(0)
    })
})
