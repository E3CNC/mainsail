import { describe, expect, it } from 'vitest'
import { mutations } from '@/store/gui/navigation/mutations'
import { getDefaultState } from '@/store/gui/navigation/index'
import type { GuiNavigationState } from '@/store/gui/navigation/types'

function state(overrides = {}): GuiNavigationState {
    return { ...getDefaultState(), ...overrides }
}

describe('gui/navigation/mutations', () => {
    it('reset restores defaults', () => {
        const s = state({ entries: [{ type: 'route', title: 'x', visible: true, position: 1 }] })
        mutations.reset(s)
        expect(s).toEqual(getDefaultState())
    })

    it('updatePos updates the position of an existing entry', () => {
        const s = state({ entries: [{ type: 'route', title: 'Dashboard', visible: true, position: 1 }] })
        mutations.updatePos(s, { type: 'route', title: 'Dashboard', visible: false, position: 5 })
        expect(s.entries).toHaveLength(1)
        expect(s.entries[0].position).toBe(5)
        expect(s.entries[0].visible).toBe(true)
    })

    it('updatePos creates a new entry when none matches', () => {
        const s = state()
        mutations.updatePos(s, { type: 'link', title: 'Blog', visible: true, position: 2 })
        expect(s.entries).toEqual([{ type: 'link', title: 'Blog', visible: true, position: 2 }])
    })

    it('updatePos matches on type and title only', () => {
        const s = state({
            entries: [
                { type: 'route', title: 'Dashboard', visible: true, position: 1 },
                { type: 'link', title: 'Dashboard', visible: true, position: 2 },
            ],
        })
        mutations.updatePos(s, { type: 'link', title: 'Dashboard', visible: true, position: 9 })
        expect(s.entries[0].position).toBe(1)
        expect(s.entries[1].position).toBe(9)
    })

    it('changeVisibility toggles an existing entry', () => {
        const s = state({ entries: [{ type: 'route', title: 'Dashboard', visible: true, position: 1 }] })
        mutations.changeVisibility(s, {
            type: 'route',
            title: 'Dashboard',
            icon: 'mdi',
            position: 1,
            visible: true,
        } as never)
        expect(s.entries[0].visible).toBe(false)
    })

    it('changeVisibility resolves orgTitle when present', () => {
        const s = state({ entries: [{ type: 'route', title: 'Console', visible: true, position: 1 }] })
        mutations.changeVisibility(s, {
            type: 'route',
            title: 'Translated',
            orgTitle: 'Console',
            icon: 'mdi',
            position: 1,
            visible: false,
        } as never)
        expect(s.entries[0].visible).toBe(true)
    })

    it('changeVisibility creates a new entry when none matches', () => {
        const s = state()
        mutations.changeVisibility(s, {
            type: 'link',
            title: 'Blog',
            icon: 'mdi',
            position: 4,
            visible: true,
        } as never)
        expect(s.entries).toEqual([{ type: 'link', title: 'Blog', visible: false, position: 4 }])
    })
})
