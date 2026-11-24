import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { del, get, post, put, useGet } from '../api.js';
import { Msg } from '../ui.jsx';

// [campo, etiqueta, largo máximo, obligatorio] de cada columna de la ficha
const izquierda = [
  ['activo_fijo', 'Activo fijo', 30, true], ['nro_inventario', 'N° inventario', 50],
  ['denominacion', 'Denominación', 255, true], ['marca', 'Marca', 100], ['serie', 'Serie', 100],
  ['modelo', 'Modelo', 100], ['ceco', 'CeCo', 20],
];
const derecha = [
  ['emplazamiento', 'Emplazamiento', 150], ['local', 'Local', 50], ['nro_personal', 'Nº pers. (ficha)', 20],
  ['nombre_personal', 'Nombre personal', 150], ['nota_inventario', 'Nota invent.', 100],
];
const LISTAS = { nombre_personal: 'af-personal', nota_inventario: 'af-notas' };

// Reduce la foto (las de celular pesan varios MB) a JPG de máx. 1600 px
function comprimir(archivo) {
  return new Promise((ok, mal) => {
    const img = new Image();
    const url = URL.createObjectURL(archivo);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo procesar la imagen'))), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('El archivo no es una imagen válida')); };
    img.src = url;
  });
}

async function enviarFoto(id, metodo, cuerpo) {
  const r = await fetch(`/api/activos/${id}/foto`, {
    method: metodo, body: cuerpo, headers: cuerpo ? { 'Content-Type': 'image/jpeg' } : undefined,
  });
  if (!r.ok) {
    let t = 'No se pudo guardar la foto';
    try { t = (await r.json()).error || t; } catch { /* sin JSON */ }
    throw new Error(t);
  }
}

const VACIO = Object.fromEntries([...izquierda, ...derecha].map(([k]) => [k, '']));
const sinNulos = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v ?? '']));

