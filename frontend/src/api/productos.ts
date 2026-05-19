import apiClient, { adminRequest } from './client';
import type { Producto, Categoria, PaginatedResponse } from '../types';

export const productosApi = {
  // ── Públicos ────────────────────────────────────────────────────────────
  listar: (params?: { q?: string; categoria?: string; page?: number; per_page?: number }) =>
    apiClient.get<PaginatedResponse<Producto>>('/productos', { params }),

  obtener: (id: number) =>
    apiClient.get<Producto>(`/productos/${id}`),

  categorias: () =>
    apiClient.get<Categoria[]>('/productos/categorias'),

  // ── Vendedor / Admin ────────────────────────────────────────────────────
  listarTodos: (params?: { page?: number; per_page?: number }) =>
    adminRequest({ method: 'GET', url: '/productos/admin/todos', params }),

  crear: (data: Partial<Producto> & { activo?: boolean }) =>
    adminRequest({ method: 'POST', url: '/productos', data }),

  actualizar: (id: number, data: Partial<Producto> & { activo?: boolean }) =>
    adminRequest({ method: 'PUT', url: `/productos/${id}`, data }),

  eliminar: (id: number) =>
    adminRequest({ method: 'DELETE', url: `/productos/${id}` }),

  ajustarStock: (id: number, stock: number, motivo?: string) =>
    adminRequest({ method: 'PATCH', url: `/productos/${id}/stock`, data: { stock, motivo } }),

  crearCategoria: (nombre: string, descripcion?: string) =>
    adminRequest({ method: 'POST', url: '/productos/categorias', data: { nombre, descripcion } }),
};
