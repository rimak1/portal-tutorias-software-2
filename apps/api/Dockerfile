FROM node:20-alpine AS base
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace @portal-tutorias/shared
RUN npm run --workspace @portal-tutorias/api prisma:generate
RUN npm run build --workspace @portal-tutorias/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/shared ./packages/shared

WORKDIR /repo/apps/api
EXPOSE 3000
CMD ["node", "dist/server.js"]
