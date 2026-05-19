-- =============================================================
--  CHUKUTA EXPRESS — Base de datos unificada (Estructura + Datos Completos)
-- =============================================================

-- =============================================================
--  CHUKUTA EXPRESS — Base de datos de ejemplo
--  PostgreSQL 14+
--  Credenciales por defecto: admin@chukuta.com / Admin123!
-- =============================================================

-- Crear base de datos (ejecutar como superusuario si aún no existe)
-- CREATE DATABASE chukutaexpress;
-- \c chukutaexpress

-- ─── Limpiar tablas si existen (orden inverso de dependencias) ────────────────
DROP TABLE IF EXISTS movimiento_inventario CASCADE;
DROP TABLE IF EXISTS auditoria_log        CASCADE;
DROP TABLE IF EXISTS historial_pedido     CASCADE;
DROP TABLE IF EXISTS detalle_pedido       CASCADE;
DROP TABLE IF EXISTS pedido               CASCADE;
DROP TABLE IF EXISTS carrito              CASCADE;
DROP TABLE IF EXISTS almacen              CASCADE;
DROP TABLE IF EXISTS categoria            CASCADE;
DROP TABLE IF EXISTS cliente              CASCADE;
DROP TABLE IF EXISTS usuario              CASCADE;
DROP TABLE IF EXISTS rol                  CASCADE;

