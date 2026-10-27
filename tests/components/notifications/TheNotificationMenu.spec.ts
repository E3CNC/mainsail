import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import TheNotificationMenu from '@/components/notifications/TheNotificationMenu.vue'

const mocks = vi.hoisted(() => ({ dispatch: vi.fn() }))

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({ isMobile: false }),
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
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.dispatch.mockReset()
})

const makeEntry = (id: string, priority: 'normal' | 'high' | 'critical' = 'normal') => ({
    id,
    priority,
    title: `title-${id}`,
    description: `desc-${id}`,
    date: new Date('2026-01-01T00:00:00Z'),
    dismissed: false,
})

const createTestWrapper = (notifications: unknown[] = []) => {
    const vuetify = createVuetify()
    const store = createStore({
        getters: {
            'gui/notifications/getNotifications': () => notifications,
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
    const wrapper = mount(TheNotificationMenu, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                VMenu: { template: '<div><slot /><slot name="activator" /></div>' },
                'notification-menu-entry': { props: ['entry'], template: '<div class="entry-stub" />' },
                OverlayScrollbarsComponent: { template: '<div><slot /></div>' },
            },
        },
    })
    return { wrapper }
}

describe('TheNotificationMenu', () => {
    it('renders the empty state without notifications', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.text()).toContain('App.Notifications.NoNotification')
        expect(wrapper.findAll('.entry-stub')).toHaveLength(0)
        wrapper.unmount()
    })

    it('renders one entry per notification', () => {
        const { wrapper } = createTestWrapper([makeEntry('a/1'), makeEntry('a/2', 'high')])
        expect(wrapper.findAll('.entry-stub')).toHaveLength(2)
        wrapper.unmount()
    })

    it('badges the notification count and caps the label at 9+', () => {
        const { wrapper } = createTestWrapper([makeEntry('a/1')])
        expect(wrapper.findComponent({ name: 'VBadge' }).props('content')).toBe(1)
        wrapper.unmount()

        const many = createTestWrapper(Array.from({ length: 12 }, (_, i) => makeEntry(`a/${i}`)))
        expect(many.wrapper.findComponent({ name: 'VBadge' }).props('content')).toBe('9+')
        many.wrapper.unmount()
    })

    it('colors the badge by highest priority', () => {
        const normal = createTestWrapper([makeEntry('a/1')])
        expect(normal.wrapper.findComponent({ name: 'VBadge' }).props('color')).toBe('primary')
        normal.wrapper.unmount()

        const high = createTestWrapper([makeEntry('a/1'), makeEntry('a/2', 'high')])
        expect(high.wrapper.findComponent({ name: 'VBadge' }).props('color')).toBe('warning')
        high.wrapper.unmount()

        const critical = createTestWrapper([makeEntry('a/2', 'high'), makeEntry('a/3', 'critical')])
        expect(critical.wrapper.findComponent({ name: 'VBadge' }).props('color')).toBe('error')
        critical.wrapper.unmount()
    })

    it('shows dismiss-all only for multiple notifications', () => {
        const single = createTestWrapper([makeEntry('a/1')])
        expect(single.wrapper.text()).not.toContain('App.Notifications.DismissAll')
        single.wrapper.unmount()

        const multi = createTestWrapper([makeEntry('a/1'), makeEntry('a/2')])
        expect(multi.wrapper.text()).toContain('App.Notifications.DismissAll')
        multi.wrapper.unmount()
    })

    it('dismisses every notification on dismiss-all', async () => {
        const { wrapper } = createTestWrapper([makeEntry('announcement/1'), makeEntry('other/2')])
        const dismissAll = wrapper.findAll('button').find((b) => b.text().includes('App.Notifications.DismissAll'))
        expect(dismissAll).toBeTruthy()
        await dismissAll!.trigger('click')
        // announcement entries are closed and dismissed; others only dismissed
        expect(mocks.dispatch).toHaveBeenCalledWith(['close', { id: 'announcement/1' }])
        expect(mocks.dispatch).toHaveBeenCalledWith(['dismiss', { id: 'announcement/1', type: 'reboot', time: null }])
        expect(mocks.dispatch).toHaveBeenCalledWith(['dismiss', { id: 'other/2', type: 'reboot', time: null }])
        wrapper.unmount()
    })
})
