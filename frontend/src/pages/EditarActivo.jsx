import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { get, put, useGet } from '../api.js';
import { Field, Msg } from '../ui.jsx';

// [campo, etiqueta, largo máximo, obligatorio]
const datosActivo = [
  ['activo_fijo', 'Activo fijo', 30, true], ['nro_inventario', 'N° de inventario', 50],
  ['denominacion', 'Denominación del activo fijo', 255, true], ['marca', 'Marca', 100],
  ['serie', 'Serie', 100], ['modelo', 'Modelo', 100],
];
const ubicacion = [['ceco', 'CeCo', 20], ['emplazamiento', 'Descripción del emplazamiento', 150], ['local', 'Local', 50]];

export default function EditarActivo() {
  const { id } = useParams();
  const navigate = useNavigate();
  const volver = useLocation().state?.volver || '/activos/listado';
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const opciones = useGet('/activos/opciones').data || { notas: [], personal: [] };

  useEffect(() => {
    get('/activos/' + id)
      .then((a) => setF(Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v ?? '']))))
      .catch((e) => setMsg({ ok: false, t: e.message }));
  }, [id]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  // Al elegir un responsable de la lista se completa su N° de ficha
  const setNombre = (e) => {
    const nombre = e.target.value;
    const p = opciones.personal.find((x) => x.nombre_personal === nombre);
    setF({ ...f, nombre_personal: nombre, ...(p ? { nro_personal: p.nro_personal ?? '' } : {}) });
  };

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      await put('/activos/' + id, f);
      setMsg({ ok: true, t: 'Activo fijo actualizado correctamente' });
      setTimeout(() => navigate(volver), 800);
    } catch (err) {
      setMsg({ ok: false, t: err.message });
      setGuardando(false);
    }
  }

  if (!f) return <><Msg msg={msg} /><Link className="enlace" to={volver}>‹ Volver al listado</Link></>;

  const campo = ([k, label, max, req]) => (
    <Field key={k} label={label + (req ? ' *' : '')} className={k === 'denominacion' || k === 'emplazamiento' ? 'span-2' : ''}>
      <input value={f[k]} onChange={set(k)} maxLength={max} required={req} />
    </Field>
  );

  return (
    <>
      <h2>Editar activo fijo {f.activo_fijo}</h2>
      <p className="page-sub">Actualiza los datos del activo, su ubicación, responsable y verificación.</p>
      <form className="card form-card" onSubmit={guardar}>
        <div className="form-block">
          <h3>Datos del activo</h3>
          <p className="hint">Los campos con * son obligatorios.</p>
          <div className="form-grid cols-3">{datosActivo.map(campo)}</div>
        </div>
        <hr className="sep" />
        <div className="form-block">
          <h3>Ubicación</h3>
          <p className="hint">Centro de costo y emplazamiento del activo.</p>
          <div className="form-grid cols-3">{ubicacion.map(campo)}</div>
        </div>
        <hr className="sep" />
        <div className="form-block">
          <h3>Responsable e inventario</h3>
          <p className="hint">Elige un responsable de la lista para completar su N° de ficha, o escribe uno nuevo.</p>
          <div className="form-grid cols-3">
            <Field label="Nombre personal" className="span-2">
              <input list="af-personal" value={f.nombre_personal} onChange={setNombre} maxLength={150} />
              <datalist id="af-personal">
                {opciones.personal.map((p) => <option key={p.nro_personal + p.nombre_personal} value={p.nombre_personal} />)}
              </datalist>
            </Field>
            <Field label="Nº pers. actual (ficha)">
              <input value={f.nro_personal} onChange={set('nro_personal')} maxLength={20} />
            </Field>
            <Field label="Nota invent.">
              <input list="af-notas" value={f.nota_inventario} onChange={set('nota_inventario')} maxLength={100} />
              <datalist id="af-notas">{opciones.notas.map((n) => <option key={n} value={n} />)}</datalist>
            </Field>
            <Field label="Verificación">
              <select value={f.verificado} onChange={set('verificado')}><option>SI</option><option>NO</option></select>
            </Field>
          </div>
        </div>
        <div className="acciones">
          <button className="btn" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
          <Link className="btn sec" to={volver}>Cancelar</Link>
        </div>
      </form>
      <Msg msg={msg} />
    </>
  );
}
