import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { carritoApi } from '../../../api/carrito';
import { pedidosApi } from '../../../api/pedidos';
import { useCliente } from '../../auth/context/ClienteContext';
import LoginModal from '../../auth/components/LoginModal';
import type { CarritoItem, CrearPedidoResponse } from '../../../types';

export default function Carrito() {
  const { isAuthenticated, setCantidadCarrito, cliente } = useCliente();
  const [items, setItems] = useState<CarritoItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [metodoPago, setMetodoPago] = useState('qr');
  const [notas, setNotas] = useState('');
  const [finalizando, setFinalizando] = useState(false);
  const [error, setError] = useState('');
  const [pedidoCreado, setPedidoCreado] = useState<CrearPedidoResponse | null>(null);
  const [actualizando, setActualizando] = useState<number | null>(null);
  const [descargandoRecibo, setDescargandoRecibo] = useState(false);

  const cargarCarrito = async () => {
    if (!isAuthenticated) { setLoading(false); return; }
    try {
      const res = await carritoApi.obtener();
      setItems(res.data.items);
      setTotal(res.data.total);
      setCantidadCarrito(res.data.cantidad_items);
    } catch {
      setError('No se pudo cargar el carrito');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Pre-llenar dirección con la del cliente si existe
    if (cliente?.direccion_defecto) {
      setDireccion(cliente.direccion_defecto);
    }
    cargarCarrito();
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEliminar = async (id_carrito: number) => {
    try {
      await carritoApi.eliminar(id_carrito);
      cargarCarrito();
    } catch {
      setError('No se pudo eliminar el producto');
    }
  };

  const handleActualizarCantidad = async (id_carrito: number, nueva: number) => {
    setActualizando(id_carrito);
    try {
      await carritoApi.actualizar(id_carrito, nueva);
      cargarCarrito();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al actualizar cantidad');
    } finally {
      setActualizando(null);
    }
  };

  const handleDescargarRecibo = async () => {
    if (!pedidoCreado) return;
    setDescargandoRecibo(true);
    try {
      await pedidosApi.descargarRecibo(pedidoCreado.id_pedido, 'informacion_de_producto.pdf', 'INFORMACION DE COMPRA');
    } catch {
      alert('No se pudo descargar la información de producto.');
    } finally {
      setDescargandoRecibo(false);
    }
  };

  const handleFinalizarCompra = async () => {
    if (!direccion.trim()) { setError('La dirección de entrega es requerida'); return; }
    setFinalizando(true);
    setError('');
    try {
      const res = await pedidosApi.crear({ direccion, metodo_pago: metodoPago, notas });
      setPedidoCreado(res.data);
      setItems([]);
      setTotal(0);
      setCantidadCarrito(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al crear el pedido');
    } finally {
      setFinalizando(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container py-5 text-center">
        <div style={{ fontSize: '4rem' }}>🛒</div>
        <h3 className="mt-3">Inicia sesión para ver tu carrito</h3>
        <p className="text-muted">Necesitas una cuenta para agregar y gestionar productos</p>
        <button className="btn btn-primary mt-2" onClick={() => setShowLogin(true)}
          style={{ background: '#6c63ff', border: 'none' }}>
          Iniciar sesión
        </button>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={cargarCarrito} />}
      </div>
    );
  }

  if (loading) {
    return <div className="container py-5 text-center"><div className="spinner-border text-primary" /></div>;
  }

  // Pedido creado con éxito
  if (pedidoCreado) {
    return (
      <div className="container py-5" style={{ maxWidth: 600 }}>
        <div className="card border-0 shadow-sm rounded-4 p-4 text-center">
          <div style={{ fontSize: '4rem' }}>✅</div>
          <h3 className="fw-bold mt-3">¡Pedido realizado!</h3>
          <p className="text-muted">Tu pedido ha sido registrado exitosamente</p>

          <div className="bg-light rounded-3 p-3 my-3 text-start">
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">N° de pedido:</span>
              <strong>#{pedidoCreado.id_pedido}</strong>
            </div>
            <div className="d-flex justify-content-between mb-1">
              <span className="text-muted">Seguimiento:</span>
              <strong className="text-primary">{pedidoCreado.codigo_seguimiento}</strong>
            </div>
            <div className="d-flex justify-content-between">
              <span className="text-muted">Total:</span>
              <strong>Bs {pedidoCreado.total.toFixed(2)}</strong>
            </div>
          </div>

          {metodoPago === 'qr' && (
            <div className="alert alert-info text-start small">
              📲 Realiza el pago por QR y envía el comprobante al vendedor para confirmar tu pedido.
            </div>
          )}

          <button
            className="btn w-100 mb-2 fw-semibold"
            style={{ background: '#10b981', border: 'none', color: 'white' }}
            onClick={handleDescargarRecibo}
            disabled={descargandoRecibo}
          >
            {descargandoRecibo
              ? <><span className="spinner-border spinner-border-sm me-2" />Generando PDF...</>
              : '🧾 Descargar información de producto'}
          </button>
          <div className="d-flex gap-2 mt-2">
            <Link to="/mis-pedidos" className="btn btn-primary flex-fill"
              style={{ background: '#6c63ff', border: 'none' }}>
              Ver mis pedidos
            </Link>
            <Link to="/productos" className="btn btn-outline-secondary flex-fill">
              Seguir comprando
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 800 }}>
      <h2 className="fw-bold mb-4">🛒 Mi Carrito</h2>

      {error && <div className="alert alert-danger">{error}</div>}

      {items.length === 0 ? (
        <div className="text-center py-5">
          <div style={{ fontSize: '4rem' }}>🛒</div>
          <p className="text-muted mt-3 fs-5">Tu carrito está vacío</p>
          <Link to="/productos" className="btn btn-primary mt-2"
            style={{ background: '#6c63ff', border: 'none' }}>
            Ver productos
          </Link>
        </div>
      ) : (
        <div className="row g-4">
          {/* Lista de ítems */}
          <div className="col-lg-7">
            {items.map((item) => (
              <div className="card mb-2 shadow-sm border-0 rounded-3" key={item.id_carrito}>
                <div className="card-body p-3">
                  <div className="d-flex justify-content-between align-items-start">
                    <div className="flex-grow-1">
                      <h6 className="mb-1 fw-semibold">{item.nombre}</h6>
                      <small className="text-muted">
                        Bs {item.precio_venta.toFixed(2)} c/u
                      </small>
                      {item.sin_stock && (
                        <span className="badge bg-danger ms-2 small">Sin stock suficiente</span>
                      )}
                    </div>
                    <button
                      className="btn btn-outline-danger btn-sm ms-2"
                      onClick={() => handleEliminar(item.id_carrito)}
                      aria-label="Eliminar"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="d-flex align-items-center justify-content-between mt-2">
                    <div className="input-group" style={{ maxWidth: 120 }}>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleActualizarCantidad(item.id_carrito, item.cantidad - 1)}
                        disabled={item.cantidad <= 1 || actualizando === item.id_carrito}
                      >−</button>
                      <span className="form-control form-control-sm text-center">{item.cantidad}</span>
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => handleActualizarCantidad(item.id_carrito, item.cantidad + 1)}
                        disabled={item.cantidad >= item.stock_disponible || actualizando === item.id_carrito}
                      >+</button>
                    </div>
                    <strong className="text-primary">Bs {item.subtotal.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen y checkout */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm rounded-3 p-3">
              <h5 className="fw-bold mb-3">Resumen del pedido</h5>

              <div className="d-flex justify-content-between text-muted small mb-1">
                <span>Subtotal ({items.reduce((a, i) => a + i.cantidad, 0)} artículos)</span>
                <span>Bs {total.toFixed(2)}</span>
              </div>
              <div className="d-flex justify-content-between mb-3">
                <span>Envío</span>
                <span className="text-success">A coordinar</span>
              </div>
              <div className="d-flex justify-content-between fw-bold fs-5 border-top pt-2 mb-3">
                <span>Total</span>
                <span style={{ color: '#6c63ff' }}>Bs {total.toFixed(2)}</span>
              </div>

              <hr />

              <div className="mb-3">
                <label className="form-label fw-semibold">Método de pago</label>
                <select
                  className="form-select form-select-sm"
                  value={metodoPago}
                  onChange={(e) => setMetodoPago(e.target.value)}
                >
                  <option value="qr">📱 Pago por QR</option>
                  <option value="transferencia">🏦 Transferencia bancaria</option>
                  <option value="efectivo">💵 Efectivo en entrega</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">
                  Dirección de entrega <span className="text-danger">*</span>
                </label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Ej: Av. 6 de agosto #456, Sopocachi, La Paz"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                />
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Notas adicionales</label>
                <textarea
                  className="form-control form-control-sm"
                  rows={2}
                  placeholder="Instrucciones para la entrega..."
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                />
              </div>

              <button
                className="btn w-100 py-2 fw-bold text-white"
                style={{ background: '#6c63ff', border: 'none' }}
                onClick={handleFinalizarCompra}
                disabled={finalizando || items.some(i => i.sin_stock)}
              >
                {finalizando ? 'Procesando...' : '✓ Confirmar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
