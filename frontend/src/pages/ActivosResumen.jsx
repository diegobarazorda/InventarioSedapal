import { Link } from 'react-router-dom';
import { useGet } from '../api.js';
import { Table } from '../ui.jsx';

const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

const colsResp = [
  { key: 'nombre_personal', header: 'Responsable (custodio)', render: (r) => r.nombre_personal ?? 'Sin responsable' },
  { key: 'total', header: 'Activos' },
  { key: 'verificados', header: 'Verificados' },
  { key: 'avance', header: 'Avance', render: (r) => (
    <span className="avance"><span style={{ width: pct(r.verificados, r.total) + '%' }} /><em>{pct(r.verificados, r.total)}%</em></span>
  ) },
];
const colsNota = [
  { key: 'nota_inventario', header: 'Nota invent.', render: (r) => r.nota_inventario ?? 'Sin nota' },
  { key: 'total', header: 'Activos' },
];

export default function ActivosResumen() {
  const { data, error, loading } = useGet('/activos/resumen');
  if (error) return <div className="msg err">{error}</div>;
  if (loading || !data) return <p>Cargando…</p>;
  const { total, verificados, con_inventario: conInv } = data.kpis;
  const cards = [
    ['Activos fijos', total, 'blue'],
    ['Verificados', verificados, 'green'],
    ['Pendientes', total - verificados, 'amber'],
    ['Avance', pct(verificados, total) + '%', 'teal'],
    ['Con N° inventario', conInv, 'cyan'],
  ];
  return (
    <>
      <h2>Resumen</h2>
      <p className="page-sub">Avance de la verificación de activos fijos de la PTAR Santa Clara. <Link className="enlace" to="/activos/listado">Ir al listado ›</Link></p>
      <div className="cards">
        {cards.map(([t, v, tone]) => (
          <div className={'card kpi tone-' + tone} key={t}><small>{t}</small><b>{v}</b></div>
        ))}
      </div>
      <div className="dos">
        <section className="card"><h3>Por responsable</h3><Table columns={colsResp} rows={data.porResponsable} /></section>
        <section className="card"><h3>Por nota de inventario</h3><Table columns={colsNota} rows={data.porNota} /></section>
      </div>
    </>
  );
}
