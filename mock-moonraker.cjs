/* Minimal mock Moonraker server for Mainsail local dev.
 * Run: node mock-moonraker.cjs (listens on 127.0.0.1:7125)
 * Speaks HTTP (CORS-enabled) + JSON-RPC over /websocket.
 */
const { Server: WSServer } = require('ws')
const http = require('http')

const PORT = process.env.MOCK_MOONRAKER_PORT ? Number(process.env.MOCK_MOONRAKER_PORT) : 7125
const startTime = Date.now()
let connectionId = 1

const cncWcs = {
    active: 'G54',
    offsets: {
        G54: { X: 0, Y: 0, Z: 0 },
        G55: { X: 10, Y: 0, Z: 0 },
        G56: { X: 0, Y: 10, Z: 0 },
        G57: { X: 0, Y: 0, Z: 10 },
        G58: { X: -10, Y: 0, Z: 0 },
        G59: { X: 0, Y: 0, Z: -10 },
    },
}

const httpServer = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
        res.writeHead(204)
        res.end()
        return
    }
    const url = new URL(req.url, `http://${req.headers.host}`)
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
        let body = {}
        try {
            if (chunks.length) body = JSON.parse(Buffer.concat(chunks).toString())
        } catch { body = {} }
        routeHttp(req, res, url, body)
    })
})

function routeHttp(req, res, url, body) {
    if (url.pathname.startsWith('/server/history/totals')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result: { job_totals: { total: 0, failed: 0, cancelled: 0, completed: 0, queued: 0, active: 0 } } }))
        return
    }
    if (url.pathname.startsWith('/server/database/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result: { namespaces: ['mainsail', 'maintenance'], value: {} } }))
        return
    }
    if (url.pathname.startsWith('/server/files/config/')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ entries: [] }))
        return
    }
    if (url.pathname.startsWith('/machine/e3cnc/info')) {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ result: { ok: true, current_version: '0.10.4-mock', instances: [{ name: 'mock-cnc', running: true, current_version: '0.10.4-mock' }] } }))
        return
    }
    if (url.pathname.startsWith('/server/cnc/')) {
        const cncPath = url.pathname.replace('/server/cnc/', '')
        if (cncPath === 'state') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({
                result: {
                    profile: {
                        name: 'Mock CNC',
                        frontend: {
                            show_machine_coords: true,
                            show_work_coords: true,
                            show_machine_health: true,
                            reverse_y_preview: false,
                        },
                        capabilities: {
                            spindle: { enabled: true },
                            coolant: { channels: 2 },
                            probe: { enabled: true },
                            tool_setter: { enabled: false },
                        },
                        safety: {
                            require_confirm_for_zero_reset: true,
                            require_confirm_for_spindle_start: true,
                            require_homing_before_offsets: true,
                        },
                    },
                    state: 'ready',
                    errors: [],
                },
            }))
            return
        }
        if (cncPath === 'spindle') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { state: 'off', rpm: 0, override: 100 } }))
            return
        }
        if (cncPath === 'coolant') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { flood: false, mist: false } }))
            return
        }
        if (cncPath === 'units') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { units: 'mm' } }))
            return
        }
        if (cncPath === 'wcs/select' && req.method === 'POST' && typeof body.wcs === 'string' && body.wcs in cncWcs.offsets) {
            cncWcs.active = body.wcs
        }
        if (cncPath === 'wcs/set-zero' && req.method === 'POST') {
            const pos = printerState.status.toolhead.position
            const machine = { X: pos[0], Y: pos[1], Z: pos[2] }
            const axes = Array.isArray(body.axes) && body.axes.length ? body.axes : ['X', 'Y', 'Z']
            for (const axis of axes) {
                if (axis in machine) cncWcs.offsets[cncWcs.active][axis] = machine[axis]
            }
        }
        if (cncPath === 'wcs' || cncPath === 'wcs/select' || cncPath === 'wcs/set-zero') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { active: cncWcs.active, offsets: cncWcs.offsets } }))
            return
        }
        if (cncPath === 'settings') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { jogSpeed: 100, feedSpeed: 100 } }))
            return
        }
        if (cncPath === 'bash') {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ result: { stdout: 'mock bash', stderr: '', returncode: 0 } }))
            return
        }
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'cnc endpoint not found' }))
        return
    }
    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
}

httpServer.listen(PORT, '127.0.0.1', () => {
    console.log(`[mock-moonraker] listening on ws://127.0.0.1:${PORT}/websocket`)
})

