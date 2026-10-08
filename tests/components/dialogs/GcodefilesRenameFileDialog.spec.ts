import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GcodefilesRenameFileDialog from '@/components/dialogs/GcodefilesRenameFileDialog.vue'

const mocks = vi.hoisted(() => {
    return { emit: vi.fn() }
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

interface RenameVm {
    name: string
    isInvalidName: boolean
    nameInputRules: ((value: string) => boolean | string)[]
    renameFileAction: () => void
    updateIsInvalidName: (value: boolean) => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as RenameVm

const makeItem = (filename = 'benchy.gcode') =>
    ({
        isDirectory: false,
        filename,
        full_filename: filename,
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
        size: 1234,
    }) as never

const createTestWrapper = (options: { modelValue?: boolean; filename?: string; existing?: string[] } = {}) => {
    const { modelValue = true, filename = 'benchy.gcode', existing = ['benchy.gcode', 'cube.gcode'] } = options
    const vuetify = createVuetify()
    const store = createStore({
        state: {
            gui: {
                view: {
                    gcodefiles: { currentPath: '', search: '', selectedFiles: [] },
                },
            },
        },
        getters: {
            'files/getGcodeFiles': () => () => existing.map((name) => ({ filename: name })),
        },
        actions: {
            'gui/saveSetting': () => {},
        },
    })

    const wrapper = mount(GcodefilesRenameFileDialog, {
        props: { modelValue, item: makeItem(filename) },
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: {
                    props: ['title'],
                    template: '<div data-testid="panel"><span>{{ title }}</span><slot name="buttons" /><slot /></div>',
                },
                VDialog: { template: '<div><slot /></div>' },
            },
        },
    })
    return wrapper
}

describe('GcodefilesRenameFileDialog', () => {
    it('renders the rename chrome', () => {
        const wrapper = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Files.RenameFile')
        expect(wrapper.text()).toContain('Buttons.Cancel')
        expect(wrapper.text()).toContain('Files.Rename')
        wrapper.unmount()
    })

    it('prefills the current filename when the dialog opens', async () => {
        const wrapper = createTestWrapper({ modelValue: false, filename: 'cube.gcode' })
        expect(getVm(wrapper).name).toBe('')
        await wrapper.setProps({ modelValue: true } as never)
        await flushPromises()
        expect(getVm(wrapper).name).toBe('cube.gcode')
        wrapper.unmount()
    })

    it('validates empty and duplicate names', () => {
        const wrapper = createTestWrapper()
        const [required, unique] = getVm(wrapper).nameInputRules
        expect(required('')).not.toBe(true)
        expect(required('fresh.gcode')).toBe(true)
        expect(unique('benchy.gcode')).not.toBe(true)
        expect(unique('fresh.gcode')).toBe(true)
        wrapper.unmount()
    })

    it('disables the rename button while the name is invalid or empty', async () => {
        const wrapper = createTestWrapper()
        const buttons = wrapper.findAll('button')
        const renameBtn = buttons.find((b) => b.text().includes('Files.Rename'))
        if (!renameBtn) throw new Error('rename button not found')
        expect((renameBtn.element as HTMLButtonElement).disabled).toBe(true)

        await wrapper.find('input').setValue('fresh')
        getVm(wrapper).updateIsInvalidName(false)
        await flushPromises()
        expect((renameBtn.element as HTMLButtonElement).disabled).toBe(false)
        wrapper.unmount()
    })

    it('emits a move with the gcodes source and dest then closes', async () => {
        const wrapper = createTestWrapper({ filename: 'benchy.gcode' })
        await wrapper.find('input').setValue('fresh')
        getVm(wrapper).updateIsInvalidName(false)
        getVm(wrapper).renameFileAction()
        await flushPromises()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'gcodes/benchy.gcode', dest: 'gcodes/fresh' },
            { action: 'files/getMove' }
        )
        expect(wrapper.emitted('update:modelValue')).toBeTruthy()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })

    it('honours the current subdirectory when renaming', async () => {
        const vuetify = createVuetify()
        const store = createStore({
            state: { gui: { view: { gcodefiles: { currentPath: '/sub', search: '', selectedFiles: [] } } } },
            getters: { 'files/getGcodeFiles': () => () => [{ filename: 'benchy.gcode' }] },
            actions: { 'gui/saveSetting': () => {} },
        })
        const wrapper = mount(GcodefilesRenameFileDialog, {
            props: { modelValue: true, item: makeItem('benchy.gcode') },
            global: {
                plugins: [vuetify, store],
                mocks: { $t: (s: string) => s },
                stubs: {
                    Panel: { template: '<div><slot name="buttons" /><slot /></div>' },
                    VDialog: { template: '<div><slot /></div>' },
                },
            },
        })
        getVm(wrapper).updateIsInvalidName(false)
        await wrapper.find('input').setValue('fresh')
        getVm(wrapper).updateIsInvalidName(false)
        getVm(wrapper).renameFileAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'gcodes/sub/benchy.gcode', dest: 'gcodes/sub/fresh' },
            { action: 'files/getMove' }
        )
        wrapper.unmount()
    })

    it('cancels without emitting a move', async () => {
        const wrapper = createTestWrapper()
        await wrapper
            .findAll('button')
            .find((b) => b.text().includes('Buttons.Cancel'))!
            .trigger('click')
        expect(mocks.emit).not.toHaveBeenCalled()
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })
})
