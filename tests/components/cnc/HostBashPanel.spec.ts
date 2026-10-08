import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import * as VuetifyComponents from 'vuetify/components'
import HostBashPanel from '@/components/panels/Cnc/HostBashPanel.vue'

const mocks = vi.hoisted(() => ({
    socketConnected: true,
    klipperState: 'ready',
    toastError: vi.fn(),
    execBash: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    terminals: [] as any[],
}))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({
        get socketIsConnected() {
            return mocks.socketConnected
        },
        get klipperState() {
            return mocks.klipperState
        },
    }),
}))

vi.mock('@/store/files/cncApi', () => ({
    execBash: mocks.execBash,
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({ error: mocks.toastError }),
}))

vi.mock('@xterm/xterm', () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Terminal: class {
        write = vi.fn()
        writeln = vi.fn()
        clear = vi.fn()
        dispose = vi.fn()
        open = vi.fn()
        loadAddon = vi.fn()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onKeyCb: ((e: any) => void) | null = null
        constructor() {
            mocks.terminals.push(this)
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onKey(cb: (e: any) => void) {
            this.onKeyCb = cb
        }
    },
}))

vi.mock('@xterm/addon-fit', () => ({
    FitAddon: class {
        fit = vi.fn()
    },
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
    if (!(globalThis as Record<string, unknown>).requestAnimationFrame) {
        ;(globalThis as Record<string, unknown>).requestAnimationFrame = () => 0
    }
})

beforeEach(() => {
    mocks.socketConnected = true
    mocks.klipperState = 'ready'
    mocks.terminals.length = 0
    mocks.execBash.mockReset()
    mocks.execBash.mockResolvedValue({ stdout: '', stderr: '', returncode: 0 })
    mocks.toastError.mockReset()
})

function createTestWrapper() {
    const vuetify = createVuetify({
        components: Object.values(VuetifyComponents) as never,
    })
    const store = createStore({
        state: { gui: { console: { height: 300 } } },
        modules: {
            socket: {
                namespaced: true,
                getters: { getUrl: () => 'http://moonraker:7125' },
            },
        },
    })
    const wrapper = mount(HostBashPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot name="buttons" /><slot /></div>' },
                VMenu: { template: '<div><slot /></div>' },
                VList: { template: '<div><slot /></div>' },
                VListItem: { template: '<div><slot /></div>' },
            },
        },
    })
    return { wrapper, store }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function keyEvent(key: string, extra: Record<string, unknown> = {}): any {
    return {
        key,
        domEvent: {
            key,
            ctrlKey: false,
            altKey: false,
            metaKey: false,
            preventDefault: () => {},
            ...extra,
        },
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function typeCommand(term: any, cmd: string) {
    for (const ch of cmd) term.onKeyCb(keyEvent(ch))
    term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
    await flushPromises()
}

describe('HostBashPanel', () => {
    it('renders the panel when the socket is connected', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(mocks.terminals).toHaveLength(1)
        wrapper.unmount()
    })

    it('hides the panel when the socket is disconnected', () => {
        mocks.socketConnected = false
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('hides the panel when klipper is disconnected', () => {
        mocks.klipperState = 'disconnected'
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        wrapper.unmount()
    })

    it('writes the welcome message and prompt on mount', () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        expect(term.writeln.mock.calls.some((c: unknown[]) => String(c[0]).includes('E3CNC Host Bash'))).toBe(true)
        expect(term.write.mock.calls.length).toBeGreaterThan(0)
        wrapper.unmount()
    })

    it('talks to the store cncApi module: execBash posts command and timeout', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        mocks.execBash.mockResolvedValueOnce({ stdout: 'hello\n', stderr: '', returncode: 0 })
        await typeCommand(term, 'echo hi')
        expect(mocks.execBash).toHaveBeenCalledWith('http://moonraker:7125', 'echo hi', 30)
        expect(term.write.mock.calls.some((c: unknown[]) => String(c[0]).includes('hello'))).toBe(true)
        wrapper.unmount()
    })

    it('renders stderr output highlighted in red', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        mocks.execBash.mockResolvedValueOnce({ stdout: '', stderr: 'boom\n', returncode: 1 })
        await typeCommand(term, 'failing-cmd')
        expect(term.write.mock.calls.some((c: unknown[]) => String(c[0]).includes('boom'))).toBe(true)
        expect(term.write.mock.calls.some((c: unknown[]) => String(c[0]).includes('[31m'))).toBe(true)
        wrapper.unmount()
    })

    it('warns on empty (null) responses from the server', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        mocks.execBash.mockResolvedValueOnce(null)
        await typeCommand(term, 'echo hi')
        expect(term.writeln.mock.calls.some((c: unknown[]) => String(c[0]).includes('No response'))).toBe(true)
        wrapper.unmount()
    })

    it('reports execBash failures in the terminal and via toast', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        mocks.execBash.mockRejectedValueOnce(new Error('net down'))
        await typeCommand(term, 'echo hi')
        expect(term.writeln.mock.calls.some((c: unknown[]) => String(c[0]).includes('net down'))).toBe(true)
        expect(mocks.toastError).toHaveBeenCalledWith('Host Bash: request failed')
        wrapper.unmount()
    })

    it('ignores empty and whitespace-only commands', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        for (const ch of '   ') term.onKeyCb(keyEvent(ch))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('ignores a second submit while a command is still running', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        let resolvePending!: (v: unknown) => void
        mocks.execBash.mockReturnValueOnce(
            new Promise((resolve) => {
                resolvePending = resolve
            }) as never
        )
        for (const ch of 'echo slow') term.onKeyCb(keyEvent(ch))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        for (const ch of 'echo queued') term.onKeyCb(keyEvent(ch))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).toHaveBeenCalledTimes(1)
        resolvePending({ stdout: 'done\n', stderr: '', returncode: 0 })
        await flushPromises()
        wrapper.unmount()
    })

    it('forwards the configured timeout to execBash', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        await wrapper.find('input').setValue('45')
        await typeCommand(term, 'sleep 1')
        expect(mocks.execBash).toHaveBeenCalledWith('http://moonraker:7125', 'sleep 1', 45)
        wrapper.unmount()
    })

    it('recalls history with ArrowUp and clears it with ArrowDown', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        await typeCommand(term, 'cmd-xyz')
        expect(mocks.execBash).toHaveBeenCalledTimes(1)
        term.onKeyCb(keyEvent('ArrowUp', { key: 'ArrowUp' }))
        term.onKeyCb(keyEvent('ArrowDown', { key: 'ArrowDown' }))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).toHaveBeenCalledTimes(1)
        term.onKeyCb(keyEvent('ArrowUp', { key: 'ArrowUp' }))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).toHaveBeenCalledTimes(2)
        expect(mocks.execBash).toHaveBeenLastCalledWith('http://moonraker:7125', 'cmd-xyz', 30)
        wrapper.unmount()
    })

    it('steps through multi-entry history with ArrowUp/ArrowDown', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        await typeCommand(term, 'first-cmd')
        await typeCommand(term, 'second-cmd')
        term.onKeyCb(keyEvent('ArrowUp', { key: 'ArrowUp' }))
        term.onKeyCb(keyEvent('ArrowUp', { key: 'ArrowUp' }))
        term.onKeyCb(keyEvent('ArrowDown', { key: 'ArrowDown' }))
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).toHaveBeenLastCalledWith('http://moonraker:7125', 'second-cmd', 30)
        wrapper.unmount()
    })

    it('edits the buffer with Backspace and tolerates it on an empty line', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        term.onKeyCb({ key: 'Backspace', domEvent: { key: 'Backspace', preventDefault: () => {} } })
        for (const ch of 'ab') term.onKeyCb(keyEvent(ch))
        term.onKeyCb({ key: 'Backspace', domEvent: { key: 'Backspace', preventDefault: () => {} } })
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).toHaveBeenCalledWith('http://moonraker:7125', 'a', 30)
        wrapper.unmount()
    })

    it('clears the line on Ctrl+C and the screen on Ctrl+L', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        for (const ch of 'partial') term.onKeyCb(keyEvent(ch))
        term.onKeyCb({ key: 'c', domEvent: { key: 'c', ctrlKey: true, preventDefault: () => {} } })
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).not.toHaveBeenCalled()
        term.onKeyCb({ key: 'l', domEvent: { key: 'l', ctrlKey: true, preventDefault: () => {} } })
        expect(term.clear).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('ignores modified and non-printable keys', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        term.onKeyCb(keyEvent('x', { ctrlKey: true }))
        term.onKeyCb(keyEvent('x', { altKey: true }))
        term.onKeyCb(keyEvent('x', { metaKey: true }))
        term.onKeyCb({ key: 'Shift', domEvent: { key: 'Shift', preventDefault: () => {} } })
        term.onKeyCb({ key: '\r', domEvent: { key: 'Enter', preventDefault: () => {} } })
        await flushPromises()
        expect(mocks.execBash).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('clears the terminal from the toolbar button', async () => {
        const { wrapper } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        await wrapper.findAll('button')[0].trigger('click')
        await nextTick()
        expect(term.clear).toHaveBeenCalled()
        wrapper.unmount()
    })

    it('survives console-height resizes and stays functional', async () => {
        const { wrapper, store } = createTestWrapper()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const term = mocks.terminals.at(-1) as any
        store.state.gui.console.height = 450
        await nextTick()
        await nextTick()
        await flushPromises()
        await typeCommand(term, 'echo after-resize')
        expect(mocks.execBash).toHaveBeenCalledWith('http://moonraker:7125', 'echo after-resize', 30)
        wrapper.unmount()
    })
})
