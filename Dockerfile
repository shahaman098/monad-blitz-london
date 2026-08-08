FROM node:22-alpine AS build

RUN corepack enable
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY app/package.json ./app/package.json
RUN pnpm install --frozen-lockfile

COPY app ./app
RUN pnpm --dir app build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=8080
WORKDIR /app

COPY --from=build /workspace/app/dist ./dist
COPY --from=build /workspace/app/server-dist ./server-dist

USER node
EXPOSE 8080
CMD ["node", "server-dist/server.mjs"]
