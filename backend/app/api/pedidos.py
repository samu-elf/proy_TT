"""
Blueprint de pedidos.
CORRECCIÓN: Transacciones atómicas, historial de estados, operador logístico.
"""
import logging
import uuid

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.middleware import require_cliente, require_vendedor, require_operador, require_admin
from app.models import (
    CarritoItem, DetallePedido, HistorialPedido,
    Pedido, Producto, EstadoPedido,
)
from app.services.auditoria import AuditoriaService
from app.utils.error_handlers import error_response
from app.utils.validators import validate_pagination, sanitize_string

logger = logging.getLogger(__name__)

pedidos_bp = Blueprint("pedidos", __name__)


# ─── Endpoints de Cliente ────────────────────────────────────────────────────

@pedidos_bp.post("/cliente/pedido")
@require_cliente
def crear_pedido():
    """
    Crea un pedido desde el carrito del cliente.
    CORRECCIÓN CRÍTICA: Usa bloqueo pesimista (with_for_update) para evitar
    condiciones de carrera en el stock con compras concurrentes.
    """
    id_cliente = request.cliente_id
    data = request.get_json(silent=True) or {}

    direccion = sanitize_string(data.get("direccion", ""), 500)
    if not direccion:
        return error_response("La dirección de entrega es requerida")

    metodo_pago = data.get("metodo_pago", "qr")
    notas = sanitize_string(data.get("notas", ""), 500)

    # Obtener ítems del carrito con lock pesimista para evitar race conditions
    items_carrito = (
        CarritoItem.query
        .join(Producto, CarritoItem.id_producto == Producto.id_producto)
        .filter(CarritoItem.id_cliente == id_cliente)
        .with_for_update()  # LOCK: previene compras simultáneas del mismo stock
        .all()
    )

    if not items_carrito:
        return error_response("El carrito está vacío")

    # Validar stock para todos los ítems ANTES de modificar nada
    errores_stock = []
    for item in items_carrito:
        p = Producto.query.with_for_update().get(item.id_producto)
        if not p or not p.activo:
            errores_stock.append(f"Producto {item.id_producto} no disponible")
        elif item.cantidad > p.stock:
            errores_stock.append(
                f"Stock insuficiente para '{p.nombre}': "
                f"tienes {item.cantidad} en carrito, disponible {p.stock}"
            )

    if errores_stock:
        return jsonify({"error": "Problemas de stock", "detalles": errores_stock}), 409

    # Calcular total
    total = sum(
        float(item.producto.precio_venta) * item.cantidad
        for item in items_carrito
    )

    # Generar código de seguimiento único
    codigo_seguimiento = f"CHK-{uuid.uuid4().hex[:8].upper()}"

    # Crear pedido
    pedido = Pedido(
        id_cliente=id_cliente,
        total=total,
        direccion_entrega=direccion,
        metodo_pago=metodo_pago,
        notas=notas,
        codigo_seguimiento=codigo_seguimiento,
    )
    db.session.add(pedido)
    db.session.flush()

    # Crear detalles y descontar stock
    for item in items_carrito:
        producto = Producto.query.get(item.id_producto)

        detalle = DetallePedido(
            id_pedido=pedido.id_pedido,
            id_producto=item.id_producto,
            cantidad=item.cantidad,
            precio_unitario=float(producto.precio_venta),
        )
        db.session.add(detalle)

        # Descontar stock con registro de movimiento
        stock_anterior = producto.stock
        producto.stock -= item.cantidad

        AuditoriaService.registrar_movimiento_inventario(
            id_producto=item.id_producto,
            tipo="salida",
            cantidad=item.cantidad,
            stock_anterior=stock_anterior,
            stock_nuevo=producto.stock,
            motivo=f"Pedido #{pedido.id_pedido}",
            id_pedido=pedido.id_pedido,
        )

    # Registrar historial inicial
    historial = HistorialPedido(
        id_pedido=pedido.id_pedido,
        estado_anterior=None,
        estado_nuevo=EstadoPedido.PENDIENTE,
        comentario="Pedido creado por el cliente",
    )
    db.session.add(historial)

    # Vaciar carrito
    CarritoItem.query.filter_by(id_cliente=id_cliente).delete()

    db.session.commit()

    logger.info(
        f"Pedido #{pedido.id_pedido} creado para cliente {id_cliente}. "
        f"Total: Bs {total:.2f}"
    )

    return jsonify({
        "id_pedido": pedido.id_pedido,
        "total": total,
        "codigo_seguimiento": codigo_seguimiento,
        "estado": EstadoPedido.PENDIENTE,
    }), 201


@pedidos_bp.get("/cliente/pedidos")
@require_cliente
def mis_pedidos():
    """Lista los pedidos del cliente autenticado con paginación."""
    id_cliente = request.cliente_id
    page, per_page = validate_pagination(request.args)

    paginated = (
        Pedido.query
        .filter_by(id_cliente=id_cliente)
        .order_by(Pedido.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "items": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })


