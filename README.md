# Chukuta Express — E-commerce Multivendedor v4.0

Sistema completo de e-commerce multivendedor con módulos de **Cliente**, **Vendedor** y **Administrador**.  
Stack: Flask (Python) + React (TypeScript + Tailwind/Bootstrap) + PostgreSQL.

---

## Credenciales de prueba

| Rol        | Email                 | Contraseña   | Panel de acceso       |
|------------|-----------------------|--------------|-----------------------|
| Admin      | admin@chukuta.com     | Admin123!    | localhost:5173/admin  |
| Vendedor 1 | vendedor1@test.com    | Vendedor123! | localhost:5173/admin  |
| Vendedor 2 | vendedor2@test.com    | Vendedor123! | localhost:5173/admin  |
| Cliente 1  | cliente1@test.com     | Cliente123!  | localhost:5173        |
| Cliente 2  | cliente2@test.com     | Cliente123!  | localhost:5173        |
| Cliente 3  | cliente3@test.com     | Cliente123!  | localhost:5173        |

---

## Requisitos previos

| Herramienta   | Versión mínima | Verificar                  |
|---------------|----------------|----------------------------|
| Python        | 3.11           | `python --version`         |
| Node.js       | 18             | `node --version`           |
| PostgreSQL    | 14             | `psql --version`           |
| pnpm          | 9              | `pnpm --version`           |

Instalar **pnpm** si no lo tienes (solo una vez):

```bash
npm install -g pnpm
```

---

## Paso 1 — Base de datos

El archivo `database.sql` crea **toda la estructura** e inserta los datos de ejemplo (50 productos en 9 categorías, 3 usuarios, 3 clientes y 5 pedidos de prueba). Ejecuta los dos comandos siguientes desde la raíz del proyecto:

```bash
# Crear la base de datos (solo la primera vez)
psql -U postgres -c "CREATE DATABASE chukutaexpress;"

# Cargar estructura y datos
psql -U postgres -d chukutaexpress -f database.sql
```

> **Windows (PowerShell):** si `psql` no está en el PATH, agrégalo o usa la ruta completa:  
> `& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -c "CREATE DATABASE chukutaexpress;"`

Al finalizar verás una tabla de verificación con los totales:

```
 tabla     | total
-----------+-------
 Roles     |     3
 Usuarios  |     3
 Clientes  |     3
 Categorías|     9
 Productos |    50
 Pedidos   |     5
 Detalles  |    10
 Historial |    15
```

---

## Paso 2 — Backend (Flask)

```bash
cd backend

# Crear y activar entorno virtual
python -m venv venv

# Linux / macOS:
source venv/bin/activate

# Windows (cmd):
venv\Scripts\activate

# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
```

```bash
# Instalar dependencias
pip install -r requirements.txt
```

```bash
# Copiar el archivo de variables de entorno
cp .env.example .env        # Linux / macOS
copy .env.example .env      # Windows
```

Editar `.env` con los datos de tu PostgreSQL:

```env
FLASK_ENV=development
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=chukutaexpress
DB_USER=postgres
DB_PASSWORD=TU_CONTRASEÑA_POSTGRES

SECRET_KEY=cambia-esto-por-una-clave-larga-y-aleatoria
JWT_EXPIRATION_HOURS=8

ALLOWED_ORIGINS=http://localhost:5173
```

> **Generar un SECRET_KEY seguro:**
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

```bash
# Iniciar el backend
python run.py
```

El backend queda disponible en **http://localhost:5000**.  
Para verificar: `curl http://localhost:5000/health` debe devolver `{"status": "ok"}`.

---

## Paso 3 — Frontend (React + Vite)

```bash
cd frontend

# Copiar variables de entorno del frontend
cp .env.example .env        # Linux / macOS
copy .env.example .env      # Windows
```

El archivo `.env` del frontend solo necesita una línea; el proxy de Vite ya está preconfigurado:

```env
VITE_API_BASE_URL=http://localhost:5000
```

```bash
# Instalar dependencias
pnpm install

# Iniciar servidor de desarrollo
pnpm dev
```

El frontend queda disponible en **http://localhost:5173**.

---

## Resumen rápido (todos los pasos en orden)

```bash
# Terminal 1 — Base de datos (ejecutar una sola vez)
psql -U postgres -c "CREATE DATABASE chukutaexpress;"
psql -U postgres -d chukutaexpress -f database.sql

# Terminal 2 — Backend
cd backend
python -m venv venv && source venv/bin/activate   # o .\venv\Scripts\Activate.ps1 en Windows
pip install -r requirements.txt
cp .env.example .env   # editar DB_PASSWORD y SECRET_KEY
python run.py

# Terminal 3 — Frontend
cd frontend
pnpm install
cp .env.example .env
pnpm dev
```

---

## Solución de problemas frecuentes

### Las contraseñas de ejemplo no funcionan

Los hashes en `database.sql` son válidos para Werkzeug/scrypt. Si tienes problemas, regenera todas las contraseñas ejecutando desde `backend/` con el entorno virtual activo:

```bash
python reset_passwords.py
```

### Error de conexión a PostgreSQL

Revisa que el servicio de PostgreSQL esté corriendo y que `DB_PASSWORD` en `.env` sea correcto. Puedes probar la conexión con:

```bash
psql -U postgres -d chukutaexpress -c "SELECT COUNT(*) FROM almacen;"
```

Debe devolver `50`.

### `psql` no reconocido en Windows

Agrega la carpeta `bin` de PostgreSQL al PATH o usa la ruta completa. Ejemplo para PostgreSQL 16:

```
C:\Program Files\PostgreSQL\16\bin\psql.exe
```

