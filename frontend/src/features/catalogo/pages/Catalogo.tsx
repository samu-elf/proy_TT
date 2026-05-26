import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { productosApi } from '../../../api/productos';
import { carritoApi } from '../../../api/carrito';
import { useCliente } from '../../auth/context/ClienteContext';
import LoginModal from '../../auth/components/LoginModal';
import type { Producto, Categoria } from '../../../types';

export default function Catalogo() {
  const { isAuthenticated, setCantidadCarrito, cantidadCarrito } = useCliente();
  const location = useLocation();

  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaActiva, setCategoriaActiva] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [pendingProductoId, setPendingProductoId] = useState<number | null>(null);
  const [agregando, setAgregando] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Leer parámetro q de la URL (vía búsqueda desde Navbar)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qParam = params.get('q');
    if (qParam) {
      setBusqueda(qParam);
    }
  }, [location.search]);

  useEffect(() => {
    productosApi.categorias()
      .then((res) => setCategorias(res.data))
      .catch(() => {});
  }, []);

  const cargarProductos = useCallback((q: string, cat: string, pg: number) => {
    setLoading(true);
    setError('');
    const params: Record<string, string | number> = { page: pg, per_page: 12 };
    if (q) params.q = q;
    if (cat) params.categoria = cat;

    productosApi.listar(params)
      .then((res) => {
        setProductos(res.data.items);
        setTotalPages(res.data.pages);
      })
      .catch(() => setError('No se pudieron cargar los productos'))
      .finally(() => setLoading(false));
  }, []);

  // Debounce en búsqueda
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
      cargarProductos(busqueda, categoriaActiva, 1);
    }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [busqueda, categoriaActiva, cargarProductos]);

  useEffect(() => {
    cargarProductos(busqueda, categoriaActiva, page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  const doAgregarCarrito = useCallback(async (id_producto: number) => {
    setAgregando(id_producto);
    try {
      await carritoApi.agregar(id_producto, 1);
      setCantidadCarrito(cantidadCarrito + 1);
      setMensaje('✓ Producto agregado al carrito');
      setTimeout(() => setMensaje(''), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar al carrito');
    } finally {
      setAgregando(null);
    }
  }, [cantidadCarrito, setCantidadCarrito]);

  const handleAgregar = (id_producto: number) => {
    if (!isAuthenticated) {
      setPendingProductoId(id_producto);
      setShowLogin(true);
      return;
    }
    doAgregarCarrito(id_producto);
  };

  const handleLoginSuccess = () => {
    if (pendingProductoId !== null) {
      doAgregarCarrito(pendingProductoId);
      setPendingProductoId(null);
    }
  };

  const handleCategoriaChange = (cat: string) => {
    setCategoriaActiva(cat);
    setPage(1);
  };

  return (
    <div className="container-lg py-4">

      {/* Header y buscador */}
      <div className="row align-items-center mb-4">
        <div className="col-md-6">
          <h1 className="fw-bold mb-1">Catálogo de productos</h1>
          <p className="text-muted small">Encuentra lo que necesitas entre cientos de productos</p>
        </div>
        <div className="col-md-6">
          <div className="input-group">
            <span className="input-group-text bg-white">🔍</span>
            <input
              type="search"
              className="form-control"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              aria-label="Buscar productos"
            />
          </div>
        </div>
      </div>

      {/* Filtros de categoría */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          className={`btn btn-sm ${categoriaActiva === '' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => handleCategoriaChange('')}
        >
          Todos
        </button>
        {categorias.map((cat) => (
          <button
            key={cat.id_categoria}
            className={`btn btn-sm ${categoriaActiva === cat.nombre_categoria ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => handleCategoriaChange(cat.nombre_categoria)}
          >
            {cat.nombre_categoria}
          </button>
        ))}
      </div>

      {/* Alertas */}
      {mensaje && <div className="alert alert-success py-2 mb-3">{mensaje}</div>}
      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      {/* Grid de productos */}
      {loading ? (
        <div className="row g-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div className="col-md-4 col-sm-6" key={i}>
              <div className="card h-100 border-0 shadow-sm">
                <div className="placeholder-glow">
                  <div className="placeholder bg-secondary" style={{ height: 170, width: '100%' }} />
                </div>
                <div className="card-body">
                  <span className="placeholder col-4 mb-2 d-block" />
                  <span className="placeholder col-8 mb-2 d-block" />
                  <span className="placeholder col-5 d-block" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {productos.length === 0 ? (
            <div className="text-center py-5">
              <p className="text-muted fs-5">No se encontraron productos</p>
              {busqueda && (
                <button className="btn btn-outline-primary mt-2" onClick={() => setBusqueda('')}>
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="row g-4">
              {productos.map((p) => (
                <div className="col-xl-3 col-md-4 col-sm-6" key={p.id_producto}>
                  <div className="card h-100 shadow-sm border-0 product-card">
                    <div
                      className="d-flex align-items-center justify-content-center text-white"
                      style={{
                        height: 170,
                        background: 'linear-gradient(135deg, #1a1a2e, #2d2d44)',
                        fontSize: '3rem',
                        borderRadius: '8px 8px 0 0',
                        overflow: 'hidden',
                      }}
                    >
                      {p.imagen_url ? (
                        <img
                          src={p.imagen_url}
                          alt={p.nombre}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.textContent = '📦';
                          }}
                        />
                      ) : '📦'}
                    </div>
                    <div className="card-body d-flex flex-column p-3">
                      <span className="badge bg-light text-dark border mb-2" style={{ width: 'fit-content' }}>
                        {p.nombre_categoria}
                      </span>
                      <h6 className="card-title mb-1 fw-semibold" style={{ lineHeight: 1.3 }}>
                        {p.nombre}
                      </h6>
                      <small className="text-muted mb-2">
                        Stock: <span className={p.stock <= 5 ? 'text-danger fw-bold' : 'text-success'}>{p.stock}</span>
                        {p.bajo_stock && <span className="badge bg-warning text-dark ms-1 small">Últimas unidades</span>}
                      </small>
                      <h5 className="fw-bold mt-auto mb-3" style={{ color: '#6c63ff' }}>
                        Bs {p.precio_venta.toFixed(2)}
                      </h5>
                      <div className="d-flex gap-2">
                        <Link
                          to={`/producto/${p.id_producto}`}
                          className="btn btn-outline-secondary btn-sm flex-fill"
                        >
                          Ver detalle
                        </Link>
                        <button
                          className="btn btn-primary btn-sm flex-fill"
                          onClick={() => handleAgregar(p.id_producto)}
                          disabled={agregando === p.id_producto || p.stock === 0}
                          style={{ background: '#6c63ff', border: 'none' }}
                        >
                          {p.stock === 0 ? 'Sin stock' : agregando === p.id_producto ? '...' : '+ Carrito'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Paginación */}
          {totalPages > 1 && (
            <nav className="mt-5 d-flex justify-content-center" aria-label="Paginación">
              <ul className="pagination">
                <li className={`page-item ${page === 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(page - 1)}>
                    ← Anterior
                  </button>
                </li>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => (
                  <li key={pg} className={`page-item ${pg === page ? 'active' : ''}`}>
                    <button className="page-link" onClick={() => setPage(pg)}>{pg}</button>
                  </li>
                ))}
                <li className={`page-item ${page === totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(page + 1)}>
                    Siguiente →
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </>
      )}

      {showLogin && (
        <LoginModal
          onClose={() => { setShowLogin(false); setPendingProductoId(null); }}
          onSuccess={handleLoginSuccess}
        />
      )}
    </div>
  );
}
