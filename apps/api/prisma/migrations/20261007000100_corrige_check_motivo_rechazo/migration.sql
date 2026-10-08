-- SWR-12: el CHECK anterior dejaba pasar una cita Rechazada con motivo NULL, porque
-- length(trim(NULL)) > 0 evalua a NULL y PostgreSQL solo rechaza un CHECK cuando da FALSE.
ALTER TABLE "cita" DROP CONSTRAINT "cita_motivo_rechazo_obligatorio";

ALTER TABLE "cita"
    ADD CONSTRAINT "cita_motivo_rechazo_obligatorio"
    CHECK ("estado" <> 'RECHAZADA' OR ("motivo_rechazo" IS NOT NULL AND length(trim("motivo_rechazo")) > 0));
