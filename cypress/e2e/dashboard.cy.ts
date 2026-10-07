// E2E: frontend served by the Docker dev harness (nginx) against a real
// containerized Moonraker 0.11.0.
//
// HARNESS REALITY (verified empirically against the running harness):
// - Real Moonraker has NO Klipper attached and NO E3CNC `/server/cnc/*`
//   endpoints (those exist only in the mock). Jog/WCS/spindle/MDI belong in a
//   spec run against `npm run mock`.
// - The SPA connects to Moonraker over the proxied WebSocket, so
//   `socketIsConnected && guiIsReady` becomes true and App.vue renders the
//   full layout (sidebar + topbar + main), NOT the connecting or
//   select-printer dialog. Because Klipper is absent, the app shows the
//   "Moonraker can't connect to Klipper!" banner.
describe('Harness bootstrap — E3CNC fork', () => {
    it('serves the SPA from nginx and mounts the app', () => {
        cy.visit('/')
        cy.get('#app', { timeout: 15000 }).should('exist')
    })

    it('renders the full layout once connected to Moonraker', () => {
        cy.visit('/')
        // Sidebar + main content area appear once the socket is connected.
        cy.get('.sidebar-shell', { timeout: 20000 }).should('exist')
        cy.get('#page-container', { timeout: 20000 }).should('exist')
    })

    it('surfaces the Klipper-disconnected state (no Klipper in the harness)', () => {
        cy.visit('/')
        cy.get('.sidebar-shell', { timeout: 20000 }).should('exist')
        // With Moonraker up but no Klipper attached, the disconnect banner shows.
        cy.contains("Moonraker can't connect to Klipper!", { timeout: 20000 }).should('be.visible')
    })
})
