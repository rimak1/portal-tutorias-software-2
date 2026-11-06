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
| Observer | `modules/citas/citas.eventos.ts` | Los cambios de estado se anuncian a suscriptores dentro de la misma transacción: el historial (`registrarEnHistorial`) y las notificaciones (`notificarCambioDeCita`). |
| Adapter + registro de fábricas | `modules/email/*`, `modules/auth/cifrado-argon2.ts`, `modules/auth/tokens-jwt.ts` | Cada proveedor externo se usa a través de una interfaz propia; `crearEmailSender` elige el adaptador según `EMAIL_ADAPTER`. |
| Data Mapper / DTO | `citas.mapper.ts`, `franjas.mapper.ts` | Convierte entidades del dominio en los objetos que responde la API. |

## Módulos agregados en la entrega 4

- **Notificaciones** (`modules/notificaciones`): `notificarCambioDeCita` es un suscriptor más de
  `CambiosDeCita`; redacta el aviso para la contraparte de quien hizo el cambio y lo guarda en la misma
  transacción, de modo que no hay cambio de estado sin su aviso ni al revés. El servicio solo lista y
  marca como leídos los avisos del usuario de la sesión. La SPA los consulta cada 30 s mientras la pestaña
  está visible (no hay comunicación en tiempo real).
- **Cuentas** (`modules/usuarios`): `GestionDeCuentasService` aplica quién puede qué (el administrador gestiona
  todas las cuentas; el coordinador solo registra y consulta tutores) y protege al sistema de quedarse sin
  administrador: no se puede desactivar la propia cuenta ni al último administrador activo (las filas de los
  administradores activos se bloquean durante la transacción). El rol de una cuenta no se modifica.
- **Histórico** (`modules/historico`): `HistoricoService` reúne las citas que cumplen los filtros (hasta un tope
  de 5.000), calcula con una función pura (`historico.resumen.ts`) los totales de todo el conjunto, pagina y
  exporta a CSV (`historico.csv.ts` neutraliza las celdas que una hoja de cálculo interpretaría como fórmulas).
- **Límite de intentos** (`lib/limitador-de-intentos.ts`, `modules/auth/limites-de-autenticacion.ts`): ventana
  deslizante en memoria, por IP y por cuenta. Solo cuentan los inicios de sesión fallidos. Al vivir en la memoria
  del proceso, cada réplica de la API llevaría su propia cuenta; con un solo nodo (el despliegue actual) basta.
- **Cabeceras de seguridad** (`plugins/cabeceras-de-seguridad.ts`).

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
