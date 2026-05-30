"""
Modelos SQLAlchemy de Chukuta Express.
Incluye auditoría, relaciones completas e índices de rendimiento.
"""
import datetime
from app import db


# ─── Mixin de Auditoría ──────────────────────────────────────────────────────

class TimestampMixin:
    created_at = db.Column(
        db.DateTime, default=datetime.datetime.utcnow, nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
        nullable=False,
    )


# ─── Enums de estado ─────────────────────────────────────────────────────────

class EstadoPedido:
    PENDIENTE = "pendiente"
    CONFIRMADO = "confirmado"
    EN_PREPARACION = "en_preparacion"
    EN_CAMINO = "en_camino"
    ENTREGADO = "entregado"
    CANCELADO = "cancelado"

    TODOS = [
        PENDIENTE, CONFIRMADO, EN_PREPARACION,
        EN_CAMINO, ENTREGADO, CANCELADO,
    ]


class RolUsuario:
    VENDEDOR = 1
    ADMIN = 2
    OPERADOR = 3

    NOMBRES = {1: "Vendedor", 2: "Administrador", 3: "Operador Logístico"}


# ─── Modelos ─────────────────────────────────────────────────────────────────

class Rol(db.Model):
    """Tabla de roles del sistema."""
    __tablename__ = "rol"

    id_rol = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(50), unique=True, nullable=False)
    descripcion = db.Column(db.String(200))

    def to_dict(self):
        return {"id_rol": self.id_rol, "nombre": self.nombre}


class Usuario(db.Model, TimestampMixin):
    """Usuarios internos: Vendedores, Admins y Operadores Logísticos."""
    __tablename__ = "usuario"

    id_usuario = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    id_rol = db.Column(db.Integer, db.ForeignKey("rol.id_rol"), nullable=False)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    ultimo_login = db.Column(db.DateTime)

    rol = db.relationship("Rol", backref="usuarios")
    productos = db.relationship(
        "Producto", backref="vendedor", lazy="dynamic", foreign_keys="Producto.id_vendedor"
    )
    logs = db.relationship("AuditoriaLog", backref="usuario", lazy=True)

    __table_args__ = (
        db.Index("ix_usuario_email_activo", "email", "activo"),
    )

    def to_dict(self):
        return {
            "id_usuario": self.id_usuario,
            "nombre": self.nombre,
            "email": self.email,
            "id_rol": self.id_rol,
            "nombre_rol": RolUsuario.NOMBRES.get(self.id_rol, "Desconocido"),
            "activo": self.activo,
            "ultimo_login": self.ultimo_login.isoformat() if self.ultimo_login else None,
            "creado": self.created_at.isoformat(),
        }


class Cliente(db.Model, TimestampMixin):
    """Clientes finales del e-commerce."""
    __tablename__ = "cliente"

    id_cliente = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(20))
    direccion_defecto = db.Column(db.Text)
    activo = db.Column(db.Boolean, default=True, nullable=False)
    verificado = db.Column(db.Boolean, default=False, nullable=False)

    carrito_items = db.relationship(
        "CarritoItem", backref="cliente", lazy=True, cascade="all, delete-orphan"
    )
    pedidos = db.relationship("Pedido", backref="cliente", lazy=True)

    def to_dict(self):
        return {
            "id": self.id_cliente,
            "nombre": self.nombre,
            "email": self.email,
            "telefono": self.telefono,
            "direccion_defecto": self.direccion_defecto,
            "verificado": self.verificado,
            "activo": self.activo,
            "creado": self.created_at.isoformat(),
        }


class Categoria(db.Model):
    """Categorías de productos."""
    __tablename__ = "categoria"

    id_categoria = db.Column(db.Integer, primary_key=True)
    nombre_categoria = db.Column(db.String(100), unique=True, nullable=False)
    descripcion = db.Column(db.Text)
    activa = db.Column(db.Boolean, default=True, nullable=False)

    productos = db.relationship("Producto", backref="categoria_rel", lazy=True)

    def to_dict(self):
        return {
            "id_categoria": self.id_categoria,
            "nombre_categoria": self.nombre_categoria,
            "descripcion": self.descripcion,
        }


