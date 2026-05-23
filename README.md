# Chukuta Express — E-commerce Multivendedor v3.0

Sistema completo de e-commerce multivendedor con módulos de Cliente, Vendedor y Administrador.

---

## Credenciales de prueba

| Rol        | Email                  | Contraseña   | Panel                  |
|------------|------------------------|--------------|------------------------|
| Admin      | admin@chukuta.com      | Admin123!    | localhost:5173/admin   |
| Vendedor 1 | vendedor1@test.com     | Vendedor123! | localhost:5173/admin   |
| Vendedor 2 | vendedor2@test.com     | Vendedor123! | localhost:5173/admin   |
| Cliente 1  | cliente1@test.com      | Cliente123!  | localhost:5173         |
| Cliente 2  | cliente2@test.com      | Cliente123!  | localhost:5173         |
| Cliente 3  | cliente3@test.com      | Cliente123!  | localhost:5173         |

> **Credenciales de PostgreSQL:** editar `backend/.env` → campo `DB_PASSWORD`

---

## Requisitos previos

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- pnpm 9+ (se instala en un solo paso, ver abajo)

---

## 1. Base de datos

```cmd
psql -U postgres -c "CREATE DATABASE chukutaexpress;"
psql -U postgres -d chukutaexpress -f database.sql
```

> **Si ya tienes la BD y las contraseñas no funcionan:**
> ```cmd
> cd backend && venv\Scripts\activate && python reset_passwords.py
> ```

---

## 2. Backend (Flask)

```cmd
cd backend

:: Entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
:: source venv/bin/activate    # Linux / Mac

:: Dependencias (incluye reportlab para PDFs)
pip install -r requirements.txt

:: Variables de entorno
copy .env.example .env
```

Editar `.env`:

```env
FLASK_ENV=development
SECRET_KEY=cambia-esta-clave-secreta
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chukutaexpress
DB_USER=postgres
DB_PASSWORD=TU_PASSWORD
ALLOWED_ORIGINS=http://localhost:5173
```

```cmd
python run.py
```

Backend en: `http://localhost:5000`

---

## 3. Frontend (React + Vite + **pnpm**)

### Instalación de pnpm (una sola vez en el sistema)

```cmd
npm install -g pnpm
```

> pnpm se configura solo — no hay pasos adicionales ni carpetas a limpiar.
> El campo `"packageManager": "pnpm@9.15.0"` en `package.json` bloquea la versión.

### Instalar dependencias e iniciar

```cmd
cd frontend

:: Copiar variables de entorno
copy .env.example .env
```

`.env` debe contener:

```env
VITE_API_BASE_URL=http://localhost:5000
```

```cmd
:: Instalar todas las dependencias (equivalente a npm install)
pnpm install

:: Iniciar servidor de desarrollo
pnpm dev
```

Frontend en: `http://localhost:5173`

### Comandos pnpm disponibles

| Comando           | Equivalente npm       | Acción                          |
|-------------------|-----------------------|---------------------------------|
| `pnpm install`    | `npm install`         | Instala dependencias            |
| `pnpm dev`        | `npm run dev`         | Servidor de desarrollo          |
| `pnpm build`      | `npm run build`       | Build de producción             |
| `pnpm preview`    | `npm run preview`     | Preview del build               |
| `pnpm add axios`  | `npm install axios`   | Añadir una dependencia          |
| `pnpm add -D vite`| `npm install -D vite` | Añadir devDependency            |
| `pnpm remove pkg` | `npm uninstall pkg`   | Eliminar paquete                |
| `pnpm type-check` | —                     | Verificar tipos TypeScript      |

> **Nota:** `pnpm-lock.yaml` reemplaza a `package-lock.json`. Commitearlo siempre.

---

## Novedades v3.0 — Reportes PDF

### Vendedor

| Reporte | Cómo acceder | Detonante |
|---------|-------------|-----------|
| **Factura / Comprobante de Venta** | Botón "🧾 Descargar Factura PDF" en el detalle de pedido | Manual (al ver el pedido) |
| **Inventario y Alertas de Stock** | Botón "📄 Reporte PDF" en la vista Productos o en Acciones rápidas | Bajo demanda |

### Administrador

| Reporte | Cómo acceder | Detonante |
|---------|-------------|-----------|
| **Facturación Global y Comisiones** | Panel Reportes → seleccionar mes/año | Cierre mensual fiscal |
| **Pago a Vendedores (Payout)** | Panel Reportes → seleccionar mes/año | Ciclo de dispersión de fondos |
| **Manifiesto Logístico Diario** | Panel Reportes → seleccionar fecha | Cada mañana antes de rutas |

---

## Estructura del proyecto

```
chukuta-express/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py
│   │   │   ├── carrito.py
│   │   │   ├── cliente.py
│   │   │   ├── pedidos.py
│   │   │   ├── productos.py
│   │   │   ├── reportes.py      ← NUEVO v3.0 (5 endpoints PDF)
│   │   │   ├── usuarios.py
│   │   │   └── vendedor.py
│   │   ├── middleware/auth.py
│   │   ├── models/__init__.py
│   │   └── services/
│   │       ├── auditoria.py
│   │       └── pdf_reportes.py  ← NUEVO v3.0 (ReportLab)
│   ├── requirements.txt         ← actualizado (+reportlab)
│   └── run.py
│
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── reportesAdmin.ts ← NUEVO v3.0
│       │   ├── vendedor.ts      ← actualizado (+reportesVendedorApi)
│       │   └── ...
│       └── features/
│           ├── admin/pages/DashboardAdmin.tsx   ← actualizado (panel PDF)
│           └── vendedor/pages/DashboardVendedor.tsx ← actualizado (botones PDF)
│
└── database.sql
```

---

## Endpoints de Reportes PDF

### Vendedor

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/vendedor/reportes/factura/<id>` | Factura del pedido |
| GET | `/vendedor/reportes/inventario` | Reporte de stock |

### Admin

| Método | Ruta | Parámetros | Descripción |
|--------|------|-----------|-------------|
| GET | `/admin/reportes/facturacion` | `?mes=5&anio=2026` | Facturación global |
| GET | `/admin/reportes/pago-vendedores` | `?mes=5&anio=2026` | Payout summary |
| GET | `/admin/reportes/manifiesto` | `?fecha=2026-05-22` | Manifiesto logístico |

---

## Producción

```cmd
:: Backend
gunicorn -w 4 -b 0.0.0.0:5000 run:app

:: Frontend
pnpm build
:: Servir carpeta dist/ con nginx o similar
```
