import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { productosApi } from '../../../api/productos';
import { carritoApi } from '../../../api/carrito';
import { useCliente } from '../../auth/context/ClienteContext';
import LoginModal from '../../auth/components/LoginModal';
import type { Producto } from '../../../types';

export default function ProductoDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, cantidadCarrito, setCantidadCarrito } = useCliente();

  const [producto, setProducto] = useState<Producto | null>(null);
  const [cantidad, setCantidad] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showLogin, setShowLogin] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [mensaje, setMensaje] = useState('');

  useEffect(() => {
    if (!id || isNaN(Number(id))) {
      navigate('/productos');
      return;
    }
    productosApi.obtener(Number(id))
      .then((res) => setProducto(res.data))
      .catch(() => setError('Producto no encontrado'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const doAgregar = async () => {
    if (!producto) return;
    setAgregando(true);
    try {
      await carritoApi.agregar(producto.id_producto, cantidad);
      setCantidadCarrito(cantidadCarrito + cantidad);
      setMensaje(`✓ ${cantidad} unidad(es) agregada(s) al carrito`);
      setTimeout(() => setMensaje(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al agregar');
    } finally {
      setAgregando(false);
    }
  };

  const handleAgregar = () => {
    if (!isAuthenticated) { setShowLogin(true); return; }
    doAgregar();
  };

  if (loading) {
    return (
      <div className="container py-5">
        <div className="placeholder-glow" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="placeholder bg-secondary rounded mb-3" style={{ height: 200, width: '100%' }} />
          <span className="placeholder col-6 d-block mb-2" />
          <span className="placeholder col-4 d-block mb-2" />
          <span className="placeholder col-8 d-block" />
        </div>
      </div>
    );
  }

  if (error || !producto) {
    return (
      <div className="container py-5" style={{ maxWidth: 600 }}>
        <div className="alert alert-danger">{error || 'Producto no encontrado'}</div>
        <button className="btn btn-secondary" onClick={() => navigate(-1)}>← Volver</button>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 700 }}>
      <button className="btn btn-link ps-0 mb-4 text-decoration-none" onClick={() => navigate(-1)}>
        ← Volver al catálogo
      </button>

      <div className="card shadow-sm border-0 rounded-4 overflow-hidden">
        {/* Imagen */}
        <div
          className="d-flex align-items-center justify-content-center"
          style={{
            height: 220,
            background: 'linear-gradient(135deg, #1a1a2e, #2d2d44)',
            fontSize: '5rem',
            overflow: 'hidden',
          }}
        >
          {producto.imagen_url ? (
            <img
              src={producto.imagen_url}
              alt={producto.nombre}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).parentElement!.innerText = '📦';
              }}
            />
          ) : (
            '📦'
          )}
        </div>

        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-start mb-2">
            <span className="badge bg-light text-dark border">{producto.nombre_categoria}</span>
            {producto.bajo_stock && (
              <span className="badge bg-warning text-dark">⚠ Últimas unidades</span>
            )}
          </div>

          <h2 className="fw-bold mb-1">{producto.nombre}</h2>

          {producto.codigo && (
            <p className="text-muted small">Código: {producto.codigo}</p>
          )}

          {producto.descripcion && (
            <p className="text-muted mt-2">{producto.descripcion}</p>
          )}

          <div className="d-flex align-items-center gap-3 my-3">
            <div>
              <span className="text-muted small d-block">Disponible</span>
              <span className={`fw-bold ${producto.stock === 0 ? 'text-danger' : producto.stock <= 5 ? 'text-warning' : 'text-success'}`}>
                {producto.stock === 0 ? 'Sin stock' : `${producto.stock} unidades`}
              </span>
            </div>
            <div className="vr" />
            <div>
              <span className="text-muted small d-block">Precio unitario</span>
              <span className="fw-bold fs-4" style={{ color: '#6c63ff' }}>
                Bs {producto.precio_venta.toFixed(2)}
              </span>
            </div>
          </div>

          {mensaje && <div className="alert alert-success py-2">{mensaje}</div>}

          {producto.stock > 0 && (
            <div className="d-flex align-items-center gap-3 mb-3">
              <label className="fw-semibold text-nowrap">Cantidad:</label>
              <div className="input-group" style={{ maxWidth: 140 }}>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setCantidad(Math.max(1, cantidad - 1))}
                  disabled={cantidad <= 1}
                >
                  −
                </button>
                <input
                  type="number"
                  className="form-control form-control-sm text-center"
                  value={cantidad}
                  min={1}
                  max={producto.stock}
                  onChange={(e) => {
                    const v = Math.min(producto.stock, Math.max(1, Number(e.target.value)));
                    setCantidad(v);
                  }}
                />
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setCantidad(Math.min(producto.stock, cantidad + 1))}
                  disabled={cantidad >= producto.stock}
                >
                  +
                </button>
              </div>
              <span className="text-muted small">
                Total: <strong>Bs {(producto.precio_venta * cantidad).toFixed(2)}</strong>
              </span>
            </div>
          )}

          <button
            className="btn w-100 py-2 fw-bold text-white"
            style={{ background: producto.stock === 0 ? '#999' : '#6c63ff', border: 'none' }}
            onClick={handleAgregar}
            disabled={agregando || producto.stock === 0}
          >
            {producto.stock === 0
              ? 'Sin stock disponible'
              : agregando
              ? 'Agregando...'
              : '🛒 Agregar al carrito'}
          </button>
        </div>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onSuccess={() => { setShowLogin(false); doAgregar(); }}
        />
      )}
    </div>
  );
}
