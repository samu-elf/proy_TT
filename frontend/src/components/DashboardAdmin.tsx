import { useEffect, useState } from 'react';
import axios from 'axios';

interface Producto {
  id_producto: number;
  nombre: string;
  stock: number;
  precio_venta: number;
  id_usuario?: number;
}

interface Pedido {
  id_pedido: number;
  total: number;
  estado: string;
}

interface Usuario {
  id_usuario: number;
  nombre: string;
  email: string;
}

type Vista = 'dashboard' | 'productos' | 'reportes' | 'pedidos' | 'afiliados' | 'registro' | 'catalogo';

const DashboardAdmin = ({ onLogout }: { onLogout: () => void }) => {

  const [vista, setVista] = useState<Vista>('dashboard');

  const [productos, setProductos] = useState<Producto[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [vendedores, setVendedores] = useState<Usuario[]>([]);

  const [form, setForm] = useState({
    nombre: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    cargarDatos();
  }, []);

  const cargarDatos = async () => {
    const prod = await axios.get('http://localhost:5000/productos');
    setProductos(prod.data);

    try {
      const ped = await axios.get('http://localhost:5000/cliente/pedidos', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      });
      setPedidos(ped.data);
    } catch {
      setPedidos([]);
    }

    try {
      const users = await axios.get('http://localhost:5000/usuarios');
      setVendedores(users.data);
    } catch {
      setVendedores([]);
    }
  };

  const registrarVendedor = async () => {
    await axios.post('http://localhost:5000/registro-usuario', {
      ...form,
      id_rol: 1
    });

    alert('Vendedor registrado');
    setVista('afiliados');
    cargarDatos();
  };

  return (
    <div className="d-flex min-vh-100 bg-light">

      {/* SIDEBAR */}
      <div className="bg-dark text-white p-3" style={{ width: '250px' }}>
        <h4>🛠 INICIO</h4>
        <hr />

        <p onClick={() => setVista('dashboard')}>🏠 Inicio</p>
        <p onClick={() => setVista('afiliados')}>👥 Afiliados</p>
        <p onClick={() => setVista('registro')}>➕ Registrar vendedor</p>
        <p onClick={() => setVista('catalogo')}>🏷️ Catálogo afiliados</p>

        <hr />

        <p onClick={() => setVista('productos')}>📦 Productos</p>
        <p onClick={() => setVista('reportes')}>📈 Reportes</p>
        <p onClick={() => setVista('pedidos')}>🧾 Pedidos</p>

        <button className="btn btn-danger w-100 mt-4" onClick={onLogout}>
          Cerrar sesión
        </button>
      </div>

      {/* CONTENIDO */}
      <div className="flex-grow-1 p-4">

        {/* 🔵 INICIO (antes dashboard) */}
        {vista === 'dashboard' && (
          <>
            <h2>🏠 Inicio</h2>

            <div className="row g-3 mt-2">

              <div className="col-md-4">
                <div className="card p-3 shadow-sm">
                  <h5>📦 Productos</h5>
                  <h2>{productos.length}</h2>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card p-3 shadow-sm">
                  <h5>🧾 Pedidos</h5>
                  <h2>{pedidos.length}</h2>
                </div>
              </div>

              <div className="col-md-4">
                <div className="card p-3 shadow-sm">
                  <h5>💰 Inventario</h5>
                  <h2>
                    Bs {productos.reduce((a, p) => a + p.precio_venta * p.stock, 0)}
                  </h2>
                </div>
              </div>

            </div>
          </>
        )}

        {/* 👥 AFILIADOS */}
        {vista === 'afiliados' && (
          <>
            <h2>👥 Afiliados (Vendedores)</h2>

            <table className="table mt-3">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nombre</th>
                  <th>Email</th>
                </tr>
              </thead>
              <tbody>
                {vendedores.map(v => (
                  <tr key={v.id_usuario}>
                    <td>{v.id_usuario}</td>
                    <td>{v.nombre}</td>
                    <td>{v.email}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* ➕ REGISTRO */}
        {vista === 'registro' && (
          <>
            <h2>➕ Registrar vendedor</h2>

            <input
              placeholder="Nombre"
              className="form-control mb-2"
              onChange={e => setForm({ ...form, nombre: e.target.value })}
            />

            <input
              placeholder="Email"
              className="form-control mb-2"
              onChange={e => setForm({ ...form, email: e.target.value })}
            />

            <input
              placeholder="Password"
              type="password"
              className="form-control mb-2"
              onChange={e => setForm({ ...form, password: e.target.value })}
            />

            <button className="btn btn-success" onClick={registrarVendedor}>
              Crear vendedor
            </button>
          </>
        )}

        {/* 🏷️ CATÁLOGO POR AFILIADOS */}
        {vista === 'catalogo' && (
          <>
            <h2>🏷️ Catálogo de Afiliados</h2>

            {vendedores.map(v => (
              <div key={v.id_usuario} className="mb-4">
                <h5>👤 {v.nombre}</h5>

                <div className="row">
                  {productos
                    .filter(p => p.id_usuario === v.id_usuario)
                    .map(p => (
                      <div key={p.id_producto} className="col-md-3">
                        <div className="card p-2">
                          <p>{p.nombre}</p>
                          <small>Bs {p.precio_venta}</small>
                        </div>
                      </div>
                    ))}
                </div>

              </div>
            ))}
          </>
        )}

        {/* PRODUCTOS */}
        {vista === 'productos' && (
          <>
            <h2>📦 Productos</h2>
            <table className="table table-striped mt-3">
              <thead>
                <tr>
                  <th>ID</th><th>Nombre</th><th>Stock</th><th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {productos.map(p => (
                  <tr key={p.id_producto}>
                    <td>{p.id_producto}</td>
                    <td>{p.nombre}</td>
                    <td>{p.stock}</td>
                    <td>Bs {p.precio_venta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {/* PEDIDOS */}
        {vista === 'pedidos' && (
          <>
            <h2>🧾 Pedidos</h2>
            <p>Tabla existente sin cambios</p>
          </>
        )}

        {/* REPORTES */}
        {vista === 'reportes' && (
          <>
            <h2>📈 Reportes</h2>
            <p>Sección futura de gráficos</p>
          </>
        )}

      </div>
    </div>
  );
};

export default DashboardAdmin;