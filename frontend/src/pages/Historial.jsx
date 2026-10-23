import { useState } from 'react';
import { useGet } from '../api.js';
import { Pager, Table, TipoBadge } from '../ui.jsx';

const columns = [
  { key: 'fecha_movimiento', header: 'Fecha y hora' },
  { key: 'tipo', header: 'Tipo', render: (r) => <TipoBadge tipo={r.tipo} /> },
  { key: 'denominacion', header: 'Producto' },
  { key: 'marca', header: 'Marca' },
  { key: 'cantidad', header: 'Cant.' },
  { key: 'guia', header: 'Guía' },
  { key: 'tecnico', header: 'Técnico' },
  { key: 'observacion', header: 'Observación' },
];

export default function Historial() {
  const [f, setF] = useState({ tipo: '', desde: '', hasta: '', search: '' });
  const [page, setPage] = useState(1);
  const { data, error } = useGet('/movimientos', { ...f, page });
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setPage(1); };

  return (
    <>
      <h2>Historial de movimientos</h2>
      <p className="page-sub">Revisa todas las entradas y salidas registradas en el inventario.</p>
      <div className="filtros">
        <input placeholder="Buscar producto, técnico u observación…" value={f.search} onChange={set('search')} />
        <select value={f.tipo} onChange={set('tipo')}>
          <option value="">Entradas y salidas</option><option value="ENTRADA">Solo entradas</option><option value="SALIDA">Solo salidas</option>
        </select>
        <label>Desde <input type="date" value={f.desde} onChange={set('desde')} /></label>
        <label>Hasta <input type="date" value={f.hasta} onChange={set('hasta')} /></label>
      </div>
      {error && <div className="msg err">{error}</div>}
      {data && (
        <>
          <Table columns={columns} rows={data.rows} />
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
