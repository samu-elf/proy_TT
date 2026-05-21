/**
 * DashboardVendedor — Panel completo del vendedor (Chukuta Express)
 *
 * Vistas:
 *   inicio    → Estadísticas reales del dashboard
 *   productos → Lista de sus productos con acciones (editar, activar, eliminar)
 *   nuevo     → Formulario de creación de producto
 *   editar    → Formulario de edición de producto
 *   pedidos   → Pedidos que incluyen sus ítems + cambio de estado
 *   perfil    → Datos del vendedor
 */
import { useEffect, useState, useCallback } from 'react';
import { productosApi }  from '../../../api/productos';
import { vendedorApi }   from '../../../api/vendedor';
//n10
import ComprobanteVisual from "../../pedidos/components/ComprobanteVisual";
import type { Producto, Categoria } from '../../../types';
import type {
  DashboardVendedorData,
  PedidoVendedor,
  PerfilVendedor,
} from '../../../api/vendedor';

// ─── Tokens de diseño ─────────────────────────────────────────────────────────
const SIDEBAR_BG = '#1f2a38';
const ACCENT     = '#6c63ff';
const DANGER     = '#ef4444';
const SUCCESS    = '#10b981';
const WARNING    = '#f59e0b';

const ESTADO_COLOR: Record<string, string> = {
  pendiente:       '#f59e0b',
  confirmado:      '#3b82f6',
  en_preparacion:  '#8b5cf6',
  en_camino:       '#06b6d4',
  entregado:       '#10b981',
  cancelado:       '#ef4444',
};

const ESTADOS_VENDEDOR = [
  { value: 'pendiente',      label: 'Pendiente' },
  { value: 'confirmado',     label: 'Confirmado' },
  { value: 'en_preparacion', label: 'En preparación' },
  { value: 'en_camino',      label: 'En camino' },
  { value: 'entregado',      label: 'Entregado' },
];

type Vista = 'inicio' | 'productos' | 'nuevo' | 'editar' | 'pedidos' | 'detalle_pedido' | 'perfil';

interface FormProducto {
  nombre: string; descripcion: string; precio_venta: string;
  stock: string; stock_minimo: string; id_categoria: string;
  imagen_url: string; activo: boolean;
}

const FORM_VACÍO: FormProducto = {
  nombre: '', descripcion: '', precio_venta: '', stock: '',
  stock_minimo: '5', id_categoria: '', imagen_url: '', activo: true,
};

interface Props { onLogout: () => void }

// ─── Componentes auxiliares ───────────────────────────────────────────────────


function StatCard({ label, value, color = ACCENT, icon, sub }: {
  label: string; value: string | number; color?: string; icon: string; sub?: string;
}) {
  return (
    <div className="card border-0 rounded-3"
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)', padding: '16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={{ fontSize: '0.8rem', color: '#6b7280', fontWeight: 500 }}>{label}</span>
      </div>
      <p style={{ fontSize: '1.8rem', fontWeight: 800, color, margin: '0 0 2px' }}>{value}</p>
      {sub && <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: 0 }}>{sub}</p>}
    </div>
  );
}

function Toast({ msg, type, onDone }: { msg: string; type: 'ok' | 'err'; onDone: () => void }) {
  useEffect(() => { const t = setTimeout(onDone, 3500); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      background: type === 'ok' ? SUCCESS : DANGER, color: 'white',
      padding: '12px 22px', borderRadius: 10, fontWeight: 600,
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)', fontSize: '0.88rem',
    }}>
      {type === 'ok' ? '✅' : '❌'} {msg}
    </div>
  );
}

