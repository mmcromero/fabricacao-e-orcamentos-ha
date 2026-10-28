# syntax=docker/dockerfile:1
FROM node:24.19.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --strict-ssl=true
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.19.0-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data APP_MODE=home-assistant HOST=0.0.0.0 PORT=8099
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/dist-server ./dist-server
EXPOSE 8099
CMD ["node", "dist-server/index.js"]
