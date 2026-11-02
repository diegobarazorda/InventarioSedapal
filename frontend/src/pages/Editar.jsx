import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { get, put, useGet } from '../api.js';
import { Field, Msg } from '../ui.jsx';

export default function Editar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState(null);
  const unidades = useGet('/unidades').data || [];

  useEffect(() => {
    get('/productos/' + id)
      .then((p) => setF({ ...p, numero_serie: p.numero_serie ?? '', modelo: p.modelo ?? '', marca: p.marca ?? '', potencia: p.potencia ?? '' }))
      .catch((e) => setMsg({ ok: false, t: e.message }));
  }, [id]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function guardar(e) {
    e.preventDefault();
    try {
      await put('/productos/' + id, f);
      setMsg({ ok: true, t: 'Producto actualizado correctamente' });
      setTimeout(() => navigate('/vista'), 800);
    } catch (err) { setMsg({ ok: false, t: err.message }); }
  }

  if (!f) return <><Msg msg={msg} /><Link className="enlace" to="/vista">‹ Volver a Vista general</Link></>;

  return (
    <>
      <h2>Editar producto #{f.id}</h2>
      <p className="page-sub">Actualiza los datos del activo y su stock actual.</p>
      <form className="card form-card" onSubmit={guardar}>
        <div className="form-block">
          <h3>Datos del producto</h3>
          <p className="hint">Modifica la información descriptiva y los valores de inventario.</p>
          <div className="form-grid cols-3">
            <Field label="Denominación del activo"><input value={f.denominacion} onChange={set('denominacion')} maxLength={100} required /></Field>
            <Field label="Número de serie"><input value={f.numero_serie} onChange={set('numero_serie')} maxLength={50} /></Field>
            <Field label="Modelo"><input value={f.modelo} onChange={set('modelo')} maxLength={100} /></Field>
            <Field label="Marca"><input value={f.marca} onChange={set('marca')} maxLength={50} /></Field>
            <Field label="Potencia / Especificación"><input value={f.potencia} onChange={set('potencia')} maxLength={50} /></Field>
            <Field label="Unidad de medida">
              <input list="unidades" value={f.unidad_medida} onChange={set('unidad_medida')} maxLength={50} required />
              <datalist id="unidades">{unidades.map((u) => <option key={u.id} value={u.nombre} />)}</datalist>
            </Field>
            <Field label="Estado">
              <select value={f.estado} onChange={set('estado')}><option>Nuevo</option><option>Usado</option></select>
            </Field>
            <Field label="Stock mínimo (alerta de stock bajo; 0 = usar 3)">
              <input type="number" min="0" step="1" value={f.stock_minimo} onChange={set('stock_minimo')} required />
            </Field>
            <Field label="Stock actual">
              <input type="number" min="0" step="1" value={f.stock_actual} onChange={set('stock_actual')} required />
            </Field>
          </div>
        </div>
        <div className="acciones">
          <button className="btn">Guardar cambios</button>
          <Link className="btn sec" to="/vista">Cancelar</Link>
        </div>
      </form>
      <Msg msg={msg} />
    </>
  );
}
