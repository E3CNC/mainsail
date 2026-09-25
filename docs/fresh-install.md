# Fresh install without KIAUH

KIAUH used to set up the webserver for you (nginx rooted at `~/mainsail`,
plus Moonraker config). On a fresh E3CNC install do it manually as below.

## Requirements

- Raspberry Pi 3B+ minimum, Pi 4 (1 GB is enough) or newer recommended.
  Mainsail is static files (~7 MB zip); the UI runs in your browser, not on
  the Pi, so RAM/CPU demands are low.
- 24 V supply still required for the 4.2.7 board / motors. Powering the Pi
  from a separate 5 V USB-C adapter is fine (and safer than a dodgy buck).
- On the Pi: `nginx`, `unzip`, `wget`, Moonraker + Klipper already installed.

```sh
sudo apt update && sudo apt install -y nginx unzip wget
```

## Option A — Moonraker update manager (recommended)

Add `docs/examples/update-manager.conf` to
`~/printer_data/config/moonraker.conf` and restart Moonraker:

```ini
[update_manager client mainsail]
type: web
channel: stable
repo: E3CNC/mainsail
path: ~/mainsail
```

Moonraker then downloads `mainsail.zip` from this repo's releases
(tags like `e3cnc-mainsail-v0.10.5`) into `~/mainsail`. Check the
[releases page](https://github.com/E3CNC/mainsail/releases) for the latest
tag — do not hardcode an old version.

## Option B — Manual replace from a release zip

Back up first, then unpack the release into `~/mainsail`:

```sh
mv ~/mainsail ~/mainsail-orig
mkdir -p ~/mainsail && cd ~/mainsail
wget -O mainsail.zip https://github.com/E3CNC/mainsail/releases/download/e3cnc-mainsail-v0.10.5/mainsail.zip
unzip -o mainsail.zip && rm mainsail.zip
```

Replace `e3cnc-mainsail-v0.10.5` with the latest release tag. To roll back:
`rm -rf ~/mainsail && mv ~/mainsail-orig ~/mainsail`.

Note: a manual unzip and the update-manager entry both target `~/mainsail`.
Pick one path — if you use the update manager, don't manually overwrite
between updates or Moonraker will see a dirty state.

## nginx

Minimal site (KIAUH equivalent). Root must be `~/mainsail`:

```nginx
server {
    listen 80;
    root /home/pi/mainsail;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Then:

```sh
sudo systemctl restart nginx
```

Browse the UI at `http://printer.local/` or `http://<pi-ip>/` (port 80).
Moonraker's API stays on port 7125 — do not browse to `:7125` for the UI.

## Troubleshooting: port / IP / blank UI

- The shipped `config.json` uses `"hostname": null, "port": null`, so the
  browser connects back to whatever host it loaded the UI from
  (`src/store/socket/index.ts` falls back to `window.location.hostname`).
  If `config.json` in `~/mainsail` contains `127.0.0.1:7125` (releases
  before this fix), remote browsers try their own loopback and never
  connect. Fix: set both to `null`, or re-download a fixed release.
- Dev only: `npm run serve` (port 8080) points at a printer via
  `.env.development.local` (`VUE_APP_HOSTNAME` / `VUE_APP_PORT`) or
  `VITE_DEV_PROXY_TARGET`. This does not affect the release zip.
- If Moonraker rejects the browser, check `moonraker.conf`
  `[authorization] trusted_clients` includes your LAN range.