### Error `ALLOWED_ORIGINS` en el backend (CORS)

Verifica que `ALLOWED_ORIGINS=http://localhost:5173` en `backend/.env` no tenga barra al final (`/`).

### pnpm no encontrado

```bash
npm install -g pnpm
```

---

## Estructura del proyecto

```
chukuta-express/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # Login cliente y usuario interno
│   │   │   ├── carrito.py       # Gestión del carrito
│   │   │   ├── cliente.py       # Perfil, pedidos y recibo PDF
│   │   │   ├── pedidos.py       # CRUD pedidos y estados
│   │   │   ├── productos.py     # Catálogo público y gestión interna
│   │   │   ├── reportes.py      # PDFs para vendedor y admin
│   │   │   ├── usuarios.py      # Gestión de usuarios internos
│   │   │   └── vendedor.py      # Panel del vendedor
│   │   ├── middleware/auth.py   # Decoradores JWT (cliente / usuario)
│   │   ├── models/__init__.py   # Modelos SQLAlchemy
│   │   └── services/
│   │       ├── auditoria.py     # Log de auditoría
│   │       ├── pdf_reportes.py  # PDFs de vendedor y admin (ReportLab)
│   │       └── recibo_cliente.py# Recibo de compra del cliente (ReportLab)
│   ├── config/settings.py
│   ├── requirements.txt
│   ├── run.py
│   └── .env.example
│
├── frontend/
│   └── src/
│       ├── api/                 # Clientes HTTP por dominio
│       ├── components/layout/   # Navbar con búsqueda en tiempo real
│       └── features/
│           ├── admin/           # Panel administrador
│           ├── auth/            # Login modal y contextos
│           ├── carrito/         # Carrito + confirmación con PDF
│           ├── catalogo/        # Catálogo público con filtros
│           ├── cliente/         # Perfil del cliente
│           ├── pedidos/         # Historial de pedidos con PDF
│           └── vendedor/        # Panel del vendedor
│
└── database.sql                 # ← Único archivo SQL: estructura + 50 productos
```

---

## Catálogo de productos incluidos

El `database.sql` carga 50 productos distribuidos en 9 categorías, incluyendo productos con identidad boliviana:

| Categoría         | Cant. | Ejemplos destacados                                        |
|-------------------|-------|------------------------------------------------------------|
| Electrónica       | 10    | Audífonos BT, Smartwatch, SSD externo, Hub USB-C           |
| Ropa y Accesorios | 7     | **Chompa de alpaca**, **Chullo de Potosí**, **Bolso awayo**|
| Hogar y Jardín    | 6     | Ollas, **Tazas fauna boliviana**, **Maceta de Tiwanaku**   |
| Deportes          | 5     | Bicicleta MTB, Mancuernas, Colchoneta yoga                 |
| Alimentos         | 6     | **Café de Yungas**, **Quinua real**, **Miel del Beni**     |
| Juguetes          | 4     | **Rompecabezas Bolivia**, **Muñeca cholita**               |
| Libros            | 4     | **Historia de Bolivia**, **Guía trekking andino**          |
| Mascotas          | 4     | Cama ortopédica, Comedero automático                       |
| Oficina           | 4     | Silla ergonómica, Monitor portátil, Kit papelería          |

---

## Funcionalidades principales

### Cliente
- Registro e inicio de sesión con JWT
- Catálogo con búsqueda en tiempo real (barra de lupa en la navbar)
- Filtro por categoría y paginación
- Carrito de compras con control de stock
- Finalización de pedido con dirección y método de pago
- **Descarga de recibo PDF** en la confirmación y en el historial de pedidos
- Historial de pedidos con estado detallado

### Vendedor
- Dashboard con resumen de ventas e inventario
- Gestión de productos (crear, editar, activar/desactivar)
- Alertas de stock bajo
- Descarga de factura PDF por pedido
- Reporte PDF de inventario

### Administrador
- Panel completo con métricas globales
- Gestión de usuarios (vendedores y operadores)
- Gestión de pedidos y cambio de estados
- Verificación de pagos
- Reportes PDF: facturación global, pago a vendedores, manifiesto logístico

---

## Endpoints API — referencia rápida

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/auth/login` | Login de cliente |
| POST | `/auth/register` | Registro de cliente |
| POST | `/auth/admin/login` | Login de usuario interno |

### Productos (público)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/productos?q=cafe&categoria=Alimentos` | Listar con búsqueda y filtro |
| GET | `/productos/<id>` | Detalle de producto |
| GET | `/productos/categorias` | Lista de categorías activas |

### Cliente (requiere JWT cliente)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/cliente/perfil` | Datos del perfil |
| GET | `/cliente/mis-pedidos` | Historial de pedidos |
| GET | `/cliente/mis-pedidos/<id>/recibo` | **Descargar recibo PDF** |

### Vendedor (requiere JWT vendedor/admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/vendedor/reportes/factura/<id>` | Factura PDF del pedido |
| GET | `/vendedor/reportes/inventario` | Reporte PDF de stock |

### Admin (requiere JWT admin)
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/admin/reportes/facturacion?mes=5&anio=2026` | Facturación mensual PDF |
| GET | `/admin/reportes/pago-vendedores?mes=5&anio=2026` | Payout summary PDF |
| GET | `/admin/reportes/manifiesto?fecha=2026-05-22` | Manifiesto logístico PDF |

---

## Producción

```bash
# Backend con Gunicorn
cd backend
source venv/bin/activate
gunicorn -w 4 -b 0.0.0.0:5000 run:app

# Frontend — generar build estático
cd frontend
pnpm build
# Servir la carpeta dist/ con nginx, Apache o cualquier servidor estático
```
