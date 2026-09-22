-- CreateEnum
CREATE TYPE "rol_usuario" AS ENUM ('ESTUDIANTE', 'TUTOR', 'ADMINISTRADOR', 'COORDINADOR');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "correo" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "rol_usuario" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_por_id" UUID,
    "creado_en" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_correo_key" ON "usuario"("correo");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_creado_por_id_fkey" FOREIGN KEY ("creado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
