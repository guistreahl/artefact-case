# Production image. Three stages: only the last one goes to Cloud Run, with
# no source code, no dev dependencies and no build cache.
#
# The build context is the repository root:
#   docker build -f infra/docker/Dockerfile .
# Context exclusions live in Dockerfile.dockerignore, next to this file.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=8080

# The standalone output already contains the server and only the
# dependencies it uses. Static files are not included and are copied apart.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node
EXPOSE 8080
CMD ["node", "server.js"]
