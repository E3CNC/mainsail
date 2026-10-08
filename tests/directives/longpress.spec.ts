import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { vLongpress } from '@/directives/longpress'

type TestableDirective = {
    mounted: (el: HTMLElement, binding: never) => void
    unmounted: (el: HTMLElement, binding: never) => void
}

const directive = vLongpress as unknown as TestableDirective

function mount(el: HTMLElement, value: unknown, arg?: unknown) {
    const addSpy = vi.spyOn(el, 'addEventListener')
    const removeSpy = vi.spyOn(el, 'removeEventListener')
    const docAddSpy = vi.spyOn(document, 'addEventListener')
    const docRemoveSpy = vi.spyOn(document, 'removeEventListener')
    directive.mounted(el, { value, arg } as never)
    const listeners = Object.fromEntries(addSpy.mock.calls.map(([type, fn]) => [type, fn])) as Record<
        string,
        (e: TouchEvent) => void
    >
    return { addSpy, removeSpy, docAddSpy, docRemoveSpy, listeners }
}

function touchEvent(type: string, touches: Partial<Touch>[] = []): TouchEvent {
    return { type, touches, preventDefault: vi.fn() } as unknown as TouchEvent
}

const fullTouch = (): Partial<Touch> => ({
    clientX: 10,
    clientY: 20,
    force: 1,
    identifier: 7,
    pageX: 10,
    pageY: 20,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    screenX: 10,
    screenY: 20,
})

describe('directives/longpress', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
        vi.restoreAllMocks()
    })

    it('warns when the binding value is neither a function nor a handler object', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const el = document.createElement('div')
        mount(el, 'not-a-function')
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('[longpress:]'))
        directive.unmounted(el, {} as never)
    })

    it('fires a plain function handler after the default debounce', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler)
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        expect(handler).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1000)
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0][0]).toMatchObject({ clientX: 10, clientY: 20, identifier: 7 })
        directive.unmounted(el, {} as never)
    })

    it('resolves { handler, args } bindings with extra args', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, { handler, args: ['a', 1] }, 100)
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        vi.advanceTimersByTime(100)
        expect(handler).toHaveBeenCalledTimes(1)
        expect(handler.mock.calls[0].slice(1)).toEqual(['a', 1])
        directive.unmounted(el, {} as never)
    })

    it('ignores clicks and touches without contact points', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler, 100)
        listeners.touchstart(touchEvent('click', [fullTouch()]))
        listeners.touchstart(touchEvent('touchstart', []))
        vi.advanceTimersByTime(5000)
        expect(handler).not.toHaveBeenCalled()
        directive.unmounted(el, {} as never)
    })

    it('does not restart the timer while a press is already pending', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler, 100)
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        vi.advanceTimersByTime(100)
        expect(handler).toHaveBeenCalledTimes(1)
        directive.unmounted(el, {} as never)
    })

    it('cancels on touchend, touchcancel, scroll and large moves', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners, docAddSpy } = mount(el, handler, 200)

        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.touchend(touchEvent('touchend'))
        vi.advanceTimersByTime(500)
        expect(handler).not.toHaveBeenCalled()

        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.touchcancel(touchEvent('touchcancel'))
        vi.advanceTimersByTime(500)
        expect(handler).not.toHaveBeenCalled()

        const scrollCancel = docAddSpy.mock.calls.find(([type]) => type === 'scroll')?.[1] as () => void
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        scrollCancel()
        vi.advanceTimersByTime(500)
        expect(handler).not.toHaveBeenCalled()

        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.touchmove(touchEvent('touchmove', [{ ...fullTouch(), clientX: 100 }]))
        vi.advanceTimersByTime(500)
        expect(handler).not.toHaveBeenCalled()
        directive.unmounted(el, {} as never)
    })

    it('keeps the timer on small moves and cancels moveless when idle', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler, 100)
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.touchmove(touchEvent('touchmove', [{ ...fullTouch(), clientX: 15, clientY: 24 }]))
        vi.advanceTimersByTime(100)
        expect(handler).toHaveBeenCalledTimes(1)

        // no pending press: touchmove without touches just cancels (no-op)
        listeners.touchmove(touchEvent('touchmove', []))
        directive.unmounted(el, {} as never)
    })

    it('prevents drags only while a press is pending', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler, 100)
        const drag = { preventDefault: vi.fn() } as unknown as Event
        listeners.dragstart(drag as unknown as TouchEvent)
        expect(drag.preventDefault).not.toHaveBeenCalled()
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        listeners.dragstart(drag as unknown as TouchEvent)
        expect(drag.preventDefault).toHaveBeenCalledTimes(1)
        directive.unmounted(el, {} as never)
    })

    it('locks text selection during the press and releases it after', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { listeners } = mount(el, handler, 100)
        listeners.touchstart(touchEvent('touchstart', [fullTouch()]))
        expect(document.querySelector('body')?.getAttribute('style')).toContain('user-select: none')
        vi.advanceTimersByTime(300)
        expect(document.querySelector('body')?.getAttribute('style')).toBe('')
        directive.unmounted(el, {} as never)
    })

    it('unmounted removes all listeners and is idempotent', () => {
        const handler = vi.fn()
        const el = document.createElement('div')
        const { removeSpy, docRemoveSpy } = mount(el, handler, 100)
        directive.unmounted(el, {} as never)
        expect(removeSpy).toHaveBeenCalledTimes(5)
        expect(docRemoveSpy).toHaveBeenCalledWith('scroll', expect.any(Function))
        // second unmount is a no-op
        directive.unmounted(el, {} as never)
        // never-mounted element is a no-op too
        directive.unmounted(document.createElement('span'), {} as never)
    })
})