-- ─── Roles ────────────────────────────────────────────────────────────────────
CREATE TABLE rol (
    id_rol      SERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

-- ─── Usuarios internos ────────────────────────────────────────────────────────
-- Contraseñas hasheadas con Werkzeug (pbkdf2:sha256)
-- admin@chukuta.com   → Admin123!
-- vendedor@chukuta.com → Vendedor1!
-- operador@chukuta.com → Operador1!
CREATE TABLE usuario (
    id_usuario    SERIAL PRIMARY KEY,
    nombre        VARCHAR(100) NOT NULL,
    email         VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    id_rol        INTEGER      NOT NULL REFERENCES rol(id_rol),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    ultimo_login  TIMESTAMP,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_usuario_email_activo ON usuario (email, activo);

-- NOTA: Los hashes de arriba son de ejemplo y NO funcionan.
-- Para generar hashes reales ejecuta en el backend:
--   flask init-db
-- O en Python:
--   from werkzeug.security import generate_password_hash
--   print(generate_password_hash("Admin123!"))

-- ─── Clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE cliente (
    id_cliente        SERIAL PRIMARY KEY,
    nombre            VARCHAR(100) NOT NULL,
    email             VARCHAR(150) NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    telefono          VARCHAR(20),
    direccion_defecto TEXT,
    activo            BOOLEAN  NOT NULL DEFAULT TRUE,
    verificado        BOOLEAN  NOT NULL DEFAULT FALSE,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_cliente_email ON cliente (email);

-- ─── Categorías ───────────────────────────────────────────────────────────────
CREATE TABLE categoria (
    id_categoria      SERIAL PRIMARY KEY,
    nombre_categoria  VARCHAR(100) NOT NULL UNIQUE,
    descripcion       TEXT,
    activa            BOOLEAN NOT NULL DEFAULT TRUE
);

-- ─── Almacén (productos) ──────────────────────────────────────────────────────
CREATE TABLE almacen (
    id_producto   SERIAL PRIMARY KEY,
    nombre        VARCHAR(200) NOT NULL,
    descripcion   TEXT         DEFAULT '',
    codigo        VARCHAR(50)  UNIQUE,
    stock         INTEGER      NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo  INTEGER      NOT NULL DEFAULT 5,
    precio_venta  NUMERIC(10,2) NOT NULL CHECK (precio_venta > 0),
    precio_costo  NUMERIC(10,2),
    id_categoria  INTEGER      NOT NULL REFERENCES categoria(id_categoria),
    id_vendedor   INTEGER      REFERENCES usuario(id_usuario),
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    imagen_url    VARCHAR(500),
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_producto_categoria_activo ON almacen (id_categoria, activo);
CREATE INDEX ix_producto_stock            ON almacen (stock);

-- ─── Carrito ──────────────────────────────────────────────────────────────────
CREATE TABLE carrito (
    id_carrito  SERIAL PRIMARY KEY,
    id_cliente  INTEGER NOT NULL REFERENCES cliente(id_cliente),
    id_producto INTEGER NOT NULL REFERENCES almacen(id_producto),
    cantidad    INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    agregado_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_carrito_cliente_producto UNIQUE (id_cliente, id_producto)
);

-- ─── Pedidos ──────────────────────────────────────────────────────────────────
CREATE TABLE pedido (
    id_pedido           SERIAL PRIMARY KEY,
    id_cliente          INTEGER      NOT NULL REFERENCES cliente(id_cliente),
    total               NUMERIC(10,2) NOT NULL,
    estado              VARCHAR(30)  NOT NULL DEFAULT 'pendiente',
    direccion_entrega   TEXT         NOT NULL,
    notas               TEXT,
    metodo_pago         VARCHAR(50)  DEFAULT 'pendiente',
    referencia_pago     VARCHAR(100),
    pago_verificado     BOOLEAN      DEFAULT FALSE,
    pago_verificado_por INTEGER      REFERENCES usuario(id_usuario),
    pago_verificado_at  TIMESTAMP,
    operador_id         INTEGER      REFERENCES usuario(id_usuario),
    codigo_seguimiento  VARCHAR(50),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_pedido_cliente_estado ON pedido (id_cliente, estado);
CREATE INDEX ix_pedido_estado         ON pedido (estado);

-- ─── Detalles de pedido ───────────────────────────────────────────────────────
CREATE TABLE detalle_pedido (
    id_detalle      SERIAL PRIMARY KEY,
    id_pedido       INTEGER       NOT NULL REFERENCES pedido(id_pedido),
    id_producto     INTEGER       NOT NULL REFERENCES almacen(id_producto),
    cantidad        INTEGER       NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL
);

-- ─── Historial de pedidos ─────────────────────────────────────────────────────
CREATE TABLE historial_pedido (
    id_historial    SERIAL PRIMARY KEY,
    id_pedido       INTEGER     NOT NULL REFERENCES pedido(id_pedido),
    estado_anterior VARCHAR(30),
    estado_nuevo    VARCHAR(30) NOT NULL,
    comentario      TEXT,
    cambiado_por    INTEGER     REFERENCES usuario(id_usuario),
    creado_at       TIMESTAMP   DEFAULT NOW()
);

-- ─── Auditoría ────────────────────────────────────────────────────────────────
CREATE TABLE auditoria_log (
    id_log          SERIAL PRIMARY KEY,
    tabla           VARCHAR(50)  NOT NULL,
    accion          VARCHAR(20)  NOT NULL,
    id_registro     INTEGER,
    datos_anteriores TEXT,
    datos_nuevos     TEXT,
    id_usuario      INTEGER REFERENCES usuario(id_usuario),
    id_cliente      INTEGER REFERENCES cliente(id_cliente),
    ip_address      VARCHAR(45),
    user_agent      VARCHAR(200),
    creado_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_auditoria_tabla_accion ON auditoria_log (tabla, accion);
CREATE INDEX ix_auditoria_usuario      ON auditoria_log (id_usuario);

-- ─── Movimientos de inventario ────────────────────────────────────────────────
CREATE TABLE movimiento_inventario (
    id_movimiento  SERIAL PRIMARY KEY,
    id_producto    INTEGER     NOT NULL REFERENCES almacen(id_producto),
    tipo           VARCHAR(20) NOT NULL,  -- entrada, salida, ajuste
    cantidad       INTEGER     NOT NULL,
    stock_anterior INTEGER     NOT NULL,
    stock_nuevo    INTEGER     NOT NULL,
    motivo         VARCHAR(200),
    id_pedido      INTEGER     REFERENCES pedido(id_pedido),
    id_usuario     INTEGER     REFERENCES usuario(id_usuario),
    creado_at      TIMESTAMP   DEFAULT NOW()
);

-- ============================================================
-- Chukuta Express — Datos de Ejemplo Completos
-- ============================================================
-- Contraseñas (bcrypt, generadas con werkzeug):
--   Admin123!   → $2b$12$Kix.../  (admin)
--   Vendedor123! → $2b$12$...     (vendedores)
--   Cliente123!  → $2b$12$...     (clientes)
--
-- INSTRUCCIONES:
--   1. Ejecutar: flask init-db
--   2. Cargar este archivo en PostgreSQL:
--      psql -U postgres -d chukutaexpress -f database.sql
--   3. Iniciar backend y frontend
-- ============================================================

-- Limpiar datos previos (orden FK-safe)

-- ── Roles ──────────────────────────────────────────────────────────────────
INSERT INTO rol (id_rol, nombre, descripcion) VALUES
  (1, 'Vendedor',           'Gestiona sus propios productos y pedidos'),
  (2, 'Administrador',      'Acceso total al sistema'),
  (3, 'Operador Logístico', 'Gestiona estados de pedidos');

-- ── Usuarios internos ──────────────────────────────────────────────────────
-- Contraseñas hasheadas con Werkzeug/scrypt (werkzeug.security.generate_password_hash)
-- CORRECCIÓN: hashes regenerados — los bcrypt anteriores no eran compatibles con Werkzeug
-- Admin123!
INSERT INTO usuario (nombre, email, password_hash, id_rol, activo, created_at, updated_at) VALUES
  ('Administrador', 'admin@chukuta.com',
   'scrypt:32768:8:1$wn8zNfI6qqjAUifH$42265e3121040642f4c17131445a7679494b9f00df878f6b47f53ff60a3305167cda77c2f197008b2b7727bd3a16b3cf84e91748d5eb5b325c887dd43cbe6920',
   2, TRUE, NOW(), NOW()),

-- Vendedor123!
  ('TechStore Bolivia', 'vendedor1@test.com',
   'scrypt:32768:8:1$mlMa4TvbxOPxHhwh$2bfe9a8a7f568772ed8a9f938afdf2bf70fddc0edff6967bf4c71129cd9775fd57f77b0aed19a00124d0e4c9bf8c5ef6d3c4d28f90610d731dafd7e77625368d',
   1, TRUE, NOW(), NOW()),

  ('ModaLatina Shop', 'vendedor2@test.com',
   'scrypt:32768:8:1$mlMa4TvbxOPxHhwh$2bfe9a8a7f568772ed8a9f938afdf2bf70fddc0edff6967bf4c71129cd9775fd57f77b0aed19a00124d0e4c9bf8c5ef6d3c4d28f90610d731dafd7e77625368d',
   1, TRUE, NOW(), NOW());

-- ── Clientes ───────────────────────────────────────────────────────────────
-- Cliente123!
INSERT INTO cliente (nombre, email, password_hash, telefono, direccion_defecto, activo, verificado, created_at, updated_at) VALUES
  ('María González', 'cliente1@test.com',
   'scrypt:32768:8:1$AHKE6D4GqdJozenh$f748de113d5a8c036505f015e58181c2289ffda09723cff04b3ed8c9b76c330bb97c9a70d06d81a350ed2c36f1606789f435ce18d3bfe40448d5615a4c8e29d0',
   '+591 71234567', 'Av. 6 de Agosto #456, Sopocachi, La Paz',
   TRUE, TRUE, NOW(), NOW()),

  ('Carlos Mamani', 'cliente2@test.com',
   'scrypt:32768:8:1$AHKE6D4GqdJozenh$f748de113d5a8c036505f015e58181c2289ffda09723cff04b3ed8c9b76c330bb97c9a70d06d81a350ed2c36f1606789f435ce18d3bfe40448d5615a4c8e29d0',
   '+591 76543210', 'Calle Comercio #789, Zona Central, La Paz',
   TRUE, TRUE, NOW(), NOW()),

  ('Ana Quispe', 'cliente3@test.com',
   'scrypt:32768:8:1$AHKE6D4GqdJozenh$f748de113d5a8c036505f015e58181c2289ffda09723cff04b3ed8c9b76c330bb97c9a70d06d81a350ed2c36f1606789f435ce18d3bfe40448d5615a4c8e29d0',
   '+591 79876543', 'Av. Arce #1234, Miraflores, La Paz',
   TRUE, FALSE, NOW(), NOW());

-- ── Categorías ─────────────────────────────────────────────────────────────
INSERT INTO categoria (nombre_categoria, descripcion, activa) VALUES
  ('Electrónica',       'Dispositivos tecnológicos y accesorios',    TRUE),
  ('Ropa y Accesorios', 'Moda y complementos para toda la familia',  TRUE),
  ('Hogar y Jardín',    'Artículos para el hogar y decoración',      TRUE),
  ('Deportes',          'Equipamiento y ropa deportiva',             TRUE),
  ('Juguetes',          'Juguetes educativos y de entretenimiento',  TRUE);

-- ── Productos — Vendedor 1 (TechStore Bolivia) ─────────────────────────────
-- id_vendedor=2, categoría Electrónica=1
INSERT INTO almacen (nombre, descripcion, stock, stock_minimo, precio_venta, id_categoria, id_vendedor, activo, imagen_url, created_at, updated_at) VALUES

  ('Audífonos Bluetooth Premium',
   'Audífonos inalámbricos con cancelación de ruido activa, 30h de batería y sonido Hi-Fi.',
   45, 5, 289.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&q=80',
   NOW(), NOW()),

  ('Smartwatch Deportivo X200',
   'Reloj inteligente con GPS, monitor cardíaco, resistente al agua IP68.',
   30, 5, 450.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500&q=80',
   NOW(), NOW()),

  ('Cargador USB-C 65W',
   'Cargador rápido compatible con laptops, tablets y smartphones.',
   120, 10, 85.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=500&q=80',
   NOW(), NOW()),

  ('Mouse Inalámbrico Ergonómico',
   'Mouse silencioso con receptor USB nano, 1600 DPI y batería AAA.',
   65, 8, 95.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500&q=80',
   NOW(), NOW()),

  ('Teclado Mecánico RGB',
   'Teclado compacto 75% con switches azules, retroiluminación RGB 16M colores.',
   20, 3, 320.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1541140532154-b024d705b90a?w=500&q=80',
   NOW(), NOW()),

  ('Parlante Portátil Waterproof',
   'Parlante Bluetooth IPX7, 12h autonomía, sonido 360° con graves profundos.',
   55, 8, 175.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500&q=80',
   NOW(), NOW()),

  ('Soporte Laptop Ajustable',
   'Soporte de aluminio con 6 niveles de altura, compatible hasta 17 pulgadas.',
   80, 10, 120.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1593642632559-0c6d3fc62b89?w=500&q=80',
   NOW(), NOW()),

  ('Webcam Full HD 1080p',
   'Cámara web con micrófono incorporado, foco automático y tapa de privacidad.',
   40, 5, 195.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1587826080692-f439cd0b70da?w=500&q=80',
   NOW(), NOW()),

  ('Hub USB 7 Puertos',
   'Hub USB 3.0 de 7 puertos con adaptador de corriente independiente.',
   90, 10, 75.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1625895197185-efcec01cffe0?w=500&q=80',
   NOW(), NOW()),

  ('Disco SSD Externo 1TB',
   'SSD portátil USB-C de 1TB, velocidades hasta 540 MB/s, resistente a golpes.',
   25, 3, 380.00, 1, 2, TRUE,
   'https://images.unsplash.com/photo-1531492746076-161ca9bcad58?w=500&q=80',
   NOW(), NOW());

-- ── Productos — Vendedor 2 (ModaLatina Shop) ────────────────────────────────
-- id_vendedor=3, categorías variadas
INSERT INTO almacen (nombre, descripcion, stock, stock_minimo, precio_venta, id_categoria, id_vendedor, activo, imagen_url, created_at, updated_at) VALUES

  ('Camiseta Deportiva Dri-Fit',
   'Camiseta de entrenamiento con tecnología de secado rápido, disponible en 5 colores.',
   200, 20, 65.00, 4, 3, TRUE,
   'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=500&q=80',
   NOW(), NOW()),

  ('Zapatillas Running Pro',
   'Zapatillas para correr con suela amortiguadora, upper transpirable y talla 36-44.',
   60, 8, 320.00, 4, 3, TRUE,
   'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500&q=80',
   NOW(), NOW()),

  ('Mochila Impermeable 30L',
   'Mochila para laptop hasta 15.6", resistente al agua, con puerto USB de carga.',
   75, 10, 185.00, 4, 3, TRUE,
   'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80',
   NOW(), NOW()),

  ('Polo Casual 100% Algodón',
   'Polo de algodón peinado premium, corte slim fit, variedad de colores.',
   300, 30, 45.00, 2, 3, TRUE,
   'https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500&q=80',
   NOW(), NOW()),

  ('Jeans Clásico Slim',
   'Jean de mezclilla 98% algodón, corte slim, disponible en azul y negro.',
   120, 15, 150.00, 2, 3, TRUE,
   'https://images.unsplash.com/photo-1542272604-787c3835535d?w=500&q=80',
   NOW(), NOW()),

  ('Colchoneta Yoga 6mm',
   'Mat antideslizante extra grueso, ecofriendly, con correa de transporte.',
   85, 10, 95.00, 4, 3, TRUE,
   'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=500&q=80',
   NOW(), NOW()),

  ('Set Ollas Antiadherentes 5 pzas',
   'Juego de ollas con revestimiento de granito, aptas para todo tipo de cocinas.',
   35, 5, 280.00, 3, 3, TRUE,
   'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&q=80',
   NOW(), NOW()),

  ('Lámpara LED Escritorio',
   'Lámpara con brazo flexible, 5 temperaturas de color, intensidad regulable y carga USB.',
   50, 8, 120.00, 3, 3, TRUE,
   'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&q=80',
   NOW(), NOW()),

  ('Juego de Sábanas Microfibra',
   'Set 4 piezas (sábana bajera, encimera, 2 fundas), suave y de secado rápido.',
   90, 12, 75.00, 3, 3, TRUE,
   'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=500&q=80',
   NOW(), NOW()),

  ('LEGO Classic 500 piezas',
   'Set creativo de construcción para niños +4 años, colores brillantes variados.',
   40, 5, 220.00, 5, 3, TRUE,
   'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=500&q=80',
   NOW(), NOW());

-- ── Pedidos de Ejemplo ──────────────────────────────────────────────────────
-- Pedido 1: cliente1, entregado
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, notas, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (1, 539.00, 'entregado', 'Av. 6 de Agosto #456, Sopocachi, La Paz', 'Entregar en horario de la tarde', 'qr', TRUE, 'CHK-A1B2C3D4', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (1, 1, 1, 289.00),  -- Audífonos Bluetooth
  (1, 3, 1, 85.00),   -- Cargador USB-C
  (1, 11, 1, 65.00);  -- Camiseta Deportiva

-- Pedido 2: cliente2, en_camino
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (2, 635.00, 'en_camino', 'Calle Comercio #789, Zona Central, La Paz', 'transferencia', TRUE, 'CHK-E5F6G7H8', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (2, 2, 1, 450.00),  -- Smartwatch
  (2, 4, 1, 95.00),   -- Mouse
  (2, 16, 1, 95.00);  -- Colchoneta Yoga

-- Pedido 3: cliente3, confirmado
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (3, 410.00, 'confirmado', 'Av. Arce #1234, Miraflores, La Paz', 'qr', TRUE, 'CHK-I9J0K1L2', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (3, 12, 1, 320.00),  -- Zapatillas Running
  (3, 14, 2, 45.00);   -- Polo Casual x2

-- Pedido 4: cliente1, en_preparacion
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (1, 600.00, 'en_preparacion', 'Av. 6 de Agosto #456, Sopocachi, La Paz', 'efectivo', FALSE, 'CHK-M3N4O5P6', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (4, 5, 1, 320.00),   -- Teclado Mecánico
  (4, 10, 1, 380.00);  -- SSD Externo

-- Pedido 5: cliente2, pendiente
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (2, 395.00, 'pendiente', 'Calle Comercio #789, Zona Central, La Paz', 'qr', FALSE, 'CHK-Q7R8S9T0', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (5, 13, 1, 185.00),  -- Mochila
  (5, 17, 1, 280.00);  -- Set Ollas

-- ── Historial de estados ────────────────────────────────────────────────────
-- Pedido 1 (entregado)
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (1, NULL,           'pendiente',       'Pedido creado por el cliente',             NULL, NOW() - INTERVAL '10 days'),
  (1, 'pendiente',    'confirmado',      'Pago QR verificado correctamente',         1,    NOW() - INTERVAL '9 days'),
  (1, 'confirmado',   'en_preparacion',  'Preparando el pedido',                     2,    NOW() - INTERVAL '8 days'),
  (1, 'en_preparacion','en_camino',      'Pedido enviado con mensajero',             2,    NOW() - INTERVAL '7 days'),
  (1, 'en_camino',    'entregado',       'Entregado al cliente satisfactoriamente',  2,    NOW() - INTERVAL '5 days');

-- Pedido 2 (en_camino)
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (2, NULL,           'pendiente',       'Pedido creado por el cliente',      NULL, NOW() - INTERVAL '3 days'),
  (2, 'pendiente',    'confirmado',      'Transferencia verificada',          1,    NOW() - INTERVAL '2 days'),
  (2, 'confirmado',   'en_preparacion',  'Embalando productos',               2,    NOW() - INTERVAL '1 day 12 hours'),
  (2, 'en_preparacion','en_camino',      'Enviado. Est. entrega: mañana',     2,    NOW() - INTERVAL '1 day');

-- Pedido 3 (confirmado)
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (3, NULL,        'pendiente',   'Pedido creado por el cliente', NULL, NOW() - INTERVAL '1 day'),
  (3, 'pendiente', 'confirmado',  'Pago QR verificado',           1,    NOW() - INTERVAL '12 hours');

-- Pedido 4 (en_preparacion)
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (4, NULL,        'pendiente',      'Pedido creado',    NULL, NOW() - INTERVAL '6 hours'),
  (4, 'pendiente', 'confirmado',     'Pago confirmado',  1,    NOW() - INTERVAL '5 hours'),
  (4, 'confirmado','en_preparacion', 'Preparando',       2,    NOW() - INTERVAL '2 hours');

-- Pedido 5 (pendiente)
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (5, NULL, 'pendiente', 'Pedido creado por el cliente', NULL, NOW() - INTERVAL '30 minutes');

-- ── Actualizar secuencias ───────────────────────────────────────────────────
SELECT setval('rol_id_rol_seq',            (SELECT MAX(id_rol)        FROM rol));
SELECT setval('usuario_id_usuario_seq',    (SELECT MAX(id_usuario)    FROM usuario));
SELECT setval('cliente_id_cliente_seq',    (SELECT MAX(id_cliente)    FROM cliente));
SELECT setval('categoria_id_categoria_seq',(SELECT MAX(id_categoria)  FROM categoria));
SELECT setval('almacen_id_producto_seq',   (SELECT MAX(id_producto)   FROM almacen));
SELECT setval('pedido_id_pedido_seq',      (SELECT MAX(id_pedido)     FROM pedido));
SELECT setval('detalle_pedido_id_detalle_seq',(SELECT MAX(id_detalle) FROM detalle_pedido));
SELECT setval('historial_pedido_id_historial_seq',(SELECT MAX(id_historial) FROM historial_pedido));

-- ── Verificación ────────────────────────────────────────────────────────────
SELECT 'Roles'      AS tabla, COUNT(*) AS total FROM rol
UNION ALL SELECT 'Usuarios',   COUNT(*) FROM usuario
UNION ALL SELECT 'Clientes',   COUNT(*) FROM cliente
UNION ALL SELECT 'Categorías', COUNT(*) FROM categoria
UNION ALL SELECT 'Productos',  COUNT(*) FROM almacen
UNION ALL SELECT 'Pedidos',    COUNT(*) FROM pedido
UNION ALL SELECT 'Detalles',   COUNT(*) FROM detalle_pedido
UNION ALL SELECT 'Historial',  COUNT(*) FROM historial_pedido;
