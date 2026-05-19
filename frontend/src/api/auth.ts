import apiClient from './client';
import type { LoginClienteResponse, LoginUsuarioResponse } from '../types';

export const authApi = {
  loginCliente: (email: string, password: string) =>
    apiClient.post<LoginClienteResponse>('/auth/cliente/login', { email, password }),

  registroCliente: (data: {
    nombre: string;
    email: string;
    password: string;
    telefono?: string;
    direccion?: string;
  }) => apiClient.post<LoginClienteResponse>('/auth/cliente/registro', data),

  loginUsuario: (email: string, password: string) =>
    apiClient.post<LoginUsuarioResponse>('/auth/login', { email, password }),

  logoutCliente: () => apiClient.post('/auth/cliente/logout'),
};
