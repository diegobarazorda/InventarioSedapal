import { useState } from 'react';
import { get, urlExcel, useGet } from '../api.js';
import { Field, Table } from '../ui.jsx';

export default function ReportesActivos() {
  const [p, setP] = useState({ verificado: '', responsable: '', nota: '', foto: '' });
  const [res, setRes] = useState(null);
  const [err, setErr] = useState('');
  const opciones = useGet('/activos/opciones').data || { notas: [], personal: [] };
  const responsables = [...new Set(opciones.personal.map((x) => x.nombre_personal))];
  const set = (k) => (e) => { setP({ ...p, [k]: e.target.value }); setRes(null); };

  async function ver() {
    setErr('');
    try { setRes(await get('/reportes/activos', p)); }
    catch (e) { setErr(e.message); setRes(null); }
  }

  return (
    <>
      <h2>Reportes</h2>
      <p className="page-sub">Consulta los activos fijos en pantalla o descárgalos en Excel. Deja un filtro en "Todos" para no filtrar por él.</p>
      <div className="card form-card">
        <div className="form-block">
          <h3>Filtros del reporte</h3>
          <div className="form-grid cols-3" style={{ marginTop: 14 }}>
            <Field label="Verificación">
              <select value={p.verificado} onChange={set('verificado')}>
                <option value="">Todos</option><option value="SI">Verificados</option><option value="NO">Sin verificar</option>
              </select>
            </Field>
            <Field label="Responsable">
              <select value={p.responsable} onChange={set('responsable')}>
                <option value="">Todos</option><option value="-">Sin responsable</option>
                {responsables.map((r) => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Nota invent.">
              <select value={p.nota} onChange={set('nota')}>
                <option value="">Todas</option><option value="-">Sin nota</option>
                {opciones.notas.map((n) => <option key={n}>{n}</option>)}
              </select>
            </Field>
            <Field label="Foto">
              <select value={p.foto} onChange={set('foto')}>
                <option value="">Todos</option><option value="SI">Con foto</option><option value="NO">Sin foto</option>
              </select>
            </Field>
          </div>
        </div>
        <div className="acciones">
          <button className="btn sec" onClick={ver}>Ver en pantalla</button>
          <a className="btn" href={urlExcel('activos', p)}>Descargar Excel</a>
        </div>
      </div>
      {err && <div className="msg err">{err}</div>}
      {res && (
        <section style={{ marginTop: 18 }}>
          <h3>{res.titulo} <small className="hint">({res.rows.length} activos)</small></h3>
          <div className="tabla-activos"><Table columns={res.columnas} rows={res.rows} /></div>
        </section>
      )}
    </>
  );
}
