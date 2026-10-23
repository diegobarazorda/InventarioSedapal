import { useState } from 'react';
import { hoy, post } from '../api.js';
import { Field, Msg, ProductoPicker } from '../ui.jsx';

export default function Reabastecer() {
  const [producto, setProducto] = useState(null);
  const [f, setF] = useState({ fecha: hoy(), cantidad: '', guia: '' });
  const [msg, setMsg] = useState(null);
  const [refresh, setRefresh] = useState(0);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    if (!producto) return setMsg({ ok: false, t: 'Elige un producto de la lista' });
    try {
      await post('/movimientos/entrada', { ...f, producto_id: producto.id });
      setMsg({ ok: true, t: `Se agregaron ${f.cantidad} unidades a "${producto.denominacion}"` });
      setProducto(null); setF({ fecha: hoy(), cantidad: '', guia: '' }); setRefresh(refresh + 1);
    } catch (err) { setMsg({ ok: false, t: err.message }); }
  }

  return (
    <>
      <h2>Reabastecer stock</h2>
      <p className="page-sub">Agrega unidades a un producto existente sin crear un registro nuevo.</p>
      <form className="card form-card" onSubmit={enviar}>
        <div className="form-block">
          <h3>Selección de producto</h3>
          <p className="hint">Busca por denominación, marca o modelo.</p>
          <div className="form-grid cols-3">
            <Field label="Producto a reabastecer" className="span-all">
              <ProductoPicker value={producto} onChange={setProducto} refresh={refresh} />
            </Field>
          </div>
        </div>
        <hr className="sep" />
        <div className="form-block">
          <h3>Datos del ingreso</h3>
          <p className="hint">Información del documento y cantidad recibida.</p>
          <div className="form-grid cols-3">
            <Field label="Fecha de ingreso"><input type="date" value={f.fecha} onChange={set('fecha')} required /></Field>
            <Field label="Cantidad"><input type="number" min="1" value={f.cantidad} onChange={set('cantidad')} required /></Field>
            <Field label="Guía (opcional)"><input value={f.guia} onChange={set('guia')} maxLength={50} /></Field>
          </div>
        </div>
        <div className="acciones"><button className="btn">Registrar ingreso</button></div>
      </form>
      <Msg msg={msg} />
    </>
  );
}
