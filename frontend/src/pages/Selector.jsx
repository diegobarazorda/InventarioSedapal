import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icono } from '../ui.jsx';

// Pantalla inicial: elegir con qué inventario trabajar
const opciones = [
  {
    to: '/stock', icono: 'cajas', titulo: 'Inventario de productos',
    texto: 'Materiales y repuestos con stock: ingresos, reabastecimiento, salidas a técnicos, reportes e historial.',
  },
  {
    to: '/activos', icono: 'etiqueta', titulo: 'Inventario de activos fijos',
    texto: 'Registro de activos fijos según SAP: N° de inventario, custodio, verificación en campo y bajas.',
  },
];

export default function Selector() {
  const [sinLogo, setSinLogo] = useState(false);
  return (
    <div className="selector">
      <header>
        {!sinLogo && <img src="/logo-sedapal.png" alt="SEDAPAL" onError={() => setSinLogo(true)} />}
        <h1>Sistema de Inventario</h1>
        <p>Elige el inventario con el que vas a trabajar</p>
      </header>
      <div className="selector-opciones">
        {opciones.map((o) => (
          <Link key={o.to} to={o.to} className="selector-card">
            <span className="selector-ico"><Icono nombre={o.icono} /></span>
            <b>{o.titulo}</b>
            <span>{o.texto}</span>
            <span className="selector-ir">Entrar ›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
