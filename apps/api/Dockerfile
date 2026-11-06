FROM node:20-alpine AS base
# Prisma necesita OpenSSL para elegir su motor de consultas; la imagen alpine no lo trae.
RUN apk add --no-cache openssl
WORKDIR /repo

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run build --workspace @portal-tutorias/shared
# En desarrollo el paquete compartido se consume como TypeScript (main apunta a src), que Node no
# ejecuta. En la imagen se apunta a lo ya compilado, para compilar y correr la API con Node a secas.
RUN npm pkg set main=./dist/index.js types=./dist/index.d.ts --workspace @portal-tutorias/shared
RUN npm run --workspace @portal-tutorias/api prisma:generate
RUN npm run build --workspace @portal-tutorias/api

FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/package.json ./package.json
COPY --from=build /repo/apps/api ./apps/api
COPY --from=build /repo/packages/shared ./packages/shared

WORKDIR /repo/apps/api
EXPOSE 3000
# Las migraciones pendientes se aplican antes de arrancar: una base nueva queda con su esquema
# y una actualizacion no depende de un paso manual. Si fallan, el contenedor no inicia.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
