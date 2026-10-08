import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { vResponsiveClass } from '@/directives/responsive-class'

type TestableDirective = {
    mounted: (el: HTMLElement, binding: never) => void
    unmounted: (el: HTMLElement, binding: never) => void
}

const directive = vResponsiveClass as unknown as TestableDirective

describe('directives/responsive-class', () => {
    let observe: ReturnType<typeof vi.fn>
    let disconnect: ReturnType<typeof vi.fn>
    let callback: (entries: ResizeObserverEntry[]) => void

    beforeEach(() => {
        vi.useFakeTimers()
        observe = vi.fn()
        disconnect = vi.fn()
        vi.stubGlobal(
            'ResizeObserver',
            vi.fn((cb: (entries: ResizeObserverEntry[]) => void) => {
                callback = cb
                return { observe, disconnect }
            })
        )
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
    })

    function resize(width: number) {
        callback([{ contentRect: { width } } as ResizeObserverEntry])
        vi.advanceTimersByTime(50)
    }

    it('toggles breakpoint classes from the content rect', () => {
        const el = document.createElement('div')
        directive.mounted(el, {
            value: {
                narrow: (cr: { width: number }) => cr.width < 100,
                wide: (cr: { width: number }) => cr.width >= 100,
            },
        } as never)
        expect(observe).toHaveBeenCalledWith(el)

        resize(50)
        expect(el.classList.contains('narrow')).toBe(true)
        expect(el.classList.contains('wide')).toBe(false)

        resize(200)
        expect(el.classList.contains('narrow')).toBe(false)
        expect(el.classList.contains('wide')).toBe(true)
        directive.unmounted(el, {} as never)
    })

    it('unmounted disconnects the observer and is idempotent', () => {
        const el = document.createElement('div')
        directive.mounted(el, { value: {} } as never)
        directive.unmounted(el, {} as never)
        expect(disconnect).toHaveBeenCalledTimes(1)
        // second unmount is a no-op
        directive.unmounted(el, {} as never)
        // never-mounted element is a no-op too
        directive.unmounted(document.createElement('span'), {} as never)
    })
})
