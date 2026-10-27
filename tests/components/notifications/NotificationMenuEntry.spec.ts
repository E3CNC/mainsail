import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import NotificationMenuEntry from '@/components/notifications/NotificationMenuEntry.vue'

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }))

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

const baseEntry = {
    id: 'announcement/1',
    priority: 'normal',
    title: 'Firmware update',
    description: 'See https://example.com for details',
    date: new Date('2026-01-01T00:00:00Z'),
    dismissed: false,
}

const createTestWrapper = (
    entry: Record<string, unknown> = {},
    options: { parentState?: boolean; maintenanceEntries?: unknown[] } = {}
) => {
    const vuetify = createVuetify()
    const store = createStore({
        getters: {
            'gui/maintenance/getEntries': () => options.maintenanceEntries ?? [],
        },
        actions: {
            'gui/notifications/close': (_ctx: never, payload: never) => {
                mocks.dispatch(['close', payload])
            },
            'gui/notifications/dismiss': (_ctx: never, payload: never) => {
                mocks.dispatch(['dismiss', payload])
            },
        },
    })
    const wrapper = mount(NotificationMenuEntry, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                'history-list-panel-detail-maintenance': {
                    props: ['modelValue'],
                    template: '<div class="maintenance-stub" />',
                },
            },
        },
        props: { entry: { ...baseEntry, ...entry }, parentState: options.parentState } as never,
    })
    return { wrapper }
}

describe('NotificationMenuEntry', () => {
    it('renders the title and linkifies urls in the description', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('Firmware update')
        expect(wrapper.html()).toContain('href="https://example.com"')
        wrapper.unmount()
    })

    it('renders an external link headline when the entry has a url', () => {
        const { wrapper } = createTestWrapper({ url: 'https://example.com/release' })
        const link = wrapper.find('a')
        expect(link.exists()).toBe(true)
        expect(link.attributes('href')).toBe('https://example.com/release')
        wrapper.unmount()
    })

    it('maps priorities to alert colors', () => {
        const critical = createTestWrapper({ id: 'other/9', priority: 'critical' })
        expect(critical.wrapper.findComponent({ name: 'VAlert' }).props('color')).toBe('error')
        critical.wrapper.unmount()

        const high = createTestWrapper({ id: 'other/9', priority: 'high' })
        expect(high.wrapper.findComponent({ name: 'VAlert' }).props('color')).toBe('warning')
        high.wrapper.unmount()

        const normal = createTestWrapper()
        expect(normal.wrapper.findComponent({ name: 'VAlert' }).props('color')).toBe('info')
        normal.wrapper.unmount()
    })

    it('dismisses a non-announcement entry with the close button', async () => {
        const { wrapper } = createTestWrapper({ id: 'other/9' })
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith(['dismiss', { id: 'other/9', type: 'reboot', time: null }])
        wrapper.unmount()
    })

    it('closes an announcement entry with the close button', async () => {
        const { wrapper } = createTestWrapper()
        const buttons = wrapper.findAll('button')
        await buttons[0].trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith(['close', { id: 'announcement/1' }])
        wrapper.unmount()
    })

    it('hides the action column for critical entries', () => {
        const { wrapper } = createTestWrapper({ id: 'other/9', priority: 'critical' })
        // no close / bell buttons rendered for critical priority
        expect(wrapper.findAll('button')).toHaveLength(0)
        wrapper.unmount()
    })

    it('offers time-based reminders for announcements', async () => {
        const { wrapper } = createTestWrapper()
        // expand the reminder row via the bell button (second button)
        const buttons = wrapper.findAll('button')
        await buttons[1].trigger('click')
        const reminder = wrapper.findAll('button').find((b) => b.text().includes('App.Notifications.OneHourShort'))
        expect(reminder).toBeTruthy()
        await reminder!.trigger('click')
        expect(mocks.dispatch).toHaveBeenCalledWith(['dismiss', { id: 'announcement/1', type: 'time', time: 3600 }])
        wrapper.unmount()
    })

    it('shows the maintenance details button for maintenance entries', () => {
        const { wrapper } = createTestWrapper(
            { id: 'maintenance/abc', priority: 'high' },
            { maintenanceEntries: [{ id: 'abc' }] }
        )
        expect(wrapper.text()).toContain('App.Notifications.ShowDetails')
        expect(wrapper.find('.maintenance-stub').exists()).toBe(true)
        wrapper.unmount()
    })

    it('collapses the reminder row when the parent menu closes', async () => {
        const { wrapper } = createTestWrapper({}, { parentState: true })
        const buttons = wrapper.findAll('button')
        await buttons[1].trigger('click')
        const reminderRow = () => wrapper.find('.pt-1.w-100').element as HTMLElement
        expect(reminderRow().style.display).not.toBe('none')
        await wrapper.setProps({ parentState: false })
        expect(reminderRow().style.display).toBe('none')
        wrapper.unmount()
    })
})
