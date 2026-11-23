import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'inventario_sedapal',
  charset: 'utf8mb4',
  dateStrings: true, // fechas como texto 'YYYY-MM-DD', sin problemas de zona horaria
  connectionLimit: 10,
});

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Ejecuta fn dentro de una transacción (commit si todo sale bien, rollback si falla)
export async function tx(fn) {
  const c = await pool.getConnection();
  try {
    await c.beginTransaction();
    const out = await fn(c);
    await c.commit();
    return out;
  } catch (e) {
    await c.rollback();
    throw e;
  } finally {
    c.release();
  }
}

// Agrega las columnas de foto a activos_fijos si la tabla aún no las tiene (bases creadas antes)
export async function migrar() {
  const [[{ hay }]] = await pool.query(
    `SELECT COUNT(*) AS hay FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'activos_fijos' AND column_name = 'foto'`);
  if (hay) return;
  const [[{ tabla }]] = await pool.query(
    `SELECT COUNT(*) AS tabla FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'activos_fijos'`);
  if (!tabla) return;
  await pool.query(`ALTER TABLE activos_fijos
    ADD COLUMN foto MEDIUMBLOB DEFAULT NULL, ADD COLUMN foto_tipo VARCHAR(30) DEFAULT NULL`);
  console.log('Columnas de foto agregadas a activos_fijos');
}
