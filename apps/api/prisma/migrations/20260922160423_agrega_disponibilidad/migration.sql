-- CreateTable
CREATE TABLE "disponibilidad" (
    "id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "materia" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(3) NOT NULL,
    "fecha_fin" TIMESTAMP(3) NOT NULL,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilidad_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "disponibilidad_fecha_inicio_idx" ON "disponibilidad"("fecha_inicio");

-- AddForeignKey
ALTER TABLE "disponibilidad" ADD CONSTRAINT "disponibilidad_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
