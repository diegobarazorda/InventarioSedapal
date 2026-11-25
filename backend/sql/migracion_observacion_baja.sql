-- =====================================================================
-- Migración de la tabla activos_fijos (para una base que ya tiene datos)
--  * Quita "Emplazamiento" (repetía el Local) y en su lugar crea "Observación",
--    ubicada después de Nota invent. El texto "PTAR Santa Clara." se borra.
--  * Agrega "Baja" (SI/NO) y "Fecha de baja".
-- Conserva todos los demás datos: N° de inventario, verificación, fotos, etc.
--
-- Uso (terminal):  mysql -u TU_USUARIO -p inventario_sedapal < migracion_observacion_baja.sql
-- Uso (MySQL Workbench): seleccionar la base inventario_sedapal, abrir y ejecutar.
-- Ejecutar UNA sola vez.
-- =====================================================================

ALTER TABLE activos_fijos
  CHANGE COLUMN emplazamiento observacion VARCHAR(500) DEFAULT NULL AFTER nota_inventario,
  ADD COLUMN baja ENUM('SI','NO') NOT NULL DEFAULT 'NO' AFTER verificado,
  ADD COLUMN fecha_baja DATE DEFAULT NULL AFTER baja;

UPDATE activos_fijos SET observacion = NULL WHERE observacion = 'PTAR Santa Clara.';
