// Importa los activos fijos de la hoja "Registro AF del SAP" del Excel a la tabla activos_fijos.
// Uso: npm run importar-activos -- [ruta/al/archivo.xlsx]   (por defecto ../datos-inventario.xlsx)
// Si la tabla ya tiene datos no hace nada, salvo que se pase --reemplazar.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { pool } from './db.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const reemplazar = args.includes('--reemplazar');
const archivo = path.resolve(args.find((a) => !a.startsWith('--')) || path.join(dir, '../../datos-inventario.xlsx'));
const HOJA = 'Registro AF del SAP';
const FILA_INICIO = 4; // filas 1-3 son títulos y encabezados

// Convierte una celda de exceljs a texto plano (o null)
function txt(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10); // series que Excel tomó como fecha
  if (typeof v === 'object') {
    if (v.richText) v = v.richText.map((t) => t.text).join('');
    else if ('result' in v) v = v.result;
    else if (v.text) v = v.text;
  }
  const s = String(v ?? '').trim();
  return s || null;
}

async function main() {
  const sql = fs.readFileSync(path.join(dir, '../sql/activos_fijos.sql'), 'utf8');
  await pool.query(sql);

  const [[{ n }]] = await pool.query('SELECT COUNT(*) AS n FROM activos_fijos');
  if (n > 0 && !reemplazar) {
    console.log(`La tabla activos_fijos ya tiene ${n} registros. Usa --reemplazar para volver a importar.`);
    return;
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(archivo);
  const ws = wb.getWorksheet(HOJA);
  if (!ws) throw new Error(`No se encontró la hoja "${HOJA}" en ${archivo}`);

  const filas = [];
  for (let i = FILA_INICIO; i <= ws.rowCount; i++) {
    const v = ws.getRow(i).values; // v[1] = columna A (N°), v[2] = Activo fijo, ...
    // Las filas de datos tienen el código de activo fijo numérico; al llegar a la leyenda se termina
    if (typeof v[2] !== 'number') { if (filas.length) break; continue; }
    const activo = txt(v[2]), denominacion = txt(v[3]);
    if (!activo || !denominacion) continue;
    const numero = Number.isInteger(v[1]) ? v[1] : null;
    const nroPersonal = txt(v[10]) === '0' ? null : txt(v[10]); // 0 = sin custodio asignado
    filas.push([
      numero, activo, denominacion, txt(v[4]), txt(v[5]), txt(v[6]), txt(v[7]), txt(v[8]),
      txt(v[9]), nroPersonal, txt(v[11]), txt(v[12]),
    ]);
  }

  if (reemplazar) await pool.query('DELETE FROM activos_fijos');
  await pool.query(
    `INSERT INTO activos_fijos (numero, activo_fijo, denominacion, marca, serie, modelo, ceco,
       emplazamiento, local, nro_personal, nombre_personal, nota_inventario) VALUES ?`, [filas]);
  console.log(`Importados ${filas.length} activos fijos desde ${path.basename(archivo)}.`);
}

main()
  .catch((e) => { console.error('Error:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