class Producto(db.Model, TimestampMixin):
    """Productos en el almacén (inventario)."""
    __tablename__ = "almacen"

    id_producto = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(200), nullable=False)
    descripcion = db.Column(db.Text, default="")
    codigo = db.Column(db.String(50), unique=True)
    stock = db.Column(db.Integer, default=0, nullable=False)
    stock_minimo = db.Column(db.Integer, default=5, nullable=False)
    precio_venta = db.Column(db.Numeric(10, 2), nullable=False)
    precio_costo = db.Column(db.Numeric(10, 2))
    id_categoria = db.Column(
        db.Integer, db.ForeignKey("categoria.id_categoria"), nullable=False
    )
    id_vendedor = db.Column(
        db.Integer, db.ForeignKey("usuario.id_usuario"), nullable=True
    )
    activo = db.Column(db.Boolean, default=True, nullable=False)
    imagen_url = db.Column(db.String(500))

    __table_args__ = (
        db.Index("ix_producto_categoria_activo", "id_categoria", "activo"),
        db.Index("ix_producto_stock", "stock"),
        db.CheckConstraint("stock >= 0", name="ck_stock_no_negativo"),
        db.CheckConstraint("precio_venta > 0", name="ck_precio_positivo"),
    )

    def to_dict(self):
        return {
            "id_producto": self.id_producto,
            "nombre": self.nombre,
            "descripcion": self.descripcion,
            "codigo": self.codigo,
            "stock": self.stock,
            "stock_minimo": self.stock_minimo,
            "bajo_stock": self.stock <= self.stock_minimo,
            "precio_venta": float(self.precio_venta),
            "id_categoria": self.id_categoria,
            "nombre_categoria": (
                self.categoria_rel.nombre_categoria if self.categoria_rel else None
            ),
            "id_vendedor": self.id_vendedor,
            "activo": self.activo,
            "imagen_url": self.imagen_url,
        }


class CarritoItem(db.Model):
    """Ítems en el carrito de compras de un cliente."""
    __tablename__ = "carrito"

    id_carrito = db.Column(db.Integer, primary_key=True)
    id_cliente = db.Column(
        db.Integer, db.ForeignKey("cliente.id_cliente"), nullable=False
    )
    id_producto = db.Column(
        db.Integer, db.ForeignKey("almacen.id_producto"), nullable=False
    )
    cantidad = db.Column(db.Integer, default=1, nullable=False)
    agregado_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    producto = db.relationship("Producto", backref="carrito_items")

    __table_args__ = (
        db.UniqueConstraint(
            "id_cliente", "id_producto", name="uq_carrito_cliente_producto"
        ),
        db.CheckConstraint("cantidad > 0", name="ck_carrito_cantidad_positiva"),
    )


class Pedido(db.Model, TimestampMixin):
    """Pedidos realizados por clientes."""
    __tablename__ = "pedido"

    id_pedido = db.Column(db.Integer, primary_key=True)
    id_cliente = db.Column(
        db.Integer, db.ForeignKey("cliente.id_cliente"), nullable=False
    )
    total = db.Column(db.Numeric(10, 2), nullable=False)
    estado = db.Column(
        db.String(30), default=EstadoPedido.PENDIENTE, nullable=False
    )
    direccion_entrega = db.Column(db.Text, nullable=False)
    notas = db.Column(db.Text)

    # Datos de pago
    metodo_pago = db.Column(db.String(50), default="pendiente")
    referencia_pago = db.Column(db.String(100))
    pago_verificado = db.Column(db.Boolean, default=False)
    pago_verificado_por = db.Column(db.Integer, db.ForeignKey("usuario.id_usuario"))
    pago_verificado_at = db.Column(db.DateTime)

    # Comprobante de pago (imagen subida por el cliente)
    comprobante_pago_url = db.Column(db.String(500))   # ruta relativa o URL

    # Tracking logístico
    operador_id = db.Column(db.Integer, db.ForeignKey("usuario.id_usuario"))
    codigo_seguimiento = db.Column(db.String(50))

    detalles = db.relationship(
        "DetallePedido", backref="pedido", lazy=True, cascade="all, delete-orphan"
    )
    historial = db.relationship(
        "HistorialPedido", backref="pedido", lazy=True, order_by="HistorialPedido.creado_at"
    )

    __table_args__ = (
        db.Index("ix_pedido_cliente_estado", "id_cliente", "estado"),
        db.Index("ix_pedido_estado", "estado"),
    )

    def to_dict(self, include_detalles=False):
        data = {
            "id_pedido": self.id_pedido,
            "id_cliente": self.id_cliente,
            "total": float(self.total),
            "estado": self.estado,
            "direccion_entrega": self.direccion_entrega,
            "notas": self.notas,
            "metodo_pago": self.metodo_pago,
            "pago_verificado": self.pago_verificado,
            "codigo_seguimiento": self.codigo_seguimiento,
            "comprobante_pago_url": self.comprobante_pago_url,
            "fecha": self.created_at.isoformat(),
            "actualizado": self.updated_at.isoformat(),
        }
        if include_detalles:
            data["detalles"] = [d.to_dict() for d in self.detalles]
            data["historial"] = [h.to_dict() for h in self.historial]
        return data


