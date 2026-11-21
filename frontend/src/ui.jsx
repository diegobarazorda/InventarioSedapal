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

export function Table({ columns, rows, empty = 'Sin resultados', onRowDoubleClick, rowTitle }) {
  return (
    <div className="tablewrap">
      <table>
        <thead><tr>{columns.map((c) => <th key={c.key}>{c.header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((r, i) => (
            <tr key={r.id ?? i} title={rowTitle} className={onRowDoubleClick ? 'fila-accion' : undefined}
              onDoubleClick={onRowDoubleClick && ((e) => {
                // No interrumpir la edición dentro de campos o botones de la fila
                if (!e.target.closest('input, button, a, select, textarea')) onRowDoubleClick(r);
              })}>
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


const iconos = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ingreso: <><path d="M12 3v11" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></>,
  reabastecer: <><path d="M20 7a8 8 0 0 0-14-2L4 7" /><path d="M4 3v4h4" /><path d="M4 17a8 8 0 0 0 14 2l2-2" /><path d="M20 21v-4h-4" /></>,
  salida: <><path d="M12 21V10" /><path d="m7 14 5-5 5 5" /><path d="M4 5h16" /></>,
  vista: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
  reportes: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  historial: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
  cambiar: <><path d="M7 4 3 8l4 4" /><path d="M3 8h14" /><path d="m17 20 4-4-4-4" /><path d="M21 16H7" /></>,
  cajas: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5" /><path d="M12 13v8" /></>,
  etiqueta: <><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" /><circle cx="7.5" cy="7.5" r="1.5" /></>,
};

export function Icono({ nombre }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconos[nombre]}
    </svg>
  );
}
