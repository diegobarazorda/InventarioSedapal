import { useState } from 'react';
import { hoy, post, useGet } from '../api.js';
import { Field, Msg } from '../ui.jsx';

const vacio = () => ({
  fecha_entrada: hoy(), cantidad: '', guia_entrada: '', numero_serie: '', denominacion: '',
  unidad_medida: 'UN', potencia: '', modelo: '', marca: '', estado: 'Nuevo',
});

export default function Ingreso() {
  const [f, setF] = useState(vacio());
  const [msg, setMsg] = useState(null);
  const unidades = useGet('/unidades').data || [];
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    try {
      await post('/productos', f);
      setMsg({ ok: true, t: `Producto "${f.denominacion}" registrado correctamente` });
      setF(vacio());
    } catch (err) { setMsg({ ok: false, t: err.message }); }
  }

  return (
    <>
      <h2>Ingreso de productos</h2>
      <p className="page-sub">Registra un nuevo activo con sus datos de entrada y características.</p>
      <form className="card form-card" onSubmit={enviar}>
        <div className="form-block">
          <h3>Datos del ingreso</h3>
          <p className="hint">Documento y cantidad recibida del proveedor.</p>
          <div className="form-grid cols-3">
            <Field label="Fecha de entrada"><input type="date" value={f.fecha_entrada} onChange={set('fecha_entrada')} required /></Field>
            <Field label="Cantidad"><input type="number" min="1" value={f.cantidad} onChange={set('cantidad')} required /></Field>
            <Field label="Guía de entrada"><input value={f.guia_entrada} onChange={set('guia_entrada')} maxLength={50} /></Field>
            <Field label="Número de serie"><input value={f.numero_serie} onChange={set('numero_serie')} maxLength={50} /></Field>
          </div>
        </div>
        <hr className="sep" />
        <div className="form-block">
          <h3>Datos del activo</h3>
          <p className="hint">Descripción, unidad y características del producto.</p>
          <div className="form-grid cols-3">
            <Field label="Denominación del activo" className="span-2"><input value={f.denominacion} onChange={set('denominacion')} maxLength={100} required /></Field>
            <Field label="Unidad de medida">
              <input list="unidades" value={f.unidad_medida} onChange={set('unidad_medida')} maxLength={50} required />
              <datalist id="unidades">{unidades.map((u) => <option key={u.id} value={u.nombre} />)}</datalist>
            </Field>
            <Field label="Potencia / Especificación"><input value={f.potencia} onChange={set('potencia')} maxLength={50} /></Field>
            <Field label="Modelo"><input value={f.modelo} onChange={set('modelo')} maxLength={100} /></Field>
            <Field label="Marca"><input value={f.marca} onChange={set('marca')} maxLength={50} /></Field>
            <Field label="Estado">
              <select value={f.estado} onChange={set('estado')}><option>Nuevo</option><option>Usado</option></select>
            </Field>
          </div>
        </div>
        <div className="acciones"><button className="btn">Registrar producto</button></div>
      </form>
      <Msg msg={msg} />
    </>
  );
}
