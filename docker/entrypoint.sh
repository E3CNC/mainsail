#!/bin/sh
set -e

# Ensure data directories exist
mkdir -p /data/config /data/database /data/gcodes /data/logs /data/pcache /data/printer_data/config /data/tmp /data/webcam

# Ensure hostname resolves (needed for Docker on macOS)
if ! getent hosts "$(hostname)" >/dev/null 2>&1; then
    echo "127.0.0.1 $(hostname)" >> /etc/hosts
fi

# Start moonraker with config
echo "[entrypoint] Starting moonraker on port 7125..."
exec moonraker -c /data/config/moonraker.conf