const printerState = {
    eventtime: 1000.5,
    status: {
        gcode: { commands: ['G28', 'G1', 'M104', 'M140', 'M109', 'M190'] },
        toolhead: { homed_axes: 'xyz', position: [100, 100, 10, 0], axis_minimum: [0, 0, 0], axis_maximum: [165, 300, 50], max_velocity: 300, max_accel: 3000 },
        gcode_move: { gcode_position: [100, 100, 10, 0], speed: 0, speed_factor: 1 },
        extruder: { temperature: 21.5, target: 0, power: 0, can_extrude: false },
        heater_bed: { temperature: 21.2, target: 0, power: 0 },
        print_stats: { state: 'standby', filename: '', total_duration: 0, print_duration: 0, filament_used: 0 },
        virtual_sdcard: { progress: 0, is_active: false },
        display_status: { progress: 0, message: null },
        'gcode_macro PAUSE': { pause_at_layer: { enable: true, call: 'PAUSE', layer: 0 } },
        'gcode_macro RESUME': {},
        'gcode_macro CANCEL_PRINT': {},
        'gcode_macro SET_PRINT_STATS_INFO': { pause_at_layer: {}, pause_next_layer: {} },
        configfile: { settings: {}, config: {} },
        webhooks: { state: 'ready', state_message: 'Printer is ready' },
    },
}

function buildStatus(objects) {
    if (!objects) return printerState.status
    const out = {}
    for (const [name, attrs] of Object.entries(objects)) {
        const full = printerState.status[name]
        if (full === undefined) continue
        if (attrs === null || attrs === undefined) out[name] = full
        else if (Array.isArray(attrs)) {
            out[name] = {}
            for (const a of attrs) if (a in full) out[name][a] = full[a]
        }
    }
    return out
}

function syncWorkPosition() {
    const off = cncWcs.offsets[cncWcs.active] ?? { X: 0, Y: 0, Z: 0 }
    const m = printerState.status.toolhead.position
    printerState.status.gcode_move.gcode_position = [m[0] - off.X, m[1] - off.Y, m[2] - off.Z, m[3] ?? 0]
}

function applyGcodeScript(script) {
    const lines = String(script ?? '').split('\n')
    let relative = false
    for (const raw of lines) {
        const line = raw.split(';')[0].trim().toUpperCase()
        if (!line) continue
        if (/\bG28\b/.test(line)) {
            printerState.status.toolhead.homed_axes = 'xyz'
            continue
        }
        if (/\bG91\b/.test(line)) { relative = true; continue }
        if (/\bG90\b/.test(line) || /\bG53\b/.test(line)) { if (/\bG90\b/.test(line)) relative = false; continue }
        // Motion line: G0/G1 with axis words
        if (!/\bG0*0\b/.test(line) && !/\bG0*1\b/.test(line)) continue
        const pos = printerState.status.toolhead.position
        const min = printerState.status.toolhead.axis_minimum
        const max = printerState.status.toolhead.axis_maximum
        const axes = { X: 0, Y: 1, Z: 2 }
        for (const [letter, idx] of Object.entries(axes)) {
            const m = line.match(new RegExp(`${letter}(-?\\d+(?:\\.\\d+)?)`))
            if (!m) continue
            const v = Number(m[1])
            pos[idx] = relative ? pos[idx] + v : v
            pos[idx] = Math.max(min[idx], Math.min(max[idx], pos[idx]))
        }
    }
    syncWorkPosition()
}

