// ─── Usuarios ─────────────────────────────────────────────────────────────────

export interface ClienteData {
  id: number;
  nombre: string;
  email: string;
  telefono?: string;
  direccion_defecto?: string;
  verificado?: boolean;
}

export interface UsuarioInterno {
  id: number;
  nombre: string;
  email: string;
  id_rol: number;
  nombre_rol: string;
  activo: boolean;
  ultimo_login?: string;
  creado: string;
}

// ─── Catálogo ────────────────────────────────────────────────────────────────

export interface Producto {
  id_producto: number;
  nombre: string;
  descripcion?: string;
  codigo?: string;
  stock: number;
  stock_minimo?: number;
  bajo_stock?: boolean;
  precio_venta: number;
  id_categoria?: number;
  nombre_categoria: string;
  id_vendedor?: number;
  activo?: boolean;
  imagen_url?: string;
}

export interface Categoria {
  id_categoria: number;
  nombre_categoria: string;
  descripcion?: string;
}

// ─── Carrito ─────────────────────────────────────────────────────────────────

export interface CarritoItem {
  id_carrito: number;
  id_producto: number;
  nombre: string;
  precio_venta: number;
  cantidad: number;
  subtotal: number;
  stock_disponible: number;
  sin_stock?: boolean;
}

export interface CarritoResponse {
  items: CarritoItem[];
  total: number;
  cantidad_items: number;
}

// ─── Pedidos ─────────────────────────────────────────────────────────────────

export type EstadoPedido =
  | 'pendiente'
  | 'confirmado'
  | 'en_preparacion'
  | 'en_camino'
  | 'entregado'
  | 'cancelado';

export interface DetallePedido {
  id_detalle: number;
  id_producto: number;
  nombre_producto?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface HistorialPedido {
  estado_anterior?: string;
  estado_nuevo: string;
  comentario?: string;
  fecha: string;
}

export interface Pedido {
  id_pedido: number;
  id_cliente?: number;
  total: number;
  estado: EstadoPedido;
  direccion_entrega: string;
  notas?: string;
  metodo_pago?: string;
  pago_verificado?: boolean;
  codigo_seguimiento?: string;
  fecha: string;
  actualizado?: string;
  detalles?: DetallePedido[];
  historial?: HistorialPedido[];
}

// ─── Respuestas de API ────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pages: number;
  has_next?: boolean;
  has_prev?: boolean;
}

export interface LoginClienteResponse {
  token: string;
  cliente: ClienteData;
}

export interface LoginUsuarioResponse {
  token: string;
  usuario: {
    id: number;
    nombre: string;
    rol: number;
    nombre_rol: string;
  };
}

export interface CrearPedidoResponse {
  id_pedido: number;
  total: number;
  codigo_seguimiento: string;
  estado: EstadoPedido;
}

// ─── UI ──────────────────────────────────────────────────────────────────────

export type AlertType = 'success' | 'danger' | 'warning' | 'info';
