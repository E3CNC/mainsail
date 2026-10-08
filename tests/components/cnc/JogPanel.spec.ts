import { describe, expect, it, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper, type DOMWrapper } from '@vue/test-utils'
import { createStore } from 'vuex'
import { createVuetify } from 'vuetify'
import { nextTick } from 'vue'
import JogPanel from '@/components/panels/Cnc/JogPanel.vue'

const mocks = vi.hoisted(() => {
    return {
        emit: vi.fn(),
        updateCncSettings: vi.fn(),
        toastError: vi.fn(),
        toastWarning: vi.fn(),
        toastDismiss: vi.fn(),
    }
})

vi.mock('@/composables/useSocket', () => ({
    useSocket: () => ({ emit: mocks.emit }),
}))

vi.mock('@/store/files/cncApi', () => ({
    updateCncSettings: (...args: unknown[]) => mocks.updateCncSettings(...args),
}))

vi.mock('vue-toast-notification', () => ({
    useToast: () => ({
        error: (...args: unknown[]) => mocks.toastError(...args),
        warning: (...args: unknown[]) => {
            mocks.toastWarning(...args)
            return { dismiss: (...dismissArgs: unknown[]) => mocks.toastDismiss(...dismissArgs) }
        },
        success: vi.fn(),
        info: vi.fn(),
    }),
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
                removeEventListener: () => {},
                dispatchEvent: () => false,
            })),
        })
    }
})

beforeEach(() => {
    mocks.emit.mockReset()
    mocks.toastError.mockReset()
    mocks.toastWarning.mockReset()
    mocks.toastDismiss.mockReset()
    mocks.updateCncSettings.mockReset()
    mocks.updateCncSettings.mockResolvedValue(null)
})

afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
})

interface JogOptions {
    klippyReady?: boolean
    printerState?: string
    homedAxes?: string
    stepIndex?: number
    feedrateXY?: number
    feedrateZ?: number
    maxVelocity?: number | null
    speedFactor?: number
}

const SOCKET_URL = 'http://127.0.0.1:7125'

const createTestWrapper = (options: JogOptions = {}) => {
    const {
        klippyReady = true,
        printerState = 'standby',
        homedAxes = 'xyz',
        stepIndex = 2,
        feedrateXY = 500,
        feedrateZ = 100,
        maxVelocity = 50,
        speedFactor = 1,
    } = options

    const vuetify = createVuetify()

    const state = {
        socket: {
            isConnected: true,
            hostname: '127.0.0.1',
            port: 7125,
            initializationList: [],
        },
        server: {
            klippy_connected: klippyReady,
            klippy_state: klippyReady ? 'ready' : 'disconnected',
            loadings: [],
        },
        printer: {
            print_stats: { state: printerState },
            toolhead: {
                homed_axes: homedAxes,
                ...(maxVelocity === null ? {} : { max_velocity: maxVelocity }),
            },
            gcode_move: { speed_factor: speedFactor },
        },
        gui: {
            control: {
                selectedCncStepIndex: stepIndex,
                cncFeedrateXY: feedrateXY,
                cncFeedrateZ: feedrateZ,
            },
        },
    }

    const store = createStore({
        state,
        getters: {
            'socket/getUrl': () => SOCKET_URL,
        },
        actions: {
            'gui/saveSetting': (context: never, payload: never) => {
                // Mutate through the vuex context state (the reactive proxy),
                // not the raw object, so computed values update.
                const ctx = context as unknown as {
                    state: { gui: { control: Record<string, unknown> } }
                }
                const parsed = payload as unknown as { name: string; value: unknown }
                const key = parsed.name.split('.')[1]
                if (key) ctx.state.gui.control[key] = parsed.value
            },
            'server/addEvent': () => {},
        },
    })
    const dispatchSpy = vi.spyOn(store, 'dispatch')

    const wrapper = mount(JogPanel, {
        global: {
            plugins: [vuetify, store],
            mocks: { $t: (s: string) => s },
            stubs: {
                Panel: { template: '<div data-testid="panel"><slot /></div>' },
            },
        },
    })

    return { wrapper, dispatchSpy }
}

