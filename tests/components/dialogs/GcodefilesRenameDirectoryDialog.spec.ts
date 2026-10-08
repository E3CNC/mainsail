import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import GcodefilesRenameDirectoryDialog from '@/components/dialogs/GcodefilesRenameDirectoryDialog.vue'

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

interface RenameDirVm {
    name: string
    isInvalidName: boolean
    nameInputRules: ((value: string) => boolean | string)[]
    renameDirectoryAction: () => void
    updateIsInvalidName: (value: boolean) => void
}

const getVm = (wrapper: ReturnType<typeof mount>) => wrapper.vm as unknown as RenameDirVm

const makeItem = (filename = 'parts') =>
    ({
        isDirectory: true,
        filename,
        full_filename: filename,
        modified: new Date('2024-01-02T03:04:05Z'),
        permissions: 'rw',
    }) as never

const createTestWrapper = (options: { modelValue?: boolean; filename?: string; existing?: string[] } = {}) => {
    const { modelValue = true, filename = 'parts', existing = ['parts', 'archive'] } = options
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

    return mount(GcodefilesRenameDirectoryDialog, {
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
}

describe('GcodefilesRenameDirectoryDialog', () => {
    it('renders the rename-directory chrome', () => {
        const wrapper = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('Files.RenameDirectory')
        expect(wrapper.text()).toContain('Buttons.Cancel')
        wrapper.unmount()
    })

    it('prefills the directory name when the dialog opens', async () => {
        const wrapper = createTestWrapper({ modelValue: false, filename: 'archive' })
        expect(getVm(wrapper).name).toBe('')
        await wrapper.setProps({ modelValue: true } as never)
        await flushPromises()
        expect(getVm(wrapper).name).toBe('archive')
        wrapper.unmount()
    })

    it('validates empty and duplicate directory names', () => {
        const wrapper = createTestWrapper()
        const [required, unique] = getVm(wrapper).nameInputRules
        expect(required('')).not.toBe(true)
        expect(required('fresh')).toBe(true)
        expect(unique('parts')).not.toBe(true)
        expect(unique('fresh')).toBe(true)
        wrapper.unmount()
    })

    it('disables the action while the name is invalid or empty', async () => {
        const wrapper = createTestWrapper()
        const renameBtn = wrapper.findAll('button').find((b) => b.text().includes('Files.Rename'))
        if (!renameBtn) throw new Error('rename button not found')
        expect((renameBtn.element as HTMLButtonElement).disabled).toBe(true)

        await wrapper.find('input').setValue('fresh')
        getVm(wrapper).updateIsInvalidName(false)
        await flushPromises()
        expect((renameBtn.element as HTMLButtonElement).disabled).toBe(false)
        wrapper.unmount()
    })

    it('emits a directory move then closes', async () => {
        const wrapper = createTestWrapper({ filename: 'parts' })
        await wrapper.find('input').setValue('fresh')
        getVm(wrapper).updateIsInvalidName(false)
        getVm(wrapper).renameDirectoryAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'gcodes/parts', dest: 'gcodes/fresh' },
            { action: 'files/getMove' }
        )
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
        wrapper.unmount()
    })

    it('includes the current path in the move payload', () => {
        const vuetify = createVuetify()
        const store = createStore({
            state: { gui: { view: { gcodefiles: { currentPath: '/sub', search: '', selectedFiles: [] } } } },
            getters: { 'files/getGcodeFiles': () => () => [{ filename: 'parts' }] },
            actions: { 'gui/saveSetting': () => {} },
        })
        const wrapper = mount(GcodefilesRenameDirectoryDialog, {
            props: { modelValue: true, item: makeItem('parts') },
            global: {
                plugins: [vuetify, store],
                mocks: { $t: (s: string) => s },
                stubs: {
                    Panel: { template: '<div><slot name="buttons" /><slot /></div>' },
                    VDialog: { template: '<div><slot /></div>' },
                },
            },
        })
        const vm = getVm(wrapper)
        vm.name = 'fresh'
        vm.renameDirectoryAction()
        expect(mocks.emit).toHaveBeenCalledWith(
            'server.files.move',
            { source: 'gcodes/sub/parts', dest: 'gcodes/sub/fresh' },
            { action: 'files/getMove' }
        )
        expect(wrapper.emitted('update:modelValue')![0]).toEqual([false])
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
