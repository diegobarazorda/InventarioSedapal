import { useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import Selector from './pages/Selector.jsx';
import Inicio from './pages/Inicio.jsx';
import Ingreso from './pages/Ingreso.jsx';
import Reabastecer from './pages/Reabastecer.jsx';
import Salida from './pages/Salida.jsx';
import Vista from './pages/Vista.jsx';
import Reportes from './pages/Reportes.jsx';
import Historial from './pages/Historial.jsx';
import Editar from './pages/Editar.jsx';
import EditarSeleccion from './pages/EditarSeleccion.jsx';
import ActivosResumen from './pages/ActivosResumen.jsx';
import VistaActivos from './pages/VistaActivos.jsx';
import EditarActivo from './pages/EditarActivo.jsx';
import { Icono } from './ui.jsx';

// Inventario 1: productos con stock (ingresos, salidas, historial…)
const menuStock = [
  ['/stock', 'Inicio', 'inicio'],
  ['/stock/ingreso', 'Ingreso de productos', 'ingreso'],
  ['/stock/reabastecer', 'Reabastecer stock', 'reabastecer'],
  ['/stock/salida', 'Salida de productos', 'salida'],
  ['/stock/vista', 'Vista general', 'vista'],
  ['/stock/editar', 'Editar producto', 'editar'],
  ['/stock/reportes', 'Reportes', 'reportes'],
  ['/stock/historial', 'Historial', 'historial'],
];

// Inventario 2: activos fijos del registro SAP
const menuActivos = [
  ['/activos', 'Resumen', 'inicio'],
  ['/activos/listado', 'Activos fijos', 'vista'],
];

function Layout({ titulo, menu, children }) {
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
          <span className="brand-sub">{titulo}</span>
        </div>
        <nav>
          {menu.map(([to, t, ico], i) => (
            <NavLink key={to} to={to} end={i === 0}>
              <Icono nombre={ico} />{t}
            </NavLink>
          ))}
        </nav>
        <Link className="cambiar" to="/"><Icono nombre="cambiar" />Cambiar inventario</Link>
        <div className="side-foot"><b>SEDAPAL</b><br />Gestión de inventario</div>
      </aside>
      <main>{children}</main>
    </div>
  );
}

function InventarioStock() {
  return (
    <Layout titulo="Inventario de productos" menu={menuStock}>
      <Routes>
        <Route index element={<Inicio />} />
        <Route path="ingreso" element={<Ingreso />} />
        <Route path="reabastecer" element={<Reabastecer />} />
        <Route path="salida" element={<Salida />} />
        <Route path="vista" element={<Vista />} />
        <Route path="editar" element={<EditarSeleccion />} />
        <Route path="reportes" element={<Reportes />} />
        <Route path="historial" element={<Historial />} />
        <Route path="productos/:id/editar" element={<Editar />} />
        <Route path="*" element={<Navigate to="/stock" replace />} />
      </Routes>
    </Layout>
  );
}

function InventarioActivos() {
  return (
    <Layout titulo="Inventario de activos fijos" menu={menuActivos}>
      <Routes>
        <Route index element={<ActivosResumen />} />
        <Route path="listado" element={<VistaActivos />} />
        <Route path="listado/:id/editar" element={<EditarActivo />} />
        <Route path="*" element={<Navigate to="/activos" replace />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Selector />} />
      <Route path="/stock/*" element={<InventarioStock />} />
      <Route path="/activos/*" element={<InventarioActivos />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
