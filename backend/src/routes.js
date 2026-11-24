import express, { Router } from 'express';
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
const enteroNoNegativo = (v, campo) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new HttpError(400, `${campo} debe ser un entero de 0 o más`);
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

// Edita los datos del producto, incluido el stock actual (ajuste manual).
r.put('/productos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const b = req.body;
  const denominacion = texto(b.denominacion);
  if (!denominacion) throw new HttpError(400, 'La denominación es obligatoria');
  if (!['Nuevo', 'Usado'].includes(b.estado)) throw new HttpError(400, 'Estado inválido');
  const minimo = enteroNoNegativo(b.stock_minimo ?? 0, 'El stock mínimo');
  const stock = enteroNoNegativo(b.stock_actual, 'El stock actual');
  const unidad = (texto(b.unidad_medida) || 'UN').toUpperCase();

  await tx(async (c) => {
    await c.query('INSERT IGNORE INTO unidades_medida (nombre) VALUES (?)', [unidad]);
    const [[u]] = await c.query('SELECT id FROM unidades_medida WHERE nombre = ?', [unidad]);
    const [upd] = await c.query(
      `UPDATE productos SET denominacion = ?, numero_serie = ?, modelo = ?, marca = ?, potencia = ?,
              unidad_medida_id = ?, estado = ?, stock_minimo = ?, stock_actual = ?
       WHERE id = ? AND activo = 1`,
      [denominacion, texto(b.numero_serie), texto(b.modelo), texto(b.marca), texto(b.potencia), u.id, b.estado, minimo, stock, id]);
    if (!upd.affectedRows) throw new HttpError(404, 'El producto no existe');
  });
  res.json({ ok: true });
}));

/* ---------- activos fijos (registro AF del SAP) ---------- */
const AF_COLS = `id, numero, activo_fijo, nro_inventario, denominacion, marca, serie, modelo, ceco,
  emplazamiento, local, nro_personal, nombre_personal, nota_inventario, verificado`;
const verificacion = (v) => {
  if (v !== 'SI' && v !== 'NO') throw new HttpError(400, 'La verificación debe ser SI o NO');
  return v;
};

// Valores ya usados, para sugerir al editar la ficha y filtrar reportes
r.get('/activos/opciones', wrap(async (_q, res) => {
  const [notas] = await pool.query(
    'SELECT DISTINCT nota_inventario AS v FROM activos_fijos WHERE nota_inventario IS NOT NULL ORDER BY v');
  const [personal] = await pool.query(
    `SELECT nro_personal, nombre_personal FROM activos_fijos WHERE nombre_personal IS NOT NULL
     GROUP BY nro_personal, nombre_personal ORDER BY nombre_personal`);
  res.json({ notas: notas.map((n) => n.v), personal });
}));

// Busca un activo por su código de activo fijo y devuelve su N° correlativo para abrir la ficha.
// Primero exacto; si no hay, por coincidencia parcial (solo si queda uno).
r.get('/activos/buscar', wrap(async (req, res) => {
  const af = texto(req.query.af);
  if (!af) throw new HttpError(400, 'Escribe el código de activo fijo');
  const ORDENADOS = `SELECT id, activo_fijo, denominacion, ROW_NUMBER() OVER (ORDER BY numero, id) AS orden
    FROM activos_fijos`;
  let [rows] = await pool.query(`SELECT * FROM (${ORDENADOS}) t WHERE activo_fijo = ? ORDER BY orden`, [af]);
  if (!rows.length) {
    [rows] = await pool.query(`SELECT * FROM (${ORDENADOS}) t WHERE activo_fijo LIKE ? ORDER BY orden LIMIT 6`, [`%${af}%`]);
  }
  if (!rows.length) throw new HttpError(404, `No existe el activo fijo ${af}`);
  if (rows.length > 1 && rows[0].activo_fijo !== af) {
    const lista = rows.slice(0, 5).map((r) => r.activo_fijo).join(', ');
    throw new HttpError(409, `Hay varios activos que contienen "${af}" (${lista}${rows.length > 5 ? '…' : ''}). Escribe el código completo.`);
  }
  res.json({ orden: Number(rows[0].orden), activo_fijo: rows[0].activo_fijo });
}));

