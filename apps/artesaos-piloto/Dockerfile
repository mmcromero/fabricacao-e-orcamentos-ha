FROM --platform=linux/arm64 node:24.19.0-bookworm-slim@sha256:a9f5f7c91a432850b2a8a7797adf5eadb6c733ceed61167806cee7ea7fbc29df
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data HOST=0.0.0.0 PORT=8099 PILOT_OPTIONS_FILE=/data/options.json
ADD runtime.tar.gz /app/
EXPOSE 8099
CMD ["node", "dist-server/pilot/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["node", "dist-server/pilot/healthcheck.js"]
