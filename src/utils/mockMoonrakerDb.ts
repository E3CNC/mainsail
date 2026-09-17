export interface DbStore {
    [namespace: string]: Record<string, unknown>
}

const db: DbStore = { mainsail: {}, maintenance: {} }

export function getDb(): DbStore {
    return db
}

export function resetDb(): void {
    db.mainsail = {}
    db.maintenance = {}
}

export function unflatten(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(obj)) {
        const parts = key.split('.')
        let cur: Record<string, unknown> = out
        for (let i = 0; i < parts.length - 1; i++) {
            if (!cur[parts[i]] || typeof cur[parts[i]] !== 'object' || Array.isArray(cur[parts[i]])) {
                cur[parts[i]] = {}
            }
            cur = cur[parts[i]] as Record<string, unknown>
        }
        cur[parts[parts.length - 1]] = value
    }
    return out
}

export function dbListNamespaces(): { namespaces: string[] } {
    return { namespaces: Object.keys(db) }
}

export function dbGetItem(namespace: string, key?: string): { namespaces: string[]; key?: string; value?: unknown } {
    const ns = namespace ?? 'mainsail'
    if (key && db[ns]?.[key] !== undefined) {
        return { namespaces: [ns], key, value: db[ns][key] }
    }
    return { namespaces: [ns], value: unflatten(db[ns] ?? {}) }
}

export function dbPostItem(namespace: string, key: string, value: Record<string, unknown>): Record<string, unknown> {
    const ns = namespace ?? 'mainsail'
    if (ns && key) {
        if (!db[ns]) db[ns] = {}
        db[ns][key] = value
    }
    return {}
}

export function dbDeleteItem(namespace: string, key: string): Record<string, unknown> {
    const ns = namespace ?? 'mainsail'
    if (ns && key && db[ns]) delete db[ns][key]
    return {}
}
