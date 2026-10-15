# Arquitectura

Este documento explica cómo está organizado el código y qué patrones de diseño
usa, y dónde. Los comentarios del código describen qué hace cada pieza y qué
regla de negocio cumple; las decisiones de diseño se explican aquí.

## Capas del backend (`apps/api`)

```
rutas (Fastify)  →  servicios (casos de uso)  →  puertos (interfaces)  ←  repositorios (Prisma)
```

- **Rutas** (`*.routes.ts`): validan la entrada con los esquemas de
  `@portal-tutorias/shared`, exigen el rol con `requireAuth` y delegan en un
  servicio. No contienen reglas de negocio.
- **Servicios** (`*.service.ts`): un caso de uso por método. Dependen solo de
  interfaces (`*.puertos.ts`, `db/puertos.ts`, `Reloj`, `EmailSender`,
  `CifradoDePasswords`, `TokensDe*`), nunca de Prisma, argon2 ni JWT.
- **Repositorios** (`*.repository.ts`): implementan los puertos con Prisma y
  traducen las violaciones de restricciones de PostgreSQL a errores de negocio
  (`FranjaTraslapada`, `FranjaYaReservada`) mediante `db/errores-postgres.ts`.
- **Composición** (`contenedor.ts`): el único módulo que crea las clases
  concretas y las conecta. Las pruebas reemplazan piezas sin tocar los servicios.

### Errores

Las reglas de negocio lanzan `ErrorDeNegocio` (o una subclase) con un código
HTTP y un mensaje para el usuario. `middleware/manejador-de-errores.ts` los
convierte en la respuesta; cualquier otro error se registra y responde 500 con
un mensaje genérico, sin exponer detalles internos.

## Patrones de diseño

| Patrón | Dónde | Para qué |
| --- | --- | --- |
| Inyección de dependencias con raíz de composición | `contenedor.ts` | Los servicios reciben sus dependencias por constructor y se prueban con dobles en memoria (`test/fakes.ts`). |
| Repository | `*.repository.ts` + `*.puertos.ts` | Aísla el acceso a datos detrás de interfaces pequeñas (lectura, escritura, bloqueo). |
| Unit of Work | `db/unidad-de-trabajo.prisma.ts` | `ejecutar` corre un caso de uso en una transacción con repositorios ligados a ella. |
| State | `modules/citas/cita.estados.ts` | Cada estado de la cita decide qué acciones admite y a qué estado llevan (RN-006). |
| Observer | `modules/citas/citas.eventos.ts` | Los cambios de estado se anuncian a suscriptores (hoy, el historial) dentro de la misma transacción. |
| Adapter + registro de fábricas | `modules/email/*`, `modules/auth/cifrado-argon2.ts`, `modules/auth/tokens-jwt.ts` | Cada proveedor externo se usa a través de una interfaz propia; `crearEmailSender` elige el adaptador según `EMAIL_ADAPTER`. |
| Data Mapper / DTO | `citas.mapper.ts`, `franjas.mapper.ts` | Convierte entidades del dominio en los objetos que responde la API. |

`EjecutorDeTransiciones` reúne en un solo procedimiento lo común a toda acción
sobre una cita (bloquear, autorizar, consultar al estado, aplicar, anunciar).
Cada acción aporta solo lo que varía (`decidir`, `datos`, `efectos`) como
funciones, de modo que los servicios de estudiante y de tutor no repiten ese
procedimiento.

## Frontend (`apps/web`)

- `lib/api/*`: una función por operación de la API; los componentes no conocen
  rutas HTTP ni la forma de las respuestas.
- `lib/use-datos.ts` y `lib/use-acciones-cita.ts`: hooks para cargar recursos y
  ejecutar acciones sobre citas con estado de carga y de error.
- `lib/acciones-cita.ts`: qué acciones se ofrecen en cada vista según el estado
  de la cita. Deben coincidir con las transiciones del backend.
- `pages/panels/estudiante/reserva-wizard.ts`: reductor puro que controla el
  avance entre los pasos de la reserva.
- `components/Mensajes.tsx` e `Iconos.tsx`: piezas de interfaz compartidas.