export default function FichaActivo() {
  const [params, setParams] = useSearchParams();
  const n = Number(params.get('n')) || 1;
  const [a, setA] = useState(null);
  const [f, setF] = useState(null); // copia en edición (null = solo lectura)
  const [nuevo, setNuevo] = useState(false); // la edición es de un registro nuevo
  const [buscar, setBuscar] = useState(''); // código de activo fijo a buscar
  const [msg, setMsg] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [version, setVersion] = useState(0); // fuerza recargar la imagen tras cambiarla
  const archivo = useRef(null);
  const opciones = useGet('/activos/opciones').data || { notas: [], personal: [] };

  const cargar = () => {
    setCargando(true);
    return get('/activos/ficha/' + n)
      .then((d) => { setA(d); setBuscar(d.activo_fijo); })
      .catch((e) => { setA(null); setMsg({ ok: false, t: e.message }); })
      .finally(() => setCargando(false));
  };
  useEffect(() => { setF(null); setNuevo(false); cargar(); }, [n]); // eslint-disable-line react-hooks/exhaustive-deps

  // Va al N° indicado (o lo recarga si ya está en él) mostrando el mensaje dado
  const ir = (x, m = null) => {
    setMsg(m);
    if (x === n) { setF(null); setNuevo(false); cargar(); } else setParams({ n: String(x) }, { replace: true });
  };
  const total = a?.total ?? 0;
  const editando = f !== null;

  // Busca por código de activo fijo y abre su ficha
  async function enviarBusqueda(e) {
    e.preventDefault();
    if (!buscar.trim()) return setMsg({ ok: false, t: 'Escribe el código de activo fijo' });
    try {
      const { orden } = await get('/activos/buscar', { af: buscar.trim() });
      ir(orden);
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
  }

  /* ----- edición en la misma ficha ----- */
  const set = (k) => (e) => {
    const v = e.target.value;
    // Al elegir un responsable de la lista se completa su N° de ficha
    const p = k === 'nombre_personal' && opciones.personal.find((x) => x.nombre_personal === v);
    setF({ ...f, [k]: v, ...(p ? { nro_personal: p.nro_personal ?? '' } : {}) });
  };

  async function guardar(e) {
    e.preventDefault();
    setGuardando(true);
    try {
      if (nuevo) {
        const { orden } = await post('/activos', f);
        ir(orden, { ok: true, t: `Registro N° ${orden} agregado. Ya puedes agregarle una foto.` });
      } else {
        await put('/activos/' + a.id, f);
        await cargar();
        setF(null);
        setMsg({ ok: true, t: 'Cambios guardados' });
      }
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    } finally {
      setGuardando(false);
    }
  }

  async function elegirFoto(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setSubiendo(true);
    try {
      await enviarFoto(a.id, 'PUT', await comprimir(file));
      setA({ ...a, tiene_foto: true });
      setVersion((v) => v + 1);
      setMsg({ ok: true, t: 'Foto guardada' });
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto() {
    if (!window.confirm('¿Quitar la foto de este activo?')) return;
    try {
      await enviarFoto(a.id, 'DELETE');
      setA({ ...a, tiene_foto: false });
      setMsg({ ok: true, t: 'Foto eliminada' });
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
  }

  const agregar = () => { setF({ ...VACIO, verificado: 'NO' }); setNuevo(true); setMsg(null); };
  const cancelar = () => { setF(null); setNuevo(false); setMsg(null); };

  async function eliminar() {
    if (!window.confirm(`¿Eliminar el registro N° ${a.orden} (${a.activo_fijo} · ${a.denominacion})?

Esta acción no se puede deshacer.`)) return;
    try {
      await del('/activos/' + a.id);
      ir(Math.max(Math.min(n, total - 1), 1), { ok: true, t: `Registro ${a.activo_fijo} eliminado` });
    } catch (err) {
      setMsg({ ok: false, t: err.message });
    }
  }

  // La verificación solo se cambia en modo edición y se guarda con "Guardar cambios"
  const verificar = (v) => { if (editando) setF({ ...f, verificado: v }); };

  const dato = ([k, label, max, req]) => (
    <label key={k} className="ficha-dato">
      <span>{label}{editando && req ? ' *' : ''}</span>
      {editando
        ? (k === 'denominacion'
          ? <textarea rows={3} value={f[k]} onChange={set(k)} maxLength={max} required={req} />
          : <input value={f[k]} onChange={set(k)} maxLength={max} required={req} list={LISTAS[k]} />)
        : <output>{a[k] || '—'}</output>}
    </label>
  );
  const verificado = editando ? f.verificado : a?.verificado;

  return (
    <div className="ficha card">
      <header className="ficha-head">
        <img src="/logo-sedapal.png" alt="SEDAPAL" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
        <div>
          <h2 className="ficha-titulo">Base de datos de activos fijos</h2>
          <p className="hint">Escribe el código de activo fijo y presiona Buscar, o recorre los registros con las flechas.</p>
        </div>
      </header>

      <form className="ficha-buscar" onSubmit={enviarBusqueda}>
        <label htmlFor="ficha-af">Activo fijo</label>
        <input id="ficha-af" inputMode="numeric" autoComplete="off" placeholder="Ej. 1320654" value={buscar} disabled={editando}
          onChange={(e) => setBuscar(e.target.value)} onFocus={(e) => e.target.select()} />
        <button className="btn" disabled={editando}>Buscar</button>
        {a && <span className="hint">Registro N° <b>{a.orden}</b> de <b>{total}</b></span>}
      </form>

      <Msg msg={msg} />

      {nuevo && <p className="msg nuevo">Nuevo registro: completa los datos y presiona <b>Guardar registro</b>. Se agregará al final de la lista.</p>}

      {(a || nuevo) && (
        <form id="ficha-form" onSubmit={guardar}
          className={'ficha-cuerpo' + (cargando ? ' cargando' : '') + (editando ? ' editando' : '')}>
          <div className="ficha-col">{izquierda.map(dato)}</div>
          <div className="ficha-col">
            {derecha.map(dato)}
            <div className="ficha-dato">
              <span>Verificación</span>
              <div className="sino" role="group" aria-label="Verificación">
                {['SI', 'NO'].map((op) => (
                  <button key={op} type="button" aria-pressed={verificado === op} disabled={!editando}
                    className={verificado === op ? 'on ' + op.toLowerCase() : ''}
                    onClick={() => verificado !== op && verificar(op)}>{op}</button>
                ))}
              </div>
            </div>
          </div>
          {nuevo ? (
            <div className="ficha-foto">
              <span>Foto</span>
              <div className="ficha-foto-marco"><em>Guarda el registro para agregar la foto</em></div>
            </div>
          ) : (
          <div className="ficha-foto">
            <span>Foto</span>
            <div className="ficha-foto-marco">
              {a.tiene_foto
                ? <a href={`/api/activos/${a.id}/foto?v=${version}`} target="_blank" rel="noreferrer" title="Ver en tamaño completo">
                    <img src={`/api/activos/${a.id}/foto?v=${version}`} alt={'Foto de ' + a.denominacion} />
                  </a>
                : <em>Sin foto</em>}
            </div>
            <input ref={archivo} type="file" accept="image/*" hidden onChange={elegirFoto} />
            <div className="ficha-foto-acc">
              <button type="button" className="btn sec" disabled={subiendo} onClick={() => archivo.current.click()}>
                {subiendo ? 'Subiendo…' : a.tiene_foto ? 'Cambiar foto' : 'Agregar foto'}
              </button>
              {a.tiene_foto && <button type="button" className="btn sec peligro" onClick={quitarFoto}>Quitar</button>}
            </div>
          </div>
          )}
          <datalist id="af-personal">
            {opciones.personal.map((p) => <option key={p.nro_personal + p.nombre_personal} value={p.nombre_personal} />)}
          </datalist>
          <datalist id="af-notas">{opciones.notas.map((x) => <option key={x} value={x} />)}</datalist>
        </form>
      )}

      <footer className="ficha-nav">
        <div className="ficha-flechas">
          <button type="button" className="btn sec" title="Primero" disabled={!a || editando || n <= 1} onClick={() => ir(1)}>|‹</button>
          <button type="button" className="btn sec" title="Anterior" disabled={!a || editando || n <= 1} onClick={() => ir(n - 1)}>‹</button>
          <span>{nuevo ? 'Nuevo' : a ? `${a.orden} de ${total}` : '—'}</span>
          <button type="button" className="btn sec" title="Siguiente" disabled={!a || editando || n >= total} onClick={() => ir(n + 1)}>›</button>
          <button type="button" className="btn sec" title="Último" disabled={!a || editando || n >= total} onClick={() => ir(total)}>›|</button>
        </div>
        {editando ? (
          <div className="ficha-acciones">
            <button type="button" className="btn sec" disabled={guardando} onClick={cancelar}>Cancelar</button>
            <button className="btn" form="ficha-form" disabled={guardando}>
              {guardando ? 'Guardando…' : nuevo ? 'Guardar registro' : 'Guardar cambios'}
            </button>
          </div>
        ) : (
          <div className="ficha-acciones">
            <button type="button" className="btn sec" onClick={agregar}>+ Agregar nuevo registro</button>
            {a && <button type="button" className="btn sec peligro" onClick={eliminar}>Eliminar registro</button>}
            {a && <button type="button" className="btn" onClick={() => { setF(sinNulos(a)); setMsg(null); }}>Editar registro</button>}
          </div>
        )}
      </footer>
    </div>
  );
}
