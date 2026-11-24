# syntax=docker/dockerfile:1
# Targets: `migrate` (applies the database migrations once) and `runtime` (the API, the last stage, the default).
# Base image pinned by version; the registry for npm comes from .npmrc (public registry, exact versions in the lockfile).
FROM node:20.20.2-alpine3.23 AS base
WORKDIR /app

# all dependencies, to build
FROM base AS deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate && npx tsc -p tsconfig.build.json

# only what the API needs to run
FROM base AS prod-deps
COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev

# one-shot job: needs the Prisma CLI, which is a development dependency
FROM build AS migrate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

FROM base AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# not root
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]
