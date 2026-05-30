"""
Blueprint del carrito de compras.
CORRECCIÓN: Validación de stock al agregar, manejo correcto de cantidades.
"""
import logging
from flask import Blueprint, jsonify, request
from app import db
from app.utils.auth import require_cliente
from app.models import CarritoItem, Producto
from app.utils.error_handlers import error_response

logger = logging.getLogger(__name__)

carrito_bp = Blueprint("carrito", __name__, url_prefix="/cliente/carrito")


@carrito_bp.get("")
@require_cliente
def obtener_carrito():
    """Obtiene el carrito del cliente con subtotales calculados."""
    id_cliente = request.cliente_id

    items = (
        CarritoItem.query
        .join(Producto)
        .filter(CarritoItem.id_cliente == id_cliente)
        .order_by(Producto.nombre)
        .all()
    )

    items_dict = []
    for item in items:
        p = item.producto
        if not p or not p.activo:
            # Producto eliminado/inactivo — limpiar del carrito automáticamente
            db.session.delete(item)
            continue
        items_dict.append({
            "id_carrito": item.id_carrito,
            "id_producto": p.id_producto,
            "nombre": p.nombre,
            "precio_venta": float(p.precio_venta),
            "cantidad": item.cantidad,
            "subtotal": float(p.precio_venta) * item.cantidad,
            "stock_disponible": p.stock,
            "sin_stock": item.cantidad > p.stock,
        })

    db.session.commit()  # Guardar eliminaciones de productos inactivos

    total = sum(i["subtotal"] for i in items_dict)
    return jsonify({
        "items": items_dict,
        "total": total,
        "cantidad_items": sum(i["cantidad"] for i in items_dict),
    })


@carrito_bp.post("")
@require_cliente
def agregar_al_carrito():
    """
    Agrega un producto al carrito.
    CORRECCIÓN: Valida existencia del producto y stock disponible.
    """
    id_cliente = request.cliente_id
    data = request.get_json(silent=True) or {}

    id_producto = data.get("id_producto")
    try:
        cantidad = max(1, int(data.get("cantidad", 1)))
    except (ValueError, TypeError):
        return error_response("Cantidad inválida")

    if not id_producto:
        return error_response("id_producto es requerido")

    # Validar que el producto existe y tiene stock
    producto = Producto.query.filter_by(
        id_producto=id_producto, activo=True
    ).first()
    if not producto:
        return error_response("Producto no encontrado o no disponible", 404)

    # Verificar stock considerando lo que ya está en el carrito
    item_existente = CarritoItem.query.filter_by(
        id_cliente=id_cliente, id_producto=id_producto
    ).first()

    cantidad_en_carrito = item_existente.cantidad if item_existente else 0
    total_solicitado = cantidad_en_carrito + cantidad

    if total_solicitado > producto.stock:
        return error_response(
            f"Stock insuficiente. Disponible: {producto.stock} unidades", 409
        )

    if item_existente:
        item_existente.cantidad = total_solicitado
    else:
        item_existente = CarritoItem(
            id_cliente=id_cliente,
            id_producto=id_producto,
            cantidad=cantidad,
        )
        db.session.add(item_existente)

    db.session.commit()
    return jsonify({"mensaje": "Producto agregado al carrito", "cantidad_total": total_solicitado}), 200


@carrito_bp.put("/<int:id_carrito>")
@require_cliente
def actualizar_cantidad(id_carrito: int):
    """Actualiza la cantidad de un ítem del carrito."""
    id_cliente = request.cliente_id
    data = request.get_json(silent=True) or {}

    item = CarritoItem.query.filter_by(
        id_carrito=id_carrito, id_cliente=id_cliente
    ).first()
    if not item:
        return error_response("Ítem no encontrado", 404)

    try:
        nueva_cantidad = int(data.get("cantidad", 1))
        if nueva_cantidad < 1:
            raise ValueError
    except (ValueError, TypeError):
        return error_response("Cantidad inválida (mínimo 1)")

    if nueva_cantidad > item.producto.stock:
        return error_response(
            f"Stock insuficiente. Disponible: {item.producto.stock}", 409
        )

    item.cantidad = nueva_cantidad
    db.session.commit()
    return jsonify({"mensaje": "Cantidad actualizada", "cantidad": nueva_cantidad})


@carrito_bp.delete("/<int:id_carrito>")
@require_cliente
def eliminar_del_carrito(id_carrito: int):
    """Elimina un ítem del carrito."""
    id_cliente = request.cliente_id

    item = CarritoItem.query.filter_by(
        id_carrito=id_carrito, id_cliente=id_cliente
    ).first()
    if not item:
        return error_response("Ítem no encontrado", 404)

    db.session.delete(item)
    db.session.commit()
    return jsonify({"mensaje": "Ítem eliminado del carrito"}), 200


@carrito_bp.delete("")
@require_cliente
def vaciar_carrito():
    """Vacía completamente el carrito del cliente."""
    id_cliente = request.cliente_id
    CarritoItem.query.filter_by(id_cliente=id_cliente).delete()
    db.session.commit()
    return jsonify({"mensaje": "Carrito vaciado"}), 200
