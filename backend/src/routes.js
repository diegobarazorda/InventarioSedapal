import { Router } from 'express';
import ExcelJS from 'exceljs';
import { pool, tx, HttpError } from './db.js';

const r = Router();
const wrap = (fn) => (req, res, next) => fn(req, res).catch(next);

/* ---------- utilidades ---------- */
const entero = (v, campo) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw new HttpError(400, `${campo} debe ser un entero mayor a 0`);
  return n;
};
const texto = (v) => String(v ?? '').trim() || null;
const fechaISO = (v) => {
  if (v && !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new HttpError(400, 'Fecha inválida');
  return v || null;
};
// Fecha elegida + hora actual, para que el historial conserve la hora real del registro
const conHora = (f) => (f ? `${f} ${new Date().toTimeString().slice(0, 8)}` : null);
const paginar = (q) => {
  const limit = Math.min(Number(q.limit) || 25, 200);
  const page = Math.max(Number(q.page) || 1, 1);
  return { limit, page, offset: (page - 1) * limit };
};

// "Stock bajo": hasta stock_minimo (si está definido) o hasta 3 unidades
const BAJO = '(p.stock_actual > 0 AND p.stock_actual <= IF(p.stock_minimo > 0, p.stock_minimo, 3))';

const PROD_FROM = 'FROM productos p JOIN unidades_medida u ON u.id = p.unidad_medida_id';
const PROD_COLS = `p.id, p.denominacion, p.numero_serie, p.modelo, p.marca, p.potencia,
  u.nombre AS unidad_medida, p.estado, p.stock_actual, DATE(p.created_at) AS fecha_entrada`;
const MOV_FROM = `FROM movimientos m
  JOIN productos p ON p.id = m.producto_id
  JOIN unidades_medida u ON u.id = p.unidad_medida_id
  LEFT JOIN tecnicos t ON t.id = m.tecnico_id`;
const MOV_COLS = `m.id, m.fecha_movimiento, m.tipo, p.denominacion, p.marca, p.modelo,
  m.cantidad, u.nombre AS unidad, m.guia, t.nombre AS tecnico, m.observacion`;

const COLS_PROD = [
  ['denominacion', 'Denominación'], ['numero_serie', 'N° serie'], ['modelo', 'Modelo'],
  ['marca', 'Marca'], ['potencia', 'Potencia / Especificación'], ['unidad_medida', 'Unidad'],
  ['estado', 'Estado'], ['stock_actual', 'Stock'], ['fecha_entrada', 'Fecha entrada'],
].map(([key, header]) => ({ key, header }));
const COLS_STOCK = COLS_PROD.filter((c) =>
  ['denominacion', 'marca', 'modelo', 'unidad_medida', 'stock_actual'].includes(c.key));
const COLS_MOV = [
  ['fecha_movimiento', 'Fecha'], ['tipo', 'Tipo'], ['denominacion', 'Producto'], ['marca', 'Marca'],
  ['modelo', 'Modelo'], ['cantidad', 'Cantidad'], ['unidad', 'Unidad'], ['guia', 'Guía'],
  ['tecnico', 'Técnico'], ['observacion', 'Observación'],
].map(([key, header]) => ({ key, header }));

function filtroProductos(q) {
  const w = ['p.activo = 1'], a = [];
  if (q.search) {
    const s = `%${q.search}%`;
    w.push('(p.denominacion LIKE ? OR p.marca LIKE ? OR p.modelo LIKE ? OR p.numero_serie LIKE ? OR p.potencia LIKE ?)');
    a.push(s, s, s, s, s);
  }
  if (q.estado === 'agotados') w.push('p.stock_actual = 0');
  if (q.estado === 'bajo') w.push(BAJO);
  return { where: w.join(' AND '), args: a };
}

function filtroMov(q) {
  const w = ['1=1'], a = [];
  if (q.tipo === 'ENTRADA' || q.tipo === 'SALIDA') { w.push('m.tipo = ?'); a.push(q.tipo); }
  if (q.desde) { w.push('m.fecha_movimiento >= ?'); a.push(fechaISO(q.desde)); }
  if (q.hasta) { w.push('m.fecha_movimiento < DATE_ADD(?, INTERVAL 1 DAY)'); a.push(fechaISO(q.hasta)); }
  if (q.search) {
    const s = `%${q.search}%`;
    w.push('(p.denominacion LIKE ? OR p.marca LIKE ? OR t.nombre LIKE ? OR m.observacion LIKE ?)');
    a.push(s, s, s, s);
  }
  return { where: w.join(' AND '), args: a };
}

/* ---------- lógica de negocio ---------- */
async function idTecnico(c, nombre) {
  await c.query('INSERT IGNORE INTO tecnicos (nombre) VALUES (?)', [nombre]);
  const [[t]] = await c.query('SELECT id FROM tecnicos WHERE nombre = ?', [nombre]);
  return t.id;
}

// Registra un movimiento y ajusta el stock (se llama siempre dentro de tx)
async function mover(c, m) {
  const [[p]] = await c.query('SELECT stock_actual FROM productos WHERE id = ? AND activo = 1 FOR UPDATE', [m.producto_id]);
  if (!p) throw new HttpError(404, 'El producto no existe');
  if (m.tipo === 'SALIDA' && p.stock_actual < m.cantidad)
    throw new HttpError(409, `Stock insuficiente (disponible: ${p.stock_actual})`);
  await c.query(
    `INSERT INTO movimientos (producto_id, tipo, cantidad, fecha_movimiento, guia, tecnico_id, observacion)
     VALUES (?, ?, ?, COALESCE(?, NOW()), ?, ?, ?)`,
    [m.producto_id, m.tipo, m.cantidad, m.fecha ?? null, m.guia ?? null, m.tecnico_id ?? null, m.observacion ?? null]);
  await c.query('UPDATE productos SET stock_actual = stock_actual + ? WHERE id = ?',
    [m.tipo === 'ENTRADA' ? m.cantidad : -m.cantidad, m.producto_id]);
}

/* ---------- catálogos ---------- */
r.get('/unidades', wrap(async (_q, res) => {
  const [rows] = await pool.query('SELECT id, nombre FROM unidades_medida ORDER BY nombre');
  res.json(rows);
}));
r.get('/tecnicos', wrap(async (_q, res) => {
  const [rows] = await pool.query('SELECT id, nombre FROM tecnicos WHERE activo = 1 ORDER BY nombre');
  res.json(rows);
}));

/* ---------- productos ---------- */
r.get('/productos/opciones', wrap(async (_q, res) => {
  const [rows] = await pool.query(
    `SELECT p.id, p.denominacion, p.marca, p.modelo, p.stock_actual, u.nombre AS unidad
     ${PROD_FROM} WHERE p.activo = 1 ORDER BY p.denominacion`);
  res.json(rows);
}));

r.get('/productos', wrap(async (req, res) => {
  const { where, args } = filtroProductos(req.query);
  const { limit, page, offset } = paginar(req.query);
  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM productos p WHERE ${where}`, args);
  const [rows] = await pool.query(
    `SELECT ${PROD_COLS} ${PROD_FROM} WHERE ${where} ORDER BY p.denominacion LIMIT ? OFFSET ?`,
    [...args, limit, offset]);
  res.json({ rows, total, page, limit });
}));

r.post('/productos', wrap(async (req, res) => {
  const b = req.body;
  const denominacion = texto(b.denominacion);
  if (!denominacion) throw new HttpError(400, 'La denominación es obligatoria');
  const cantidad = entero(b.cantidad, 'La cantidad');
  const fecha = fechaISO(b.fecha_entrada);
  if (!fecha) throw new HttpError(400, 'La fecha de entrada es obligatoria');
  if (!['Nuevo', 'Usado'].includes(b.estado)) throw new HttpError(400, 'Estado inválido');
  const unidad = (texto(b.unidad_medida) || 'UN').toUpperCase();

  const id = await tx(async (c) => {
    await c.query('INSERT IGNORE INTO unidades_medida (nombre) VALUES (?)', [unidad]);
    const [[u]] = await c.query('SELECT id FROM unidades_medida WHERE nombre = ?', [unidad]);
    const [ins] = await c.query(
      `INSERT INTO productos (denominacion, numero_serie, modelo, marca, potencia, unidad_medida_id, estado, stock_actual, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [denominacion, texto(b.numero_serie), texto(b.modelo), texto(b.marca), texto(b.potencia), u.id, b.estado, cantidad, fecha]);
    await c.query(
      `INSERT INTO movimientos (producto_id, tipo, cantidad, fecha_movimiento, guia) VALUES (?, 'ENTRADA', ?, ?, ?)`,
      [ins.insertId, cantidad, conHora(fecha), texto(b.guia_entrada)]);
    return ins.insertId;
  });
  res.status(201).json({ id });
}));

