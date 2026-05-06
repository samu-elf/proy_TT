# 🚀 CHUKUTA EXPRESS - Sistema Web (React + Flask + PostgreSQL)

## 📌 Descripción

Sistema web de gestión con roles:

* 👨‍💼 Administrador
* 🧑‍💻 Vendedor
* 🛒 Cliente (opcional)

Frontend desarrollado en React (Vite)
Backend en Flask
Base de datos PostgreSQL

---

## 🧱 Estructura del Proyecto

```
REACT-FLASK/
│
├── frontend/        # React (Vite)
│   ├── src/
│   ├── package.json
│
├── app.py           # Backend Flask
├── venv/            # Entorno virtual (NO subir a Git)
```

---

## ⚙️ REQUISITOS

* Node.js + npm
* Python 3.x
* PostgreSQL
* pgAdmin (opcional)

---

## 🟢 1. CONFIGURAR BACKEND (Flask)

### Crear entorno virtual

```bash
python -m venv venv
```

### Activar entorno

```bash
venv\Scripts\activate
```

### Instalar dependencias

```bash
pip install flask flask-cors flask-sqlalchemy psycopg2-binary
```

---

## 🔵 2. CONFIGURAR BASE DE DATOS

1. Crear base de datos:

```
chukutaexpress
```

2. Configurar conexión en `app.py`:

```python
app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:12345678@localhost:5432/chukutaexpress'
```

3. Importar backup desde pgAdmin

---

## 🟡 3. EJECUTAR BACKEND

```bash
python app.py
```

Servidor:

```
http://localhost:5000
```

---

## 🟣 4. CONFIGURAR FRONTEND (React)

Ir a carpeta:

```bash
cd frontend
```

Instalar dependencias:

```bash
npm install
```

---

## 🟢 5. EJECUTAR FRONTEND

```bash
npm run dev
```

Aplicación:

```
http://localhost:5173
```

---

## 🔗 6. CONEXIÓN FRONTEND - BACKEND

Ejemplo endpoint:

```javascript
axios.get('http://localhost:5000/productos')
```

---

## 🔐 7. LOGIN

Endpoint:

```
POST /login
```

Ejemplo JSON:

```json
{
  "email": "admin@gmail.com",
  "password": "1234"
}
```

Roles:

* 1 → Vendedor
* 2 → Admin
* 3 → Cliente

---

## 🧪 8. FUNCIONALIDADES

✔ Login por roles
✔ Dashboard Admin
✔ Dashboard Vendedor
✔ Visualización de productos
✔ Conexión a PostgreSQL

---

## ⚠️ NOTAS

* El backend corre en puerto 5000
* El frontend corre en puerto 5173
* CORS ya está habilitado en Flask
* No subir `venv` ni `node_modules` al repositorio

---

## 🚀 FUTURAS MEJORAS

* CRUD de productos
* Gestión de usuarios
* Carrito de compras
* Protección de rutas

---

## 👩‍💻 Autores

Proyecto académico - Sistema CHUKUTA EXPRESS

