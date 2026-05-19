import apiClient from './client';
import type { CarritoResponse } from '../types';

export const carritoApi = {
  obtener: () =>
    apiClient.get<CarritoResponse>('/cliente/carrito'),

  agregar: (id_producto: number, cantidad = 1) =>
    apiClient.post('/cliente/carrito', { id_producto, cantidad }),

  actualizar: (id_carrito: number, cantidad: number) =>
    apiClient.put(`/cliente/carrito/${id_carrito}`, { cantidad }),

  eliminar: (id_carrito: number) =>
    apiClient.delete(`/cliente/carrito/${id_carrito}`),

  vaciar: () =>
    apiClient.delete('/cliente/carrito'),
};
