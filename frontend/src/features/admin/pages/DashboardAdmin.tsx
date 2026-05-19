/**
 * DashboardAdmin — Panel de administración completo
 *
 * FIX: acepta userRole como prop para que el Admin (rol=2) y el Operador (rol=3)
 *   puedan ver secciones diferentes según sus permisos.
 *
 * TYPO: tipografía consistente mediante un sistema de tokens inline
 *   (evita mezcla de rem/px y tamaños ad-hoc dispersos).
 */
import { useEffect, useState, useCallback } from 'react';
import { productosApi } from '../../../api/productos';
import { pedidosApi }   from '../../../api/pedidos';
import { usuariosApi, clientesAdminApi }  from '../../../api/usuarios';
import type { Producto, Pedido, UsuarioInterno } from '../../../types';

// ─── Tipografía centralizada ─────────────────────────────────────────────────
const T = {
  pageTitle:   { fontSize: '1.5rem',  fontWeight: 700, color: '#1a1a2e', margin: '0 0 24px' },
  sectionHd:   { fontSize: '0.7rem',  fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase' as const, padding: '12px 12px 4px' },
  label:       { fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 },
  small:       { fontSize: '0.78rem', color: '#6b7280' },
  statValue:   { fontSize: '1.8rem',  fontWeight: 800, color: '#1a1a2e', margin: 0 },
  statLabel:   { fontSize: '0.75rem', color: '#6b7280', marginBottom: 4 },
} as const;

// ─── Estados de pedido ────────────────────────────────────────────────────────
const ESTADOS = ['pendiente','confirmado','en_preparacion','en_camino','entregado','cancelado'];
const ESTADO_COLOR: Record<string, string> = {
  pendiente: '#f59e0b', confirmado: '#3b82f6', en_preparacion: '#8b5cf6',
  en_camino: '#06b6d4', entregado: '#10b981', cancelado: '#ef4444',
};

type Vista = 'dashboard' | 'productos' | 'pedidos' | 'usuarios' | 'nuevo_usuario' | 'reportes';

interface Props {
  onLogout: () => void;
  userRole?: number; // 2 = Admin, 3 = Operador
}

interface Resumen {
  total_pedidos: number;
  total_clientes: number;
  total_productos: number;
  ingresos_totales: number;
  pedidos_por_estado: { estado: string; cantidad: number; total: number }[];
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function StatCard({ label, value, color = '#6c63ff', icon }: {
  label: string; value: string | number; color?: string; icon: string;
}) {
  return (
    <div className="card border-0 rounded-3 p-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={T.statLabel}>{label}</span>
      </div>
      <p style={{ ...T.statValue, color }}>{value}</p>
    </div>
  );
}

function ImagenModal({ editando, onClose, onSave, saving }: {
  editando: { id: number; url: string };
  onClose: () => void;
  onSave: (url: string) => void;
  saving: boolean;
}) {
  const [url, setUrl] = useState(editando.url);
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1050,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Editar imagen del producto</h5>
        <div style={{ marginBottom: 12 }}>
          <label style={T.label}>URL de imagen</label>
          <input className="form-control" placeholder="https://ejemplo.com/imagen.jpg"
            value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
        {url && (
          <div style={{ textAlign: 'center', marginBottom: 12 }}>
            <img src={url} alt="Vista previa"
              style={{ maxHeight: 140, maxWidth: '100%', borderRadius: 8, border: '1px solid #e5e7eb' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary flex-fill" onClick={onClose}>Cancelar</button>
          <button
            className="btn text-white flex-fill fw-semibold"
            style={{ background: '#6c63ff', border: 'none' }}
            onClick={() => onSave(url)} disabled={saving}
          >
            {saving ? 'Guardando...' : 'Guardar imagen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsuarioEditModal({ editando, onClose, onSave, saving, setEditando }: any) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1050, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: 12, padding: 24, width: '100%', maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <h5 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>Editar {editando.tipo === 'cliente' ? 'Cliente' : 'Usuario'}</h5>
        <div className="mb-3">
          <label style={T.label}>Nombre</label>
          <input className="form-control" value={editando.nombre} onChange={e => setEditando({...editando, nombre: e.target.value})} />
        </div>
        {editando.tipo === 'cliente' ? (
            <div className="mb-3">
              <label style={T.label}>Teléfono</label>
              <input className="form-control" value={editando.telefono || ''} onChange={e => setEditando({...editando, telefono: e.target.value})} />
            </div>
        ) : (
            <div className="mb-3">
              <label style={T.label}>Rol</label>
              <select className="form-select" value={editando.id_rol} onChange={e => setEditando({...editando, id_rol: Number(e.target.value)})}>
                  <option value={1}>Vendedor</option>
                  <option value={2}>Administrador</option>
                  <option value={3}>Operador Logístico</option>
              </select>
            </div>
        )}
        <div className="mb-4 form-check">
            <input type="checkbox" className="form-check-input" id="editActivo" checked={editando.activo} onChange={e => setEditando({...editando, activo: e.target.checked})} />
            <label className="form-check-label" htmlFor="editActivo">Activo</label>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary flex-fill" onClick={onClose}>Cancelar</button>
          <button className="btn text-white flex-fill fw-semibold" style={{ background: '#6c63ff', border: 'none' }} onClick={onSave} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DashboardAdmin({ onLogout, userRole = 2 }: Props) {
  const isAdmin    = userRole === 2;
  const isOperador = userRole === 3;

  const [vista, setVista]           = useState<Vista>('dashboard');
  const [productos, setProductos]   = useState<Producto[]>([]);
  const [pedidos, setPedidos]       = useState<Pedido[]>([]);
  const [usuarios, setUsuarios]     = useState<any[]>([]);
  const [resumen, setResumen]       = useState<Resumen | null>(null);
  const [loadingPedidos, setLoadingPedidos] = useState(false);
  const [filtroPedido, setFiltroPedido]     = useState('');

  // Form nuevo usuario
  const [form, setForm]         = useState({ nombre: '', email: '', password: '', id_rol: 1, telefono: '' });
  const [formError, setFormError] = useState('');
  const [formOk, setFormOk]     = useState('');

  // Modal imagen
  const [editandoImagen, setEditandoImagen] = useState<{ id: number; url: string } | null>(null);
  const [guardandoImagen, setGuardandoImagen] = useState(false);

  // Modal edición usuario
  const [editandoUsuario, setEditandoUsuario] = useState<any>(null);
  const [guardandoUsuario, setGuardandoUsuario] = useState(false);

  const cargarUsuarios = async () => {
    try {
      const [resUsr, resCli] = await Promise.all([usuariosApi.listar(), clientesAdminApi.listar()]);
      const usr = (resUsr.data.items ?? []).map((u: any) => ({ ...u, tipo: 'interno', id_unico: `u_${u.id_usuario}` }));
      const cli = (resCli.data.items ?? []).map((c: any) => ({ ...c, tipo: 'cliente', id_unico: `c_${c.id}`, nombre_rol: 'Cliente' }));
      setUsuarios([...usr, ...cli]);
    } catch { /* silencioso */ }
  };

  // ─── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    productosApi.listarTodos().then((r: any) => setProductos(r.data.items ?? [])).catch(() => {});
    if (isAdmin) {
      cargarUsuarios();
      pedidosApi.reporteResumen().then((r: any) => setResumen(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  const cargarPedidos = useCallback(async (estado = '') => {
    setLoadingPedidos(true);
    try {
      const res: any = await pedidosApi.listarAdmin({ estado: estado || undefined });
      setPedidos(res.data.items ?? []);
    } catch { /* silencioso */ }
    finally { setLoadingPedidos(false); }
  }, []);

  useEffect(() => {
    if (vista === 'pedidos') cargarPedidos(filtroPedido);
  }, [vista, filtroPedido, cargarPedidos]);

  // ─── Handlers ──────────────────────────────────────────────────────────────
  const handleGuardarImagen = async (url: string) => {
    if (!editandoImagen) return;
    setGuardandoImagen(true);
    try {
      await productosApi.actualizar(editandoImagen.id, { imagen_url: url });
      const res: any = await productosApi.listarTodos();
      setProductos(res.data.items ?? []);
      setEditandoImagen(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar imagen');
    } finally { setGuardandoImagen(false); }
  };

  const handleCrearUsuario = async () => {
    setFormError(''); setFormOk('');
    if (!form.nombre || !form.email || !form.password) {
      setFormError('Nombre, email y contraseña son requeridos'); return;
    }
    try {
      if (form.id_rol === 4) {
        await clientesAdminApi.crear({ nombre: form.nombre, email: form.email, password: form.password, telefono: form.telefono });
      } else {
        await usuariosApi.crear({ nombre: form.nombre, email: form.email, password: form.password, id_rol: Number(form.id_rol) });
      }
      setFormOk('Usuario/Cliente registrado exitosamente');
      setForm({ nombre: '', email: '', password: '', id_rol: 1, telefono: '' });
      await cargarUsuarios();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear');
    }
  };

  const handleDesactivarUsuario = async (u: any) => {
    if (!confirm(`¿Desactivar a ${u.nombre}?`)) return;
    try {
      if (u.tipo === 'cliente') await clientesAdminApi.desactivar(u.id);
      else await usuariosApi.desactivar(u.id_usuario);
      await cargarUsuarios();
    } catch (err) { alert(err instanceof Error ? err.message : 'Error al desactivar'); }
  };

  const handleGuardarEdicionUsuario = async () => {
    if (!editandoUsuario) return;
    setGuardandoUsuario(true);
    try {
      if (editandoUsuario.tipo === 'cliente') {
        await clientesAdminApi.actualizar(editandoUsuario.id, { nombre: editandoUsuario.nombre, telefono: editandoUsuario.telefono, activo: editandoUsuario.activo });
      } else {
        await usuariosApi.actualizar(editandoUsuario.id_usuario, { nombre: editandoUsuario.nombre, id_rol: editandoUsuario.id_rol, activo: editandoUsuario.activo });
      }
      setEditandoUsuario(null);
      await cargarUsuarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al guardar');
    } finally { setGuardandoUsuario(false); }
  };

  const handleCambiarEstado = async (id: number, estado: string) => {
    try {
      await pedidosApi.cambiarEstado(id, estado);
      cargarPedidos(filtroPedido);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al cambiar estado');
    }
  };

  // ─── Sidebar nav item ──────────────────────────────────────────────────────
  const navItem = (v: Vista, label: string, icon: string) => (
    <button key={v} onClick={() => setVista(v)}
      style={{
        width: '100%', background: vista === v ? 'rgba(255,255,255,0.12)' : 'transparent',
        color: 'white', border: 'none', borderRadius: 7, padding: '9px 12px',
        display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem',
        fontWeight: vista === v ? 600 : 400, cursor: 'pointer', marginBottom: 2,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: '1rem' }}>{icon}</span> {label}
    </button>
  );

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside style={{ width: 220, background: '#1a1a2e', padding: '20px 10px', flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: 'white', padding: '0 8px 20px' }}>
          <p style={{ fontWeight: 800, fontSize: '1rem', margin: 0 }}>
            📦 Chukuta<span style={{ color: '#ff7043' }}>Express</span>
          </p>
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
            {isAdmin ? 'Administrador' : 'Operador Logístico'}
          </p>
        </div>

        <p style={T.sectionHd}>Visión general</p>
        {navItem('dashboard', 'Dashboard', '🏠')}
        {navItem('pedidos',   'Pedidos',   '🧾')}
        {navItem('productos', 'Inventario','📦')}

        {isAdmin && (
          <>
            <p style={T.sectionHd}>Administración</p>
            {navItem('usuarios',      'Usuarios',      '👥')}
            {navItem('nuevo_usuario', 'Nuevo usuario', '➕')}
            {navItem('reportes',      'Reportes',      '📈')}
          </>
        )}

        <div style={{ flexGrow: 1 }} />
        <button onClick={onLogout}
          style={{
            width: '100%', background: 'rgba(239,68,68,0.12)', color: '#fc8181',
            border: '1px solid rgba(239,68,68,0.25)', borderRadius: 7, padding: '9px 12px',
            fontSize: '0.875rem', cursor: 'pointer', textAlign: 'left', fontWeight: 500,
          }}
        >
          🚪 Cerrar sesión
        </button>
      </aside>

      {/* ── Contenido principal ────────────────────────────────────────── */}
      <main style={{ flexGrow: 1, background: '#f4f5f7', padding: '32px 28px', overflow: 'auto' }}>

        {/* DASHBOARD */}
        {vista === 'dashboard' && (
          <>
            <h1 style={T.pageTitle}>Panel de control</h1>
            <div className="row g-3 mb-4">
              <div className="col-sm-6 col-xl-3">
                <StatCard label="Total pedidos"  value={resumen?.total_pedidos  ?? '—'} icon="🧾" color="#6c63ff" />
              </div>
              <div className="col-sm-6 col-xl-3">
                <StatCard label="Clientes"        value={resumen?.total_clientes ?? '—'} icon="👥" color="#2196F3" />
              </div>
              <div className="col-sm-6 col-xl-3">
                <StatCard label="Productos"       value={resumen?.total_productos ?? '—'} icon="📦" color="#ff7043" />
              </div>
              <div className="col-sm-6 col-xl-3">
                <StatCard label="Ingresos (Bs)"   value={resumen ? `${resumen.ingresos_totales.toFixed(2)}` : '—'} icon="💰" color="#10b981" />
              </div>
            </div>

            {resumen && (
              <div className="card border-0 rounded-3 mb-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="card-body">
                  <h6 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Estado de pedidos</h6>
                  <div className="row g-2">
                    {resumen.pedidos_por_estado.map((e) => (
                      <div key={e.estado} className="col-6 col-md-4 col-xl-2">
                        <div style={{ background: '#f8f9fa', borderRadius: 8, padding: '10px 12px', textAlign: 'center', borderLeft: `3px solid ${ESTADO_COLOR[e.estado] ?? '#ccc'}` }}>
                          <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'capitalize', marginBottom: 2 }}>{e.estado.replace(/_/g,' ')}</div>
                          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{e.cantidad}</div>
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>Bs {e.total.toFixed(0)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {productos.filter(p => p.bajo_stock).length > 0 && (
              <div className="alert alert-warning d-flex align-items-center gap-2" style={{ fontSize: '0.875rem' }}>
                ⚠️ <strong>{productos.filter(p => p.bajo_stock).length} productos</strong> con stock bajo.{' '}
                <button className="btn btn-link p-0 ms-1" style={{ fontSize: '0.875rem' }} onClick={() => setVista('productos')}>
                  Ver inventario →
                </button>
              </div>
            )}
          </>
        )}

        {/* PEDIDOS */}
        {vista === 'pedidos' && (
          <>
            <div className="d-flex align-items-center justify-content-between mb-4" style={{ flexWrap: 'wrap', gap: 12 }}>
              <h1 style={{ ...T.pageTitle, margin: 0 }}>Gestión de pedidos</h1>
              <select className="form-select form-select-sm" style={{ width: 'auto', minWidth: 180 }}
                value={filtroPedido} onChange={(e) => setFiltroPedido(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS.map(e => <option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
              </select>
            </div>

            {loadingPedidos ? (
              <div className="text-center py-5"><div className="spinner-border" style={{ color: '#6c63ff' }} /></div>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <div style={{ fontSize: '3rem' }}>🧾</div>
                <p style={{ marginTop: 12 }}>No hay pedidos{filtroPedido ? ` con estado "${filtroPedido}"` : ''}.</p>
              </div>
            ) : (
              <div className="card border-0 rounded-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                <div className="table-responsive">
                  <table className="table table-hover mb-0" style={{ fontSize: '0.875rem' }}>
                    <thead style={{ background: '#f8f9fa' }}>
                      <tr>
                        <th style={{ padding: '12px 16px' }}>Pedido</th>
                        <th>Seguimiento</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Fecha</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidos.map((p) => (
                        <tr key={p.id_pedido}>
                          <td style={{ padding: '12px 16px', fontWeight: 700 }}>#{p.id_pedido}</td>
                          <td style={{ ...T.small }}>{p.codigo_seguimiento ?? '—'}</td>
                          <td style={{ fontWeight: 600 }}>Bs {p.total.toFixed(2)}</td>
                          <td>
                            <span style={{
                              display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                              fontSize: '0.72rem', fontWeight: 600, textTransform: 'capitalize',
                              background: `${ESTADO_COLOR[p.estado]}20`,
                              color: ESTADO_COLOR[p.estado] ?? '#6b7280',
                              border: `1px solid ${ESTADO_COLOR[p.estado]}40`,
                            }}>
                              {p.estado.replace(/_/g,' ')}
                            </span>
                          </td>
                          <td style={T.small}>{new Date(p.fecha).toLocaleDateString('es-BO')}</td>
                          <td>
                            <select className="form-select form-select-sm" style={{ minWidth: 160 }}
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) handleCambiarEstado(p.id_pedido, e.target.value);
                                e.target.value = '';
                              }}
                            >
                              <option value="">Cambiar estado…</option>
                              {ESTADOS.filter(e => e !== p.estado).map(e => (
                                <option key={e} value={e}>{e.replace(/_/g,' ')}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* INVENTARIO / PRODUCTOS */}
        {vista === 'productos' && (
          <>
            <h1 style={T.pageTitle}>Inventario de productos</h1>

            <div className="card border-0 rounded-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ padding: '12px 16px', width: 64 }}>Img</th>
                      <th>Nombre</th>
                      <th>Categoría</th>
                      <th>Stock</th>
                      <th>Precio</th>
                      <th>Estado</th>
                      {isAdmin && <th>Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {productos.map((p) => (
                      <tr key={p.id_producto}>
                        <td style={{ padding: '10px 16px' }}>
                          {p.imagen_url ? (
                            <img src={p.imagen_url} alt={p.nombre}
                              style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #e5e7eb' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <div style={{ width: 44, height: 44, borderRadius: 6, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem' }}>📦</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, verticalAlign: 'middle' }}>{p.nombre}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ background: '#f3f4f6', padding: '2px 8px', borderRadius: 4, fontSize: '0.78rem', color: '#374151' }}>
                            {p.nombre_categoria}
                          </span>
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{ fontWeight: 700, color: p.stock === 0 ? '#ef4444' : p.bajo_stock ? '#f59e0b' : '#10b981' }}>
                            {p.stock}
                          </span>
                          {p.bajo_stock && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.65rem' }}>Bajo</span>}
                        </td>
                        <td style={{ verticalAlign: 'middle' }}>Bs {p.precio_venta.toFixed(2)}</td>
                        <td style={{ verticalAlign: 'middle' }}>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                            background: p.activo ? '#d1fae5' : '#f3f4f6',
                            color: p.activo ? '#065f46' : '#6b7280',
                          }}>
                            {p.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        {isAdmin && (
                          <td style={{ verticalAlign: 'middle' }}>
                            <button className="btn btn-sm" style={{ border: '1px solid #e5e7eb', fontSize: '0.78rem', color: '#6c63ff' }}
                              onClick={() => setEditandoImagen({ id: p.id_producto, url: p.imagen_url || '' })}>
                              🖼 Imagen
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* USUARIOS — solo Admin */}
        {vista === 'usuarios' && isAdmin && (
          <>
            <h1 style={T.pageTitle}>Usuarios del sistema</h1>
            <div className="card border-0 rounded-3" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              <div className="table-responsive">
                <table className="table table-hover mb-0" style={{ fontSize: '0.875rem' }}>
                  <thead style={{ background: '#f8f9fa' }}>
                    <tr>
                      <th style={{ padding: '12px 16px' }}>Nombre</th>
                      <th>Email</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th>Último acceso</th>
                      <th style={{ textAlign: 'right', paddingRight: 16 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((v) => (
                      <tr key={v.id_unico}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {v.nombre}
                          {v.tipo === 'cliente' && v.telefono && (
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 400 }}>📞 {v.telefono}</div>
                          )}
                        </td>
                        <td style={T.small}>{v.email}</td>
                        <td>
                          <span style={{ background: v.tipo === 'cliente' ? '#e0f2fe' : '#ede9fe', color: v.tipo === 'cliente' ? '#0369a1' : '#5b21b6', padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600 }}>
                            {v.nombre_rol}
                          </span>
                        </td>
                        <td>
                          <span style={{
                            padding: '2px 8px', borderRadius: 4, fontSize: '0.72rem', fontWeight: 600,
                            background: v.activo ? '#d1fae5' : '#fee2e2',
                            color: v.activo ? '#065f46' : '#991b1b',
                          }}>
                            {v.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td style={T.small}>{v.ultimo_login ? new Date(v.ultimo_login).toLocaleDateString('es-BO') : '—'}</td>
                        <td style={{ textAlign: 'right', paddingRight: 16 }}>
                          <button onClick={() => setEditandoUsuario({ ...v })} style={{ background: 'none', border: 'none', color: '#6c63ff', marginRight: 12, fontSize: '0.875rem' }} title="Editar">✏️</button>
                          <button onClick={() => handleDesactivarUsuario(v)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.875rem' }} title="Desactivar" disabled={!v.activo}>🛑</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* NUEVO USUARIO — solo Admin */}
        {vista === 'nuevo_usuario' && isAdmin && (
          <>
            <h1 style={T.pageTitle}>Registrar nuevo usuario</h1>
            <div className="card border-0 rounded-3 p-4" style={{ maxWidth: 460, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
              {formError && <div className="alert alert-danger py-2" style={{ fontSize: '0.85rem' }}>{formError}</div>}
              {formOk    && <div className="alert alert-success py-2" style={{ fontSize: '0.85rem' }}>{formOk}</div>}

              <div className="mb-3">
                <label style={T.label}>Nombre completo</label>
                <input className="form-control" value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </div>
              <div className="mb-3">
                <label style={T.label}>Email</label>
                <input type="email" className="form-control" value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="mb-3">
                <label style={T.label}>Contraseña</label>
                <input type="password" className="form-control" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Mínimo 8 caracteres" />
              </div>
              <div className="mb-4">
                <label style={T.label}>Rol</label>
                <select className="form-select" value={form.id_rol}
                  onChange={(e) => setForm({ ...form, id_rol: Number(e.target.value) })}>
                  <option value={1}>Vendedor</option>
                  <option value={2}>Administrador</option>
                  <option value={3}>Operador Logístico</option>
                  <option value={4}>Cliente</option>
                </select>
              </div>
              {form.id_rol === 4 && (
                <div className="mb-4">
                  <label style={T.label}>Teléfono (Opcional)</label>
                  <input type="text" className="form-control" value={form.telefono}
                    onChange={(e) => setForm({ ...form, telefono: e.target.value })}
                    placeholder="Ej. +591 71234567" />
                </div>
              )}
              <button
                className="btn w-100 text-white fw-semibold"
                style={{ background: '#1a1a2e', border: 'none', height: 44 }}
                onClick={handleCrearUsuario}
              >
                Crear usuario
              </button>
            </div>
          </>
        )}

        {/* REPORTES — solo Admin */}
        {vista === 'reportes' && isAdmin && (
          <>
            <h1 style={T.pageTitle}>Reportes y métricas</h1>
            {resumen ? (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-md-4"><StatCard label="Ingresos totales" value={`Bs ${resumen.ingresos_totales.toFixed(2)}`} icon="💰" color="#10b981" /></div>
                  <div className="col-md-4"><StatCard label="Total pedidos"    value={resumen.total_pedidos}    icon="🧾" /></div>
                  <div className="col-md-4"><StatCard label="Clientes"          value={resumen.total_clientes}   icon="👥" color="#2196F3" /></div>
                </div>
                <div className="card border-0 rounded-3 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
                  <h6 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 16 }}>Desglose por estado</h6>
                  <table className="table table-striped" style={{ fontSize: '0.875rem' }}>
                    <thead><tr><th>Estado</th><th>Cantidad</th><th>Total (Bs)</th></tr></thead>
                    <tbody>
                      {resumen.pedidos_por_estado.map((e) => (
                        <tr key={e.estado}>
                          <td style={{ textTransform: 'capitalize' }}>{e.estado.replace(/_/g,' ')}</td>
                          <td>{e.cantidad}</td>
                          <td>{e.total.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-5"><div className="spinner-border" style={{ color: '#6c63ff' }} /></div>
            )}
          </>
        )}

      </main>

      {/* ── Modales globales ────────────────────────────────────────── */}
      {editandoImagen && (
        <ImagenModal editando={editandoImagen} onClose={() => setEditandoImagen(null)}
          onSave={handleGuardarImagen} saving={guardandoImagen} />
      )}
      {editandoUsuario && (
        <UsuarioEditModal
          editando={editandoUsuario}
          setEditando={setEditandoUsuario}
          onClose={() => setEditandoUsuario(null)}
          onSave={handleGuardarEdicionUsuario}
          saving={guardandoUsuario}
        />
      )}
    </div>
  );
}
