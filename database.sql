-- ============================================================
--  CHUKUTA EXPRESS — Base de datos completa v4.0
--  PostgreSQL 14+
--
--  Este único archivo crea toda la estructura y carga los datos
--  de ejemplo. Ejecútalo con:
--
--    psql -U postgres -c "CREATE DATABASE chukutaexpress;"
--    psql -U postgres -d chukutaexpress -f database.sql
--
--  Credenciales de prueba:
--    admin@chukuta.com      / Admin123!
--    vendedor1@test.com     / Vendedor123!
--    vendedor2@test.com     / Vendedor123!
--    cliente1@test.com      / Cliente123!
--    cliente2@test.com      / Cliente123!
--    cliente3@test.com      / Cliente123!
-- ============================================================
SET client_encoding = 'UTF8';

BEGIN;

-- ============================================================
--  SECCIÓN 1 — ESTRUCTURA
-- ============================================================

-- Limpiar tablas previas (orden inverso de dependencias FK)
DROP TABLE IF EXISTS movimiento_inventario CASCADE;
DROP TABLE IF EXISTS auditoria_log         CASCADE;
DROP TABLE IF EXISTS historial_pedido      CASCADE;
DROP TABLE IF EXISTS detalle_pedido        CASCADE;
DROP TABLE IF EXISTS pedido                CASCADE;
DROP TABLE IF EXISTS carrito               CASCADE;
DROP TABLE IF EXISTS almacen               CASCADE;
DROP TABLE IF EXISTS categoria             CASCADE;
DROP TABLE IF EXISTS cliente               CASCADE;
DROP TABLE IF EXISTS usuario               CASCADE;
DROP TABLE IF EXISTS rol                   CASCADE;

-- ── Roles ─────────────────────────────────────────────────────────────────────
CREATE TABLE rol (
    id_rol      SERIAL PRIMARY KEY,
    nombre      VARCHAR(50)  NOT NULL UNIQUE,
    descripcion VARCHAR(200)
);

-- ── Usuarios internos ─────────────────────────────────────────────────────────
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

-- ── Clientes ──────────────────────────────────────────────────────────────────
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

-- ── Categorías ────────────────────────────────────────────────────────────────
CREATE TABLE categoria (
    id_categoria     SERIAL PRIMARY KEY,
    nombre_categoria VARCHAR(100) NOT NULL UNIQUE,
    descripcion      TEXT,
    activa           BOOLEAN NOT NULL DEFAULT TRUE
);

