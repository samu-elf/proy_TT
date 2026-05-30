import apiClient from './client';
import { adminRequest } from './client';
import type { CrearPedidoResponse, Pedido, PaginatedResponse } from '../types';

const BASE = (import.meta.env.VITE_API_BASE_URL as string) ?? '';

/** Descarga/abre un PDF autenticado con el token indicado. */
function _abrirPdf(url: string, token: string, filename: string) {
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => { if (!r.ok) throw new Error(`Error ${r.status}`); return r.blob(); })
    .then(blob => {
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u; a.target = '_blank'; a.download = filename;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 30_000);
    })
    .catch(e => alert(`No se pudo generar el PDF: ${(e as Error).message}`));
}

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

  /** Sube la imagen del comprobante de pago del cliente */
  subirComprobante: (pedidoId: number, archivo: File): Promise<{ url: string }> => {
    const form = new FormData();
    form.append('comprobante', archivo);
    const token = localStorage.getItem('cliente_token') ?? '';
    return fetch(`${BASE}/cliente/pedidos/${pedidoId}/comprobante`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }).then(async r => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `Error ${r.status}`);
      }
      return r.json();
    });
  },

  /** Descarga el comprobante de pedido PDF para el cliente */
  descargarComprobantePdf: (pedidoId: number) => {
    const token = localStorage.getItem('cliente_token') ?? '';
    _abrirPdf(`${BASE}/cliente/reportes/comprobante/${pedidoId}`, token, `comprobante_pedido_${pedidoId}.pdf`);
  },

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
