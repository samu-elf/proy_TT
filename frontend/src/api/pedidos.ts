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

  descargarRecibo: async (pedidoId: number, customFilename?: string, customTitulo?: string): Promise<void> => {
    const token = localStorage.getItem('cliente_token');
    const baseUrl = `${import.meta.env.VITE_API_BASE_URL ?? ''}/cliente/mis-pedidos/${pedidoId}/recibo`;
    const urlWithParams = customTitulo ? `${baseUrl}?titulo=${encodeURIComponent(customTitulo)}` : baseUrl;
    
    const response = await fetch(urlWithParams, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('No se pudo descargar el recibo');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = customFilename || `recibo_chukuta_${pedidoId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
};