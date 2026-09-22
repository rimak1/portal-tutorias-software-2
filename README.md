# Portal de Tutorías Académicas

Portal web para el agendamiento de tutorías académicas: los estudiantes consultan
la disponibilidad de los tutores y reservan franjas; los tutores publican su
disponibilidad y atienden las solicitudes; la coordinación académica y la
administración gestionan el programa.

La arquitectura completa (modelo C4, modelo de datos, decisiones y stack) está
documentada en `Documento_Arquitectura_Portal_Tutorias.pdf`.

## Estado del proyecto

Este repositorio se desarrolla en 3 entregas incrementales:

| Entrega | Alcance | Estado |
| --- | --- | --- |
| 1 | Acceso y autenticación (login, RBAC, recuperación de contraseña) | ✅ Completa |
| 2 | Disponibilidad del tutor y consulta de disponibilidad | ⏳ Pendiente |
| 3 | Reserva de citas (con control de concurrencia) | ⏳ Pendiente |

## Estructura del repositorio

```
apps/
  api/      API REST (Node.js, Fastify, TypeScript, Prisma)
  web/      SPA (React, Vite, TypeScript)
packages/
  shared/   Tipos y esquemas (Zod) compartidos entre api y web
nginx/      Configuración de Nginx para el despliegue con Docker Compose
```

## Requisitos previos

- Node.js 20 o superior
- Docker y Docker Compose (para levantar PostgreSQL)

## Puesta en marcha

```bash
npm install
docker compose up -d db
```

Cada aplicación (`apps/api` y, si aplica, la raíz del repositorio) incluye un
archivo `.env.example` con las variables de entorno necesarias y una
explicación de cada una. Cópialo a `.env` en la misma carpeta y define tus
propios valores antes de continuar — al ser un repositorio público, ningún
`.env` se versiona (ver `.gitignore`).

Con las variables definidas:

```bash
cd apps/api
npx prisma migrate dev
npm run prisma:seed
```

El seed crea un usuario de prueba por cada rol (estudiante, tutor,
coordinador, administrador); el script imprime en consola la contraseña
generada para esas cuentas de demostración.

## Desarrollo

Desde la raíz del repositorio:

```bash
npm run dev:api   # API en http://localhost:3000
npm run dev:web   # SPA en http://localhost:5173
```

## Pruebas y calidad

```bash
npm run test        # Pruebas unitarias y de integración (requieren la base de datos activa)
npm run typecheck
npm run lint
```

## Despliegue con Docker Compose

```bash
docker compose up --build
```

Levanta los tres contenedores descritos en la vista de despliegue del
documento de arquitectura: `db` (PostgreSQL), `api` (Node.js/Fastify) y `web`
(SPA servida por Nginx, que también reenvía `/api` hacia el contenedor de la
API).
