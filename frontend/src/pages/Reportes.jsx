import { useState } from 'react';
import { get, urlExcel } from '../api.js';
import { Field, Table } from '../ui.jsx';

export default function Reportes() {
  const [tipo, setTipo] = useState('general');
  const [p, setP] = useState({ search: '', estado: '', desde: '', hasta: '', mov: '' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setP({ ...p, [k]: e.target.value });

  const params =
    tipo === 'busqueda' ? { search: p.search } :
    tipo === 'stock' ? { estado: p.estado } :
    tipo === 'movimientos' ? { desde: p.desde, hasta: p.hasta, tipo: p.mov } : {};
  const incompleto = tipo === 'busqueda' && !p.search.trim();

  async function ver() {
    setErr('');
    try { setRes(await get('/reportes/' + tipo, params)); }
    catch (e) { setErr(e.message); setRes(null); }
  }

  return (
    <>
      <h2>Reportes</h2>
      <p className="page-sub">Consulta la información del inventario en pantalla o descárgala en Excel.</p>
      <div className="card form-card">
        <div className="form-block">
          <h3>Configuración del reporte</h3>
          <p className="hint">Elige el tipo de reporte y ajusta los filtros disponibles.</p>
          <div className="form-grid cols-3">
            <Field label="Tipo de reporte">
              <select value={tipo} onChange={(e) => { setTipo(e.target.value); setRes(null); setErr(''); }}>
                <option value="general">Reporte general</option>
                <option value="busqueda">Búsqueda de productos</option>
                <option value="stock">Reporte de stock</option>
                <option value="movimientos">Movimientos (entradas / salidas)</option>
              </select>
            </Field>
            {tipo === 'busqueda' && <Field label="Buscar"><input value={p.search} onChange={set('search')} /></Field>}
            {tipo === 'stock' && (
              <Field label="Mostrar">
                <select value={p.estado} onChange={set('estado')}>
                  <option value="">Todo el stock</option><option value="bajo">Stock bajo</option><option value="agotados">Agotados</option>
                </select>
              </Field>
            )}
            {tipo === 'movimientos' && (
              <>
                <Field label="Tipo"><select value={p.mov} onChange={set('mov')}>
                  <option value="">Entradas y salidas</option><option value="ENTRADA">Entradas</option><option value="SALIDA">Salidas</option>
                </select></Field>
                <Field label="Desde"><input type="date" value={p.desde} onChange={set('desde')} /></Field>
                <Field label="Hasta"><input type="date" value={p.hasta} onChange={set('hasta')} /></Field>
              </>
            )}
          </div>
        </div>
        <div className="acciones">
          <button className="btn sec" onClick={ver} disabled={incompleto}>Ver en pantalla</button>
          {incompleto
            ? <button className="btn" disabled>Descargar Excel</button>
            : <a className="btn" href={urlExcel(tipo, params)}>Descargar Excel</a>}
        </div>
      </div>
      {err && <div className="msg err">{err}</div>}
      {res && (
        <section style={{ marginTop: 18 }}>
          <h3>{res.titulo} <small className="hint">({res.rows.length} filas)</small></h3>
          <Table columns={res.columnas} rows={res.rows} />
        </section>
      )}
    </>
  );
}
