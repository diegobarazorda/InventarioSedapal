// Genera sql/activos_fijos_completo.sql: crea la tabla activos_fijos y carga todos los activos
// tal como están ahora en la base (sin las fotos). Sirve para pasar los datos a otra PC.
// Uso: npm run exportar-activos
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(dir, '../sql/activos_fijos_completo.sql');
const COLS = ['id', 'numero', 'activo_fijo', 'nro_inventario', 'denominacion', 'marca', 'serie', 'modelo', 'ceco',
  'local', 'nro_personal', 'nombre_personal', 'nota_inventario', 'observacion', 'verificado', 'baja', 'fecha_baja'];

async function main() {
  const [rows] = await pool.query(`SELECT ${COLS.join(', ')} FROM activos_fijos ORDER BY id`);
  const tabla = fs.readFileSync(path.join(dir, '../sql/activos_fijos.sql'), 'utf8').replace(/^--.*\n/, '').trim();
  const lineas = rows.map((r) => '  (' + COLS.map((c) => pool.escape(r[c])).join(', ') + ')');
  const bloques = [];
  for (let i = 0; i < lineas.length; i += 100) {
    bloques.push(`INSERT INTO activos_fijos (${COLS.map((c) => '`' + c + '`').join(', ')}) VALUES\n`
      + lineas.slice(i, i + 100).join(',\n') + ';');
  }
  const sql = `-- =====================================================================
-- Inventario de activos fijos - PTAR Santa Clara (registro AF del SAP)
-- Crea la tabla activos_fijos y carga los ${rows.length} activos.
--
-- Uso (terminal):  mysql -u TU_USUARIO -p < activos_fijos_completo.sql
-- Uso (MySQL Workbench): File > Open SQL Script… y ejecutar todo (rayo).
-- Crea la base inventario_sedapal si no existe.
--
-- ATENCIÓN: si la tabla activos_fijos ya existe, se BORRA y se vuelve a crear
-- (las fotos no van en este script). Para actualizar una base que ya tiene
-- datos sin perderlos, usar migracion_observacion_baja.sql.
-- =====================================================================

SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS inventario_sedapal CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE inventario_sedapal;

DROP TABLE IF EXISTS activos_fijos;

${tabla}

${bloques.join('\n\n')}
`;
  fs.writeFileSync(SALIDA, sql);
  console.log(`Generado ${path.relative(process.cwd(), SALIDA)} con ${rows.length} activos.`);
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