r.get('/productos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const [[p]] = await pool.query(
    `SELECT p.id, p.denominacion, p.numero_serie, p.modelo, p.marca, p.potencia,
            u.nombre AS unidad_medida, p.estado, p.stock_actual, p.stock_minimo
     ${PROD_FROM} WHERE p.id = ? AND p.activo = 1`, [id]);
  if (!p) throw new HttpError(404, 'El producto no existe');
  res.json(p);
}));

// Edita los datos descriptivos. El stock NO se toca aquí: solo cambia con movimientos.
r.put('/productos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const b = req.body;
  const denominacion = texto(b.denominacion);
  if (!denominacion) throw new HttpError(400, 'La denominación es obligatoria');
  if (!['Nuevo', 'Usado'].includes(b.estado)) throw new HttpError(400, 'Estado inválido');
  const minimo = Number(b.stock_minimo ?? 0);
  if (!Number.isInteger(minimo) || minimo < 0) throw new HttpError(400, 'El stock mínimo debe ser un entero de 0 o más');
  const unidad = (texto(b.unidad_medida) || 'UN').toUpperCase();

  await tx(async (c) => {
    await c.query('INSERT IGNORE INTO unidades_medida (nombre) VALUES (?)', [unidad]);
    const [[u]] = await c.query('SELECT id FROM unidades_medida WHERE nombre = ?', [unidad]);
    const [upd] = await c.query(
      `UPDATE productos SET denominacion = ?, numero_serie = ?, modelo = ?, marca = ?, potencia = ?,
              unidad_medida_id = ?, estado = ?, stock_minimo = ?
       WHERE id = ? AND activo = 1`,
      [denominacion, texto(b.numero_serie), texto(b.modelo), texto(b.marca), texto(b.potencia), u.id, b.estado, minimo, id]);
    if (!upd.affectedRows) throw new HttpError(404, 'El producto no existe');
  });
  res.json({ ok: true });
}));

