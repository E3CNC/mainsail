import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mount } from '@vue/test-utils'
import { useSocket, SOCKET_KEY } from '@/composables/useSocket'

const socketStub = { emit: () => undefined }

const Consumer = defineComponent({
    setup() {
        let result: unknown
        let error: unknown
        try {
            result = useSocket()
        } catch (e) {
            error = e
        }
        return () => h('div', error ? 'error' : result ? 'ok' : 'none')
    },
})

describe('useSocket', () => {
    it('returns the injected socket when provided', () => {
        const wrapper = mount(Consumer, {
            global: { provide: { [SOCKET_KEY as symbol]: socketStub } },
        })
        expect(wrapper.text()).toBe('ok')
    })

    it('throws when no socket is provided', () => {
        const wrapper = mount(Consumer)
        expect(wrapper.text()).toBe('error')
    })
})
