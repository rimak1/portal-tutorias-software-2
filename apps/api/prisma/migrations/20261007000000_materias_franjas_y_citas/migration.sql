-- Materias, gestion de franjas, citas y su ciclo de vida.
-- Escrita a mano: conserva los datos existentes (la materia pasa de texto libre
-- a catalogo) y declara las restricciones que Prisma no sabe expresar.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- CreateEnum
CREATE TYPE "estado_franja" AS ENUM ('LIBRE', 'RESERVADA');
CREATE TYPE "estado_cita" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA', 'FINALIZADA');
CREATE TYPE "estado_propuesta" AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');

-- CreateTable materia
CREATE TABLE "materia" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "materia_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "materia_nombre_key" ON "materia"("nombre");

-- CreateTable tutor_materia (SWR-20)
CREATE TABLE "tutor_materia" (
    "tutor_id" UUID NOT NULL,
    "materia_id" UUID NOT NULL,

    CONSTRAINT "tutor_materia_pkey" PRIMARY KEY ("tutor_id", "materia_id")
);

-- Conserva los datos: cada texto de materia existente pasa al catalogo y al perfil de su tutor.
INSERT INTO "materia" ("id", "nombre")
SELECT gen_random_uuid(), "nombre" FROM (SELECT DISTINCT "materia" AS "nombre" FROM "disponibilidad") AS existentes;

ALTER TABLE "disponibilidad" ADD COLUMN "materia_id" UUID;
UPDATE "disponibilidad" SET "materia_id" = "materia"."id" FROM "materia" WHERE "materia"."nombre" = "disponibilidad"."materia";
ALTER TABLE "disponibilidad" ALTER COLUMN "materia_id" SET NOT NULL;

INSERT INTO "tutor_materia" ("tutor_id", "materia_id")
SELECT DISTINCT "tutor_id", "materia_id" FROM "disponibilidad";

ALTER TABLE "disponibilidad" DROP COLUMN "materia";

-- Las fechas se almacenan con zona horaria; los valores previos estaban en UTC.
ALTER TABLE "disponibilidad"
    ALTER COLUMN "fecha_inicio" TYPE TIMESTAMPTZ(3) USING "fecha_inicio" AT TIME ZONE 'UTC',
    ALTER COLUMN "fecha_fin" TYPE TIMESTAMPTZ(3) USING "fecha_fin" AT TIME ZONE 'UTC';

ALTER TABLE "disponibilidad"
    ADD COLUMN "estado" "estado_franja" NOT NULL DEFAULT 'LIBRE',
    ADD COLUMN "eliminada_en" TIMESTAMPTZ(3);

CREATE INDEX "disponibilidad_tutor_id_fecha_inicio_idx" ON "disponibilidad"("tutor_id", "fecha_inicio");

-- SWR-03: horas coherentes.
ALTER TABLE "disponibilidad"
    ADD CONSTRAINT "disponibilidad_horas_coherentes" CHECK ("fecha_fin" > "fecha_inicio");

-- SWR-04: un tutor no puede tener franjas traslapadas; los rangos semiabiertos
-- permiten franjas contiguas. Las franjas eliminadas logicamente no cuentan.
ALTER TABLE "disponibilidad"
    ADD CONSTRAINT "disponibilidad_sin_traslape"
    EXCLUDE USING gist ("tutor_id" WITH =, tstzrange("fecha_inicio", "fecha_fin", '[)') WITH &&)
    WHERE ("eliminada_en" IS NULL);

-- CreateTable cita
CREATE TABLE "cita" (
    "id" UUID NOT NULL,
    "estudiante_id" UUID NOT NULL,
    "franja_id" UUID NOT NULL,
    "estado" "estado_cita" NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,
    "fecha_finalizacion" TIMESTAMPTZ(3),

    CONSTRAINT "cita_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "cita_estudiante_id_estado_idx" ON "cita"("estudiante_id", "estado");
CREATE INDEX "cita_estado_fecha_finalizacion_idx" ON "cita"("estado", "fecha_finalizacion");

-- SWR-09: una sola cita activa por franja, aun con reservas simultaneas.
CREATE UNIQUE INDEX "cita_franja_activa_key" ON "cita"("franja_id") WHERE "estado" IN ('PENDIENTE', 'APROBADA');

-- SWR-12: toda cita rechazada guarda un motivo no vacio.
ALTER TABLE "cita"
    ADD CONSTRAINT "cita_motivo_rechazo_obligatorio"
    CHECK ("estado" <> 'RECHAZADA' OR length(trim("motivo_rechazo")) > 0);

-- CreateTable propuesta_reprogramacion (SWR-11)
CREATE TABLE "propuesta_reprogramacion" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "franja_original_id" UUID NOT NULL,
    "franja_nueva_id" UUID NOT NULL,
    "estado" "estado_propuesta" NOT NULL DEFAULT 'PENDIENTE',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondido_en" TIMESTAMPTZ(3),

    CONSTRAINT "propuesta_reprogramacion_pkey" PRIMARY KEY ("id")
);

-- Una sola propuesta pendiente por cita.
CREATE UNIQUE INDEX "propuesta_pendiente_por_cita_key" ON "propuesta_reprogramacion"("cita_id") WHERE "estado" = 'PENDIENTE';

-- CreateTable historial_estado_cita (BR-04)
CREATE TABLE "historial_estado_cita" (
    "id" UUID NOT NULL,
    "cita_id" UUID NOT NULL,
    "estado_anterior" "estado_cita",
    "estado_nuevo" "estado_cita" NOT NULL,
    "actor_id" UUID NOT NULL,
    "detalle" TEXT,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estado_cita_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "historial_estado_cita_cita_id_creado_en_idx" ON "historial_estado_cita"("cita_id", "creado_en");

-- AddForeignKey
ALTER TABLE "tutor_materia" ADD CONSTRAINT "tutor_materia_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tutor_materia" ADD CONSTRAINT "tutor_materia_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_materia_id_fkey" FOREIGN KEY ("materia_id") REFERENCES "materia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cita" ADD CONSTRAINT "cita_estudiante_id_fkey" FOREIGN KEY ("estudiante_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cita" ADD CONSTRAINT "cita_franja_id_fkey" FOREIGN KEY ("franja_id") REFERENCES "disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "propuesta_reprogramacion" ADD CONSTRAINT "propuesta_reprogramacion_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "propuesta_reprogramacion" ADD CONSTRAINT "propuesta_reprogramacion_franja_original_id_fkey" FOREIGN KEY ("franja_original_id") REFERENCES "disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "propuesta_reprogramacion" ADD CONSTRAINT "propuesta_reprogramacion_franja_nueva_id_fkey" FOREIGN KEY ("franja_nueva_id") REFERENCES "disponibilidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_estado_cita" ADD CONSTRAINT "historial_estado_cita_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "historial_estado_cita" ADD CONSTRAINT "historial_estado_cita_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
