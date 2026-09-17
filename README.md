<p align="center">
  <h1 align="center">Mainsail (E3CNC fork)</h1>
</p>
<p align="center">
  CNC web interface for Klipper-based machines, forked from
  <a href="https://github.com/mainsail-crew/mainsail">mainsail-crew/mainsail</a>.
  Vue 3 + Vuetify 3 frontend talking to Moonraker over WebSocket.
</p>
<p align="center">
  <a aria-label="Releases" href="https://github.com/E3CNC/mainsail/releases">
    <img src="https://img.shields.io/github/v/release/E3CNC/mainsail?style=flat-square">
  </a>
  <a aria-label="Stars" href="https://github.com/E3CNC/mainsail/stargazers">
    <img src="https://img.shields.io/github/stars/E3CNC/mainsail?style=flat-square">
  </a>
  <a aria-label="License" href="https://github.com/E3CNC/mainsail/blob/develop/LICENSE">
    <img src="https://img.shields.io/github/license/E3CNC/mainsail?style=flat-square">
  </a>
</p>

## What this is

This repo hosts the E3CNC web UI: work coordinate systems (G54-G59) with an
interactive preview and click-to-move, DRO, jog controls, MDI console, spindle
and coolant control, G-code files and viewer, history, timelapse, webcam, and
machine pages.

**Stack:** Vue 3.5, Vuetify 3, Vuex 4, vue-router 4, TypeScript (strict), Vite 7.

## Releases

Tagged `e3cnc-v*` releases ship `mainsail.zip`, built by the
[E3CNC Release](.github/workflows/e3cnc-release.yml) workflow
(`npm run build` produces `dist/mainsail.zip`). Latest:
[releases](https://github.com/E3CNC/mainsail/releases).

## Use this fork with Moonraker's update manager

Add [docs/examples/update-manager.conf](docs/examples/update-manager.conf) to
`moonraker.conf` and restart Moonraker. The recommended `type: web` entry
tracks this repo's releases. Note this UI has no update screen; updates apply
through the Moonraker API or another client.

## Development

```sh
npm install
npm run mock    # fake Moonraker on 127.0.0.1:7125 (WebSocket + HTTP + /server/cnc/*)
npm run serve   # Vite dev server (port 8080)
```

Point the dev server at the mock with `.env.development.local`:

```sh
VUE_APP_HOSTNAME=127.0.0.1
VUE_APP_PORT=7125
```

Other commands: `npm run build`, `npm run lint`, `npm run typecheck`,
`npm run test:unit`, `npm run test:ui`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). AI-agent conventions live in
[AGENTS.md](AGENTS.md) and [agent_docs/](agent_docs/).

## Credit

- [mainsail-crew/mainsail](https://github.com/mainsail-crew/mainsail) for the
  upstream project this fork builds on.
- [Kevin O'Connor](https://github.com/KevinOConnor) for
  [Klipper](https://github.com/KevinOConnor/klipper).
- [Eric Callahan (arksine)](https://github.com/Arksine) for
  [Moonraker](https://github.com/Arksine/moonraker).
- [Vue.js](https://vuejs.org/) and [Vuetify](https://vuetifyjs.com/).
