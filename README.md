# Chukuta Express — E-commerce Multivendedor

Sistema completo de e-commerce multivendedor con módulos de Cliente, Vendedor y Administrador.

# borrar bd y crear de nuveo, copiar los querys de database.sql

# credencial postgre en -> backend\.env ->DB PASSWORD
# admins y vendedores
| Rol         | Email                   | Contraseña    | Panel                          |
|-------------|-------------------------|---------------|--------------------------------|
| Admin       | admin@chukuta.com       | Admin123!     | localhost:5173/admin           |
| Vendedor 1  | vendedor1@test.com      | Vendedor123!  | localhost:5173/admin           |
| Vendedor 2  | vendedor2@test.com      | Vendedor123!  | localhost:5173/admin           |
| Cliente 1   | cliente1@test.com       | Cliente123!   | localhost:5173 (portal tienda) |
| Cliente 2   | cliente2@test.com       | Cliente123!   | localhost:5173                 |
| Cliente 3   | cliente3@test.com       | Cliente123!   | localhost:5173                 |

# --- PNPM ---

instala pnpm en variables de entorno automaticamente

npm install -g pnpm

Pasos para cambiar de npm a pnpm

1. Limpiar el proyecto (¡Importante!)
Para que no haya mezclas raras entre los dos gestores:

Respaldar en otra carpeta los archivos:

src (Carpeta)
eslint.config.js
index.html
package.json
tsconfig.app.json
tsconfig.json
tsconfig.node.json
vite.config.ts

luego borrar y dejar carpeta frontend vacia

2. Instalar pnpm 

luego en la carpeta frontend y ejecutar
1
pnpm init

2
pnpm install 
o
pnpm i

3
(copiar y pegar los archivos respaldados, copiar y reemplazar si pide)

4
pnpm add -D vite
(los siguientes son opcionales probar antes
pnpm run dev)
pnpm add -D @vitejs/plugin-react
pnpm add react react-dom
pnpm add Bootstrap
pnpm add react-router-dom axios

5 Actualizar el .gitignore
node_modules/
.pnpm-debug.log*

6
pnpm run dev 


---

## ✅ Correcciones aplicadas en esta versión (v2.1)

### Bug 1 — Frontend sin estilos / "Failed to load url /src/main.tsx"
**Causa:** El archivo `src/main.tsx` no existía en el proyecto. Vite lo busca como
punto de entrada (declarado en `index.html`) y falla si no lo encuentra. Además,
Bootstrap estaba instalado en `package.json` pero nunca se importaba, por eso la
tienda se veía sin estilos.

**Solución:** Se creó `frontend/src/main.tsx` con:
- Montaje de React en `#root`
- `import 'bootstrap/dist/css/bootstrap.min.css'` para habilitar todos los estilos

### Bug 2 — Login admin/vendedor: `ValueError: Invalid hash method ''`
**Causa:** El archivo `database.sql` contenía hashes generados con
**bcrypt** (`$2b$12$...`), pero Werkzeug (la librería que usa Flask para verificar
contraseñas) NO soporta bcrypt de serie — sólo sus propios formatos `pbkdf2:sha256`
y `scrypt`. Al intentar verificar, Werkzeug leía el prefijo vacío/desconocido y
lanzaba `ValueError: Invalid hash method ''`.

**Solución:**
- Los hashes de `database.sql` se
  regeneraron con `werkzeug.security.generate_password_hash()` (formato `scrypt`).
- Se añadió `backend/reset_passwords.py`: script de emergencia que regenera los
  hashes directamente en la BD si ya la tienes importada.

---

## Credenciales de prueba

| Rol         | Email                   | Contraseña    | Panel                          |
|-------------|-------------------------|---------------|--------------------------------|
| Admin       | admin@chukuta.com       | Admin123!     | localhost:5173/admin           |
| Vendedor 1  | vendedor1@test.com      | Vendedor123!  | localhost:5173/admin           |
| Vendedor 2  | vendedor2@test.com      | Vendedor123!  | localhost:5173/admin           |
| Cliente 1   | cliente1@test.com       | Cliente123!   | localhost:5173 (portal tienda) |
| Cliente 2   | cliente2@test.com       | Cliente123!   | localhost:5173                 |
| Cliente 3   | cliente3@test.com       | Cliente123!   | localhost:5173                 |

