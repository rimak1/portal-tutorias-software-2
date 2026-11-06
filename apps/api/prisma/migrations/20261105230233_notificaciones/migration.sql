-- CreateTable
CREATE TABLE "notificacion" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "cita_id" UUID,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "leida_en" TIMESTAMPTZ(3),
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_creado_en_idx" ON "notificacion"("usuario_id", "creado_en");

-- CreateIndex
CREATE INDEX "notificacion_usuario_id_leida_en_idx" ON "notificacion"("usuario_id", "leida_en");

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notificacion" ADD CONSTRAINT "notificacion_cita_id_fkey" FOREIGN KEY ("cita_id") REFERENCES "cita"("id") ON DELETE SET NULL ON UPDATE CASCADE;
