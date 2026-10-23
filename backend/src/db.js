import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'inventario',
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
