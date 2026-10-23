import { useGet } from '../api.js';
import { StockBadge, Table, TipoBadge } from '../ui.jsx';

const colsMov = [
  { key: 'fecha_movimiento', header: 'Fecha' },
  { key: 'tipo', header: 'Tipo', render: (r) => <TipoBadge tipo={r.tipo} /> },
  { key: 'denominacion', header: 'Producto' },
  { key: 'cantidad', header: 'Cant.' },
  { key: 'tecnico', header: 'Técnico' },
];
const colsBajo = [
  { key: 'denominacion', header: 'Producto' },
  { key: 'marca', header: 'Marca' },
  { key: 'stock_actual', header: 'Stock', render: (r) => <StockBadge n={r.stock_actual} /> },
];

export default function Inicio() {
  const { data, error, loading } = useGet('/dashboard');
  if (error) return <div className="msg err">{error}</div>;
  if (loading || !data) return <p>Cargando…</p>;
  const { kpis, mes, bajos, ultimos } = data;
  const cards = [
    ['Productos', kpis.productos, 'blue'], ['Unidades en stock', kpis.unidades, 'cyan'],
    ['Agotados', kpis.agotados, 'red'], ['Stock bajo', kpis.bajo, 'amber'],
    ['Entradas (30 días)', `${mes.ENTRADA?.unidades ?? 0} u.`, 'green'], ['Salidas (30 días)', `${mes.SALIDA?.unidades ?? 0} u.`, 'teal'],
  ];
  return (
    <>
      <h2>Inicio</h2>
      <p className="page-sub">Resumen general del inventario y movimiento reciente.</p>
      <div className="cards">
        {cards.map(([t, v, tone]) => (
          <div className={'card kpi tone-' + tone} key={t}><small>{t}</small><b>{v}</b></div>
        ))}
      </div>
      <div className="dos">
        <section className="card"><h3>Últimos movimientos</h3><Table columns={colsMov} rows={ultimos} /></section>
        <section className="card"><h3>Stock bajo</h3><Table columns={colsBajo} rows={bajos} empty="Todo en orden" /></section>
      </div>
    </>
  );
}
