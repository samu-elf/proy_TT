import { adminRequest } from './client';
import type { UsuarioInterno, PaginatedResponse } from '../types';

export const usuariosApi = {
  listar: (params?: { page?: number }) =>
    adminRequest({ method: 'GET', url: '/admin/usuarios', params }),

  crear: (data: {
    nombre: string;
    email: string;
    password: string;
    id_rol: number;
  }) => adminRequest({ method: 'POST', url: '/admin/usuarios', data }),

  actualizar: (id: number, data: Partial<UsuarioInterno & { password?: string }>) =>
    adminRequest({ method: 'PUT', url: `/admin/usuarios/${id}`, data }),

  desactivar: (id: number) =>
    adminRequest({ method: 'DELETE', url: `/admin/usuarios/${id}` }),
};

export const clientesAdminApi = {
  listar: (params?: { page?: number }) =>
    adminRequest({ method: 'GET', url: '/admin/clientes', params }),

  crear: (data: {
    nombre: string;
    email: string;
    password?: string;
    telefono?: string;
  }) => adminRequest({ method: 'POST', url: '/admin/clientes', data }),

  actualizar: (id: number, data: { nombre?: string; telefono?: string; activo?: boolean; password?: string }) =>
    adminRequest({ method: 'PUT', url: `/admin/clientes/${id}`, data }),

  desactivar: (id: number) =>
    adminRequest({ method: 'DELETE', url: `/admin/clientes/${id}` }),
};
