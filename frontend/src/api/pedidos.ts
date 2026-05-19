import apiClient from './client';
import { adminRequest } from './client';
import type { CrearPedidoResponse, Pedido, PaginatedResponse } from '../types';

export const pedidosApi = {
  // ── Cliente ──────────────────────────────────────────────────────────────
  crear: (data: { direccion: string; metodo_pago?: string; notas?: string }) =>
    apiClient.post<CrearPedidoResponse>('/cliente/pedido', data),

  // Listado resumido (sin detalles de líneas)
  listar: (params?: { page?: number }) =>
    apiClient.get<PaginatedResponse<Pedido>>('/cliente/pedidos', { params }),

  detalle: (id: number) =>
    apiClient.get<Pedido>(`/cliente/pedidos/${id}`),

  // Historial completo con detalles de líneas (nuevo endpoint cliente_ext)
  historial: (params?: { page?: number; estado?: string }) =>
    apiClient.get<PaginatedResponse<Pedido>>('/cliente/mis-pedidos', { params }),

  detalleCompleto: (id: number) =>
    apiClient.get<Pedido>(`/cliente/mis-pedidos/${id}`),

  // ── Admin / Operador ─────────────────────────────────────────────────────
  listarAdmin: (params?: { estado?: string; page?: number }) =>
    adminRequest({ method: 'GET', url: '/admin/pedidos', params }),

  cambiarEstado: (id: number, estado: string, comentario?: string) =>
    adminRequest({
      method: 'PATCH',
      url:    `/admin/pedidos/${id}/estado`,
      data:   { estado, comentario },
    }),

  verificarPago: (id: number, referencia?: string) =>
    adminRequest({
      method: 'PATCH',
      url:    `/admin/pedidos/${id}/verificar-pago`,
      data:   { referencia },
    }),

  reporteResumen: () =>
    adminRequest({ method: 'GET', url: '/admin/reportes/resumen' }),
};