// Ficha: un activo por su N° correlativo (1, 2, 3…), con el total para navegar
r.get('/activos/ficha/:n', wrap(async (req, res) => {
  const n = entero(req.params.n, 'El N°');
  const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM activos_fijos');
  const [[row]] = await pool.query(
    `SELECT * FROM (SELECT ${AF_COLS}, foto_tipo IS NOT NULL AS tiene_foto,
       ROW_NUMBER() OVER (ORDER BY numero, id) AS orden FROM activos_fijos) t WHERE orden = ?`, [n]);
  if (!row) throw new HttpError(404, `No existe el N° ${n} (hay ${total} activos)`);
  res.json({ ...row, tiene_foto: Boolean(row.tiene_foto), orden: Number(row.orden), total: Number(total) });
}));

/* ---------- foto del activo (se guarda en la base de datos) ---------- */
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
r.get('/activos/:id/foto', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const [[row]] = await pool.query('SELECT foto, foto_tipo FROM activos_fijos WHERE id = ?', [id]);
  if (!row?.foto) throw new HttpError(404, 'El activo no tiene foto');
  res.set('Content-Type', row.foto_tipo).set('Cache-Control', 'no-cache').send(row.foto);
}));
r.put('/activos/:id/foto', express.raw({ type: 'image/*', limit: '8mb' }), wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const tipo = req.get('Content-Type');
  if (!TIPOS_FOTO.includes(tipo)) throw new HttpError(400, 'La foto debe ser JPG, PNG, WEBP o GIF');
  if (!Buffer.isBuffer(req.body) || !req.body.length) throw new HttpError(400, 'No se recibió la imagen');
  const [upd] = await pool.query('UPDATE activos_fijos SET foto = ?, foto_tipo = ? WHERE id = ?', [req.body, tipo, id]);
  if (!upd.affectedRows) throw new HttpError(404, 'El activo fijo no existe');
  res.json({ ok: true });
}));
r.delete('/activos/:id/foto', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const [upd] = await pool.query('UPDATE activos_fijos SET foto = NULL, foto_tipo = NULL WHERE id = ?', [id]);
  if (!upd.affectedRows) throw new HttpError(404, 'El activo fijo no existe');
  res.json({ ok: true });
}));

// Edición completa de un activo fijo (todos los campos)
const AF_EDITABLES = [
  ['activo_fijo', 30, 'El código de activo fijo es obligatorio'], ['nro_inventario', 50], ['denominacion', 255, 'La denominación es obligatoria'],
  ['marca', 100], ['serie', 100], ['modelo', 100], ['ceco', 20], ['emplazamiento', 150], ['local', 50],
  ['nro_personal', 20], ['nombre_personal', 150], ['nota_inventario', 100],
];
const leerActivo = (b) => AF_EDITABLES.map(([k, max, obligatorio]) => {
  const v = texto(b[k]);
  if (obligatorio && !v) throw new HttpError(400, obligatorio);
  if (v && v.length > max) throw new HttpError(400, `El campo ${k.replace('_', ' ')} admite hasta ${max} caracteres`);
  return v;
});

// Nuevo activo: va al final de la lista (N° interno = el mayor + 1). Devuelve su N° correlativo
r.post('/activos', wrap(async (req, res) => {
  const valores = leerActivo(req.body);
  const verif = verificacion(req.body.verificado || 'NO');
  const [ins] = await pool.query(
    `INSERT INTO activos_fijos (numero, ${AF_EDITABLES.map(([k]) => k).join(', ')}, verificado)
     SELECT COALESCE(MAX(numero), 0) + 1, ${AF_EDITABLES.map(() => '?').join(', ')}, ? FROM activos_fijos`,
    [...valores, verif]);
  const [[{ orden }]] = await pool.query(
    `SELECT orden FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY numero, id) AS orden FROM activos_fijos) t
     WHERE id = ?`, [ins.insertId]);
  res.status(201).json({ id: ins.insertId, orden: Number(orden) });
}));