const findButtonByText = (wrapper: VueWrapper, text: string): DOMWrapper<Element> => {
    const found = wrapper.findAll('button').find((b) => b.text().trim() === text)
    if (!found) throw new Error(`button with text "${text}" not found`)
    return found
}

const findButtonStartingWith = (wrapper: VueWrapper, prefix: string): DOMWrapper<Element> => {
    const found = wrapper.findAll('button').find((b) => b.text().trim().startsWith(prefix))
    if (!found) throw new Error(`button starting with "${prefix}" not found`)
    return found
}

const jogScripts = (): string[] =>
    mocks.emit.mock.calls
        .map((call) => (call[1] as { script?: string } | undefined)?.script ?? '')
        .filter((script) => script.includes('SAVE_GCODE_STATE'))

const setTextFieldByLabel = async (wrapper: VueWrapper, label: string, value: string) => {
    const fields = wrapper.findAllComponents({ name: 'VTextField' })
    const field = fields.find((f) => f.props('label') === label)
    if (!field) throw new Error(`text field "${label}" not found`)
    await field.find('input').setValue(value)
    await field.find('input').trigger('change')
    await nextTick()
}

const pressKey = (key: string, target?: Element) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    ;(target ?? document).dispatchEvent(event)
}

const enableKeyboardNav = async (wrapper: VueWrapper) => {
    await findButtonStartingWith(wrapper, 'Keyboard Nav').trigger('click')
    await nextTick()
}

describe('JogPanel rendering and status', () => {
    it('renders the jog panel when klipper is ready', () => {
        const { wrapper } = createTestWrapper()
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(true)
        expect(wrapper.text()).toContain('XY Jog')
        expect(wrapper.text()).toContain('Z Jog')
        wrapper.unmount()
    })

    it('hides the panel when klipper is not ready', () => {
        const { wrapper } = createTestWrapper({ klippyReady: false })
        expect(wrapper.find('[data-testid="panel"]').exists()).toBe(false)
        expect(mocks.emit).not.toHaveBeenCalled()
        wrapper.unmount()
    })

    it('shows All when every axis is homed', () => {
        const { wrapper } = createTestWrapper({ homedAxes: 'xyz' })
        expect(wrapper.text()).toContain('All')
        expect(wrapper.text()).toContain('standby')
        wrapper.unmount()
    })

    it('shows None when no axis is homed', () => {
        const { wrapper } = createTestWrapper({ homedAxes: '' })
        expect(wrapper.text()).toContain('None')
        wrapper.unmount()
    })
})

describe('JogPanel homing and machine commands', () => {
    it('homes all axes with an echo event and loading flag', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButtonByText(wrapper, 'Home All').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', { message: 'G28', type: 'command' })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G28' }, { loading: 'homeAll' })
        wrapper.unmount()
    })

    it('homes XY with an echo event and loading flag', async () => {
        const { wrapper } = createTestWrapper()
        await findButtonByText(wrapper, 'Home XY').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G28 X Y' }, { loading: 'homeXY' })
        wrapper.unmount()
    })

    it('homes Z with an echo event and loading flag', async () => {
        const { wrapper } = createTestWrapper()
        await findButtonByText(wrapper, 'Home Z').trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'G28 Z' }, { loading: 'homeZ' })
        wrapper.unmount()
    })

    it('disables steppers with M18 and an echo event', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButtonByText(wrapper, 'Disable Steppers').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', { message: 'M18', type: 'command' })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M18' })
        wrapper.unmount()
    })

    it('stops motion with M112 from the XY pad center button', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        const xyButtons = wrapper.findAll('.jog-panel__xy-btn')
        expect(xyButtons).toHaveLength(5)
        await xyButtons[2].trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('server/addEvent', { message: 'M112', type: 'command' })
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M112' })
        wrapper.unmount()
    })
})

