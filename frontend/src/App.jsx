import { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import Inicio from './pages/Inicio.jsx';
import Ingreso from './pages/Ingreso.jsx';
import Reabastecer from './pages/Reabastecer.jsx';
import Salida from './pages/Salida.jsx';
import Vista from './pages/Vista.jsx';
import Reportes from './pages/Reportes.jsx';
import Historial from './pages/Historial.jsx';
import Editar from './pages/Editar.jsx';
import EditarSeleccion from './pages/EditarSeleccion.jsx';

const iconos = {
  inicio: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  ingreso: <><path d="M12 3v11" /><path d="m7 10 5 5 5-5" /><path d="M4 19h16" /></>,
  reabastecer: <><path d="M20 7a8 8 0 0 0-14-2L4 7" /><path d="M4 3v4h4" /><path d="M4 17a8 8 0 0 0 14 2l2-2" /><path d="M20 21v-4h-4" /></>,
  salida: <><path d="M12 21V10" /><path d="m7 14 5-5 5 5" /><path d="M4 5h16" /></>,
  vista: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
  reportes: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  historial: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  editar: <><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></>,
};

const menu = [
  ['/', 'Inicio', 'inicio'],
  ['/ingreso', 'Ingreso de productos', 'ingreso'],
  ['/reabastecer', 'Reabastecer stock', 'reabastecer'],
  ['/salida', 'Salida de productos', 'salida'],
  ['/vista', 'Vista general', 'vista'],
  ['/editar', 'Editar producto', 'editar'],
  ['/reportes', 'Reportes', 'reportes'],
  ['/historial', 'Historial', 'historial'],
];

function Icono({ nombre }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconos[nombre]}
    </svg>
  );
}

export default function App() {
  const [sinLogo, setSinLogo] = useState(false);
  return (
    <div className="app">
      <aside>
        <div className="brand">
          {!sinLogo && (
            <div className="brand-logo">
              <img src="/logo-sedapal.png" alt="SEDAPAL" onError={() => setSinLogo(true)} />
            </div>
          )}
          <span className="brand-sub">Sistema de Inventario</span>
        </div>
        <nav>
          {menu.map(([to, t, ico]) => (
            <NavLink key={to} to={to} end={to === '/'}>
              <Icono nombre={ico} />{t}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot"><b>SEDAPAL</b><br />Gestión de inventario</div>
      </aside>
      <main>
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/ingreso" element={<Ingreso />} />
          <Route path="/reabastecer" element={<Reabastecer />} />
          <Route path="/salida" element={<Salida />} />
          <Route path="/vista" element={<Vista />} />
          <Route path="/editar" element={<EditarSeleccion />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/historial" element={<Historial />} />
          <Route path="/productos/:id/editar" element={<Editar />} />
        </Routes>
      </main>
    </div>
  );
}