function ConfirmModal({ mensaje, onConfirm, onCancel }: {
  mensaje: string; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1100,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onCancel}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 380, width: '90%' }}
        onClick={e => e.stopPropagation()}>
        <p style={{ fontWeight: 600, marginBottom: 20, color: '#1a1a2e', fontSize: '0.95rem' }}>{mensaje}</p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary flex-fill" onClick={onCancel}>Cancelar</button>
          <button className="btn flex-fill text-white fw-semibold"
            style={{ background: DANGER, border: 'none' }} onClick={onConfirm}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  const color = ESTADO_COLOR[estado] ?? '#6b7280';
  const label = ESTADOS_VENDEDOR.find(e => e.value === estado)?.label ?? estado;
  return (
    <span style={{
      background: color + '20', color, border: `1px solid ${color}40`,
      borderRadius: 6, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
    }}>{label}</span>
  );
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export default function DashboardVendedor({ onLogout }: Props) {
  const [vista,    setVista]    = useState<Vista>('inicio');
  const [toast,    setToast]    = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);
  const [confirm,  setConfirm]  = useState<{ msg: string; fn: () => void } | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Dashboard
  const [stats,    setStats]    = useState<DashboardVendedorData | null>(null);

  // Productos
  const [productos,     setProductos]     = useState<Producto[]>([]);
  const [categorias,    setCategorias]    = useState<Categoria[]>([]);
  const [totalProductos, setTotalProductos] = useState(0);
  const [pageProductos, setPageProductos] = useState(1);
  const [filtroActivo,  setFiltroActivo]  = useState('');
  const [busqueda,      setBusqueda]      = useState('');

  // Form producto
  const [form,          setForm]          = useState<FormProducto>(FORM_VACÍO);
  const [editId,        setEditId]        = useState<number | null>(null);
  const [formErr,       setFormErr]       = useState('');

  // Pedidos
  const [pedidos,       setPedidos]       = useState<PedidoVendedor[]>([]);
  const [totalPedidos,  setTotalPedidos]  = useState(0);
  const [pagePedidos,   setPagePedidos]   = useState(1);
  const [filtroEstado,  setFiltroEstado]  = useState('');
  const [pedidoDetalle, setPedidoDetalle] = useState<PedidoVendedor | null>(null);
  const [nuevoEstado,   setNuevoEstado]   = useState('');
  const [comentarioEstado, setComentarioEstado] = useState('');

  // Perfil
  const [perfil,        setPerfil]        = useState<PerfilVendedor | null>(null);
  const [perfilNombre,  setPerfilNombre]  = useState('');

  const ok  = (msg: string) => setToast({ msg, type: 'ok' });
  const err = (msg: string) => setToast({ msg, type: 'err' });

  //n10
  const [pedidoParaComprobante, setPedidoParaComprobante] = useState<PedidoVendedor | null>(null);

  // ── Cargar datos según vista ───────────────────────────────────────────────

  const cargarStats = useCallback(async () => {
    try {
      const r = await vendedorApi.dashboard();
      setStats(r.data);
    } catch { err('Error al cargar estadísticas'); }
  }, []);

  const cargarProductos = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await vendedorApi.misProductos({
        page, per_page: 12,
        activo: filtroActivo || undefined,
        q:      busqueda     || undefined,
      });
      setProductos(r.data.items);
      setTotalProductos(r.data.total);
      setPageProductos(page);
    } catch { err('Error al cargar productos'); }
    finally { setLoading(false); }
  }, [filtroActivo, busqueda]);

  const cargarCategorias = useCallback(async () => {
    if (categorias.length > 0) return;
    try {
      const r = await productosApi.categorias();
      setCategorias(r.data);
    } catch { /* silencioso */ }
  }, [categorias.length]);

  const cargarPedidos = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const r = await vendedorApi.misPedidos({
        page, per_page: 15,
        estado: filtroEstado || undefined,
      });
      setPedidos(r.data.items);
      setTotalPedidos(r.data.total);
      setPagePedidos(page);
    } catch { err('Error al cargar pedidos'); }
    finally { setLoading(false); }
  }, [filtroEstado]);

  const cargarDetallePedido = useCallback(async (id: number) => {
    setLoading(true);
    try {
      const r = await vendedorApi.detallePedido(id);
      setPedidoDetalle(r.data);
      setNuevoEstado(r.data.estado);
      setComentarioEstado('');
    } catch { err('Error al cargar el pedido'); }
    finally { setLoading(false); }
  }, []);

  const cargarPerfil = useCallback(async () => {
    try {
      const r = await vendedorApi.perfil();
      setPerfil(r.data);
      setPerfilNombre(r.data.nombre);
    } catch { err('Error al cargar perfil'); }
  }, []);

  // Efectos por vista
  useEffect(() => {
    if (vista === 'inicio')    cargarStats();
    if (vista === 'productos') { cargarProductos(1); cargarCategorias(); }
    if (vista === 'nuevo')     cargarCategorias();
    if (vista === 'pedidos')   cargarPedidos(1);
    if (vista === 'perfil')    cargarPerfil();
  }, [vista]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (vista === 'productos') cargarProductos(1);
  }, [filtroActivo, busqueda]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (vista === 'pedidos') cargarPedidos(1);
  }, [filtroEstado]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Acciones de producto ───────────────────────────────────────────────────

  const iniciarEdicion = (p: Producto) => {
    setEditId(p.id_producto);
    setForm({
      nombre:       p.nombre,
      descripcion:  p.descripcion ?? '',
      precio_venta: String(p.precio_venta),
      stock:        String(p.stock),
      stock_minimo: String(p.stock_minimo ?? 5),
      id_categoria: String(p.id_categoria ?? ''),
      imagen_url:   p.imagen_url ?? '',
      activo:       p.activo ?? true,
    });
    setFormErr('');
    setVista('editar');
    cargarCategorias();
  };

  const validarForm = (): string => {
    if (!form.nombre.trim())       return 'El nombre es obligatorio';
    if (!form.precio_venta)        return 'El precio es obligatorio';
    if (parseFloat(form.precio_venta) <= 0) return 'El precio debe ser mayor a 0';
    if (!form.id_categoria)        return 'La categoría es obligatoria';
    if (form.stock !== '' && parseInt(form.stock) < 0) return 'El stock no puede ser negativo';
    return '';
  };

  const guardarProducto = async () => {
    const e = validarForm();
    if (e) { setFormErr(e); return; }
    setLoading(true);
    const payload = {
      nombre:       form.nombre.trim(),
      descripcion:  form.descripcion.trim(),
      precio_venta: parseFloat(form.precio_venta),
      stock:        parseInt(form.stock || '0'),
      stock_minimo: parseInt(form.stock_minimo || '5'),
      id_categoria: parseInt(form.id_categoria),
      imagen_url:   form.imagen_url.trim() || undefined,
      activo:       form.activo,
    };
    try {
      if (editId) {
        await productosApi.actualizar(editId, payload);
        ok('Producto actualizado correctamente');
      } else {
        await productosApi.crear(payload);
        ok('Producto creado correctamente');
      }
      setForm(FORM_VACÍO);
      setEditId(null);
      setVista('productos');
    } catch (ex: unknown) {
      err(ex instanceof Error ? ex.message : 'Error al guardar');
    } finally { setLoading(false); }
  };

  const toggleActivo = async (p: Producto) => {
    try {
      await productosApi.actualizar(p.id_producto, { activo: !p.activo });
      ok(`Producto ${!p.activo ? 'activado' : 'desactivado'}`);
      cargarProductos(pageProductos);
    } catch (ex: unknown) {
      err(ex instanceof Error ? ex.message : 'Error al cambiar estado');
    }
  };

  const eliminarProducto = (p: Producto) => {
    setConfirm({
      msg: `¿Desactivar "${p.nombre}"? Dejará de aparecer en el catálogo.`,
      fn: async () => {
        setConfirm(null);
        try {
          await productosApi.eliminar(p.id_producto);
          ok('Producto desactivado');
          cargarProductos(pageProductos);
        } catch (ex: unknown) {
          err(ex instanceof Error ? ex.message : 'Error al eliminar');
        }
      },
    });
  };

  // ── Acción: cambiar estado pedido ─────────────────────────────────────────

  const cambiarEstadoPedido = async () => {
    if (!pedidoDetalle || !nuevoEstado) return;
    setLoading(true);
    try {
      await vendedorApi.actualizarEstadoPedido(
        pedidoDetalle.id_pedido, nuevoEstado, comentarioEstado
      );
      ok('Estado actualizado');
      await cargarDetallePedido(pedidoDetalle.id_pedido);
      cargarPedidos(pagePedidos);
    } catch (ex: unknown) {
      err(ex instanceof Error ? ex.message : 'Error al cambiar estado');
    } finally { setLoading(false); }
  };

  // ── Acción: guardar perfil ────────────────────────────────────────────────

  const guardarPerfil = async () => {
    if (!perfilNombre.trim()) { err('El nombre no puede estar vacío'); return; }
    setLoading(true);
    try {
      await vendedorApi.actualizarPerfil({ nombre: perfilNombre.trim() });
      ok('Perfil actualizado');
      cargarPerfil();
    } catch (ex: unknown) {
      err(ex instanceof Error ? ex.message : 'Error al guardar perfil');
    } finally { setLoading(false); }
  };

  // ── Sidebar ────────────────────────────────────────────────────────────────

  const navItems: { key: Vista; label: string; icon: string }[] = [
    { key: 'inicio',    label: 'Inicio',    icon: '🏠' },
    { key: 'productos', label: 'Productos', icon: '📦' },
    { key: 'pedidos',   label: 'Pedidos',   icon: '🛒' },
    { key: 'perfil',    label: 'Mi Perfil', icon: '👤' },
  ];

  const irA = (v: Vista) => {
    setVista(v);
    setForm(FORM_VACÍO);
    setEditId(null);
    setFormErr('');
    setPedidoDetalle(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f8fafc' }}>
      {/* Sidebar */}
      <aside style={{
        width: 220, background: SIDEBAR_BG, color: 'white',
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>🏪 Mi Tienda</p>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '4px 0 0' }}>Panel de vendedor</p>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px' }}>
          {navItems.map(({ key, label, icon }) => (
            <button key={key}
              onClick={() => irA(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                padding: '10px 12px', borderRadius: 8, marginBottom: 4, border: 'none',
                background: (vista === key || (vista === 'editar' && key === 'productos') ||
                              (vista === 'nuevo' && key === 'productos') ||
                              (vista === 'detalle_pedido' && key === 'pedidos'))
                  ? ACCENT : 'transparent',
                color: 'white', cursor: 'pointer', textAlign: 'left',
                fontSize: '0.88rem', fontWeight: 500, transition: 'background 0.15s',
              }}>
              <span>{icon}</span> {label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '16px 10px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={onLogout} style={{
            width: '100%', padding: '10px', borderRadius: 8, border: 'none',
            background: 'rgba(239,68,68,0.15)', color: '#fca5a5',
            cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
          }}>
            🚪 Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido principal */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>

        {/* ── INICIO / DASHBOARD ─────────────────────────────────────────── */}
        {vista === 'inicio' && (
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 6 }}>
              Dashboard
            </h1>
            <p style={{ color: '#6b7280', marginBottom: 24, fontSize: '0.9rem' }}>
              Resumen de tu actividad como vendedor
            </p>

            {!stats ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" />
              </div>
            ) : (
              <>
                <div className="row g-3 mb-4">
                  <div className="col-6 col-md-4 col-lg-3">
                    <StatCard label="Productos activos" value={stats.productos_activos}
                      icon="📦" color={ACCENT}
                      sub={`${stats.productos_total} en total`} />
                  </div>
                  <div className="col-6 col-md-4 col-lg-3">
                    <StatCard label="Pedidos pendientes" value={stats.pedidos_pendientes}
                      icon="⏳" color={WARNING} />
                  </div>
                  <div className="col-6 col-md-4 col-lg-3">
                    <StatCard label="Pedidos entregados" value={stats.pedidos_entregados}
                      icon="✅" color={SUCCESS} />
                  </div>
                  <div className="col-6 col-md-4 col-lg-3">
                    <StatCard label="Ingresos totales"
                      value={`Bs ${(stats.ingresos_totales ?? 0).toFixed(2)}`}
                      icon="💰" color="#059669"
                      sub={`${stats.ventas_totales} unidades vendidas`} />
                  </div>
                </div>

                {stats.productos_bajo_stock > 0 && (
                  <div style={{
                    background: '#fef3c7', border: '1px solid #fbbf24',
                    borderRadius: 10, padding: '14px 18px', marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: '1.3rem' }}>⚠️</span>
                    <div>
                      <p style={{ margin: 0, fontWeight: 600, color: '#92400e' }}>
                        {stats.productos_bajo_stock} producto{stats.productos_bajo_stock > 1 ? 's' : ''} con bajo stock
                      </p>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#b45309' }}>
                        Revisa tu inventario para evitar quedarte sin existencias
                      </p>
                    </div>
                    <button className="btn btn-sm ms-auto"
                      style={{ background: '#f59e0b', color: 'white', border: 'none' }}
                      onClick={() => irA('productos')}>
                      Ver productos
                    </button>
                  </div>
                )}

                {/* Accesos rápidos */}
                <div className="row g-3">
                  <div className="col-md-6">
                    <div className="card border-0 rounded-3"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}>
                      <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Acciones rápidas</h6>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <button className="btn btn-sm text-white fw-semibold"
                          style={{ background: ACCENT, border: 'none', textAlign: 'left' }}
                          onClick={() => { setForm(FORM_VACÍO); setEditId(null); setFormErr(''); setVista('nuevo'); cargarCategorias(); }}>
                          ➕ Publicar nuevo producto
                        </button>
                        <button className="btn btn-sm btn-outline-primary fw-semibold"
                          style={{ textAlign: 'left' }}
                          onClick={() => irA('pedidos')}>
                          📋 Ver mis pedidos
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── LISTA DE PRODUCTOS ────────────────────────────────────────────── */}
        {vista === 'productos' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Mis Productos</h1>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  {totalProductos} producto{totalProductos !== 1 ? 's' : ''} en total
                </p>
              </div>
              <button className="btn text-white fw-semibold"
                style={{ background: ACCENT, border: 'none' }}
                onClick={() => { setForm(FORM_VACÍO); setEditId(null); setFormErr(''); setVista('nuevo'); cargarCategorias(); }}>
                ➕ Nuevo producto
              </button>
            </div>

            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
              <input className="form-control form-control-sm" placeholder="Buscar por nombre…"
                value={busqueda} onChange={e => setBusqueda(e.target.value)}
                style={{ maxWidth: 220 }} />
              <select className="form-select form-select-sm" style={{ maxWidth: 160 }}
                value={filtroActivo} onChange={e => setFiltroActivo(e.target.value)}>
                <option value="">Todos</option>
                <option value="true">Activos</option>
                <option value="false">Inactivos</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : productos.length === 0 ? (
              <div className="text-center py-5" style={{ color: '#9ca3af' }}>
                <p style={{ fontSize: '2rem' }}>📦</p>
                <p>No tienes productos aún. ¡Publica el primero!</p>
              </div>
            ) : (
              <>
                <div className="row g-3">
                  {productos.map(p => (
                    <div key={p.id_producto} className="col-12 col-sm-6 col-lg-4">
                      <div className="card border-0 rounded-3 h-100"
                        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', opacity: p.activo ? 1 : 0.6 }}>
                        {p.imagen_url && (
                          <img src={p.imagen_url} alt={p.nombre}
                            style={{ height: 150, objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        )}
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <p style={{ fontWeight: 600, margin: '0 0 4px', fontSize: '0.92rem', color: '#1a1a2e' }}>
                              {p.nombre}
                            </p>
                            <span style={{
                              background: p.activo ? '#d1fae5' : '#fee2e2',
                              color:      p.activo ? '#065f46' : '#991b1b',
                              borderRadius: 4, padding: '2px 7px', fontSize: '0.7rem', fontWeight: 600, whiteSpace: 'nowrap',
                            }}>
                              {p.activo ? 'Activo' : 'Inactivo'}
                            </span>
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: '2px 0 8px' }}>
                            {p.nombre_categoria}
                          </p>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                            <span style={{ fontWeight: 700, color: ACCENT }}>Bs {(p.precio_venta ?? 0).toFixed(2)}</span>
                            <span style={{ fontSize: '0.8rem', color: (p.bajo_stock ? WARNING : '#6b7280') }}>
                              {p.bajo_stock ? '⚠️' : ''} Stock: {p.stock}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-sm flex-fill"
                              style={{ border: `1px solid ${ACCENT}`, color: ACCENT, fontSize: '0.78rem' }}
                              onClick={() => iniciarEdicion(p)}>
                              ✏️ Editar
                            </button>
                            <button className="btn btn-sm"
                              style={{
                                border: `1px solid ${p.activo ? WARNING : SUCCESS}`,
                                color: p.activo ? WARNING : SUCCESS, fontSize: '0.78rem',
                              }}
                              onClick={() => toggleActivo(p)}>
                              {p.activo ? '⏸' : '▶️'}
                            </button>
                            <button className="btn btn-sm"
                              style={{ border: `1px solid ${DANGER}`, color: DANGER, fontSize: '0.78rem' }}
                              onClick={() => eliminarProducto(p)}>
                              🗑
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginación */}
                {totalProductos > 12 && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
                    <button className="btn btn-sm btn-outline-secondary"
                      disabled={pageProductos === 1}
                      onClick={() => cargarProductos(pageProductos - 1)}>← Anterior</button>
                    <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#6b7280' }}>
                      Pág. {pageProductos}
                    </span>
                    <button className="btn btn-sm btn-outline-secondary"
                      disabled={productos.length < 12}
                      onClick={() => cargarProductos(pageProductos + 1)}>Siguiente →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── FORMULARIO PRODUCTO (CREAR / EDITAR) ─────────────────────────── */}
        {(vista === 'nuevo' || vista === 'editar') && (
          <div style={{ maxWidth: 620 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => irA('productos')}>← Volver</button>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                {vista === 'nuevo' ? 'Nuevo Producto' : 'Editar Producto'}
              </h1>
            </div>

            <div className="card border-0 rounded-3"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)', padding: '28px' }}>
              {formErr && (
                <div className="alert alert-danger py-2 px-3" style={{ fontSize: '0.85rem' }}>
                  {formErr}
                </div>
              )}

              <div className="row g-3">
                <div className="col-12">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Nombre del producto *
                  </label>
                  <input className="form-control" value={form.nombre}
                    onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Ej: Camiseta deportiva azul" />
                </div>

                <div className="col-12">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Descripción
                  </label>
                  <textarea className="form-control" rows={3} value={form.descripcion}
                    onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Describe el producto…" />
                </div>

                <div className="col-6">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Precio (Bs) *
                  </label>
                  <input className="form-control" type="number" min="0.01" step="0.01"
                    value={form.precio_venta}
                    onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))}
                    placeholder="0.00" />
                </div>

                <div className="col-6">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Categoría *
                  </label>
                  <select className="form-select" value={form.id_categoria}
                    onChange={e => setForm(f => ({ ...f, id_categoria: e.target.value }))}>
                    <option value="">Seleccionar…</option>
                    {categorias.map(c => (
                      <option key={c.id_categoria} value={c.id_categoria}>
                        {c.nombre_categoria}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-6">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Stock disponible
                  </label>
                  <input className="form-control" type="number" min="0"
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    placeholder="0" />
                </div>

                <div className="col-6">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    Stock mínimo (alerta)
                  </label>
                  <input className="form-control" type="number" min="0"
                    value={form.stock_minimo}
                    onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))}
                    placeholder="5" />
                </div>

                <div className="col-12">
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                    URL de imagen
                  </label>
                  <input className="form-control" value={form.imagen_url}
                    onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))}
                    placeholder="https://…" />
                  {form.imagen_url && (
                    <img src={form.imagen_url} alt="preview"
                      style={{ height: 80, marginTop: 8, borderRadius: 6, objectFit: 'cover' }}
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  )}
                </div>

                <div className="col-12">
                  <div className="form-check">
                    <input className="form-check-input" type="checkbox" id="chkActivo"
                      checked={form.activo}
                      onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} />
                    <label className="form-check-label" htmlFor="chkActivo"
                      style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                      Visible en el catálogo
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={() => irA('productos')}>
                  Cancelar
                </button>
                <button className="btn text-white fw-semibold flex-fill"
                  style={{ background: ACCENT, border: 'none' }}
                  disabled={loading}
                  onClick={guardarProducto}>
                  {loading ? <span className="spinner-border spinner-border-sm" /> :
                    (vista === 'nuevo' ? '➕ Publicar producto' : '💾 Guardar cambios')}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── LISTA DE PEDIDOS ─────────────────────────────────────────────── */}
        {vista === 'pedidos' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <div>
                <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>Mis Pedidos</h1>
                <p style={{ color: '#6b7280', fontSize: '0.85rem', margin: '4px 0 0' }}>
                  {totalPedidos} pedido{totalPedidos !== 1 ? 's' : ''} encontrado{totalPedidos !== 1 ? 's' : ''}
                </p>
              </div>
            </div>

            {/* n10 */}
            {pedidoDetalle && (
              <div style={{ marginTop: 16, padding: 16, background: 'white', borderRadius: 10, border: '1px solid #e2e8f0' }}>
                {/* ... cabecera del detalle, tabla de items, etc... */}

                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  {/* BOTÓN NUEVO: DIBUJAR COMPROBANTE */}
                  <button 
                    className="btn btn-sm btn-outline-secondary fw-semibold"
                    onClick={() => setPedidoParaComprobante(pedidoDetalle)} // Activa el dibujo
                  >
                    📄 Ver Comprobante
                  </button>

                  {/* Tu select y botón de cambiar estado existentes */}
                  <select /* ... */ />
                  <button /* ... cambiarEstadoPedido ... */ />
                </div>
              </div>
            )}
            {/*fin n10*/}

            {/* Filtro estado */}
            <div style={{ marginBottom: 16 }}>
              <select className="form-select form-select-sm" style={{ maxWidth: 180 }}
                value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                <option value="">Todos los estados</option>
                {ESTADOS_VENDEDOR.map(e => (
                  <option key={e.value} value={e.value}>{e.label}</option>
                ))}
                <option value="cancelado">Cancelado</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : pedidos.length === 0 ? (
              <div className="text-center py-5" style={{ color: '#9ca3af' }}>
                <p style={{ fontSize: '2rem' }}>🛒</p>
                <p>No tienes pedidos{filtroEstado ? ' con ese estado' : ' aún'}.</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pedidos.map(p => (
                    <div key={p.id_pedido} className="card border-0 rounded-3"
                      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '16px 20px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                        <div style={{ flex: 1, minWidth: 200 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontWeight: 700, color: '#1a1a2e' }}>
                              Pedido #{p.id_pedido}
                            </span>
                            <EstadoBadge estado={p.estado} />
                          </div>
                          <p style={{ color: '#6b7280', fontSize: '0.78rem', margin: 0 }}>
                            {new Date(p.fecha).toLocaleDateString('es-BO', {
                              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                            })}
                          </p>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Mis ítems</p>
                          <p style={{ margin: 0, fontWeight: 700, color: ACCENT }}>
                            {p.mis_detalles.length} producto{p.mis_detalles.length !== 1 ? 's' : ''}
                          </p>
                        </div>

                        <div style={{ textAlign: 'center' }}>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>Mi subtotal</p>
                          <p style={{ margin: 0, fontWeight: 700, color: SUCCESS }}>
                            Bs {(p.subtotal_vendedor ?? 0).toFixed(2)}
                          </p>
                        </div>

                        <button className="btn btn-sm"
                          style={{ border: `1px solid ${ACCENT}`, color: ACCENT, whiteSpace: 'nowrap' }}
                          onClick={async () => {
                            await cargarDetallePedido(p.id_pedido);
                            setVista('detalle_pedido');
                          }}>
                          Ver detalle →
                        </button>
                      </div>

                      {/* Preview ítems */}
                      {p.mis_detalles.length > 0 && (
                        <div style={{
                          marginTop: 10, paddingTop: 10,
                          borderTop: '1px solid #f1f5f9', fontSize: '0.78rem', color: '#6b7280',
                        }}>
                          {p.mis_detalles.slice(0, 2).map(d => (
                            <span key={d.id_detalle} style={{ marginRight: 12 }}>
                              {d.nombre_producto} ×{d.cantidad}
                            </span>
                          ))}
                          {p.mis_detalles.length > 2 && (
                            <span style={{ color: ACCENT }}>+{p.mis_detalles.length - 2} más</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Paginación pedidos */}
                {totalPedidos > 15 && (
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 24 }}>
                    <button className="btn btn-sm btn-outline-secondary"
                      disabled={pagePedidos === 1}
                      onClick={() => cargarPedidos(pagePedidos - 1)}>← Anterior</button>
                    <span style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#6b7280' }}>
                      Pág. {pagePedidos}
                    </span>
                    <button className="btn btn-sm btn-outline-secondary"
                      disabled={pedidos.length < 15}
                      onClick={() => cargarPedidos(pagePedidos + 1)}>Siguiente →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── DETALLE DE PEDIDO ─────────────────────────────────────────────── */}
        {vista === 'detalle_pedido' && (
          <div style={{ maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <button className="btn btn-sm btn-outline-secondary"
                onClick={() => irA('pedidos')}>← Volver</button>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a1a2e', margin: 0 }}>
                Pedido #{pedidoDetalle?.id_pedido}
              </h1>
              {pedidoDetalle && <EstadoBadge estado={pedidoDetalle.estado} />}
            </div>

            {loading || !pedidoDetalle ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Info del pedido */}
                <div className="card border-0 rounded-3"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}>
                  <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Información del pedido</h6>
                  <div className="row g-2" style={{ fontSize: '0.85rem' }}>
                    <div className="col-6">
                      <span style={{ color: '#6b7280' }}>Fecha:</span><br />
                      <strong>{new Date(pedidoDetalle.fecha).toLocaleString('es-BO')}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: '#6b7280' }}>Método de pago:</span><br />
                      <strong style={{ textTransform: 'capitalize' }}>
                        {pedidoDetalle.metodo_pago ?? 'N/A'}
                        {pedidoDetalle.pago_verificado ? ' ✅' : ''}
                      </strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: '#6b7280' }}>Cliente:</span><br />
                      <strong>{pedidoDetalle.cliente_nombre ?? '—'}</strong>
                    </div>
                    <div className="col-6">
                      <span style={{ color: '#6b7280' }}>Teléfono:</span><br />
                      <strong>{pedidoDetalle.cliente_telefono || '—'}</strong>
                    </div>
                    <div className="col-12">
                      <span style={{ color: '#6b7280' }}>Dirección de entrega:</span><br />
                      <strong>{pedidoDetalle.direccion_entrega}</strong>
                    </div>
                    {pedidoDetalle.notas && (
                      <div className="col-12">
                        <span style={{ color: '#6b7280' }}>Notas:</span><br />
                        <span style={{ fontStyle: 'italic' }}>{pedidoDetalle.notas}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Mis ítems en este pedido */}
                <div className="card border-0 rounded-3"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}>
                  <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Mis productos en este pedido</h6>
                  <table className="table table-sm mb-0" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ color: '#6b7280' }}>
                        <th>Producto</th>
                        <th className="text-center">Cant.</th>
                        <th className="text-end">Precio</th>
                        <th className="text-end">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidoDetalle.mis_detalles.map(d => (
                        <tr key={d.id_detalle}>
                          <td>{d.nombre_producto}</td>
                          <td className="text-center">{d.cantidad}</td>
                          <td className="text-end">Bs {(d.precio_unitario ?? 0).toFixed(2)}</td>
                          <td className="text-end" style={{ fontWeight: 600 }}>
                            Bs {(d.subtotal ?? 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} style={{ fontWeight: 700, textAlign: 'right', color: '#374151' }}>
                          Mi subtotal:
                        </td>
                        <td style={{ fontWeight: 800, color: SUCCESS, textAlign: 'right' }}>
                          Bs {(pedidoDetalle.subtotal_vendedor ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Cambiar estado */}
                {pedidoDetalle.estado !== 'cancelado' && (
                  <div className="card border-0 rounded-3"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}>
                    <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Actualizar estado del pedido</h6>
                    {/* n10 */}
                    <button 
                        className="btn btn-sm btn-outline-primary fw-bold px-3"
                        onClick={() => setPedidoParaComprobante(pedidoDetalle)}
                        type="button"
                      >
                        📄 Ver Comprobante
                    </button>
                    <div className="row g-2">
                      <div className="col-md-5">
                        <select className="form-select form-select-sm"
                          value={nuevoEstado}
                          onChange={e => setNuevoEstado(e.target.value)}>
                          {ESTADOS_VENDEDOR.map(e => (
                            <option key={e.value} value={e.value}>{e.label}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-5">
                        <input className="form-control form-control-sm"
                          placeholder="Comentario (opcional)"
                          value={comentarioEstado}
                          onChange={e => setComentarioEstado(e.target.value)} />
                      </div>
                      <div className="col-md-2">
                        <button className="btn btn-sm w-100 text-white fw-semibold"
                          style={{ background: ACCENT, border: 'none' }}
                          disabled={loading || nuevoEstado === pedidoDetalle.estado}
                          onClick={cambiarEstadoPedido}>
                          {loading ? <span className="spinner-border spinner-border-sm" /> : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Historial */}
                {pedidoDetalle.historial && pedidoDetalle.historial.length > 0 && (
                  <div className="card border-0 rounded-3"
                    style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.08)', padding: '20px' }}>
                    <h6 style={{ fontWeight: 700, marginBottom: 12 }}>Historial de estados</h6>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {pedidoDetalle.historial.map((h, i) => (
                        <div key={i} style={{
                          display: 'flex', gap: 10, alignItems: 'flex-start',
                          fontSize: '0.82rem', padding: '8px 0',
                          borderBottom: i < pedidoDetalle.historial!.length - 1 ? '1px solid #f1f5f9' : 'none',
                        }}>
                          <span style={{ color: '#9ca3af', whiteSpace: 'nowrap' }}>
                            {new Date(h.fecha).toLocaleString('es-BO', {
                              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                            })}
                          </span>
                          <div>
                            <span style={{ color: '#374151' }}>
                              {h.estado_anterior && <>{h.estado_anterior} → </>}
                              <strong>{h.estado_nuevo}</strong>
                            </span>
                            {h.comentario && (
                              <p style={{ color: '#6b7280', margin: '2px 0 0', fontStyle: 'italic' }}>
                                {h.comentario}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PERFIL ───────────────────────────────────────────────────────── */}
        {vista === 'perfil' && (
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 20 }}>
              Mi Perfil
            </h1>

            {!perfil ? (
              <div className="text-center py-5"><div className="spinner-border text-primary" /></div>
            ) : (
              <>
                <div className="card border-0 rounded-3"
                  style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.1)', padding: '28px' }}>
                  {/* Avatar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: ACCENT, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', fontWeight: 700,
                    }}>
                      {perfil.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontWeight: 700, margin: 0, color: '#1a1a2e' }}>{perfil.nombre}</p>
                      <p style={{ color: '#6b7280', fontSize: '0.82rem', margin: 0 }}>{perfil.nombre_rol}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                        Email
                      </label>
                      <p style={{ margin: 0, color: '#1a1a2e', fontWeight: 500 }}>{perfil.email}</p>
                    </div>

                    <div>
                      <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: 5 }}>
                        Nombre / Nombre de tienda
                      </label>
                      <input className="form-control" value={perfilNombre}
                        onChange={e => setPerfilNombre(e.target.value)} />
                    </div>

                    <div style={{ display: 'flex', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                          Productos activos
                        </label>
                        <p style={{ margin: 0, fontWeight: 700, color: ACCENT, fontSize: '1.2rem' }}>
                          {perfil.productos_activos}
                        </p>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', display: 'block', marginBottom: 4 }}>
                          Último acceso
                        </label>
                        <p style={{ margin: 0, fontSize: '0.82rem', color: '#374151' }}>
                          {perfil.ultimo_login
                            ? new Date(perfil.ultimo_login).toLocaleDateString('es-BO')
                            : 'Nunca'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <button className="btn text-white fw-semibold w-100"
                    style={{ background: ACCENT, border: 'none' }}
                    disabled={loading}
                    onClick={guardarPerfil}>
                    {loading ? <span className="spinner-border spinner-border-sm" /> : '💾 Guardar cambios'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

      </main>

      //n10
      <ComprobanteVisual 
        pedido={pedidoParaComprobante} 
        onClose={() => setPedidoParaComprobante(null)} 
      />

      {/* Notificaciones y modales globales */}
      {toast    && <Toast    msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      {confirm  && <ConfirmModal mensaje={confirm.msg} onConfirm={confirm.fn} onCancel={() => setConfirm(null)} />}
    </div>
  );
}