---

## Instalación en Windows

### Requisitos previos
- Python 3.11+
- Node.js 18+
- PostgreSQL 14+

---

### 1. Base de datos

Abre pgAdmin o la consola de PostgreSQL y ejecuta:

```sql
CREATE DATABASE chukutaexpress;
```

Luego importa la base de datos unificada (estructura y datos con hashes correctos):

```cmd
psql -U postgres -d chukutaexpress -f database.sql
```

> **Si ya tenías la BD importada** con la versión anterior (hashes rotos), regenera
> las contraseñas sin borrar nada:
> ```cmd
> cd backend
> venv\Scripts\activate
> python reset_passwords.py
> ```

---

### 2. Backend

```cmd
cd chukuta-express\backend

:: Crear y activar entorno virtual
python -m venv venv
venv\Scripts\activate

:: Instalar dependencias
pip install -r requirements.txt

:: Copiar y configurar variables de entorno
copy .env.example .env
```

Edita `.env` con tus datos de PostgreSQL:

```env
FLASK_ENV=development
SECRET_KEY=cambia-esta-clave-secreta-en-produccion
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chukutaexpress
DB_USER=postgres
DB_PASSWORD=tu_password_postgres
ALLOWED_ORIGINS=http://localhost:5173
```

```cmd
:: Cargar estructura completa y datos de ejemplo
psql -U postgres -d chukutaexpress -f ..\database.sql
```

> **Alternativa en pgAdmin:** Abre `database.sql` con el Query Tool y ejecuta.

```cmd
:: Iniciar el servidor Flask
python run.py
```

El backend quedará disponible en `http://localhost:5000`

---

### 3. Frontend

Abre una **nueva terminal**:

```cmd
cd chukuta-express\frontend

:: Copiar variables de entorno
copy .env.example .env
```

El `.env` debe contener:

```env
VITE_API_BASE_URL=http://localhost:5000
```

```cmd
:: Instalar dependencias
npm install

:: Iniciar servidor de desarrollo
npm run dev
```

El frontend estará en `http://localhost:5173`

---

## Estructura del proyecto

```
chukuta-express/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py          # Login/registro cliente y usuarios
│   │   │   ├── carrito.py       # Carrito de compras
│   │   │   ├── cliente.py       # Perfil e historial del cliente  ← NUEVO
│   │   │   ├── pedidos.py       # Pedidos (cliente + admin)
│   │   │   ├── productos.py     # Catálogo y CRUD
│   │   │   ├── usuarios.py      # Gestión de usuarios (admin)
│   │   │   └── vendedor.py      # Dashboard y gestión del vendedor ← NUEVO
│   │   ├── middleware/auth.py   # JWT + decoradores de rol
│   │   ├── models/__init__.py  # SQLAlchemy models
│   │   ├── services/auditoria.py
│   │   └── utils/
│   ├── config/settings.py
│   ├── requirements.txt
│   └── run.py
│
├── frontend/
│   └── src/
│       ├── api/
│       │   ├── cliente.ts       # GET/PUT /cliente/perfil  ← NUEVO
│       │   ├── vendedor.ts      # Todos los endpoints del vendedor ← NUEVO
│       │   └── ...
│       ├── features/
│       │   ├── admin/pages/DashboardAdmin.tsx
│       │   ├── cliente/pages/PerfilCliente.tsx  ← NUEVO
│       │   ├── pedidos/pages/MisPedidos.tsx     (actualizado)
│       │   └── vendedor/pages/DashboardVendedor.tsx (completo)
│       └── components/layout/Navbar.tsx         (con link a perfil)
│
└── database.sql
```

---

## Endpoints principales

### Públicos
| Método | Ruta                    | Descripción                  |
|--------|-------------------------|------------------------------|
| GET    | /productos              | Catálogo (activos, con stock)|
| GET    | /productos/:id          | Detalle de producto          |
| GET    | /productos/categorias   | Lista de categorías          |
| POST   | /auth/cliente/registro  | Registro de cliente          |
| POST   | /auth/cliente/login     | Login de cliente             |
| POST   | /auth/login             | Login admin/vendedor         |

