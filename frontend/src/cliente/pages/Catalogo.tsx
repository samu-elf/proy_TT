import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCliente } from '../context/ClienteContext';
import LoginModal from '../components/LoginModal';

interface Producto {
  id_producto: number;
  nombre: string;
  precio_venta: number;
  stock: number;
  nombre_categoria: string;
}

export default function Catalogo() {
  const { isAuthenticated, token, setCantidadCarrito, cantidadCarrito } = useCliente();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [productoParaAgregar, setProductoParaAgregar] = useState<number | null>(null);
  const [agregando, setAgregando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    fetch('http://localhost:5000/categorias')
      .then(r => r.json())
      .then(setCategorias);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (busqueda) params.append('q', busqueda);
    if (categoriaActiva) params.append('categoria', categoriaActiva);

    fetch(`http://localhost:5000/productos?${params}`)
      .then(r => r.json())
      .then(setProductos);
  }, [busqueda, categoriaActiva]);

  const agregarAlCarrito = async (id_producto: number) => {
    if (!isAuthenticated) {
      setProductoParaAgregar(id_producto);
      setShowLogin(true);
      return;
    }
    await doAgregarCarrito(id_producto);
  };

  const doAgregarCarrito = async (id_producto: number) => {
    setAgregando(id_producto);

    try {
      const res = await fetch('http://localhost:5000/cliente/carrito', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ id_producto, cantidad: 1 })
      });

      if (res.ok) {
        setCantidadCarrito(cantidadCarrito + 1);
        setMensaje('✓ Producto agregado al carrito');
        setTimeout(() => setMensaje(''), 2500);
      }
    } finally {
      setAgregando(null);
    }
  };

  return (
    <div className="container py-4">

      {/* HEADER */}
      <div className="mb-4">
        <h1 className="fw-bold">🛍 Catálogo de productos</h1>

        <input
          type="text"
          className="form-control mt-3"
          placeholder="Buscar productos..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{ maxWidth: '500px' }}
        />
      </div>

      {/* CATEGORÍAS */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          className={`btn ${categoriaActiva === '' ? 'btn-primary' : 'btn-outline-primary'}`}
          onClick={() => setCategoriaActiva('')}
        >
          Todos
        </button>

        {categorias.map(cat => (
          <button
            key={cat}
            className={`btn ${categoriaActiva === cat ? 'btn-primary' : 'btn-outline-primary'}`}
            onClick={() => setCategoriaActiva(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* MENSAJE */}
      {mensaje && (
        <div className="alert alert-success py-2">
          {mensaje}
        </div>
      )}

      {/* PRODUCTOS */}
      <div className="row g-4">

        {productos.map(p => (
          <div className="col-md-4 col-sm-6" key={p.id_producto}>

            <div className="card h-100 shadow-sm border-0">

              {/* IMAGEN FAKE BONITA */}
              <div
                className="bg-dark text-white d-flex align-items-center justify-content-center"
                style={{ height: '170px', fontSize: '2.5rem' }}
              >
                📦
              </div>

              <div className="card-body d-flex flex-column">

                {/* CATEGORÍA */}
                <span className="badge bg-secondary mb-2 w-fit">
                  {p.nombre_categoria}
                </span>

                {/* NOMBRE */}
                <h5 className="card-title">{p.nombre}</h5>

                {/* STOCK */}
                <small className="text-muted">
                  Stock: {p.stock}
                </small>

                {/* PRECIO */}
                <h5 className="text-primary fw-bold mt-2">
                  Bs {p.precio_venta.toFixed(2)}
                </h5>

                {/* BOTONES */}
                <div className="mt-auto d-flex gap-2">

                  <Link
                    to={`/producto/${p.id_producto}`}
                    className="btn btn-outline-primary btn-sm w-50"
                  >
                    Ver
                  </Link>

                  <button
                    className="btn btn-primary btn-sm w-50"
                    onClick={() => agregarAlCarrito(p.id_producto)}
                    disabled={agregando === p.id_producto}
                  >
                    {agregando === p.id_producto ? '...' : '+ Carrito'}
                  </button>

                </div>

              </div>

            </div>

          </div>
        ))}

      </div>

      {/* LOGIN MODAL */}
      {showLogin && (
        <LoginModal
          onClose={() => {
            setShowLogin(false);
            setProductoParaAgregar(null);
          }}
          onSuccess={() => {
            if (productoParaAgregar) doAgregarCarrito(productoParaAgregar);
            setProductoParaAgregar(null);
          }}
        />
      )}

    </div>
  );
}