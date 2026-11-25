-- Inventario de activos fijos (registro AF del SAP)
CREATE TABLE IF NOT EXISTS activos_fijos (
  id INT NOT NULL AUTO_INCREMENT,
  numero INT DEFAULT NULL,                    -- N° original del Excel (dato interno; la app numera 1, 2, 3…)
  activo_fijo VARCHAR(30) NOT NULL,           -- código SAP del activo fijo
  nro_inventario VARCHAR(50) DEFAULT NULL,    -- N° de inventario (se completa en campo)
  denominacion VARCHAR(255) NOT NULL,
  marca VARCHAR(100) DEFAULT NULL,
  serie VARCHAR(100) DEFAULT NULL,
  modelo VARCHAR(100) DEFAULT NULL,
  ceco VARCHAR(20) DEFAULT NULL,
  local VARCHAR(50) DEFAULT NULL,
  nro_personal VARCHAR(20) DEFAULT NULL,      -- Nº pers. actual (ficha)
  nombre_personal VARCHAR(150) DEFAULT NULL,
  nota_inventario VARCHAR(100) DEFAULT NULL,
  observacion VARCHAR(500) DEFAULT NULL,
  verificado ENUM('SI','NO') NOT NULL DEFAULT 'NO',
  baja ENUM('SI','NO') NOT NULL DEFAULT 'NO', -- activo dado de baja
  fecha_baja DATE DEFAULT NULL,               -- obligatoria cuando baja = 'SI'
  foto MEDIUMBLOB DEFAULT NULL,               -- foto del activo (JPG/PNG/WEBP)
  foto_tipo VARCHAR(30) DEFAULT NULL,         -- tipo MIME de la foto
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_af_activo (activo_fijo),
  KEY idx_af_inventario (nro_inventario),
  KEY idx_af_denominacion (denominacion)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