describe('JogPanel jog moves', () => {
    it('jogs Y positive with the default step and XY feedrate', async () => {
        const { wrapper } = createTestWrapper()
        const xyButtons = wrapper.findAll('.jog-panel__xy-btn')
        await xyButtons[0].trigger('click')
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', {
            script: 'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Y1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement',
        })
        wrapper.unmount()
    })

    it('jogs X in both directions with the XY feedrate', async () => {
        const { wrapper } = createTestWrapper()
        const xyButtons = wrapper.findAll('.jog-panel__xy-btn')
        await xyButtons[1].trigger('click')
        await xyButtons[3].trigger('click')
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X-1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('jogs Y negative from the XY pad', async () => {
        const { wrapper } = createTestWrapper()
        const xyButtons = wrapper.findAll('.jog-panel__xy-btn')
        await xyButtons[4].trigger('click')
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Y-1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('jogs Z with the Z feedrate instead of the XY feedrate', async () => {
        const { wrapper } = createTestWrapper({ feedrateXY: 500, feedrateZ: 100 })
        const zButtons = wrapper.findAll('.jog-panel__jog-btn')
        expect(zButtons).toHaveLength(2)
        await zButtons[0].trigger('click')
        await zButtons[1].trigger('click')
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Z1 F6000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Z-1 F6000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('jogs a precise X distance entered by the operator', async () => {
        const { wrapper } = createTestWrapper()
        await setTextFieldByLabel(wrapper, 'X', '2.5')
        await findButtonByText(wrapper, 'Jog X').trigger('click')
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X2.5 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('disables the precise jog button while its distance is zero', () => {
        const { wrapper } = createTestWrapper()
        expect(findButtonByText(wrapper, 'Jog X').attributes('disabled')).toBeDefined()
        expect(findButtonByText(wrapper, 'Jog Y').attributes('disabled')).toBeDefined()
        expect(findButtonByText(wrapper, 'Jog Z').attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })

    it('disables XY and Z jog buttons when no axis is homed', () => {
        const { wrapper } = createTestWrapper({ homedAxes: '' })
        for (const button of wrapper.findAll('.jog-panel__xy-btn')) {
            expect(button.attributes('disabled')).toBeDefined()
        }
        for (const button of wrapper.findAll('.jog-panel__jog-btn')) {
            expect(button.attributes('disabled')).toBeDefined()
        }
        wrapper.unmount()
    })
})

describe('JogPanel step and feedrate selection', () => {
    it('persists the selected jog step and shows it in the pad header', async () => {
        const { wrapper, dispatchSpy } = createTestWrapper()
        await findButtonByText(wrapper, '25mm').trigger('click')
        expect(dispatchSpy).toHaveBeenCalledWith('gui/saveSetting', {
            name: 'control.selectedCncStepIndex',
            value: 5,
        })
        expect(wrapper.text()).toContain('25')
        wrapper.unmount()
    })

    it('derives the feed slider range from the toolhead max velocity', () => {
        const { wrapper } = createTestWrapper({ maxVelocity: 50 })
        const sliders = wrapper.findAll('.feed-slider')
        expect(sliders[0].attributes('max')).toBe('3000')
        wrapper.unmount()
    })

    it('falls back to a 1000 mm/min feed range without max velocity', () => {
        const { wrapper } = createTestWrapper({ maxVelocity: null })
        const sliders = wrapper.findAll('.feed-slider')
        expect(sliders[0].attributes('max')).toBe('1000')
        wrapper.unmount()
    })

    it('persists feedrate edits through the CNC settings API', async () => {
        const { wrapper } = createTestWrapper()
        await setTextFieldByLabel(wrapper, 'XY Feed', '800')
        expect(mocks.updateCncSettings).toHaveBeenCalledWith(SOCKET_URL, {
            feedrateXY: 800,
            feedrateZ: 100,
        })
        wrapper.unmount()
    })

    it('toasts when persisting feedrates fails', async () => {
        const { wrapper } = createTestWrapper()
        mocks.updateCncSettings.mockRejectedValueOnce(new Error('nope'))
        await setTextFieldByLabel(wrapper, 'Z Feed', '150')
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(mocks.toastError).toHaveBeenCalledWith('nope')
        wrapper.unmount()
    })
})

describe('JogPanel keyboard navigation', () => {
    it('toggles the warning toast with the current step and dismisses it', async () => {
        const { wrapper } = createTestWrapper()
        await findButtonStartingWith(wrapper, 'Keyboard Nav').trigger('click')
        expect(mocks.toastWarning).toHaveBeenCalledTimes(1)
        expect(mocks.toastWarning.mock.calls[0][0]).toContain('KEYBOARD NAVIGATION IS ON')
        expect(mocks.toastWarning.mock.calls[0][0]).toContain('1mm')
        expect(findButtonStartingWith(wrapper, 'Keyboard Nav').text()).toContain('(ON)')

        await findButtonStartingWith(wrapper, 'Keyboard Nav').trigger('click')
        expect(mocks.toastDismiss).toHaveBeenCalled()
        expect(findButtonStartingWith(wrapper, 'Keyboard Nav').text()).toContain('(OFF)')
        wrapper.unmount()
    })

    it('restores the nav state when the toast is dismissed externally', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        const options = mocks.toastWarning.mock.calls[0][1] as { onDismiss: () => void }
        options.onDismiss()
        await nextTick()
        expect(findButtonStartingWith(wrapper, 'Keyboard Nav').text()).toContain('(OFF)')
        wrapper.unmount()
    })

    it('jogs Y positive on ArrowUp while navigation is on', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        pressKey('ArrowUp')
        await nextTick()
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Y1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('maps ArrowDown, ArrowLeft and ArrowRight to Y-, X- and X+', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        pressKey('ArrowDown')
        pressKey('ArrowLeft')
        pressKey('ArrowRight')
        await nextTick()
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 Y-1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X-1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        expect(jogScripts()).toContain(
            'SAVE_GCODE_STATE NAME=_ui_movement\nG91\nG1 X1 F30000\nRESTORE_GCODE_STATE NAME=_ui_movement'
        )
        wrapper.unmount()
    })

    it('ignores keys while navigation is off and ignores non-arrow keys', async () => {
        const { wrapper } = createTestWrapper()
        pressKey('ArrowUp')
        await enableKeyboardNav(wrapper)
        pressKey('Enter')
        await nextTick()
        expect(jogScripts()).toHaveLength(0)
        wrapper.unmount()
    })

    it('ignores keys typed into editable targets', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        const input = document.createElement('input')
        document.body.appendChild(input)
        pressKey('ArrowUp', input)
        await nextTick()
        expect(jogScripts()).toHaveLength(0)
        wrapper.unmount()
    })

    it('ignores keys while printing', async () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing' })
        await enableKeyboardNav(wrapper)
        pressKey('ArrowUp')
        await nextTick()
        expect(jogScripts()).toHaveLength(0)
        wrapper.unmount()
    })

    it('refreshes the nav toast when the step changes while enabled', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        mocks.toastWarning.mockClear()
        await findButtonByText(wrapper, '25mm').trigger('click')
        await nextTick()
        expect(mocks.toastWarning).toHaveBeenCalledTimes(1)
        expect(mocks.toastWarning.mock.calls[0][0]).toContain('25mm')
        wrapper.unmount()
    })

    it('removes the key listener on unmount', async () => {
        const { wrapper } = createTestWrapper()
        await enableKeyboardNav(wrapper)
        wrapper.unmount()
        mocks.emit.mockClear()
        pressKey('ArrowUp')
        await nextTick()
        expect(mocks.emit).not.toHaveBeenCalled()
    })
})

describe('JogPanel feedrate override', () => {
    it('debounces slider input into an M220 command and shows the value', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper()
        const slider = wrapper.findAll('.feed-slider')[2]
        await slider.setValue('150')
        expect(wrapper.text()).toContain('150%')
        expect(mocks.emit).not.toHaveBeenCalled()
        vi.advanceTimersByTime(1000)
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S150' })
        wrapper.unmount()
    })

    it('coalesces rapid slider inputs into a single M220 with the latest value', async () => {
        vi.useFakeTimers()
        const { wrapper } = createTestWrapper()
        const slider = wrapper.findAll('.feed-slider')[2]
        await slider.setValue('150')
        vi.advanceTimersByTime(500)
        await slider.setValue('160')
        vi.advanceTimersByTime(1000)
        expect(mocks.emit).toHaveBeenCalledTimes(1)
        expect(mocks.emit).toHaveBeenCalledWith('printer.gcode.script', { script: 'M220 S160' })
        wrapper.unmount()
    })

    it('disables the feed sliders while printing', () => {
        const { wrapper } = createTestWrapper({ printerState: 'printing' })
        expect(wrapper.findAll('.feed-slider')[0].attributes('disabled')).toBeDefined()
        wrapper.unmount()
    })
})
