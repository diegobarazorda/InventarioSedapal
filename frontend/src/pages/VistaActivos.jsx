import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { patch, useGet } from '../api.js';
import { Pager, Table } from '../ui.jsx';

// Interruptor SI / NO de verificación
function Verificacion({ fila, onGuardar }) {
  return (
    <div className="sino" role="group" aria-label="Verificación">
      {['SI', 'NO'].map((op) => (
        <button key={op} type="button" aria-pressed={fila.verificado === op}
          className={fila.verificado === op ? 'on ' + op.toLowerCase() : ''}
          onClick={() => fila.verificado !== op && onGuardar(fila.id, { verificado: op })}>
          {op}
        </button>
      ))}
    </div>
  );
}

export default function VistaActivos() {
  // Filtros y página en la URL, para volver al mismo lugar después de editar
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const editar = (r) => navigate(`/activos/listado/${r.id}/editar`, { state: { volver: '/activos/listado?' + params } });
  const search = params.get('q') ?? '';
  const verificado = params.get('v') ?? '';
  const page = Number(params.get('p')) || 1;
  const cambiar = (q, v, p) => setParams(Object.fromEntries(
    Object.entries({ q, v, p: p > 1 ? p : '' }).filter(([, x]) => x)), { replace: true });
  const setPage = (p) => cambiar(search, verificado, p);
  const [error, setError] = useState('');
  const { data, error: errCarga, reload } = useGet('/activos', { search, verificado, page });

  const guardar = (id, cambios) =>
    patch(`/activos/${id}`, cambios).then(() => { setError(''); reload(); }).catch((e) => setError(e.message));

  const columns = [
    { key: 'orden', header: 'N°' },
    { key: 'activo_fijo', header: 'Activo fijo' },
    { key: 'nro_inventario', header: 'N° inventario' },
    { key: 'denominacion', header: 'Denominación del activo fijo' },
    { key: 'marca', header: 'Marca' },
    { key: 'serie', header: 'Serie' },
    { key: 'modelo', header: 'Modelo' },
    { key: 'ceco', header: 'CeCo' },
    { key: 'emplazamiento', header: 'Descripción del emplazamiento' },
    { key: 'local', header: 'Local' },
    { key: 'nro_personal', header: 'Nº pers. actual (ficha)' },
    { key: 'nombre_personal', header: 'Nombre personal' },
    { key: 'nota_inventario', header: 'Nota invent.' },
    { key: 'verificado', header: 'Verificación', render: (r) => <Verificacion fila={r} onGuardar={guardar} /> },
    { key: 'acciones', header: '', render: (r) => (
      <Link className="btn sec" to={`/activos/listado/${r.id}/editar`} state={{ volver: '/activos/listado?' + params }}>Editar</Link>
    ) },
  ];

  return (
    <>
      <h2>Activos fijos</h2>
      <p className="page-sub">Registro de activos fijos según SAP. Haz doble clic en una fila para editarla y completar su N° de inventario.</p>
      <div className="filtros">
        <input placeholder="Buscar por activo fijo, N° inventario, denominación, marca, serie, personal…" value={search}
          onChange={(e) => cambiar(e.target.value, verificado, 1)} />
        <select value={verificado} onChange={(e) => cambiar(search, e.target.value, 1)}>
          <option value="">Todos</option><option value="SI">Verificados</option><option value="NO">Sin verificar</option>
        </select>
        {data && <span className="hint">Verificados: <b>{data.verificados}</b></span>}
      </div>
      {(error || errCarga) && <div className="msg err">{error || errCarga}</div>}
      {data && (
        <>
          <div className="tabla-activos"><Table columns={columns} rows={data.rows} onRowDoubleClick={editar} rowTitle="Doble clic para editar" /></div>
          <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