@pedidos_bp.get("/cliente/pedidos/<int:pedido_id>")
@require_cliente
def detalle_pedido(pedido_id: int):
    """Detalle completo de un pedido del cliente."""
    pedido = Pedido.query.filter_by(
        id_pedido=pedido_id, id_cliente=request.cliente_id
    ).first()
    if not pedido:
        return error_response("Pedido no encontrado", 404)
    return jsonify(pedido.to_dict(include_detalles=True))


# ─── Endpoints de Administración/Operador ───────────────────────────────────

@pedidos_bp.get("/admin/pedidos")
@require_vendedor
def listar_pedidos_admin():
    """Lista todos los pedidos con filtros por estado."""
    estado = request.args.get("estado", "").strip()
    page, per_page = validate_pagination(request.args)

    query = Pedido.query

    if estado and estado in EstadoPedido.TODOS:
        query = query.filter_by(estado=estado)

    paginated = (
        query
        .order_by(Pedido.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "items": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })


@pedidos_bp.patch("/admin/pedidos/<int:pedido_id>/estado")
@require_operador
def cambiar_estado_pedido(pedido_id: int):
    """
    Cambia el estado de un pedido (operador logístico o admin).
    Registra historial del cambio.
    """
    pedido = Pedido.query.get_or_404(pedido_id)
    data = request.get_json(silent=True) or {}

    nuevo_estado = data.get("estado", "")
    if nuevo_estado not in EstadoPedido.TODOS:
        return error_response(
            f"Estado inválido. Opciones: {', '.join(EstadoPedido.TODOS)}"
        )

    comentario = sanitize_string(data.get("comentario", ""), 500)
    estado_anterior = pedido.estado

    # Prevent changing a cancelled or delivered order
    if estado_anterior in (EstadoPedido.CANCELADO, EstadoPedido.ENTREGADO):
        return error_response(
            f"No se puede cambiar el estado de un pedido {estado_anterior}"
        )

    pedido.estado = nuevo_estado

    historial = HistorialPedido(
        id_pedido=pedido.id_pedido,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        comentario=comentario,
        cambiado_por=request.usuario_id,
    )
    db.session.add(historial)

    AuditoriaService.registrar(
        tabla="pedido",
        accion="UPDATE",
        id_registro=pedido_id,
        datos_anteriores={"estado": estado_anterior},
        datos_nuevos={"estado": nuevo_estado},
        id_usuario=request.usuario_id,
    )

    db.session.commit()
    logger.info(
        f"Pedido #{pedido_id}: {estado_anterior} → {nuevo_estado} "
        f"por usuario {request.usuario_id}"
    )

    return jsonify({"mensaje": "Estado actualizado", "estado": nuevo_estado})


@pedidos_bp.patch("/admin/pedidos/<int:pedido_id>/verificar-pago")
@require_admin
def verificar_pago(pedido_id: int):
    """Admin verifica el pago de un pedido (QR/transferencia)."""
    import datetime
    pedido = Pedido.query.get_or_404(pedido_id)
    data = request.get_json(silent=True) or {}

    pedido.pago_verificado = True
    pedido.pago_verificado_por = request.usuario_id
    pedido.pago_verificado_at = datetime.datetime.utcnow()
    pedido.referencia_pago = sanitize_string(data.get("referencia", ""), 100)

    if pedido.estado == EstadoPedido.PENDIENTE:
        pedido.estado = EstadoPedido.CONFIRMADO
        historial = HistorialPedido(
            id_pedido=pedido.id_pedido,
            estado_anterior=EstadoPedido.PENDIENTE,
            estado_nuevo=EstadoPedido.CONFIRMADO,
            comentario=f"Pago verificado. Referencia: {pedido.referencia_pago}",
            cambiado_por=request.usuario_id,
        )
        db.session.add(historial)

    db.session.commit()
    return jsonify({"mensaje": "Pago verificado correctamente"})


# ─── Reportes ────────────────────────────────────────────────────────────────

@pedidos_bp.get("/admin/reportes/resumen")
@require_admin
def reporte_resumen():
    """Resumen ejecutivo: ventas por estado, totales."""
    from app.models import Cliente

    resumen_por_estado = (
        db.session.query(
            Pedido.estado,
            func.count(Pedido.id_pedido).label("cantidad"),
            func.sum(Pedido.total).label("total"),
        )
        .group_by(Pedido.estado)
        .all()
    )

    total_clientes = db.session.query(func.count(Cliente.id_cliente)).scalar()
    total_productos = db.session.query(func.count(Producto.id_producto)).filter(
        Producto.activo == True
    ).scalar()

    return jsonify({
        "pedidos_por_estado": [
            {
                "estado": r.estado,
                "cantidad": r.cantidad,
                "total": float(r.total or 0),
            }
            for r in resumen_por_estado
        ],
        "total_clientes": total_clientes,
        "total_productos": total_productos,
        "total_pedidos": sum(r.cantidad for r in resumen_por_estado),
        "ingresos_totales": float(
            sum(r.total or 0 for r in resumen_por_estado
                if r.estado == EstadoPedido.ENTREGADO)
        ),
    })
