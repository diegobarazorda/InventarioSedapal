import { useState } from 'react';
import { useGet } from '../api.js';
import { Pager, StockBadge, Table } from '../ui.jsx';

const columns = [
  { key: 'denominacion', header: 'Denominación' },
  { key: 'numero_serie', header: 'N° serie' },
  { key: 'modelo', header: 'Modelo' },
  { key: 'marca', header: 'Marca' },
  { key: 'potencia', header: 'Potencia / Esp.' },
  { key: 'unidad_medida', header: 'Unidad' },
  { key: 'estado', header: 'Estado' },
  { key: 'stock_actual', header: 'Stock', render: (r) => <StockBadge n={r.stock_actual} /> },
  { key: 'fecha_entrada', header: 'Fecha entrada' },
];

export default function Vista() {
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [page, setPage] = useState(1);
  const { data, error } = useGet('/productos', { search, estado, page });

  return (
    <>
      <h2>Vista general</h2>
      <p className="page-sub">Consulta el stock actual y los datos de cada producto registrado.</p>
      <div className="filtros">
        <input placeholder="Buscar por denominación, marca, modelo, serie…" value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}>
          <option value="">Todos</option><option value="bajo">Stock bajo</option><option value="agotados">Agotados</option>
        </select>
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
