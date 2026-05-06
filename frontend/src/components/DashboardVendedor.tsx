import { useEffect, useState } from 'react';
import axios from 'axios';

interface Producto {
  id_producto: number;
  nombre: string;
  stock: number;
  precio_venta: number;
  nombre_categoria: string;
}

type Vista = 'inicio' | 'inventario' | 'pedidos' | 'estadisticas';

const Dashboard = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState<Vista>('inicio');

  const [cliente, setCliente] = useState('');
  const [celular, setCelular] = useState('');
  const [productoSel, setProductoSel] = useState('');
  const [cantidad, setCantidad] = useState(1);
  const [direccion, setDireccion] = useState('');

  const ventasSimuladas = 4500;
  const afiliacion = 200;

  const fetchProductos = async () => {
    const res = await axios.get('http://localhost:5000/productos');
    setProductos(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const cerrarSesion = () => {
    localStorage.clear();
    window.location.href = '/';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f4f6f8' }}>

      {/* SIDEBAR */}
      <div style={{ width: 240, background: '#1f2a38', color: 'white', padding: 20 }}>
        <h3>CHUKUTA EXPRESS</h3>
        <hr />

        <p onClick={() => setVista('inicio')} style={menu(vista === 'inicio')}>🏠 Inicio</p>
        <p onClick={() => setVista('inventario')} style={menu(vista === 'inventario')}>📦 Inventario</p>
        <p onClick={() => setVista('pedidos')} style={menu(vista === 'pedidos')}>🧾 Pedidos</p>
        <p onClick={() => setVista('estadisticas')} style={menu(vista === 'estadisticas')}>📊 Estadísticas</p>

        <button onClick={cerrarSesion} style={logoutBtn}>
          Cerrar sesión
        </button>
      </div>

      {/* CONTENIDO */}
      <div style={{ flex: 1, padding: 25 }}>

        {/* ================= INICIO ================= */}
        {vista === 'inicio' && (
          <>
            <h2>🏠 Inicio</h2>

            <div style={card}>
              <h3>🤝 Afiliado</h3>
              <p>Nombre: Juan Pérez</p>
              <p>Comisión: Bs {afiliacion}</p>
              <p>Estado: Activo</p>
            </div>

            <div style={{ display: 'flex', gap: 15, marginTop: 15 }}>
              <div style={statCard}>💰 <h3>Ventas</h3><h2>Bs {ventasSimuladas}</h2></div>
              <div style={statCard}>📦 <h3>Productos</h3><h2>{productos.length}</h2></div>
              <div style={statCard}>🤝 <h3>Afiliación</h3><h2>Bs {afiliacion}</h2></div>
            </div>
          </>
        )}

        {/* ================= INVENTARIO ================= */}
        {vista === 'inventario' && (
          <>
            <h2>📦 Inventario</h2>

            <div style={tableContainer}>
              <table style={table}>
                <thead>
                  <tr>
                    <th style={th}>Producto</th>
                    <th style={th}>Categoría</th>
                    <th style={th}>Stock</th>
                    <th style={th}>Precio</th>
                  </tr>
                </thead>

                <tbody>
                  {productos.map(p => (
                    <tr key={p.id_producto}>
                      <td style={td}>{p.nombre}</td>
                      <td style={td}>{p.nombre_categoria}</td>
                      <td style={{ ...td, color: p.stock < 10 ? 'red' : 'green', fontWeight: 'bold' }}>
                        {p.stock}
                      </td>
                      <td style={td}>Bs {p.precio_venta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ================= PEDIDOS ================= */}
        {vista === 'pedidos' && (
          <>
            <h2>🧾 Nuevo Pedido</h2>

            <div style={card}>
              <label>Cliente</label>
              <input value={cliente} onChange={e => setCliente(e.target.value)} style={input} />

              <label>Celular</label>
              <input value={celular} onChange={e => setCelular(e.target.value)} style={input} />

              <label>Dirección</label>
              <input value={direccion} onChange={e => setDireccion(e.target.value)} style={input} />

              <label>Producto</label>
              <select value={productoSel} onChange={e => setProductoSel(e.target.value)} style={input}>
                <option>Seleccionar</option>
                {productos.map(p => (
                  <option key={p.id_producto}>
                    {p.nombre}
                  </option>
                ))}
              </select>

              <label>Cantidad</label>
              <input
                type="number"
                value={cantidad}
                onChange={e => setCantidad(Number(e.target.value))}
                style={input}
              />

              <button style={btn}>Registrar Pedido</button>
            </div>
          </>
        )}

        {/* ================= ESTADÍSTICAS ================= */}
        {vista === 'estadisticas' && (
          <>
            <h2>📊 Estadísticas</h2>

            <div style={{ display: 'flex', gap: 15 }}>
              <div style={statCard}>
                💰 <h3>Ingresos Totales</h3>
                <h2>Bs {ventasSimuladas}</h2>
              </div>

              <div style={statCard}>
                📦 <h3>Stock Total</h3>
                <h2>{productos.reduce((a, p) => a + p.stock, 0)}</h2>
              </div>

              <div style={statCard}>
                📈 <h3>Promedio Precio</h3>
                <h2>
                  Bs {productos.length
                    ? (productos.reduce((a, p) => a + p.precio_venta, 0) / productos.length).toFixed(2)
                    : 0}
                </h2>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

/* ESTILOS */
const menu = (active: boolean): React.CSSProperties => ({
  padding: 10,
  cursor: 'pointer',
  color: active ? '#00d4ff' : 'white'
});

const logoutBtn: React.CSSProperties = {
  marginTop: 20,
  width: '100%',
  padding: 10,
  background: '#e74c3c',
  border: 'none',
  color: 'white',
  cursor: 'pointer',
  borderRadius: 6
};

const card: React.CSSProperties = {
  background: 'white',
  padding: 15,
  borderRadius: 10,
  boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
};

const statCard: React.CSSProperties = {
  ...card,
  flex: 1,
  textAlign: 'center'
};

const tableContainer: React.CSSProperties = {
  background: 'white',
  padding: 10,
  borderRadius: 10
};

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse'
};

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: 10
};

const td: React.CSSProperties = {
  padding: 10,
  borderTop: '1px solid #eee'
};

const input: React.CSSProperties = {
  width: '100%',
  padding: 10,
  marginBottom: 10,
  borderRadius: 6,
  border: '1px solid #ddd'
};

const btn: React.CSSProperties = {
  background: '#2ecc71',
  color: 'white',
  border: 'none',
  padding: 10,
  width: '100%',
  borderRadius: 6
};

export default Dashboard;