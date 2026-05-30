/**
 * MisPedidos — historial del cliente con:
 *  · Subida de imagen/PDF de comprobante de pago
 *  · Descarga de comprobante PDF (cuando estado ≥ confirmado)
 *  · Visualización del comprobante ya subido
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { pedidosApi } from '../../../api/pedidos';
import { useCliente } from '../../auth/context/ClienteContext';
import type { Pedido, EstadoPedido, DetallePedido } from '../../../types';

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string) ?? '';
const API_URL = (import.meta.env.VITE_API_BASE_URL as string) || 'http://localhost:5000';

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

const ESTADOS_COMPROBANTE_PDF = new Set(['confirmado','en_preparacion','en_camino','entregado']);

// ── Sub-componente: uploader de comprobante ────────────────────────────────
function UploaderComprobante({
  pedidoId,
  urlActual,
  onSubido,
}: {
  pedidoId: number;
  urlActual?: string;
  onSubido: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error,    setError]    = useState('');
  const [preview,  setPreview]  = useState<string | null>(null);

  const manejarArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    // Preview local inmediato si es imagen
    if (archivo.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setPreview(ev.target?.result as string);
      reader.readAsDataURL(archivo);
    } else {
      setPreview(null);
    }

    setSubiendo(true);
    setError('');
    try {
      const res = await pedidosApi.subirComprobante(pedidoId, archivo);
      onSubido(res.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubiendo(false);
    }
  };

  const imgSrc = preview ?? (urlActual ? `${BASE_URL}${urlActual}` : null);

  return (
    <div style={{ marginTop: 12 }}>
      <p className="fw-semibold small mb-1" style={{ color: '#1f2a38' }}>
        📎 Comprobante de pago
      </p>

      {imgSrc && (
        <div className="mb-2">
          {urlActual?.endsWith('.pdf') || preview === null && urlActual ? (
            <a href={`${API_URL}${urlActual}`} target="_blank" rel="noreferrer"
               className="btn btn-sm btn-outline-primary">
              📄 Ver comprobante subido
            </a>
          ) : (
            <img src={imgSrc} alt="Comprobante de pago"
              style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 8,
                       border: '1px solid #e2e8f0', objectFit: 'contain' }} />
          )}
        </div>
      )}

      <div className="d-flex align-items-center gap-2 flex-wrap">
        <button className="btn btn-sm btn-outline-secondary"
          style={{ fontSize: '0.8rem' }}
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}>
          {subiendo
            ? <><span className="spinner-border spinner-border-sm me-1" />Subiendo...</>
            : urlActual ? '🔄 Cambiar comprobante' : '⬆ Subir comprobante'}
        </button>
        <span className="text-muted" style={{ fontSize: '0.75rem' }}>
          JPG, PNG, WEBP o PDF · máx 5 MB
        </span>
      </div>

      <input ref={inputRef} type="file" hidden
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={manejarArchivo} />

      {error && (
        <div className="alert alert-danger py-1 px-2 mt-1 small">{error}</div>
      )}
    </div>
  );
}


// ── Componente principal ───────────────────────────────────────────────────
export default function MisPedidos() {
  const { isAuthenticated } = useCliente();
  const [pedidos,      setPedidos]      = useState<Pedido[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [expandido,    setExpandido]    = useState<number | null>(null);
  const [detalles,     setDetalles]     = useState<Record<number, DetallePedido[]>>({});
  const [loadingDet,   setLoadingDet]   = useState<number | null>(null);
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

  /** Actualiza la URL del comprobante en el estado local sin recargar */
  const actualizarComprobante = (pedidoId: number, url: string) => {
    setPedidos(prev => prev.map(p =>
      p.id_pedido === pedidoId ? { ...p, comprobante_pago_url: url } : p
    ));
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
          const puedeComprobantePdf = ESTADOS_COMPROBANTE_PDF.has(p.estado);

          return (
            <div className="card mb-3 shadow-sm border-0 rounded-3" key={p.id_pedido}>
              {/* Cabecera clickeable */}
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

              {/* Panel expandido */}
              {isOpen && (
                <div className="border-top p-3 bg-light rounded-bottom">

                  {/* Tabla de productos */}
                  {loadingDet === p.id_pedido ? (
                    <div className="text-center py-2">
                      <div className="spinner-border spinner-border-sm text-primary" />
                    </div>
                  ) : lineas.length > 0 && (
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
                  )}

                  {/* Historial de estados */}
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

                  {/* Sección de pago + acciones */}
                  <div className="rounded-2 p-3" style={{ background: '#fff', border: '1px solid #e2e8f0' }}>
                    {/* Estado del pago */}
                    <div className={`alert alert-${p.pago_verificado ? 'success' : 'warning'} py-2 small mb-3`}>
                      {p.pago_verificado
                        ? '✅ Pago verificado por el vendedor'
                        : '⏳ Pago pendiente de verificación — sube tu comprobante para agilizarlo'}
                    </div>

                    {/* Uploader de comprobante (siempre visible excepto cancelado) */}
                    {p.estado !== 'cancelado' && (
                      <UploaderComprobante
                        pedidoId={p.id_pedido}
                        urlActual={p.comprobante_pago_url}
                        onSubido={url => actualizarComprobante(p.id_pedido, url)}
                      />
                    )}

                    {/* Botón comprobante PDF (solo cuando está en proceso o entregado) */}
                    {puedeComprobantePdf && (
                      <div className="mt-3 pt-3" style={{ borderTop: '1px dashed #e2e8f0' }}>
                        <button
                          className="btn btn-sm fw-semibold"
                          style={{ background: '#6c63ff', color: '#fff', border: 'none' }}
                          onClick={e => { e.stopPropagation(); pedidosApi.descargarComprobantePdf(p.id_pedido); }}>
                          🧾 Descargar comprobante PDF
                        </button>
                        <span className="ms-2 text-muted" style={{ fontSize: '0.75rem' }}>
                          Disponible desde estado "Confirmado"
                        </span>
                      </div>
                    )}
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
