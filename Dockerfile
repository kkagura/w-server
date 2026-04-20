FROM node:22-bookworm-slim AS base
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
COPY config ./config
COPY scripts ./scripts
COPY docs ./docs
RUN pnpm run build

FROM base AS prod-deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=prod
ENV HOST=0.0.0.0
RUN corepack enable
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/config ./config
COPY package.json ./
EXPOSE 8080
CMD ["node", "dist/main"]