function handleMethod(method, params = {}) {
    switch (method) {
        case 'server.connection.identify':
            return { connection_id: connectionId }
        case 'server.info':
            return {
                klippy_connected: true,
                klippy_state: 'ready',
                klippy_message: 'Printer is ready',
                components: [],
                failed_components: [],
                warnings: [],
                registered_directories: ['gcodes', 'config', 'logs'],
                websocket_count: 1,
                moonraker_version: 'v0.9.3-1',
                api_version: [1, 4, 0],
                api_version_string: '1.4.0',
            }
        case 'server.config':
            return { config: { server: { host: '0.0.0.0', port: 7125 } }, orig: {} }
        case 'machine.system_info':
            return {
                system_info: {
                    available_services: ['klipper', 'moonraker'],
                    cpu_info: { bits: '64bit', cpu_count: 4, cpu_desc: 'Mock CPU', serial_number: 'mock123', hardware_desc: 'Mock board', memory_units: 'kB', model: 'MockPi', processor: 'armv7l', total_memory: 8000000 },
                    distribution: { codename: 'bookworm', id: 'debian', like: 'debian', name: 'Debian GNU/Linux', version: '12', version_parts: { build_number: '', major: '12', minor: '' } },
                    network: {},
                    system_uptime: Math.floor((Date.now() - startTime) / 1000),
                    instance_ids: { moonraker: 'mock-moonraker', klipper: 'mock-klipper' },
                    service_state: {},
                    python: { version: [3, 9, 2], version_string: '3.9.2' },
                    sd_info: { capacity: '0', manufacturer: 'mock', manufacturer_date: '', manufacturer_id: '', oem_id: '', product_name: 'mock', product_revision: '', serial_number: '', total_bytes: 0 },
                },
            }
        case 'machine.proc_stats':
            return {
                moonraker_stats: [{ time: Date.now() / 1000, cpu_usage: 5.2, memory: 50000, mem_units: 'kB' }],
                system_cpu_usage: { avg: 5.2 },
                system_uptime: Math.floor((Date.now() - startTime) / 1000),
                throttled_state: null,
                cpu_temp: 42.1,
            }
        case 'server.database.list':
            return { namespaces: [] }
        case 'server.gcode_store':
            return { gcode_store: [{ time: Date.now() / 1000, type: 'response', message: 'Mock Moonraker ready' }] }
        case 'printer.info':
            return { state: 'ready', state_message: 'Printer is ready', hostname: 'mock-printer', software_version: 'v0.12.0-mock', cpu_info: 'Mock CPU' }
        case 'printer.objects.list':
            return { objects: Object.keys(printerState.status) }
        case 'server.webcams.list':
            return { webcams: [] }
        case 'server.database.get_item':
            return { namespaces: [params.namespace ?? 'mainsail'], value: {} }
        case 'printer.objects.subscribe':
        case 'printer.objects.query':
            printerState.eventtime += 0.5
            return { eventtime: printerState.eventtime, status: buildStatus(params.objects) }
        case 'server.temperature_store':
            return {
                extruder: { temperatures: [21.5], targets: [0], powers: [0], speeds: [0] },
                heater_bed: { temperatures: [21.2], targets: [0], powers: [0], speeds: [0] },
            }
        case 'server.files.list':
        case 'server.files.get_directory':
            return { dirs: [], files: [], disk_usage: { total: 0, used: 0, free: 0 }, root_info: { name: params.root ?? 'gcodes' } }
        case 'printer.gcode.script':
            applyGcodeScript(params.script)
            return 'ok'
        case 'printer.emergency_stop':
        case 'printer.print.start':
        case 'printer.print.pause':
        case 'printer.print.cancel':
            return 'ok'
        default:
            return {}
    }
}

function reply(ws, id, result) {
    ws.send(JSON.stringify({ jsonrpc: '2.0', id, result }))
}

const wss = new WSServer({ server: httpServer, path: '/websocket' })

function statusBroadcast() {
    printerState.eventtime += 0.5
    printerState.status.extruder.temperature = 21.5 + Math.sin(Date.now() / 8000) * 0.4
    printerState.status.heater_bed.temperature = 21.2 + Math.cos(Date.now() / 10000) * 0.3
    return {
        jsonrpc: '2.0',
        method: 'notify_status_update',
        params: [
            {
                extruder: { ...printerState.status.extruder },
                heater_bed: { ...printerState.status.heater_bed },
                toolhead: { ...printerState.status.toolhead, position: [...printerState.status.toolhead.position] },
                gcode_move: { ...printerState.status.gcode_move, gcode_position: [...printerState.status.gcode_move.gcode_position] },
            },
            printerState.eventtime,
        ],
    }
}

wss.on('connection', (ws, req) => {
    const myId = connectionId++
    console.log(`[mock-moonraker] client #${myId} connected: ${req.url}`)
    ws._mockId = myId

    const timer = setInterval(() => {
        try {
            ws.send(JSON.stringify(statusBroadcast()))
        } catch { /* ignore closed socket */ }
    }, 2000)

    ws.on('message', (raw) => {
        let data
        try { data = JSON.parse(raw.toString()) } catch { return }
        const messages = Array.isArray(data) ? data : [data]
        for (const msg of messages) {
            if (msg.method === undefined) continue
            console.log(`[mock-moonraker] #${ws._mockId} ${msg.method}`)
            try {
                const result = handleMethod(msg.method, msg.params ?? {})
                if (msg.id !== undefined && msg.id !== null) reply(ws, msg.id, result)
                if (msg.method === 'printer.gcode.script') {
                    try { ws.send(JSON.stringify(statusBroadcast())) } catch { /* ignore */ }
                }
            } catch (e) {
                ws.send(JSON.stringify({ jsonrpc: '2.0', id: msg.id, error: { message: String(e) } }))
            }
        }
    })

    ws.on('close', () => { clearInterval(timer); console.log(`[mock-moonraker] client #${ws._mockId} disconnected`) })
})
