import { describe, expect, it } from 'vitest'
import routes, { type AppRoute } from '@/routes'

type RouteComponent = Record<string, unknown>

const isComponentObject = (value: unknown): value is RouteComponent => {
    if (typeof value !== 'object' || value === null) return false
    const record = value as Record<string, unknown>
    return typeof record.setup === 'function' || typeof record.render === 'function'
}

// Resolving every route component keeps the lazy route chunks loading in CI
// (and restores module-level coverage for code only reachable via routes).
const resolveRouteComponent = async (component: AppRoute['component']): Promise<RouteComponent | null> => {
    if (component === null || component === undefined) return null
    const resolved =
        typeof component === 'function' ? await (component as unknown as () => Promise<unknown>)() : component
    const normalized =
        typeof resolved === 'object' && resolved !== null && 'default' in resolved
            ? (resolved as { default: unknown }).default
            : resolved
    if (!isComponentObject(normalized)) throw new Error('route component did not resolve to a component object')
    return normalized
}

const collectRoutes = (entries: AppRoute[]): AppRoute[] =>
    entries.flatMap((entry) => [entry, ...collectRoutes(entry.children ?? [])])

describe('routes', () => {
    it('resolves every route component', { timeout: 120000 }, async () => {
        const all = collectRoutes(routes)
        expect(all.length).toBeGreaterThan(0)

        let resolved = 0
        for (const route of all) {
            const component = await resolveRouteComponent(route.component)
            if (component === null) {
                expect(route.redirect).toBeTruthy()
                continue
            }
            resolved += 1
        }
        expect(resolved).toBeGreaterThan(0)
    })
})