/* ---------- movimientos ---------- */
r.post('/movimientos/entrada', wrap(async (req, res) => {
  const b = req.body;
  await tx((c) => mover(c, {
    producto_id: entero(b.producto_id, 'El producto'), tipo: 'ENTRADA',
    cantidad: entero(b.cantidad, 'La cantidad'), fecha: conHora(fechaISO(b.fecha)), guia: texto(b.guia),
  }));
  res.status(201).json({ ok: true });
}));

r.post('/movimientos/salida', wrap(async (req, res) => {
  const b = req.body;
  const tecnico = texto(b.tecnico);
  if (!tecnico) throw new HttpError(400, 'El técnico responsable es obligatorio');
  const dato = {
    producto_id: entero(b.producto_id, 'El producto'), tipo: 'SALIDA',
    cantidad: entero(b.cantidad, 'La cantidad'), fecha: conHora(fechaISO(b.fecha)), observacion: texto(b.observacion),
  };
  await tx(async (c) => mover(c, { ...dato, tecnico_id: await idTecnico(c, tecnico) }));
  res.status(201).json({ ok: true });
}));

r.get('/movimientos', wrap(async (req, res) => {
  const { where, args } = filtroMov(req.query);
  const { limit, page, offset } = paginar(req.query);
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total ${MOV_FROM} WHERE ${where}`, args);
  const [rows] = await pool.query(
    `SELECT ${MOV_COLS} ${MOV_FROM} WHERE ${where}
     ORDER BY m.fecha_movimiento DESC, m.id DESC LIMIT ? OFFSET ?`, [...args, limit, offset]);
  res.json({ rows, total, page, limit });
}));

/* ---------- dashboard ---------- */
r.get('/dashboard', wrap(async (_q, res) => {
  const [[k]] = await pool.query(
    `SELECT COUNT(*) AS productos, COALESCE(SUM(p.stock_actual), 0) AS unidades,
            COALESCE(SUM(p.stock_actual = 0), 0) AS agotados, COALESCE(SUM(${BAJO}), 0) AS bajo
     FROM productos p WHERE p.activo = 1`);
  const [mes] = await pool.query(
    `SELECT tipo, COUNT(*) AS movimientos, SUM(cantidad) AS unidades FROM movimientos
     WHERE fecha_movimiento >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY tipo`);
  const [bajos] = await pool.query(
    `SELECT p.id, p.denominacion, p.marca, p.stock_actual, u.nombre AS unidad
     ${PROD_FROM} WHERE p.activo = 1 AND ${BAJO} ORDER BY p.stock_actual, p.denominacion LIMIT 8`);
  const [ultimos] = await pool.query(
    `SELECT ${MOV_COLS} ${MOV_FROM} ORDER BY m.fecha_movimiento DESC, m.id DESC LIMIT 8`);
  res.json({
    kpis: Object.fromEntries(Object.entries(k).map(([a, b]) => [a, Number(b)])),
    mes: Object.fromEntries(mes.map((m) => [m.tipo, { movimientos: Number(m.movimientos), unidades: Number(m.unidades) }])),
    bajos, ultimos,
  });
}));

/* ---------- reportes (JSON o Excel con ?formato=xlsx) ---------- */
async function generarReporte(tipo, q) {
  if (tipo === 'movimientos') {
    const { where, args } = filtroMov(q);
    const [rows] = await pool.query(
      `SELECT ${MOV_COLS} ${MOV_FROM} WHERE ${where} ORDER BY m.fecha_movimiento DESC, m.id DESC`, args);
    return { titulo: 'Reporte de movimientos', columnas: COLS_MOV, rows };
  }
  if (!['general', 'busqueda', 'stock'].includes(tipo)) throw new HttpError(404, 'Reporte no existe');
  if (tipo === 'busqueda' && !texto(q.search)) throw new HttpError(400, 'Escribe un término de búsqueda');
  const { where, args } = filtroProductos(
    tipo === 'general' ? {} : tipo === 'stock' ? { estado: q.estado } : { search: q.search });
  const [rows] = await pool.query(
    `SELECT ${PROD_COLS} ${PROD_FROM} WHERE ${where} ORDER BY p.denominacion`, args);
  const titulos = { general: 'Reporte general', busqueda: 'Búsqueda de productos', stock: 'Reporte de stock' };
  return { titulo: titulos[tipo], columnas: tipo === 'stock' ? COLS_STOCK : COLS_PROD, rows };
}

r.get('/reportes/:tipo', wrap(async (req, res) => {
  const rep = await generarReporte(req.params.tipo, req.query);
  if (req.query.formato !== 'xlsx') return res.json(rep);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Reporte');
  ws.columns = rep.columnas.map((c) => ({ header: c.header, key: c.key, width: Math.max(c.header.length + 4, 18) }));
  ws.addRows(rep.rows);
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: 'A1', to: { row: 1, column: rep.columnas.length } };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.tipo}-${new Date().toISOString().slice(0, 10)}.xlsx"`);
  await wb.xlsx.write(res);
  res.end();
}));

export default r;
