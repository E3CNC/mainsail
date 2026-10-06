FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    gcc \
    sqlite3 \
    libc6-dev \
    libstdc++-14-dev \
    libsodium23 \
    iproute2 \
    && rm -rf /var/lib/apt/lists/*

# Pin Moonraker for reproducible harness builds. See docker/README.md for the bump procedure.
RUN pip install --no-cache-dir moonraker==0.11.0

RUN mkdir -p /data/config /data/database /data/gcodes /data/logs /data/pcache /data/printer_data/config /data/tmp /data/webcam

COPY moonraker.conf /data/config/moonraker.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 7125 7126

VOLUME ["/data"]

ENTRYPOINT ["/entrypoint.sh"]
