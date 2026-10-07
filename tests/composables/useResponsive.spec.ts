import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { mount } from '@vue/test-utils'

vi.mock('@/composables/useBase', () => ({
    useBase: () => ({}),
}))

import { useResponsive } from '@/composables/useResponsive'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let resizeCallback: ((entries: any[]) => void) | null = null

const Consumer = defineComponent({
    setup() {
        const { el, targetRef } = useResponsive({
            narrow: (rect: DOMRect) => rect.width < 200,
        })
        return { el, targetRef }
    },
    render() {
        return h('div', { ref: 'target' }, (this.el as { is: Record<string, boolean> }).is.narrow ? 'n' : 'w')
    },
})

describe('useResponsive', () => {
    beforeEach(() => {
        resizeCallback = null
        vi.stubGlobal(
            'ResizeObserver',
            class {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                constructor(cb: any) {
                    resizeCallback = cb
                }
                observe() {}
                unobserve() {}
                disconnect() {}
            }
        )
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('evaluates breakpoints on resize entries', async () => {
        const wrapper = mount(Consumer, {
            global: {
                stubs: {},
            },
        })
        await nextTick()
        await nextTick()
        expect(resizeCallback).not.toBeNull()
        resizeCallback?.([{ contentRect: { width: 100, height: 50 } }])
        await nextTick()
        expect(wrapper.text()).toBe('n')
        resizeCallback?.([{ contentRect: { width: 400, height: 50 } }])
        // lodash throttle suppresses the second call inside its 50ms window;
        // wait out the trailing invocation, then flush reactivity.
        await new Promise((r) => setTimeout(r, 120))
        await nextTick()
        expect(wrapper.text()).toBe('w')
        wrapper.unmount()
    })

    it('ignores zero-size entries', async () => {
        const wrapper = mount(Consumer)
        await nextTick()
        await nextTick()
        resizeCallback?.([{ contentRect: { width: 0, height: 0 } }])
        await nextTick()
        expect(wrapper.text()).toBe('w')
        wrapper.unmount()
    })

    it('works without breakpoints', () => {
        const Plain = defineComponent({
            setup() {
                return useResponsive()
            },
            render() {
                return h('div', 'plain')
            },
        })
        const wrapper = mount(Plain)
        expect(wrapper.text()).toBe('plain')
        wrapper.unmount()
    })
})