r.delete('/activos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const [del] = await pool.query('DELETE FROM activos_fijos WHERE id = ?', [id]);
  if (!del.affectedRows) throw new HttpError(404, 'El activo fijo no existe');
  res.json({ ok: true });
}));

r.put('/activos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const b = req.body;
  const valores = leerActivo(b);
  const numero = b.numero === '' || b.numero == null ? null : enteroNoNegativo(b.numero, 'El N°');
  const [upd] = await pool.query(
    `UPDATE activos_fijos SET numero = ?, ${AF_EDITABLES.map(([k]) => `${k} = ?`).join(', ')}, verificado = ?
     WHERE id = ?`, [numero, ...valores, verificacion(b.verificado), id]);
  if (!upd.affectedRows) throw new HttpError(404, 'El activo fijo no existe');
  const [[row]] = await pool.query(`SELECT ${AF_COLS} FROM activos_fijos WHERE id = ?`, [id]);
  res.json(row);
}));

// Actualiza solo los campos enviados: nro_inventario y/o verificado
r.patch('/activos/:id', wrap(async (req, res) => {
  const id = entero(req.params.id, 'El id');
  const b = req.body, sets = [], a = [];
  if ('nro_inventario' in b) { sets.push('nro_inventario = ?'); a.push(texto(b.nro_inventario)); }
  if ('verificado' in b) { sets.push('verificado = ?'); a.push(verificacion(b.verificado)); }
  if (!sets.length) throw new HttpError(400, 'Nada que actualizar');
  const [upd] = await pool.query(`UPDATE activos_fijos SET ${sets.join(', ')} WHERE id = ?`, [...a, id]);
  if (!upd.affectedRows) throw new HttpError(404, 'El activo fijo no existe');
  const [[row]] = await pool.query(`SELECT ${AF_COLS} FROM activos_fijos WHERE id = ?`, [id]);
  res.json(row);
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
const COLS_ACTIVOS = [
  ['orden', 'N°'], ['activo_fijo', 'Activo fijo'], ['nro_inventario', 'N° inventario'], ['denominacion', 'Denominación'],
  ['marca', 'Marca'], ['serie', 'Serie'], ['modelo', 'Modelo'], ['ceco', 'CeCo'], ['emplazamiento', 'Emplazamiento'],
  ['local', 'Local'], ['nro_personal', 'Nº pers. (ficha)'], ['nombre_personal', 'Nombre personal'],
  ['nota_inventario', 'Nota invent.'], ['verificado', 'Verificación'], ['foto', 'Foto'],
].map(([key, header]) => ({ key, header }));

async function reporteActivos(q) {
  const w = ['1=1'], a = [];
  if (q.verificado === 'SI' || q.verificado === 'NO') { w.push('verificado = ?'); a.push(q.verificado); }
  if (q.responsable === '-') w.push('nombre_personal IS NULL');
  else if (texto(q.responsable)) { w.push('nombre_personal = ?'); a.push(texto(q.responsable)); }
  if (q.nota === '-') w.push('nota_inventario IS NULL');
  else if (texto(q.nota)) { w.push('nota_inventario = ?'); a.push(texto(q.nota)); }
  if (q.foto === 'SI' || q.foto === 'NO') { w.push('foto = ?'); a.push(q.foto); }
  const [rows] = await pool.query(
    `SELECT * FROM (SELECT ${AF_COLS}, IF(foto_tipo IS NULL, 'NO', 'SI') AS foto,
       ROW_NUMBER() OVER (ORDER BY numero, id) AS orden FROM activos_fijos) t
     WHERE ${w.join(' AND ')} ORDER BY orden`, a);
  return { titulo: 'Reporte de activos fijos', columnas: COLS_ACTIVOS, rows: rows.map((r) => ({ ...r, orden: Number(r.orden) })) };
}

async function generarReporte(tipo, q) {
  if (tipo === 'activos') return reporteActivos(q);
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
