import { useEffect, useState } from 'react';
import { useGet } from './api.js';

export const Field = ({ label, children, className = '', hint }) => (
  <label className={'field ' + className}>
    <span>{label}</span>
    {children}
    {hint && <small className="hint">{hint}</small>}
  </label>
);

export const Msg = ({ msg }) => msg ? <div className={'msg ' + (msg.ok ? 'ok' : 'err')}>{msg.t}</div> : null;

export function Table({ columns, rows, empty = 'Sin resultados' }) {
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => (
            <tr key={r.id ?? i}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : (r[c.key] ?? '—')}</td>)}
            </tr>
          )) : <tr><td colSpan={columns.length} className="vacio">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, limit, total, onPage }) {
  const paginas = Math.max(Math.ceil(total / limit), 1);
  return (
    <div className="pager">
      <span>{total} registros</span>
      <button className="btn sec" disabled={page <= 1} onClick={() => onPage(page - 1)}>‹ Anterior</button>
      <span>Página {page} de {paginas}</span>
      <button className="btn sec" disabled={page >= paginas} onClick={() => onPage(page + 1)}>Siguiente ›</button>
    </div>
  );
}

export const StockBadge = ({ n }) => (
  <span className={'badge ' + (n === 0 ? 'bad' : n <= 3 ? 'warn' : 'ok')}>{n}</span>
);

export const TipoBadge = ({ tipo }) => (
  <span className={'badge ' + (tipo === 'ENTRADA' ? 'ok' : 'warn')}>{tipo}</span>
);

// Buscador de producto: escribe y elige de la lista. `refresh` recarga el stock tras guardar.
export function ProductoPicker({ value, onChange, refresh }) {
  const { data } = useGet('/productos/opciones', { r: refresh });
  const [texto, setTexto] = useState('');
  const opts = data || [];
  const label = (p) => `#${p.id} · ${p.denominacion}${p.marca ? ' · ' + p.marca : ''}${p.modelo ? ' · ' + p.modelo : ''}`;
  useEffect(() => { if (!value) setTexto(''); }, [value]);
  const cambiar = (t) => { setTexto(t); onChange(opts.find((p) => label(p) === t) || null); };
  return (
    <>
      <input list="lista-productos" value={texto} onChange={(e) => cambiar(e.target.value)}
        placeholder="Escribe para buscar y elige de la lista…" />
      <datalist id="lista-productos">{opts.map((p) => <option key={p.id} value={label(p)} />)}</datalist>
      {value && <small className="hint">Stock actual: <b>{value.stock_actual}</b> {value.unidad}</small>}
    </>
  );
}
