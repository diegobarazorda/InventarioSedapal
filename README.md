# Sistema de Inventario SEDAPAL

Sistema web para la gestión de inventario de activos y materiales de SEDAPAL. Permite registrar ingresos, reabastecimientos, salidas, consultar stock, llevar historial de movimientos y editar productos.

## Tecnologías

### Frontend
- [React](https://react.dev/) 19
- [Vite](https://vitejs.dev/)
- [React Router DOM](https://reactrouter.com/)

### Backend
- [Node.js](https://nodejs.org/)
- [Express](https://expressjs.com/)
- [MySQL2](https://github.com/sidorares/node-mysql2)

## Estructura del proyecto

```text
InventarioSedapal/
├── backend/        # API REST con Node.js + Express + MySQL
├── frontend/       # Aplicación React + Vite
└── iniciar.bat     # Script para iniciar frontend y backend (Windows)
```

## Funcionalidades

Al abrir la aplicación se elige uno de los dos inventarios, cada uno con su propio menú (botón **Cambiar inventario** para volver):

### 1. Inventario de productos (`/stock`)

- **Inicio** - Dashboard con resumen de inventario
- **Ingreso de productos** - Registro de nuevos activos con sus características
- **Reabastecer stock** - Agregar unidades a productos existentes
- **Salida de productos** - Registrar entregas a técnicos responsables
- **Vista general** - Listado de productos con filtros y opción de editar
- **Editar producto** - Búsqueda y edición de productos existentes
- **Reportes** - Generación de reportes en Excel
- **Historial** - Consulta de entradas y salidas con filtros por fecha, tipo y búsqueda

### 2. Inventario de activos fijos (`/activos`)

- **Resumen** - Total de activos, verificados, pendientes y avance por responsable (PTAR Santa Clara)
- **Activos fijos** - Registro importado del Excel (hoja "Registro AF del SAP") con N° de inventario editable, verificación SI/NO y botón **Editar** para modificar todos los campos

## Requisitos

- [Node.js](https://nodejs.org/) (v18 o superior)
- [MySQL](https://www.mysql.com/)
- [npm](https://www.npmjs.com/)

## Instalación

### 1. Clonar el repositorio

```bash
git clone git@github.com:diegobarazorda/InventarioSedapal.git
cd InventarioSedapal
```

### 2. Configurar Base de Datos

Crear una base de datos MySQL con el nombre `inventario_sedapal` e importar el esquema correspondiente.

### 3. Configurar Backend

```bash
cd backend
cp .env.example .env
npm install
```

Editar el archivo `.env` con tus credenciales de MySQL:

```env
PORT=3001
DB_HOST=127.0.0.1
DB_USER=tu_usuario
DB_PASSWORD=tu_contraseña
DB_NAME=inventario_sedapal
CORS_ORIGIN=http://localhost:5173
```

Importar los activos fijos del Excel (`datos-inventario.xlsx`, hoja "Registro AF del SAP"). Crea la tabla `activos_fijos` si no existe:

```bash
npm run importar-activos
```

Para volver a cargar el Excel desde cero (borra N° de inventario y verificaciones guardadas): `npm run importar-activos -- --reemplazar`.

Iniciar el servidor:

```bash
npm run dev
```

### 4. Configurar Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Uso rápido (Windows)

Ejecutar `iniciar.bat` para levantar ambos servicios automáticamente.

## Características destacadas

- Interfaz moderna con diseño inspirado en SEDAPAL
- Búsqueda y filtrado en tiempo real
- Alertas visuales para stock bajo o agotado
- Validaciones en formularios
- Historial completo de movimientos
- Exportación de reportes a Excel

## Autor

**Diego Barazorda**

## Licencia

Este proyecto es de uso interno.
