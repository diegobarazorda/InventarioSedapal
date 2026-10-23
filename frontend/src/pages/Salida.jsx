import { useState } from 'react';
import { hoy, post, useGet } from '../api.js';
import { Field, Msg, ProductoPicker } from '../ui.jsx';

const vacio = () => ({ fecha: hoy(), cantidad: '', tecnico: '', observacion: '' });

export default function Salida() {
  const [producto, setProducto] = useState(null);
  const [f, setF] = useState(vacio());
  const [msg, setMsg] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const tecnicos = useGet('/tecnicos').data || [];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    if (!producto) return setMsg({ ok: false, t: 'Elige un producto de la lista' });
    try {
      await post('/movimientos/salida', { ...f, producto_id: producto.id });
      setMsg({ ok: true, t: `Salida registrada: ${f.cantidad} × "${producto.denominacion}"` });
      setProducto(null); setF(vacio()); setRefresh(refresh + 1);
    } catch (err) { setMsg({ ok: false, t: err.message }); }
  }

  return (
    <>
      <h2>Salida de productos</h2>
      <p className="page-sub">Registra la entrega de unidades a un técnico responsable.</p>
      <form className="card form-card" onSubmit={enviar}>
        <div className="form-block">
          <h3>Selección de producto</h3>
          <p className="hint">Busca por denominación, marca o modelo.</p>
          <div className="form-grid cols-3">
            <Field label="Producto a salir" className="span-all">
              <ProductoPicker value={producto} onChange={setProducto} refresh={refresh} />
            </Field>
          </div>
        </div>
        <hr className="sep" />
        <div className="form-block">
          <h3>Datos de la salida</h3>
          <p className="hint">Cantidad entregada y responsable de la salida.</p>
          <div className="form-grid cols-3">
            <Field label="Fecha de salida"><input type="date" value={f.fecha} onChange={set('fecha')} required /></Field>
            <Field label="Cantidad a salir">
              <input type="number" min="1" max={producto?.stock_actual || undefined} value={f.cantidad} onChange={set('cantidad')} required />
            </Field>
            <Field label="Técnico responsable">
              <input list="tecnicos" value={f.tecnico} onChange={set('tecnico')} maxLength={300} required />
              <datalist id="tecnicos">{tecnicos.map((t) => <option key={t.id} value={t.nombre} />)}</datalist>
            </Field>
            <Field label="Observación" className="span-all">
              <textarea rows={3} value={f.observacion} onChange={set('observacion')} />
            </Field>
          </div>
        </div>
        <div className="acciones"><button className="btn">Registrar salida</button></div>
      </form>
      <Msg msg={msg} />
    </>
  );
}
