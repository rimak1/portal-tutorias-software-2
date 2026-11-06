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
| 2 | Materias del tutor, gestión de franjas (crear, modificar, eliminar, sin traslapes) y consulta de disponibilidad con filtros | ✅ Completa |
| 3 | Reserva de citas con control de concurrencia, atención de solicitudes (aprobar, rechazar con motivo, reprogramar), finalización y cancelación | ✅ Completa |
| 4 | Notificaciones dentro de la plataforma, administración de cuentas, histórico y reportes de tutorías, y endurecimiento de seguridad y despliegue | ✅ Completa |

Funcionalidades del Plan de Requisitos cubiertas: F-01 a F-11.

| Funcionalidad | Qué hace | Quién |
| --- | --- | --- |
| F-07 Notificaciones | Cada cambio de estado de una cita genera un aviso para la otra parte, visible en la campana del encabezado | Todos los roles |
| F-08 Administración de usuarios | Crear, buscar, editar, desactivar y reactivar cuentas; restablecer contraseñas | Administrador (todo); coordinador (registrar y consultar tutores) |
| F-09 Histórico y reportes | Histórico de todas las tutorías con filtros, totales por estado, materia y tutor, horas realizadas, bitácora de cada cita y exportación a CSV | Coordinador y administrador |

Sin implementar: pruebas automatizadas de extremo a extremo con navegador y un monitor de
disponibilidad en producción (ver el informe de arquitectura).

## Estructura del repositorio

```
apps/
  api/      API REST (Node.js, Fastify, TypeScript, Prisma)
  web/      SPA (React, Vite, TypeScript)
packages/
  shared/   Tipos y esquemas (Zod) compartidos entre api y web
nginx/      Configuración de Nginx para el despliegue con Docker Compose
docs/       Documentación técnica
```

La organización por capas y los patrones de diseño se explican en [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

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

El seed crea cuentas de demostración de todos los roles, franjas de ejemplo y
un histórico de tutorías ya concluidas. La contraseña de esas cuentas se genera
al azar en cada ejecución y el script la imprime en consola. **El seed es solo
para desarrollo**: se niega a correr con el modo de producción activo.

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
docker compose up -d --build
```

Levanta los tres contenedores descritos en la vista de despliegue del
documento de arquitectura: `db` (PostgreSQL), `api` (Node.js/Fastify) y `web`
(SPA servida por Nginx, que también reenvía `/api` hacia el contenedor de la
API).

Al arrancar, la API aplica las migraciones pendientes; si fallan, el contenedor no
inicia. Los secretos y la configuración de correo se definen en el archivo `.env`
de la raíz (plantilla en `.env.example`), que no se versiona.

### HTTPS

En producción la cookie de sesión se marca como segura, por lo que el navegador
solo la envía por HTTPS. Para publicar el portal con HTTPS, coloca el certificado
(`fullchain.pem`) y su clave (`privkey.pem`) en una carpeta `certs/` (no se
versiona) y combina los dos archivos de Compose:

```bash
docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Nginx redirige el tráfico HTTP a HTTPS y envía HSTS.

### Primer administrador

El seed no puede usarse en producción, y las demás cuentas las crea un administrador desde la
aplicación, así que la primera cuenta de administrador se crea con un script:

```bash
docker compose exec api npx tsx prisma/crear-administrador.ts correo@institucion.edu.co "Nombre Completo"
```

La contraseña se genera al azar y se imprime una sola vez. El script se niega a crear una cuenta con un
correo que ya existe.

### Respaldos

```bash
scripts/respaldar-db.sh              # crea respaldos/portal-AAAAMMDD-HHMMSS.sql.gz y conserva los 14 últimos
scripts/restaurar-db.sh respaldos/portal-AAAAMMDD-HHMMSS.sql.gz   # reemplaza los datos actuales
```

Para programar el respaldo diario, agrégalo a `cron` (por ejemplo, `0 2 * * *`).

## Seguridad

- Contraseñas con argon2id; sesión en una cookie `HttpOnly` y `SameSite=Lax`; el rol y el estado de
  la cuenta se revisan en cada petición, así que desactivar una cuenta le quita el acceso de inmediato.
- Límite de intentos: los inicios de sesión fallidos y las solicitudes de recuperación de contraseña
  se limitan por dirección IP y por cuenta (respuesta 429 con `Retry-After`).
- Cabeceras de seguridad en la API y en la SPA (política de contenido, `nosniff`, sin incrustación,
  sin caché de las respuestas de la API); HSTS en producción.
- La base de datos solo se publica en la máquina local; los secretos nunca se versionan ni entran en
  las imágenes (ver `.dockerignore`).