### Cliente (requiere token cliente)
| Método | Ruta                        | Descripción               |
|--------|-----------------------------|---------------------------|
| GET    | /cliente/carrito            | Ver carrito               |
| POST   | /cliente/carrito            | Agregar producto          |
| PUT    | /cliente/carrito/:id        | Actualizar cantidad        |
| DELETE | /cliente/carrito/:id        | Eliminar ítem             |
| POST   | /cliente/pedido             | Crear pedido desde carrito|
| GET    | /cliente/mis-pedidos        | Historial de pedidos      |
| GET    | /cliente/mis-pedidos/:id    | Detalle de pedido         |
| GET    | /cliente/perfil             | Ver perfil                |
| PUT    | /cliente/perfil             | Editar perfil             |

### Vendedor (requiere token rol=1 o rol=2)
| Método | Ruta                            | Descripción               |
|--------|---------------------------------|---------------------------|
| GET    | /vendedor/dashboard             | Estadísticas del vendedor |
| GET    | /vendedor/productos             | Sus productos             |
| GET    | /vendedor/pedidos               | Sus pedidos               |
| GET    | /vendedor/pedidos/:id           | Detalle de un pedido      |
| PATCH  | /vendedor/pedidos/:id/estado    | Cambiar estado            |
| GET    | /vendedor/perfil                | Su perfil                 |
| PUT    | /vendedor/perfil                | Actualizar perfil         |

### Admin (requiere token rol=2)
| Método | Ruta                            | Descripción               |
|--------|---------------------------------|---------------------------|
| GET    | /admin/usuarios                 | Listar usuarios           |
| POST   | /admin/usuarios                 | Crear usuario             |
| PUT    | /admin/usuarios/:id             | Editar usuario            |
| DELETE | /admin/usuarios/:id             | Desactivar usuario        |
| GET    | /admin/pedidos                  | Todos los pedidos         |
| PATCH  | /admin/pedidos/:id/estado       | Cambiar estado pedido     |
| GET    | /admin/reportes/resumen         | Estadísticas globales     |
| GET    | /productos/admin/todos          | Todos los productos       |

---

## Flujo completo de uso

### Como Cliente
1. Accede a `http://localhost:5173`
2. Navega el catálogo o busca por nombre/categoría
3. Haz clic en "+ Carrito" (te pedirá login si no estás autenticado)
4. Regístrate o inicia sesión
5. Ve al carrito (🛒), ingresa dirección y método de pago
6. Confirma el pedido
7. Consulta el estado en "Mis Pedidos"

### Como Vendedor
1. Accede a `http://localhost:5173/admin`
2. Inicia sesión con `vendedor1@test.com` / `Vendedor123!`
3. Dashboard: estadísticas de tus productos y pedidos
4. "Productos" → gestiona tu catálogo
5. "Pedidos" → ve los pedidos con tus ítems y actualiza estados

### Como Admin
1. Accede a `http://localhost:5173/admin`
2. Inicia sesión con `admin@chukuta.com` / `Admin123!`
3. Panel completo: productos, pedidos, usuarios, reportes
4. Gestiona categorías, crea vendedores, verifica pagos

---

## Nota sobre contraseñas en SQL

Las contraseñas en `database.sql` están hasheadas con **scrypt** compatible con Werkzeug.  
Si las contraseñas no funcionan (hash mismatch entre versiones de bcrypt), ejecuta
este script para regenerarlas:

```python
# generar_hashes.py — ejecutar dentro del virtualenv
from werkzeug.security import generate_password_hash
print("Admin123!  :", generate_password_hash("Admin123!"))
print("Vendedor123!:", generate_password_hash("Vendedor123!"))
print("Cliente123! :", generate_password_hash("Cliente123!"))
```

Luego actualiza los valores en el SQL.

---

## Producción

```cmd
:: Backend con Gunicorn (Linux/Mac)
gunicorn -w 4 -b 0.0.0.0:5000 run:app

:: Frontend (build)
npm run build
:: Sirve la carpeta dist/ con nginx o similar
```