class DetallePedido(db.Model):
    """Líneas de producto dentro de un pedido."""
    __tablename__ = "detalle_pedido"

    id_detalle = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(
        db.Integer, db.ForeignKey("pedido.id_pedido"), nullable=False
    )
    id_producto = db.Column(
        db.Integer, db.ForeignKey("almacen.id_producto"), nullable=False
    )
    cantidad = db.Column(db.Integer, nullable=False)
    precio_unitario = db.Column(db.Numeric(10, 2), nullable=False)

    producto = db.relationship("Producto")

    def to_dict(self):
        return {
            "id_detalle": self.id_detalle,
            "id_producto": self.id_producto,
            "nombre_producto": (
                self.producto.nombre if self.producto else None
            ),
            "cantidad": self.cantidad,
            "precio_unitario": float(self.precio_unitario),
            "subtotal": float(self.precio_unitario) * self.cantidad,
        }


class HistorialPedido(db.Model):
    """Historial de cambios de estado de un pedido."""
    __tablename__ = "historial_pedido"

    id_historial = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(
        db.Integer, db.ForeignKey("pedido.id_pedido"), nullable=False
    )
    estado_anterior = db.Column(db.String(30))
    estado_nuevo = db.Column(db.String(30), nullable=False)
    comentario = db.Column(db.Text)
    cambiado_por = db.Column(db.Integer, db.ForeignKey("usuario.id_usuario"))
    creado_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    def to_dict(self):
        return {
            "estado_anterior": self.estado_anterior,
            "estado_nuevo": self.estado_nuevo,
            "comentario": self.comentario,
            "fecha": self.creado_at.isoformat(),
        }


class AuditoriaLog(db.Model):
    """Log de auditoría del sistema."""
    __tablename__ = "auditoria_log"

    id_log = db.Column(db.Integer, primary_key=True)
    tabla = db.Column(db.String(50), nullable=False)
    accion = db.Column(db.String(20), nullable=False)  # CREATE, UPDATE, DELETE
    id_registro = db.Column(db.Integer)
    datos_anteriores = db.Column(db.Text)
    datos_nuevos = db.Column(db.Text)
    id_usuario = db.Column(db.Integer, db.ForeignKey("usuario.id_usuario"))
    id_cliente = db.Column(db.Integer, db.ForeignKey("cliente.id_cliente"))
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(200))
    creado_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    __table_args__ = (
        db.Index("ix_auditoria_tabla_accion", "tabla", "accion"),
        db.Index("ix_auditoria_usuario", "id_usuario"),
    )


class MovimientoInventario(db.Model):
    """Historial de movimientos de inventario."""
    __tablename__ = "movimiento_inventario"

    id_movimiento = db.Column(db.Integer, primary_key=True)
    id_producto = db.Column(
        db.Integer, db.ForeignKey("almacen.id_producto"), nullable=False
    )
    tipo = db.Column(db.String(20), nullable=False)  # entrada, salida, ajuste
    cantidad = db.Column(db.Integer, nullable=False)
    stock_anterior = db.Column(db.Integer, nullable=False)
    stock_nuevo = db.Column(db.Integer, nullable=False)
    motivo = db.Column(db.String(200))
    id_pedido = db.Column(db.Integer, db.ForeignKey("pedido.id_pedido"))
    id_usuario = db.Column(db.Integer, db.ForeignKey("usuario.id_usuario"))
    creado_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

    producto = db.relationship("Producto")

    def to_dict(self):
        return {
            "id_movimiento": self.id_movimiento,
            "id_producto": self.id_producto,
            "nombre_producto": self.producto.nombre if self.producto else None,
            "tipo": self.tipo,
            "cantidad": self.cantidad,
            "stock_anterior": self.stock_anterior,
            "stock_nuevo": self.stock_nuevo,
            "motivo": self.motivo,
            "fecha": self.creado_at.isoformat(),
        }
