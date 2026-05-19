/**
 * client.ts — Cliente HTTP centralizado
 *
 * Responsabilidades:
 * - Inyectar Authorization header según tipo de ruta
 * - Normalizar errores del servidor en mensajes legibles
 * - Detectar 401 en rutas admin y limpiar sesión automáticamente
 * - adminRequest(): helper que inyecta admin_token sin depender de la URL
 */
import axios, { type AxiosRequestConfig } from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

// ─── Request interceptor: inyección de tokens ─────────────────────────────────
apiClient.interceptors.request.use((config) => {
  const url = config.url ?? '';
  // Incluir /productos/admin porque ese prefijo no empieza con /admin/
  // pero requiere autenticación de usuario interno (vendedor/admin).
  if (url.startsWith('/admin/') || url.startsWith('/productos/admin') || url.startsWith('/vendedor/')) {
    const t = localStorage.getItem('admin_token');
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } else if (url.startsWith('/cliente/') || url.startsWith('/carrito')) {
    const t = localStorage.getItem('cliente_token');
    if (t) config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// ─── Response interceptor: normalización de errores ──────────────────────────
apiClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.code === 'ECONNABORTED')
      return Promise.reject(new Error('La solicitud tardó demasiado. Verifica tu conexión.'));

    const status    = error.response?.status;
    const serverMsg = error.response?.data?.error ?? error.response?.data?.mensaje ?? null;

    // Token admin expirado → limpiar y recargar para forzar re-login
    const reqUrl = error.config?.url ?? '';
    if (status === 401 && (reqUrl.startsWith('/admin/') || reqUrl.startsWith('/vendedor/'))) {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.reload();
    }

    const msg =
      serverMsg ??
      { 400: 'Datos inválidos.', 401: 'Sesión expirada.', 403: 'Sin permiso.',
        404: 'Recurso no encontrado.', 409: 'Conflicto con datos existentes.',
        429: 'Demasiadas solicitudes.', 500: 'Error interno del servidor.' }[status as number] ??
      'Error de conexión con el servidor.';

    return Promise.reject(new Error(msg));
  },
);

/**
 * adminRequest — siempre inyecta admin_token.
 * Usar para todas las llamadas a endpoints que requieren autenticación de admin/vendedor.
 */
export function adminRequest<T = unknown>(config: AxiosRequestConfig) {
  const token = localStorage.getItem('admin_token');
  return apiClient<T>({
    ...config,
    headers: {
      ...config.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export default apiClient;