-- ── Almacén (productos) ───────────────────────────────────────────────────────
CREATE TABLE almacen (
    id_producto   SERIAL PRIMARY KEY,
    nombre        VARCHAR(200)  NOT NULL,
    descripcion   TEXT          DEFAULT '',
    codigo        VARCHAR(50)   UNIQUE,
    stock         INTEGER       NOT NULL DEFAULT 0 CHECK (stock >= 0),
    stock_minimo  INTEGER       NOT NULL DEFAULT 5,
    precio_venta  NUMERIC(10,2) NOT NULL CHECK (precio_venta > 0),
    precio_costo  NUMERIC(10,2),
    id_categoria  INTEGER       NOT NULL REFERENCES categoria(id_categoria),
    id_vendedor   INTEGER       REFERENCES usuario(id_usuario),
    activo        BOOLEAN       NOT NULL DEFAULT TRUE,
    imagen_url    VARCHAR(500),
    created_at    TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_producto_categoria_activo ON almacen (id_categoria, activo);
CREATE INDEX ix_producto_stock            ON almacen (stock);

-- ── Carrito ───────────────────────────────────────────────────────────────────
CREATE TABLE carrito (
    id_carrito  SERIAL PRIMARY KEY,
    id_cliente  INTEGER NOT NULL REFERENCES cliente(id_cliente),
    id_producto INTEGER NOT NULL REFERENCES almacen(id_producto),
    cantidad    INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    agregado_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_carrito_cliente_producto UNIQUE (id_cliente, id_producto)
);

-- ── Pedidos ───────────────────────────────────────────────────────────────────
CREATE TABLE pedido (
    id_pedido           SERIAL PRIMARY KEY,
    id_cliente          INTEGER       NOT NULL REFERENCES cliente(id_cliente),
    total               NUMERIC(10,2) NOT NULL,
    estado              VARCHAR(30)   NOT NULL DEFAULT 'pendiente',
    direccion_entrega   TEXT          NOT NULL,
    notas               TEXT,
    metodo_pago         VARCHAR(50)   DEFAULT 'pendiente',
    referencia_pago     VARCHAR(100),
    pago_verificado     BOOLEAN       DEFAULT FALSE,
    pago_verificado_por INTEGER       REFERENCES usuario(id_usuario),
    pago_verificado_at  TIMESTAMP,
    operador_id         INTEGER       REFERENCES usuario(id_usuario),
    codigo_seguimiento  VARCHAR(50),
    created_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_pedido_cliente_estado ON pedido (id_cliente, estado);
CREATE INDEX ix_pedido_estado         ON pedido (estado);

-- ── Detalles de pedido ────────────────────────────────────────────────────────
CREATE TABLE detalle_pedido (
    id_detalle      SERIAL PRIMARY KEY,
    id_pedido       INTEGER       NOT NULL REFERENCES pedido(id_pedido),
    id_producto     INTEGER       NOT NULL REFERENCES almacen(id_producto),
    cantidad        INTEGER       NOT NULL,
    precio_unitario NUMERIC(10,2) NOT NULL
);

-- ── Historial de pedidos ──────────────────────────────────────────────────────
CREATE TABLE historial_pedido (
    id_historial    SERIAL PRIMARY KEY,
    id_pedido       INTEGER     NOT NULL REFERENCES pedido(id_pedido),
    estado_anterior VARCHAR(30),
    estado_nuevo    VARCHAR(30) NOT NULL,
    comentario      TEXT,
    cambiado_por    INTEGER     REFERENCES usuario(id_usuario),
    creado_at       TIMESTAMP   DEFAULT NOW()
);

-- ── Auditoría ─────────────────────────────────────────────────────────────────
CREATE TABLE auditoria_log (
    id_log           SERIAL PRIMARY KEY,
    tabla            VARCHAR(50)  NOT NULL,
    accion           VARCHAR(20)  NOT NULL,
    id_registro      INTEGER,
    datos_anteriores TEXT,
    datos_nuevos     TEXT,
    id_usuario       INTEGER REFERENCES usuario(id_usuario),
    id_cliente       INTEGER REFERENCES cliente(id_cliente),
    ip_address       VARCHAR(45),
    user_agent       VARCHAR(200),
    creado_at        TIMESTAMP DEFAULT NOW()
);

CREATE INDEX ix_auditoria_tabla_accion ON auditoria_log (tabla, accion);
CREATE INDEX ix_auditoria_usuario      ON auditoria_log (id_usuario);

-- ── Movimientos de inventario ─────────────────────────────────────────────────
CREATE TABLE movimiento_inventario (
    id_movimiento  SERIAL PRIMARY KEY,
    id_producto    INTEGER     NOT NULL REFERENCES almacen(id_producto),
    tipo           VARCHAR(20) NOT NULL,  -- entrada | salida | ajuste
    cantidad       INTEGER     NOT NULL,
    stock_anterior INTEGER     NOT NULL,
    stock_nuevo    INTEGER     NOT NULL,
    motivo         VARCHAR(200),
    id_pedido      INTEGER     REFERENCES pedido(id_pedido),
    id_usuario     INTEGER     REFERENCES usuario(id_usuario),
    creado_at      TIMESTAMP   DEFAULT NOW()
);

-- ============================================================
--  SECCIÓN 2 — DATOS DE EJEMPLO
-- ============================================================

-- ── Roles ─────────────────────────────────────────────────────────────────────
INSERT INTO rol (id_rol, nombre, descripcion) VALUES
  (1, 'Vendedor',           'Gestiona sus propios productos y pedidos'),
  (2, 'Administrador',      'Acceso total al sistema'),
  (3, 'Operador Logístico', 'Gestiona estados de pedidos y logística');

-- ── Usuarios internos ─────────────────────────────────────────────────────────
-- Hashes generados con werkzeug.security.generate_password_hash (scrypt)
-- admin@chukuta.com    → Admin123!
-- vendedor*@test.com   → Vendedor123!
INSERT INTO usuario (nombre, email, password_hash, id_rol, activo, created_at, updated_at) VALUES
  ('Administrador', 'admin@chukuta.com',
   'scrypt:32768:8:1$wn8zNfI6qqjAUifH$42265e3121040642f4c17131445a7679494b9f00df878f6b47f53ff60a3305167cda77c2f197008b2b7727bd3a16b3cf84e91748d5eb5b325c887dd43cbe6920',
   2, TRUE, NOW(), NOW()),

  ('TechStore Bolivia', 'vendedor1@test.com',
   'scrypt:32768:8:1$mlMa4TvbxOPxHhwh$2bfe9a8a7f568772ed8a9f938afdf2bf70fddc0edff6967bf4c71129cd9775fd57f77b0aed19a00124d0e4c9bf8c5ef6d3c4d28f90610d731dafd7e77625368d',
   1, TRUE, NOW(), NOW()),

  ('ModaLatina Shop', 'vendedor2@test.com',
   'scrypt:32768:8:1$mlMa4TvbxOPxHhwh$2bfe9a8a7f568772ed8a9f938afdf2bf70fddc0edff6967bf4c71129cd9775fd57f77b0aed19a00124d0e4c9bf8c5ef6d3c4d28f90610d731dafd7e77625368d',
   1, TRUE, NOW(), NOW());

-- ── Clientes ──────────────────────────────────────────────────────────────────
-- cliente*@test.com → Cliente123!
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

-- ── Categorías ────────────────────────────────────────────────────────────────
-- 9 categorías: IDs 1–9 en orden de inserción
INSERT INTO categoria (nombre_categoria, descripcion, activa) VALUES
  ('Electrónica',      'Dispositivos tecnológicos, accesorios y gadgets',         TRUE),  -- 1
  ('Ropa y Accesorios','Moda, calzado y complementos para toda la familia',        TRUE),  -- 2
  ('Hogar y Jardín',   'Artículos para el hogar, cocina y decoración',             TRUE),  -- 3
  ('Deportes',         'Equipamiento, ropa y accesorios deportivos',               TRUE),  -- 4
  ('Alimentos',        'Productos alimenticios, bebidas y gourmet boliviano',       TRUE),  -- 5
  ('Juguetes',         'Juguetes educativos y de entretenimiento para niños',      TRUE),  -- 6
  ('Libros',           'Libros, revistas y material educativo',                    TRUE),  -- 7
  ('Mascotas',         'Alimentos, accesorios y cuidado de mascotas',              TRUE),  -- 8
  ('Oficina',          'Material de oficina, papelería y ergonomía',               TRUE);  -- 9

-- ============================================================
--  PRODUCTOS — 50 en total, distribuidos en las 9 categorías
--  id_vendedor 2 = TechStore Bolivia
--  id_vendedor 3 = ModaLatina Shop
-- ============================================================

-- ── ELECTRÓNICA — 10 productos (id_categoria = 1) ─────────────────────────────
INSERT INTO almacen (nombre, descripcion, stock, stock_minimo, precio_venta, id_categoria, id_vendedor, activo, imagen_url, created_at, updated_at) VALUES

  ('Audífonos Bluetooth Premium',
   'Auriculares inalámbricos con cancelación de ruido activa y sonido Hi-Fi. Hasta 30h de batería, driver de 40mm, pliegue compacto para viaje. Compatibles con iOS y Android.',
   45, 5, 289.00, 1, 2, TRUE, 'https://picsum.photos/seed/AudifonosBT/400/400', NOW(), NOW()),

  ('Smartwatch Deportivo X200',
   'Reloj inteligente con GPS integrado, monitor de frecuencia cardíaca y SpO2. Resistente al agua IP68. Batería 7 días, más de 100 modos de ejercicio.',
   30, 5, 450.00, 1, 2, TRUE, 'https://picsum.photos/seed/SmartwatchX200/400/400', NOW(), NOW()),

  ('Cable USB-C Carga Rápida 65W',
   'Cable trenzado de nylon de 2m para carga rápida PD 65W compatible con laptops, tablets y smartphones. Certificado UL, soporta 10Gbps de transferencia.',
   150, 20, 38.00, 1, 2, TRUE, 'https://picsum.photos/seed/CableUSBC/400/400', NOW(), NOW()),

  ('Mouse Inalámbrico Silencioso',
   'Mouse ergonómico con sensor óptico de 1600 DPI, clic silencioso y receptor nano USB. Batería AA incluida con autonomía de hasta 12 meses. Para diestros y zurdos.',
   65, 8, 95.00, 1, 2, TRUE, 'https://picsum.photos/seed/MouseInalambrico/400/400', NOW(), NOW()),

  ('Teclado Mecánico RGB 75%',
   'Teclado compacto con switches mecánicos azules, retroiluminación RGB por tecla y reposabrazos magnético. Layout español latinoamericano, conexión USB-C.',
   20, 3, 320.00, 1, 2, TRUE, 'https://picsum.photos/seed/TecladoMecanico/400/400', NOW(), NOW()),

  ('Parlante Bluetooth Portátil IPX7',
   'Altavoz compacto con sonido 360° y graves potentes. Resistente al agua y polvo IPX7, 12h de autonomía. Ideal para el lago Titicaca o el Salar de Uyuni.',
   55, 8, 175.00, 1, 2, TRUE, 'https://picsum.photos/seed/ParlanteBT/400/400', NOW(), NOW()),

  ('Soporte Laptop Aluminio Ajustable',
   'Base elevadora de aluminio con 6 niveles de altura, compatible con laptops de 10 a 17 pulgadas. Plegable, con almohadillas antideslizantes. Mejora la ergonomía del cuello.',
   80, 10, 120.00, 1, 2, TRUE, 'https://picsum.photos/seed/SoporteLaptop/400/400', NOW(), NOW()),

  ('Webcam Full HD 1080p',
   'Cámara web con resolución 1080p a 30fps, autofocus, micrófono con reducción de ruido y tapa de privacidad. Plug & Play, sin drivers. Compatible con Zoom, Teams y Meet.',
   40, 5, 195.00, 1, 2, TRUE, 'https://picsum.photos/seed/Webcam1080p/400/400', NOW(), NOW()),

  ('Hub USB-C 7 en 1',
   'Concentrador multipuerto con HDMI 4K, 3× USB-A 3.0, USB-C PD 100W, lector SD/microSD. Carcasa de aluminio con disipación de calor. Compatible con MacBook y Windows.',
   90, 10, 145.00, 1, 2, TRUE, 'https://picsum.photos/seed/HubUSBC/400/400', NOW(), NOW()),

  ('Disco SSD Externo 1TB',
   'SSD portátil USB-C con velocidades de lectura hasta 540 MB/s. Carcasa de aluminio resistente a golpes y caídas. Compatible con PC, Mac, consolas y tablets.',
   25, 3, 380.00, 1, 2, TRUE, 'https://picsum.photos/seed/SSDExterno1TB/400/400', NOW(), NOW()),


-- ── ROPA Y ACCESORIOS — 7 productos (id_categoria = 2) ────────────────────────

  ('Chompa de Lana de Alpaca — Diseño Andino',
   'Chompa 100% lana de alpaca boliviana con diseño geométrico inspirado en textiles tiwanakotas. Colores naturales sin tinte, suave al tacto, talla única con elasticidad.',
   60, 8, 185.00, 2, 3, TRUE, 'https://picsum.photos/seed/ChompaAlpaca/400/400', NOW(), NOW()),

  ('Chullo Artesanal de Potosí',
   'Gorro chullo tejido a mano por artesanas de Potosí con motivos de llamas y flores andinas. Lana de oveja natural, forro interior de polar. Talla adulto.',
   100, 15, 65.00, 2, 3, TRUE, 'https://picsum.photos/seed/ChulloArtesanal/400/400', NOW(), NOW()),

  ('Polo Casual 100% Algodón',
   'Polo de algodón peinado premium de 180g/m², corte slim fit con costuras reforzadas. Variedad de colores básicos y pasteles. Tallas S a XXL. No encoge al lavar.',
   200, 25, 45.00, 2, 3, TRUE, 'https://picsum.photos/seed/PoloAlgodon/400/400', NOW(), NOW()),

  ('Bolso Tejido de Awayo Boliviano',
   'Bolso de hombro elaborado con tela awayo auténtica de los Andes. Forrado interiormente, cierre metálico y bolsillo adicional. Pieza única de artesanía paceña.',
   40, 5, 130.00, 2, 3, TRUE, 'https://picsum.photos/seed/BolsoAwayo/400/400', NOW(), NOW()),

  ('Jeans Clásico Slim Fit',
   'Jean de mezclilla 98% algodón 2% elastano, corte slim fit con cinco bolsillos tradicionales. Disponible en azul clásico y negro. Tallas 28 a 38.',
   120, 15, 150.00, 2, 3, TRUE, 'https://picsum.photos/seed/JeansSlim/400/400', NOW(), NOW()),

  ('Gafas de Sol UV400 Polarizadas',
   'Lentes polarizadas con protección UV400, marco de acetato ligero y bisagras de resorte. Incluye funda y paño de limpieza. Ideales para la alta radiación solar del altiplano.',
   85, 10, 195.00, 2, 3, TRUE, 'https://picsum.photos/seed/GafasUV400/400/400', NOW(), NOW()),

  ('Zapatillas Running Ultraligeras',
   'Zapatillas de correr con upper de malla transpirable, suela de goma EVA amortiguadora y plantilla de memoria extraíble. Peso 280g. Tallas 36 a 44.',
   50, 8, 320.00, 2, 3, TRUE, 'https://picsum.photos/seed/ZapatillasRunning/400/400', NOW(), NOW()),


-- ── HOGAR Y JARDÍN — 6 productos (id_categoria = 3) ──────────────────────────

  ('Set de Ollas Antiadherentes 5 Piezas',
   'Juego de ollas de aluminio forjado con recubrimiento antiadherente libre de PFOA. Incluye ollas de 16, 18 y 20cm, sartén de 24cm y cacerola con tapas de vidrio templado.',
   35, 5, 280.00, 3, 3, TRUE, 'https://picsum.photos/seed/Ollas5pzas/400/400', NOW(), NOW()),

  ('Juego de Tazas Cerámicas — Fauna Bolivia',
   'Set de 6 tazas de 300ml con diseños de la fauna boliviana: flamenco, vicuña, cóndor, jaguar, oso andino y tapir. Apto lavavajillas y microondas.',
   45, 8, 160.00, 3, 3, TRUE, 'https://picsum.photos/seed/TazasFaunaBolivia/400/400', NOW(), NOW()),

  ('Maceta de Barro Cocido Artesanal',
   'Maceta de barro cocido con diseños andinos pintados a mano por alfareros de Tiwanaku. Diámetro 25cm, con plato base. Ideal para plantas de interior y exterior.',
   55, 8, 75.00, 3, 3, TRUE, 'https://picsum.photos/seed/MacetaBarro/400/400', NOW(), NOW()),

  ('Lámpara LED de Escritorio Regulable',
   'Lámpara con cuello flexible de aluminio, 3 temperaturas de color (cálido/neutro/frío), 5 niveles de brillo y puerto USB de carga integrado. Base antideslizante.',
   50, 8, 120.00, 3, 3, TRUE, 'https://picsum.photos/seed/LamparaLED/400/400', NOW(), NOW()),

  ('Almohada Viscoelástica Memory Foam',
   'Almohada ergonómica con núcleo de espuma viscoelástica de 60 densidad y funda de bambú hipoalergénica. Se adapta a la curva cervical. Altura 12cm.',
   40, 6, 220.00, 3, 3, TRUE, 'https://picsum.photos/seed/AlmohadaMemory/400/400', NOW(), NOW()),

  ('Vela Aromática de Cera de Soya',
   'Vela artesanal de cera de soya 100% natural, con mechas de algodón sin plomo. Aroma de eucalipto y menta andina. 200g, duración estimada 45 horas.',
   90, 15, 55.00, 3, 3, TRUE, 'https://picsum.photos/seed/VelaAromatica/400/400', NOW(), NOW()),


-- ── DEPORTES — 5 productos (id_categoria = 4) ─────────────────────────────────

  ('Bicicleta de Montaña 21 Velocidades',
   'MTB con cuadro de aluminio 6061, horquilla de suspensión delantera 100mm, frenos de disco mecánicos Shimano y neumáticos 27.5×2.1. Ideal para los cerros de La Paz.',
   12, 2, 2850.00, 4, 2, TRUE, 'https://picsum.photos/seed/BicicletaMTB/400/400', NOW(), NOW()),

  ('Pelota de Fútbol Profesional N°5',
   'Balón termosellado de 32 paneles con carcasa de poliuretano y vejiga de látex. Presión recomendada 0.8 bar. Aprobada para cancha de grama y cemento.',
   80, 15, 120.00, 4, 2, TRUE, 'https://picsum.photos/seed/PelotaFutbol/400/400', NOW(), NOW()),

  ('Colchoneta Yoga Antideslizante 6mm',
   'Mat de TPE ecológico 183×61cm, 6mm de grosor. Superficie antideslizante en ambas caras con textura en relieve. Incluye correa de transporte. Sin PVC ni ftalatos.',
   70, 10, 95.00, 4, 3, TRUE, 'https://picsum.photos/seed/ColchonetaYoga/400/400', NOW(), NOW()),

  ('Mancuernas Ajustables 20kg — Par',
   'Par de mancuernas ajustables de 5 a 20kg con discos de hierro cromado y collares de rosca de seguridad. Mango estriado antideslizante. Ideal para entrenamiento en casa.',
   25, 4, 480.00, 4, 2, TRUE, 'https://picsum.photos/seed/Mancuernas20kg/400/400', NOW(), NOW()),

  ('Cuerda para Saltar de Velocidad',
   'Cuerda de saltar con rodamientos de bolas de acero, mango ergonómico de aluminio y cable de acero PVC. Longitud ajustable hasta 3m. Para crossfit y boxeo.',
   100, 20, 45.00, 4, 2, TRUE, 'https://picsum.photos/seed/CuerdaSaltar/400/400', NOW(), NOW()),


-- ── ALIMENTOS — 6 productos (id_categoria = 5) ────────────────────────────────

  ('Café de los Yungas 500g — Molido',
   'Café arábica 100% boliviano cultivado en los Yungas de La Paz entre 1200 y 1800m sobre el nivel del mar. Tostado medio, notas a chocolate amargo y avellana. Molido fino para espresso.',
   120, 20, 95.00, 5, 3, TRUE, 'https://picsum.photos/seed/CafeYungas/400/400', NOW(), NOW()),

  ('Quinua Real Orgánica 1kg',
   'Quinua real del altiplano boliviano con certificación orgánica internacional. Grano perlado de alta calidad, libre de gluten. Rica en proteínas completas, calcio y hierro.',
   200, 30, 42.00, 5, 3, TRUE, 'https://picsum.photos/seed/QuinuaReal/400/400', NOW(), NOW()),

  ('Cacao en Polvo del Beni 250g',
   'Cacao puro en polvo elaborado con cacao fino de aroma cultivado en el Beni, Bolivia. Sin azúcar ni conservantes. Perfecto para postres, batidos calientes y repostería.',
   85, 12, 68.00, 5, 3, TRUE, 'https://picsum.photos/seed/CacaoBeni/400/400', NOW(), NOW()),

  ('Miel de Abeja Pura del Beni 1kg',
   'Miel monofloral cosechada en apiarios tradicionales del Beni. Sin pasteurizar ni filtrar. Certificado artesanal. Puede cristalizarse naturalmente, lo que garantiza su pureza.',
   60, 8, 85.00, 5, 3, TRUE, 'https://picsum.photos/seed/MielPuraBeni/400/400', NOW(), NOW()),

  ('Chía Orgánica Boliviana 500g',
   'Semillas de chía de producción boliviana con certificación orgánica. Rica en ácidos grasos omega-3, fibra soluble y antioxidantes. Ideal para smoothies y bowls saludables.',
   130, 20, 38.00, 5, 3, TRUE, 'https://picsum.photos/seed/ChiaOrganica/400/400', NOW(), NOW()),

  ('Chocolate Artesanal 70% Cacao — Pack 6',
   'Pack de 6 tabletas de chocolate oscuro elaborado con cacao fino beniano. 70% cacao, sin lecitina de soya ni saborizantes artificiales. Producción de comercio justo.',
   70, 10, 110.00, 5, 3, TRUE, 'https://picsum.photos/seed/ChocolateArtesanal/400/400', NOW(), NOW()),


-- ── JUGUETES — 4 productos (id_categoria = 6) ─────────────────────────────────

  ('Set de Construcción STEM 200 Piezas',
   'Bloques de construcción compatibles aptos para niños desde 4 años. 200 piezas en colores primarios que estimulan la creatividad, coordinación motriz y pensamiento lógico-matemático.',
   55, 8, 195.00, 6, 3, TRUE, 'https://picsum.photos/seed/SetSTEM200/400/400', NOW(), NOW()),

  ('Rompecabezas Mapa de Bolivia 500 Piezas',
   'Rompecabezas educativo con el mapa político de Bolivia: departamentos, capitales, ríos y sitios de interés. Cartón grueso 2mm. Para niños mayores de 8 años y adultos.',
   45, 6, 75.00, 6, 3, TRUE, 'https://picsum.photos/seed/RompecabezasBolivia/400/400', NOW(), NOW()),

  ('Muñeca Artesanal de Pollera Boliviana',
   'Muñeca de tela con traje típico de cholita paceña: pollera, manta, sombrero borsalino y trenzas. Confeccionada a mano por artesanas de la ciudad de El Alto. Coleccionable.',
   30, 4, 85.00, 6, 3, TRUE, 'https://picsum.photos/seed/MunecaCholita/400/400', NOW(), NOW()),

  ('Pizarrón Magnético Doble Cara con Caballete',
   'Pizarrón de 60×45cm con cara de pizarra verde para tiza y cara magnética blanca para marcadores. Caballete de madera de altura regulable. Incluye accesorios.',
   20, 3, 285.00, 6, 3, TRUE, 'https://picsum.photos/seed/PizarronDobleCara/400/400', NOW(), NOW()),


-- ── LIBROS — 4 productos (id_categoria = 7) ───────────────────────────────────

  ('Historia de Bolivia — Edición Ilustrada',
   'Recorrido completo por la historia boliviana desde las culturas precolombinas (Tiwanaku, Incas) hasta el siglo XXI. Más de 400 páginas con fotografías y mapas históricos.',
   40, 5, 95.00, 7, 3, TRUE, 'https://picsum.photos/seed/HistoriaBolivia/400/400', NOW(), NOW()),

  ('Guía de Trekking en los Andes Bolivianos',
   'Manual práctico con 30 rutas de senderismo: Huayna Potosí, Choro, Takesi, Yunga Cruz y más. Incluye mapas topográficos, perfiles de elevación, consejos de seguridad y altitud.',
   25, 4, 120.00, 7, 3, TRUE, 'https://picsum.photos/seed/GuiaTrekkingAndes/400/400', NOW(), NOW()),

  ('Python para Ciencia de Datos — 2024',
   'Guía técnica actualizada que cubre NumPy, Pandas, Matplotlib, Scikit-learn y TensorFlow. 80 ejercicios prácticos con datasets reales. Ideal para estudiantes y profesionales.',
   30, 5, 185.00, 7, 2, TRUE, 'https://picsum.photos/seed/PythonDataScience/400/400', NOW(), NOW()),

  ('Cocina Boliviana: 120 Recetas Tradicionales',
   'Recopilación de recetas auténticas de los 9 departamentos: salteñas, fricasé, silpancho, chairo, sopa de maní, api morado, chicha, humintas y muchas más. Con historia de cada plato.',
   50, 8, 80.00, 7, 3, TRUE, 'https://picsum.photos/seed/CocinaBoliviana/400/400', NOW(), NOW()),


-- ── MASCOTAS — 4 productos (id_categoria = 8) ─────────────────────────────────

  ('Cama Ortopédica para Perros Medianos',
   'Cama con núcleo de espuma memory foam de alta densidad para perros de 10 a 25kg. Funda de microfibra lavable a máquina, base antideslizante. Ideal para mascotas con displasia.',
   25, 4, 280.00, 8, 3, TRUE, 'https://picsum.photos/seed/CamaPerroOrtopedica/400/400', NOW(), NOW()),

  ('Torre Rascador para Gatos con Hamaca',
   'Rascador de 80cm con plataforma superior, hamaca intermedia y cuerda de sisal natural. Base de 40×40cm con sujeción antivuelco. Para gatos de hasta 6kg.',
   20, 3, 340.00, 8, 3, TRUE, 'https://picsum.photos/seed/RascadorGatoTorre/400/400', NOW(), NOW()),

  ('Comedero Automático Programable 2L',
   'Dispensador de comida con temporizador digital para hasta 4 comidas diarias. Capacidad 2 litros, pantalla LCD, alarma de comida. Funciona con pilas AA o USB-C.',
   15, 3, 390.00, 8, 3, TRUE, 'https://picsum.photos/seed/ComederoAutomatico/400/400', NOW(), NOW()),

  ('Transportador Plegable para Mascotas',
   'Jaula de tela Oxford 600D con estructura de alambre galvanizado, ventanas de malla, base impermeable y bolsillo lateral con cierre. Para mascotas hasta 8kg.',
   30, 5, 165.00, 8, 3, TRUE, 'https://picsum.photos/seed/TransportadorMascota/400/400', NOW(), NOW()),


-- ── OFICINA — 4 productos (id_categoria = 9) ──────────────────────────────────

  ('Silla Ergonómica con Soporte Lumbar',
   'Silla ejecutiva con respaldo de malla transpirable, soporte lumbar regulable, reposabrazos 3D y base de aluminio con ruedas de poliuretano. Soporta hasta 120kg.',
   10, 2, 1450.00, 9, 2, TRUE, 'https://picsum.photos/seed/SillaErgonomica/400/400', NOW(), NOW()),

  ('Organizador de Escritorio 6 Compartimentos',
   'Organizador modular en madera MDF con acabado bambú natural. 6 compartimentos de distintos tamaños para bolígrafos, tarjetas, clips, notas y documentos en vertical.',
   60, 10, 95.00, 9, 2, TRUE, 'https://picsum.photos/seed/OrganizadorEscritorio/400/400', NOW(), NOW()),

  ('Monitor Portátil USB-C 15.6" Full HD',
   'Monitor secundario portátil IPS de 15.6 pulgadas, resolución 1920×1080, brillo 300 nits. Conexión USB-C y mini-HDMI. Funda protectora incluida. 800g.',
   18, 3, 1280.00, 9, 2, TRUE, 'https://picsum.photos/seed/MonitorPortatil/400/400', NOW(), NOW()),

  ('Kit de Papelería Premium 15 Piezas',
   'Set completo para escritorio: 4 bolígrafos Pilot, 2 rotuladores de colores, 3 resaltadores pastel, lápices HB y 2B, corrector líquido, compás y regla de 30cm metálica.',
   110, 20, 75.00, 9, 2, TRUE, 'https://picsum.photos/seed/KitPapeleriaPremium/400/400', NOW(), NOW()),

-- ── PRODUCTOS ADICIONALES (20 más para llegar a 70) ──────────────────────────

  ('Monitor Gamer Curvo 27"',
   'Monitor curvo 144Hz, 1ms de respuesta. Panel VA con tecnología FreeSync. Ideal para e-sports y diseño gráfico.',
   25, 5, 2100.00, 1, 2, TRUE, 'https://picsum.photos/seed/MonitorGamer27/400/400', NOW(), NOW()),

  ('Teclado Inalámbrico Ergonómico',
   'Teclado dividido con reposamuñecas acolchado, conectividad Bluetooth multidispositivo.',
   40, 10, 450.00, 1, 2, TRUE, 'https://picsum.photos/seed/TecladoErgonomico/400/400', NOW(), NOW()),

  ('Cámara de Seguridad WiFi Exterior',
   'Cámara IP65, visión nocturna, detección de movimiento y audio bidireccional. 1080p.',
   60, 15, 320.00, 1, 2, TRUE, 'https://picsum.photos/seed/CamaraWifi/400/400', NOW(), NOW()),

  ('Chaqueta de Cuero Sintético',
   'Chaqueta estilo motero, slim fit, con cremalleras asimétricas. Tallas M, L, XL.',
   30, 5, 250.00, 2, 3, TRUE, 'https://picsum.photos/seed/ChaquetaCuero/400/400', NOW(), NOW()),

  ('Vestido Floral de Verano',
   'Vestido ligero de algodón con estampado de flores. Tiras ajustables y cintura elástica.',
   50, 10, 180.00, 2, 3, TRUE, 'https://picsum.photos/seed/VestidoFloral/400/400', NOW(), NOW()),

  ('Gorra Deportiva Transpirable',
   'Gorra de poliéster con paneles de malla, ajustable y ligera. Ideal para correr.',
   100, 20, 60.00, 2, 3, TRUE, 'https://picsum.photos/seed/GorraDeportiva/400/400', NOW(), NOW()),

  ('Juego de Sábanas 100% Algodón',
   'Sábanas de 400 hilos para cama de 2 plazas. Incluye sábana encimera, bajera y 2 fundas.',
   45, 10, 350.00, 3, 3, TRUE, 'https://picsum.photos/seed/SabanasAlgodon/400/400', NOW(), NOW()),

  ('Licuadora de Alta Potencia',
   'Licuadora de vaso de vidrio 1.5L, 6 cuchillas de acero inoxidable, 800W. Pica hielo.',
   20, 5, 290.00, 3, 3, TRUE, 'https://picsum.photos/seed/Licuadora/400/400', NOW(), NOW()),

  ('Aspiradora Robot Inteligente',
   'Robot aspirador y trapeador con mapeo láser, control por app y voz. Autonomía 120min.',
   15, 3, 1800.00, 3, 3, TRUE, 'https://picsum.photos/seed/AspiradoraRobot/400/400', NOW(), NOW()),

  ('Mochila de Senderismo 50L',
   'Mochila impermeable con soporte de espalda acolchado, múltiples compartimentos. Color verde.',
   35, 5, 420.00, 4, 2, TRUE, 'https://picsum.photos/seed/Mochila50L/400/400', NOW(), NOW()),

  ('Set de Bandas de Resistencia',
   'Pack de 5 bandas elásticas con diferentes niveles de tensión. Incluye bolsa de transporte.',
   80, 15, 85.00, 4, 2, TRUE, 'https://picsum.photos/seed/BandasResistencia/400/400', NOW(), NOW()),

  ('Botella de Agua de Acero Inoxidable 1L',
   'Termo de doble pared que mantiene el frío 24h y el calor 12h. Libre de BPA.',
   120, 25, 95.00, 4, 2, TRUE, 'https://picsum.photos/seed/TermoAcero/400/400', NOW(), NOW()),

  ('Galletas de Amaranto y Chocolate',
   'Caja de 500g de galletas horneadas saludables, ricas en fibra. Producto nacional.',
   150, 30, 25.00, 5, 3, TRUE, 'https://picsum.photos/seed/GalletasAmaranto/400/400', NOW(), NOW()),

  ('Mermelada de Locoto y Piña',
   'Mermelada artesanal agridulce con un toque picante. Frasco de 300g.',
   60, 10, 35.00, 5, 3, TRUE, 'https://picsum.photos/seed/MermeladaLocoto/400/400', NOW(), NOW()),

  ('Juego de Mesa Familiar Estrategia',
   'Juego de tablero de gestión de recursos y estrategia para 2 a 5 jugadores. 60 min de juego.',
   25, 5, 250.00, 6, 3, TRUE, 'https://picsum.photos/seed/JuegoMesa/400/400', NOW(), NOW()),

  ('Triciclo Infantil con Canasta',
   'Triciclo de metal resistente con ruedas de goma EVA, timbre y canasta trasera.',
   18, 4, 380.00, 6, 3, TRUE, 'https://picsum.photos/seed/Triciclo/400/400', NOW(), NOW()),

  ('Libro El Principito Tapa Dura',
   'Clásico de Antoine de Saint-Exupéry con ilustraciones originales y encuadernación de lujo.',
   70, 10, 110.00, 7, 3, TRUE, 'https://picsum.photos/seed/LibroPrincipito/400/400', NOW(), NOW()),

  ('Shampoo Hipoalergénico para Perros',
   'Shampoo de 500ml con extracto de avena y aloe vera. Alivia picazón y cuida el pelaje.',
   90, 15, 65.00, 8, 3, TRUE, 'https://picsum.photos/seed/ShampooPerro/400/400', NOW(), NOW()),

  ('Juguete Interactivo para Gatos Láser',
   'Torre láser automática giratoria para entretener a gatos. Funciona con batería recargable.',
   40, 8, 140.00, 8, 3, TRUE, 'https://picsum.photos/seed/LaserGato/400/400', NOW(), NOW()),

  ('Impresora Multifuncional EcoTank',
   'Impresora de tanques de tinta con WiFi, escáner de alta resolución y bajo costo de impresión.',
   12, 3, 1450.00, 9, 2, TRUE, 'https://picsum.photos/seed/ImpresoraEcoTank/400/400', NOW(), NOW());

-- ============================================================
--  SECCIÓN 3 — PEDIDOS DE EJEMPLO (5 pedidos)
-- ============================================================

-- Pedido 1: cliente1 — entregado hace 10 días
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, notas, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (1, 539.00, 'entregado', 'Av. 6 de Agosto #456, Sopocachi, La Paz', 'Entregar en horario de la tarde', 'qr', TRUE, 'CHK-A1B2C3D4', NOW() - INTERVAL '10 days', NOW() - INTERVAL '5 days');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (1, 1, 1, 289.00),   -- Audífonos Bluetooth Premium
  (1, 3, 1, 95.00),    -- Mouse Inalámbrico
  (1, 11, 1, 65.00);   -- Camiseta Dri-Fit

-- Pedido 2: cliente2 — en_camino
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (2, 745.00, 'en_camino', 'Calle Comercio #789, Zona Central, La Paz', 'transferencia', TRUE, 'CHK-E5F6G7H8', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (2, 2, 1, 450.00),   -- Smartwatch Deportivo
  (2, 4, 1, 95.00),    -- Mouse
  (2, 29, 1, 200.00);  -- Bicicleta (primer producto de Deportes)

-- Pedido 3: cliente3 — confirmado
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (3, 410.00, 'confirmado', 'Av. Arce #1234, Miraflores, La Paz', 'qr', TRUE, 'CHK-I9J0K1L2', NOW() - INTERVAL '1 day', NOW() - INTERVAL '12 hours');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (3, 13, 1, 185.00),  -- Mochila (producto Deportes vendedor 3, id puede variar)
  (3, 14, 2, 45.00);   -- Polo Casual x2

-- Pedido 4: cliente1 — en_preparacion
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (1, 700.00, 'en_preparacion', 'Av. 6 de Agosto #456, Sopocachi, La Paz', 'efectivo', FALSE, 'CHK-M3N4O5P6', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '2 hours');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (4, 5, 1, 320.00),   -- Teclado Mecánico
  (4, 10, 1, 380.00);  -- SSD Externo 1TB

-- Pedido 5: cliente2 — pendiente
INSERT INTO pedido (id_cliente, total, estado, direccion_entrega, metodo_pago, pago_verificado, codigo_seguimiento, created_at, updated_at)
VALUES (2, 395.00, 'pendiente', 'Calle Comercio #789, Zona Central, La Paz', 'qr', FALSE, 'CHK-Q7R8S9T0', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes');

INSERT INTO detalle_pedido (id_pedido, id_producto, cantidad, precio_unitario) VALUES
  (5, 7, 1, 120.00),   -- Soporte Laptop
  (5, 17, 1, 280.00);  -- Set Ollas

-- ── Historial de estados ──────────────────────────────────────────────────────
INSERT INTO historial_pedido (id_pedido, estado_anterior, estado_nuevo, comentario, cambiado_por, creado_at) VALUES
  (1, NULL,              'pendiente',       'Pedido creado por el cliente',             NULL, NOW() - INTERVAL '10 days'),
  (1, 'pendiente',       'confirmado',      'Pago QR verificado correctamente',         1,    NOW() - INTERVAL '9 days'),
  (1, 'confirmado',      'en_preparacion',  'Preparando el pedido',                     2,    NOW() - INTERVAL '8 days'),
  (1, 'en_preparacion',  'en_camino',       'Pedido enviado con mensajero',             2,    NOW() - INTERVAL '7 days'),
  (1, 'en_camino',       'entregado',       'Entregado al cliente satisfactoriamente',  2,    NOW() - INTERVAL '5 days'),

  (2, NULL,              'pendiente',       'Pedido creado por el cliente',             NULL, NOW() - INTERVAL '3 days'),
  (2, 'pendiente',       'confirmado',      'Transferencia bancaria verificada',        1,    NOW() - INTERVAL '2 days'),
  (2, 'confirmado',      'en_preparacion',  'Embalando productos para envío',           2,    NOW() - INTERVAL '1 day 12 hours'),
  (2, 'en_preparacion',  'en_camino',       'Enviado. Entrega estimada: mañana',        2,    NOW() - INTERVAL '1 day'),

  (3, NULL,              'pendiente',       'Pedido creado por el cliente',             NULL, NOW() - INTERVAL '1 day'),
  (3, 'pendiente',       'confirmado',      'Pago QR verificado',                       1,    NOW() - INTERVAL '12 hours'),

  (4, NULL,              'pendiente',       'Pedido creado',                            NULL, NOW() - INTERVAL '6 hours'),
  (4, 'pendiente',       'confirmado',      'Pago confirmado por admin',                1,    NOW() - INTERVAL '5 hours'),
  (4, 'confirmado',      'en_preparacion',  'En preparación',                           2,    NOW() - INTERVAL '2 hours'),

  (5, NULL,              'pendiente',       'Pedido creado por el cliente',             NULL, NOW() - INTERVAL '30 minutes');

-- ============================================================
--  SECCIÓN 4 — SINCRONIZACIÓN DE SECUENCIAS
-- ============================================================
SELECT setval('rol_id_rol_seq',                  (SELECT MAX(id_rol)          FROM rol));
SELECT setval('usuario_id_usuario_seq',           (SELECT MAX(id_usuario)      FROM usuario));
SELECT setval('cliente_id_cliente_seq',           (SELECT MAX(id_cliente)      FROM cliente));
SELECT setval('categoria_id_categoria_seq',       (SELECT MAX(id_categoria)    FROM categoria));
SELECT setval('almacen_id_producto_seq',          (SELECT MAX(id_producto)     FROM almacen));
SELECT setval('pedido_id_pedido_seq',             (SELECT MAX(id_pedido)       FROM pedido));
SELECT setval('detalle_pedido_id_detalle_seq',    (SELECT MAX(id_detalle)      FROM detalle_pedido));
SELECT setval('historial_pedido_id_historial_seq',(SELECT MAX(id_historial)    FROM historial_pedido));

COMMIT;

-- ============================================================
--  VERIFICACIÓN FINAL
-- ============================================================
SELECT tabla, total FROM (
  SELECT 'Roles'      AS tabla, COUNT(*) AS total FROM rol
  UNION ALL SELECT 'Usuarios',   COUNT(*) FROM usuario
  UNION ALL SELECT 'Clientes',   COUNT(*) FROM cliente
  UNION ALL SELECT 'Categorías', COUNT(*) FROM categoria
  UNION ALL SELECT 'Productos',  COUNT(*) FROM almacen
  UNION ALL SELECT 'Pedidos',    COUNT(*) FROM pedido
  UNION ALL SELECT 'Detalles',   COUNT(*) FROM detalle_pedido
  UNION ALL SELECT 'Historial',  COUNT(*) FROM historial_pedido
) t;
