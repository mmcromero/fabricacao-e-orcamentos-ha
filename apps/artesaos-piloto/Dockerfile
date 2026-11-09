FROM --platform=linux/arm64 node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
LABEL org.opencontainers.image.revision="0d95c81e05cc6f49cf4a2e4866b0034c4217adeb" org.opencontainers.image.version="0.2.0-dev.23" org.opencontainers.image.created="2026-11-09T17:27:53.140421+00:00" dev.artesao.distribution="home-assistant"
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data HOST=0.0.0.0 PORT=8099 PILOT_OPTIONS_FILE=/data/options.json
ADD runtime.tar.gz /app/
EXPOSE 8099
CMD ["node", "dist-server/pilot/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "dist-server/pilot/healthcheck.js"]
