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
