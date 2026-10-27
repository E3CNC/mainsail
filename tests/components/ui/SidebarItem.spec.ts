import { describe, expect, it, vi, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createRouter, createMemoryHistory } from 'vue-router'
import { createVuetify } from 'vuetify'
import SidebarItem from '@/components/ui/SidebarItem.vue'

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

const createTestWrapper = async (
    item: Record<string, unknown>,
    options: { navigationStyle?: string; path?: string } = {}
) => {
    const { navigationStyle = 'full', path = '/' } = options
    const vuetify = createVuetify()
    const store = createStore({
        state: { gui: { uiSettings: { navigationStyle } } },
    })
    const router = createRouter({
        history: createMemoryHistory(),
        routes: [
            { path: '/', component: { template: '<div />' } },
            { path: '/dashboard', component: { template: '<div />' } },
            { path: '/allCncMachines', component: { template: '<div />' } },
        ],
    })
    await router.push(path)
    await router.isReady()
    const wrapper = mount(SidebarItem, {
        global: {
            plugins: [vuetify, store, router],
            mocks: { $t: (s: string) => s },
        },
        props: { item } as never,
    })
    return { wrapper }
}

describe('SidebarItem', () => {
    it('renders the item title', async () => {
        const { wrapper } = await createTestWrapper({
            icon: 'mdi-view-dashboard',
            title: 'Dashboard',
            to: '/dashboard',
        })
        expect(wrapper.text()).toContain('Dashboard')
        wrapper.unmount()
    })

    it('marks the item active when the route matches', async () => {
        const { wrapper } = await createTestWrapper(
            { icon: 'mdi-view-dashboard', title: 'Dashboard', to: '/dashboard' },
            { path: '/dashboard' }
        )
        expect(wrapper.find('.active-nav-item').exists()).toBe(true)
        wrapper.unmount()
    })

    it('leaves the item inactive on other routes', async () => {
        const { wrapper } = await createTestWrapper(
            { icon: 'mdi-view-dashboard', title: 'Dashboard', to: '/dashboard' },
            { path: '/' }
        )
        expect(wrapper.find('.active-nav-item').exists()).toBe(false)
        wrapper.unmount()
    })

    it('renders an external link with target _blank as inactive', async () => {
        const { wrapper } = await createTestWrapper({
            icon: 'mdi-web',
            title: 'Docs',
            href: 'https://example.com',
            target: '_blank',
        })
        expect(wrapper.find('.active-nav-item').exists()).toBe(false)
        expect(wrapper.find('a').attributes('href')).toBe('https://example.com')
        wrapper.unmount()
    })

    it('renders a divider below the farm overview entry', async () => {
        const { wrapper } = await createTestWrapper({ icon: 'mdi-server', title: 'Machines', to: '/allCncMachines' })
        expect(wrapper.find('.v-divider').exists()).toBe(true)
        wrapper.unmount()
    })

    it('renders no divider for regular entries', async () => {
        const { wrapper } = await createTestWrapper({
            icon: 'mdi-view-dashboard',
            title: 'Dashboard',
            to: '/dashboard',
        })
        expect(wrapper.find('.v-divider').exists()).toBe(false)
        wrapper.unmount()
    })

    it('wraps the item in a tooltip in icons-only mode', async () => {
        const { wrapper } = await createTestWrapper(
            { icon: 'mdi-view-dashboard', title: 'Dashboard', to: '/dashboard' },
            { navigationStyle: 'iconsOnly' }
        )
        expect(wrapper.text()).toContain('Dashboard')
        expect(wrapper.html()).toContain('v-tooltip')
        wrapper.unmount()
    })
})
