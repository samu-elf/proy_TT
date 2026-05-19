/**
 * MisPedidos — historial completo del cliente con detalle de líneas e historial de estados
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { pedidosApi } from '../../../api/pedidos';
import { useCliente } from '../../auth/context/ClienteContext';
import type { Pedido, EstadoPedido, DetallePedido } from '../../../types';

const ESTADO_CONFIG: Record<EstadoPedido, { badge: string; label: string; icon: string }> = {
  pendiente:      { badge: 'warning',   label: 'Pendiente',       icon: '⏳' },
  confirmado:     { badge: 'info',      label: 'Confirmado',      icon: '✅' },
  en_preparacion: { badge: 'primary',   label: 'En preparación',  icon: '📦' },
  en_camino:      { badge: 'primary',   label: 'En camino',       icon: '🚚' },
  entregado:      { badge: 'success',   label: 'Entregado',       icon: '🎉' },
  cancelado:      { badge: 'danger',    label: 'Cancelado',       icon: '❌' },
};

const METODO_LABEL: Record<string, string> = {
  qr:            '📱 Pago por QR',
  transferencia: '🏦 Transferencia',
  efectivo:      '💵 Efectivo',
};

export default function MisPedidos() {
  const { isAuthenticated } = useCliente();
  const [pedidos,   setPedidos]   = useState<Pedido[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [expandido, setExpandido] = useState<number | null>(null);
  const [detalles,  setDetalles]  = useState<Record<number, DetallePedido[]>>({});
  const [loadingDet, setLoadingDet] = useState<number | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  const cargarPedidos = useCallback(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    setLoading(true);
    pedidosApi.historial({ estado: filtroEstado || undefined })
      .then(r => setPedidos(r.data.items))
      .catch(() => setError('No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, filtroEstado]);

  useEffect(() => { cargarPedidos(); }, [cargarPedidos]);

  const toggleExpandir = async (id: number) => {
    if (expandido === id) { setExpandido(null); return; }
    setExpandido(id);
    if (detalles[id]) return;
    setLoadingDet(id);
    try {
      const r = await pedidosApi.detalleCompleto(id);
      setDetalles(prev => ({ ...prev, [id]: r.data.detalles ?? [] }));
    } catch { /* silencioso */ }
    finally { setLoadingDet(null); }
  };

  if (!isAuthenticated) {
    return (
      <div className="container py-5 text-center">
        <div style={{ fontSize: '3rem' }}>📦</div>
        <h4 className="mt-3">Inicia sesión para ver tus pedidos</h4>
        <Link to="/" className="btn btn-primary mt-3" style={{ background: '#6c63ff', border: 'none' }}>
          Ir al inicio
        </Link>
      </div>
    );
  }

  return (
    <div className="container py-4" style={{ maxWidth: 800 }}>
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <h2 className="fw-bold mb-0">📦 Mis Pedidos</h2>
        <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
          value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {loading ? (
        <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
      ) : pedidos.length === 0 ? (
        <div className="text-center py-5">
          <div style={{ fontSize: '4rem' }}>📭</div>
          <p className="text-muted mt-3 fs-5">
            {filtroEstado ? 'No hay pedidos con ese estado' : 'Aún no tienes pedidos'}
          </p>
          <Link to="/productos" className="btn btn-primary mt-2"
            style={{ background: '#6c63ff', border: 'none' }}>
            Explorar productos
          </Link>
        </div>
      ) : (
        pedidos.map(p => {
          const estado = ESTADO_CONFIG[p.estado] ?? { badge: 'secondary', label: p.estado, icon: '?' };
          const isOpen = expandido === p.id_pedido;
          const lineas = detalles[p.id_pedido] ?? [];

          return (
            <div className="card mb-3 shadow-sm border-0 rounded-3" key={p.id_pedido}>
              <div className="card-body p-3" style={{ cursor: 'pointer' }}
                onClick={() => toggleExpandir(p.id_pedido)}>
                <div className="d-flex justify-content-between align-items-center">
                  <div>
                    <h6 className="mb-0 fw-bold">{estado.icon} Pedido #{p.id_pedido}</h6>
                    <small className="text-muted">
                      {new Date(p.fecha).toLocaleDateString('es-BO', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </small>
                  </div>
                  <div className="text-end">
                    <span className={`badge bg-${estado.badge} mb-1 d-block`}>{estado.label}</span>
                    <strong>Bs {p.total.toFixed(2)}</strong>
                  </div>
                </div>
                <div className="mt-2 d-flex flex-wrap gap-3 small text-muted">
                  <span>📍 {p.direccion_entrega}</span>
                  {p.codigo_seguimiento && <span>🔖 {p.codigo_seguimiento}</span>}
                  {p.metodo_pago && <span>{METODO_LABEL[p.metodo_pago] ?? p.metodo_pago}</span>}
                  <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{isOpen ? '▲' : '▼'}</span>
                </div>
              </div>

              {isOpen && (
                <div className="border-top p-3 bg-light rounded-bottom">
                  {loadingDet === p.id_pedido ? (
                    <div className="text-center py-2">
                      <div className="spinner-border spinner-border-sm text-primary" />
                    </div>
                  ) : lineas.length > 0 ? (
                    <div className="mb-3">
                      <h6 className="fw-bold small text-uppercase text-muted mb-2">Productos</h6>
                      <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Producto</th>
                            <th className="text-center">Cant.</th>
                            <th className="text-end">Precio</th>
                            <th className="text-end">Subtotal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lineas.map(d => (
                            <tr key={d.id_detalle}>
                              <td>{d.nombre_producto}</td>
                              <td className="text-center">{d.cantidad}</td>
                              <td className="text-end">Bs {d.precio_unitario.toFixed(2)}</td>
                              <td className="text-end fw-semibold">Bs {d.subtotal.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <td colSpan={3} className="text-end fw-bold">Total:</td>
                            <td className="text-end fw-bold" style={{ color: '#6c63ff' }}>
                              Bs {p.total.toFixed(2)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  ) : null}

                  {p.historial && p.historial.length > 0 && (
                    <div className="mb-3">
                      <h6 className="fw-bold small text-uppercase text-muted mb-2">Historial</h6>
                      <div className="d-flex flex-column gap-1">
                        {p.historial.map((h, i) => (
                          <div key={i} className="d-flex align-items-start gap-2 small">
                            <span className={`badge bg-${ESTADO_CONFIG[h.estado_nuevo as EstadoPedido]?.badge ?? 'secondary'}`}>
                              {ESTADO_CONFIG[h.estado_nuevo as EstadoPedido]?.label ?? h.estado_nuevo}
                            </span>
                            <span className="text-muted">
                              {new Date(h.fecha).toLocaleString('es-BO')}
                              {h.comentario && ` · ${h.comentario}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`alert alert-${p.pago_verificado ? 'success' : 'warning'} py-2 small mb-0`}>
                    {p.pago_verificado
                      ? '✅ Pago verificado'
                      : '⏳ Pago pendiente de verificación. Envía tu comprobante al vendedor.'}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
