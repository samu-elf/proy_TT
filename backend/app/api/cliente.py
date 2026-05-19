"""
Blueprint del Cliente — perfil, historial de pedidos detallado.
Complementa al carrito (carrito_bp) y pedidos (pedidos_bp).
"""
import logging

from flask import Blueprint, jsonify, request

from app import db
from app.middleware import require_cliente
from app.models import Cliente, Pedido
from app.utils.error_handlers import error_response
from app.utils.validators import sanitize_string, validate_pagination

logger = logging.getLogger(__name__)

cliente_bp = Blueprint("cliente_ext", __name__, url_prefix="/cliente")


# ── Perfil ────────────────────────────────────────────────────────────────────

@cliente_bp.get("/perfil")
@require_cliente
def obtener_perfil():
    """Retorna los datos del cliente autenticado."""
    cliente = Cliente.query.get_or_404(request.cliente_id)
    return jsonify(cliente.to_dict())


@cliente_bp.put("/perfil")
@require_cliente
def actualizar_perfil():
    """
    Permite al cliente actualizar nombre, teléfono y dirección por defecto.
    No puede cambiar email ni contraseña desde aquí.
    """
    cliente = Cliente.query.get_or_404(request.cliente_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        nombre = sanitize_string(data["nombre"], 100)
        if len(nombre) < 2:
            return error_response("El nombre debe tener al menos 2 caracteres")
        cliente.nombre = nombre

    if "telefono" in data:
        cliente.telefono = sanitize_string(data["telefono"], 20) or None

    if "direccion_defecto" in data:
        cliente.direccion_defecto = sanitize_string(data["direccion_defecto"], 500) or None

    db.session.commit()
    logger.info(f"Perfil actualizado: cliente {cliente.id_cliente}")
    return jsonify({"mensaje": "Perfil actualizado", "cliente": cliente.to_dict()})


# ── Historial de pedidos (versión extendida con detalles) ─────────────────────

@cliente_bp.get("/mis-pedidos")
@require_cliente
def historial_pedidos():
    """
    Historial completo del cliente con detalles de productos.
    Diferente a /cliente/pedidos (que devuelve resumen sin detalles).
    """
    id_cliente = request.cliente_id
    page, per_page = validate_pagination(request.args)
    estado = request.args.get("estado", "").strip()

    query = Pedido.query.filter_by(id_cliente=id_cliente)
    if estado:
        query = query.filter_by(estado=estado)

    paginated = (
        query.order_by(Pedido.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    items = []
    for p in paginated.items:
        d = p.to_dict(include_detalles=True)
        items.append(d)

    return jsonify({
        "items":  items,
        "total":  paginated.total,
        "page":   paginated.page,
        "pages":  paginated.pages,
    })


@cliente_bp.get("/mis-pedidos/<int:pedido_id>")
@require_cliente
def detalle_pedido_extendido(pedido_id: int):
    """Detalle completo de un pedido con historial y detalles de líneas."""
    pedido = Pedido.query.filter_by(
        id_pedido=pedido_id, id_cliente=request.cliente_id
    ).first()
    if not pedido:
        return error_response("Pedido no encontrado", 404)
    return jsonify(pedido.to_dict(include_detalles=True))
