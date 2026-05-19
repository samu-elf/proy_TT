import apiClient from './client';
import type { ClienteData } from '../types';

export const clienteApi = {
  perfil: () =>
    apiClient.get<ClienteData>('/cliente/perfil'),

  actualizarPerfil: (data: { nombre?: string; telefono?: string; direccion_defecto?: string }) =>
    apiClient.put<{ mensaje: string; cliente: ClienteData }>('/cliente/perfil', data),
};
