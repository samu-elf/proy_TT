/**
 * vendedor.ts — Cliente API del módulo Vendedor
 *
 * Todos los métodos usan adminRequest() para inyectar el admin_token
 * automáticamente (igual que el resto de endpoints protegidos).
 */
import { adminRequest } from './client';
import type { Producto, PaginatedResponse } from '../types';

// ─── Tipos específicos del vendedor ──────────────────────────────────────────

export interface DashboardVendedorData {
  productos_activos:      number;
  productos_total:        number;
  pedidos_pendientes:     number;
  pedidos_entregados:     number;
  ingresos_totales:       number;
  ventas_totales:         number;
  productos_bajo_stock:   number;
}

export interface DetallePedidoVendedor {
  id_detalle:      number;
  id_producto:     number;
  nombre_producto: string;
  cantidad:        number;
  precio_unitario: number;
  subtotal:        number;
}

export interface PedidoVendedor {
  id_pedido:          number;
  total:              number;
  estado:             string;
  direccion_entrega:  string;
  notas?:             string;
  metodo_pago?:       string;
  pago_verificado?:   boolean;
  codigo_seguimiento?:string;
  fecha:              string;
  actualizado?:       string;
  // Ítems filtrados solo del vendedor
  mis_detalles:       DetallePedidoVendedor[];
  subtotal_vendedor:  number;
  // Todos los ítems (solo en detalle)
  detalles?:          DetallePedidoVendedor[];
  historial?:         { estado_anterior?: string; estado_nuevo: string; comentario?: string; fecha: string }[];
  // Info del cliente (solo en detalle)
  cliente_nombre?:    string;
  cliente_email?:     string;
  cliente_telefono?:  string;
}

export interface PerfilVendedor {
  id_usuario:       number;
  nombre:           string;
  email:            string;
  id_rol:           number;
  nombre_rol:       string;
  activo:           boolean;
  ultimo_login?:    string;
  creado:           string;
  total_productos:  number;
  productos_activos:number;
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const vendedorApi = {
  // Dashboard
  dashboard: () =>
    adminRequest<DashboardVendedorData>({ method: 'GET', url: '/vendedor/dashboard' }),

  // Productos propios
  misProductos: (params?: { q?: string; activo?: string; page?: number; per_page?: number }) =>
    adminRequest<PaginatedResponse<Producto>>({ method: 'GET', url: '/vendedor/productos', params }),

  // Pedidos con sus ítems
  misPedidos: (params?: { estado?: string; page?: number; per_page?: number }) =>
    adminRequest<PaginatedResponse<PedidoVendedor>>({ method: 'GET', url: '/vendedor/pedidos', params }),

  detallePedido: (id: number) =>
    adminRequest<PedidoVendedor>({ method: 'GET', url: `/vendedor/pedidos/${id}` }),

  actualizarEstadoPedido: (id: number, estado: string, comentario?: string) =>
    adminRequest<{ mensaje: string; estado: string }>({
      method: 'PATCH',
      url:    `/vendedor/pedidos/${id}/estado`,
      data:   { estado, comentario },
    }),

  // Perfil
  perfil: () =>
    adminRequest<PerfilVendedor>({ method: 'GET', url: '/vendedor/perfil' }),

  actualizarPerfil: (data: { nombre?: string }) =>
    adminRequest<{ mensaje: string; usuario: PerfilVendedor }>({
      method: 'PUT',
      url:    '/vendedor/perfil',
      data,
    }),
};


// ─── Helpers internos de descarga PDF ────────────────────────────────────────

function _abrirPdfVendedor(ruta: string, nombreArchivo: string): void {
  const token   = localStorage.getItem('admin_token') ?? '';
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:5000';
  fetch(`${baseUrl}${ruta}`, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (!r.ok) throw new Error(`Error ${r.status} al generar el PDF`);
      return r.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.target  = '_blank';
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    })
    .catch(err => alert(`No se pudo generar el PDF: ${(err as Error).message}`));
}

// ─── Reportes PDF del Vendedor ────────────────────────────────────────────────

export const reportesVendedorApi = {
  /**
   * Descarga la factura/comprobante de venta de un pedido específico.
   * Detonante: pago verificado por el admin.
   */
  descargarFacturaPedido(pedidoId: number): void {
    _abrirPdfVendedor(
      `/vendedor/reportes/factura/${pedidoId}`,
      `factura_pedido_${pedidoId}.pdf`,
    );
  },

  /**
   * Genera bajo demanda el reporte de inventario con alertas de stock.
   */
  descargarInventario(): void {
    const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    _abrirPdfVendedor('/vendedor/reportes/inventario', `inventario_${hoy}.pdf`);
  },
};
