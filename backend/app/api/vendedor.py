"""
Blueprint del Vendedor — Chukuta Express
========================================
Todos los endpoints están protegidos con require_vendedor (rol=1 o admin rol=2).

Endpoints:
  GET  /vendedor/dashboard          → estadísticas personales del vendedor
  GET  /vendedor/productos          → sus productos (con paginación y filtros)
  GET  /vendedor/pedidos            → pedidos que incluyen al menos un ítem suyo
  GET  /vendedor/pedidos/<id>       → detalle de un pedido con sus ítems filtrados
  GET  /vendedor/perfil             → datos del vendedor autenticado
  PUT  /vendedor/perfil             → actualizar nombre/teléfono/nombre_tienda
"""
import logging

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app import db
from app.middleware import require_vendedor
from app.models import (
    DetallePedido, HistorialPedido,
    Pedido, Producto, EstadoPedido, Usuario,
)
from app.utils.error_handlers import error_response
from app.utils.validators import validate_pagination, sanitize_string

logger = logging.getLogger(__name__)

vendedor_bp = Blueprint("vendedor", __name__, url_prefix="/vendedor")


# ─── Helpers internos ─────────────────────────────────────────────────────────

def _pedidos_del_vendedor_query(vendedor_id: int):
    """
    Subquery: ids de pedidos que contienen al menos un producto del vendedor.
    Reutilizado en lista y detalle para evitar repetición.
    """
    return (
        db.session.query(DetallePedido.id_pedido)
        .join(Producto, DetallePedido.id_producto == Producto.id_producto)
        .filter(Producto.id_vendedor == vendedor_id)
        .subquery()
    )


# ─── Dashboard ────────────────────────────────────────────────────────────────

@vendedor_bp.get("/dashboard")
@require_vendedor
def dashboard():
    """
    Estadísticas reales del vendedor autenticado:
    - productos_activos: cuántos productos suyos están activos
    - productos_total: todos los suyos (incluyendo inactivos)
    - pedidos_pendientes: pedidos en estado pendiente/confirmado/en_preparacion
    - pedidos_entregados: pedidos en estado entregado
    - ingresos_totales: suma de (precio_unitario × cantidad) de sus ítems entregados
    - ventas_totales: total de ítems vendidos (cantidad) en pedidos entregados
    """
    vid = request.usuario_id

    # ── Productos ─────────────────────────────────────────────────────────────
    productos_total = (
        Producto.query.filter_by(id_vendedor=vid).count()
    )
    productos_activos = (
        Producto.query.filter_by(id_vendedor=vid, activo=True).count()
    )

    # ── Pedidos que contienen sus productos ──────────────────────────────────
    subq = _pedidos_del_vendedor_query(vid)

    pedidos_pendientes = (
        db.session.query(func.count(Pedido.id_pedido))
        .filter(
            Pedido.id_pedido.in_(subq),
            Pedido.estado.in_([
                EstadoPedido.PENDIENTE,
                EstadoPedido.CONFIRMADO,
                EstadoPedido.EN_PREPARACION,
                EstadoPedido.EN_CAMINO,
            ])
        )
        .scalar() or 0
    )

    pedidos_entregados = (
        db.session.query(func.count(Pedido.id_pedido))
        .filter(
            Pedido.id_pedido.in_(subq),
            Pedido.estado == EstadoPedido.ENTREGADO,
        )
        .scalar() or 0
    )

    # ── Ingresos: suma de sus ítems en pedidos entregados ────────────────────
    ingresos_row = (
        db.session.query(
            func.coalesce(
                func.sum(DetallePedido.precio_unitario * DetallePedido.cantidad), 0
            ).label("ingresos"),
            func.coalesce(func.sum(DetallePedido.cantidad), 0).label("unidades"),
        )
        .join(Producto, DetallePedido.id_producto == Producto.id_producto)
        .join(Pedido, DetallePedido.id_pedido == Pedido.id_pedido)
        .filter(
            Producto.id_vendedor == vid,
            Pedido.estado == EstadoPedido.ENTREGADO,
        )
        .one()
    )

    # ── Productos con bajo stock ──────────────────────────────────────────────
    bajo_stock = (
        db.session.query(func.count(Producto.id_producto))
        .filter(
            Producto.id_vendedor == vid,
            Producto.activo == True,
            Producto.stock <= Producto.stock_minimo,
        )
        .scalar() or 0
    )

    return jsonify({
        "productos_activos":  productos_activos,
        "productos_total":    productos_total,
        "pedidos_pendientes": pedidos_pendientes,
        "pedidos_entregados": pedidos_entregados,
        "ingresos_totales":   float(ingresos_row.ingresos),
        "ventas_totales":     int(ingresos_row.unidades),
        "productos_bajo_stock": bajo_stock,
    })


# ─── Productos del vendedor ───────────────────────────────────────────────────

@vendedor_bp.get("/productos")
@require_vendedor
def mis_productos():
    """
    Lista los productos del vendedor autenticado.
    Soporta: q (búsqueda), activo (true/false/''), page, per_page.
    Admin llamando aquí ve SUS propios productos (no todos); para ver todos
    el admin usa /productos/admin/todos.
    """
    vid = request.usuario_id
    page, per_page = validate_pagination(request.args)
    q = request.args.get("q", "").strip()
    activo_param = request.args.get("activo", "").strip().lower()

    query = Producto.query.filter_by(id_vendedor=vid)

    if q:
        safe_q = q.replace('%', '\\%').replace('_', '\\_')
        query = query.filter(Producto.nombre.ilike(f"%{safe_q}%", escape='\\'))

    if activo_param == "true":
        query = query.filter(Producto.activo == True)
    elif activo_param == "false":
        query = query.filter(Producto.activo == False)

    paginated = (
        query.order_by(Producto.activo.desc(), Producto.nombre)
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        "items":  [p.to_dict() for p in paginated.items],
        "total":  paginated.total,
        "page":   paginated.page,
        "pages":  paginated.pages,
    })


# ─── Pedidos del vendedor ─────────────────────────────────────────────────────

@vendedor_bp.get("/pedidos")
@require_vendedor
def mis_pedidos():
    """
    Lista los pedidos que contienen al menos un producto del vendedor.
    Soporta: estado (filtro), page, per_page.
    Incluye únicamente los detalles de sus propios ítems en cada pedido.
    """
    vid = request.usuario_id
    page, per_page = validate_pagination(request.args)
    estado = request.args.get("estado", "").strip()

    subq = _pedidos_del_vendedor_query(vid)

    query = Pedido.query.filter(Pedido.id_pedido.in_(subq))

    if estado and estado in EstadoPedido.TODOS:
        query = query.filter(Pedido.estado == estado)

    paginated = (
        query.order_by(Pedido.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    resultado = []
    for pedido in paginated.items:
        # Solo los ítems que pertenecen a este vendedor
        mis_detalles = [
            d.to_dict() for d in pedido.detalles
            if d.producto and d.producto.id_vendedor == vid
        ]
        subtotal_vendedor = sum(
            d["subtotal"] for d in mis_detalles
        )
        data = pedido.to_dict()
        data["mis_detalles"]       = mis_detalles
        data["subtotal_vendedor"]  = subtotal_vendedor
        resultado.append(data)

    return jsonify({
        "items":  resultado,
        "total":  paginated.total,
        "page":   paginated.page,
        "pages":  paginated.pages,
    })


@vendedor_bp.get("/pedidos/<int:pedido_id>")
@require_vendedor
def detalle_pedido_vendedor(pedido_id: int):
    """
    Detalle completo de un pedido, verificando que contenga al menos un
    producto del vendedor. Devuelve TODO el pedido + historial, pero
    resalta los ítems propios del vendedor ('mis_detalles').
    """
    vid = request.usuario_id
    subq = _pedidos_del_vendedor_query(vid)

    pedido = (
        Pedido.query
        .filter(Pedido.id_pedido == pedido_id, Pedido.id_pedido.in_(subq))
        .first()
    )
    if not pedido:
        return error_response("Pedido no encontrado o no pertenece a tus productos", 404)

    mis_detalles = [
        d.to_dict() for d in pedido.detalles
        if d.producto and d.producto.id_vendedor == vid
    ]

    data = pedido.to_dict(include_detalles=True)
    data["mis_detalles"]      = mis_detalles
    data["subtotal_vendedor"] = sum(d["subtotal"] for d in mis_detalles)

    # Información básica del cliente (sin datos sensibles)
    if pedido.cliente:
        data["cliente_nombre"] = pedido.cliente.nombre
        data["cliente_email"]  = pedido.cliente.email
        data["cliente_telefono"] = pedido.cliente.telefono or ""

    return jsonify(data)


@vendedor_bp.patch("/pedidos/<int:pedido_id>/estado")
@require_vendedor
def actualizar_estado_pedido(pedido_id: int):
    """
    Permite al vendedor actualizar el estado de un pedido que contiene
    sus productos. Solo puede mover el estado hacia adelante en el flujo:
        pendiente → confirmado → en_preparacion → en_camino → entregado
    No puede cancelar (eso es del admin) ni saltar estados hacia atrás.
    """
    vid = request.usuario_id
    subq = _pedidos_del_vendedor_query(vid)

    pedido = (
        Pedido.query
        .filter(Pedido.id_pedido == pedido_id, Pedido.id_pedido.in_(subq))
        .first()
    )
    if not pedido:
        return error_response("Pedido no encontrado", 404)

    data = request.get_json(silent=True) or {}
    nuevo_estado = data.get("estado", "").strip()

    # Flujo permitido para el vendedor
    FLUJO_VENDEDOR = [
        EstadoPedido.PENDIENTE,
        EstadoPedido.CONFIRMADO,
        EstadoPedido.EN_PREPARACION,
        EstadoPedido.EN_CAMINO,
        EstadoPedido.ENTREGADO,
    ]

    if nuevo_estado not in FLUJO_VENDEDOR:
        return error_response(
            f"Estado inválido. El vendedor puede usar: {', '.join(FLUJO_VENDEDOR)}"
        )

    # Solo avanzar, no retroceder
    if (
        nuevo_estado in FLUJO_VENDEDOR
        and pedido.estado in FLUJO_VENDEDOR
        and FLUJO_VENDEDOR.index(nuevo_estado) < FLUJO_VENDEDOR.index(pedido.estado)
    ):
        return error_response("No puedes retroceder el estado de un pedido", 400)

    comentario = sanitize_string(data.get("comentario", ""), 500)
    estado_anterior = pedido.estado
    pedido.estado = nuevo_estado

    historial = HistorialPedido(
        id_pedido=pedido.id_pedido,
        estado_anterior=estado_anterior,
        estado_nuevo=nuevo_estado,
        comentario=comentario or f"Actualizado por vendedor",
        cambiado_por=vid,
    )
    db.session.add(historial)
    db.session.commit()

    logger.info(
        f"Pedido #{pedido_id}: {estado_anterior} → {nuevo_estado} "
        f"por vendedor {vid}"
    )
    return jsonify({"mensaje": "Estado actualizado", "estado": nuevo_estado})


# ─── Perfil del vendedor ─────────────────────────────────────────────────────

@vendedor_bp.get("/perfil")
@require_vendedor
def perfil():
    """Retorna los datos del vendedor autenticado."""
    usuario = Usuario.query.get_or_404(request.usuario_id)
    data = usuario.to_dict()

    # Estadísticas rápidas para el perfil
    data["total_productos"] = Producto.query.filter_by(
        id_vendedor=request.usuario_id
    ).count()
    data["productos_activos"] = Producto.query.filter_by(
        id_vendedor=request.usuario_id, activo=True
    ).count()

    return jsonify(data)


@vendedor_bp.put("/perfil")
@require_vendedor
def actualizar_perfil():
    """
    Permite al vendedor actualizar su nombre y teléfono.
    No puede cambiar email ni rol (eso es del admin).
    El campo 'nombre_tienda' se guarda en 'nombre' con prefijo si el usuario quiere.
    """
    usuario = Usuario.query.get_or_404(request.usuario_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        nombre = sanitize_string(data["nombre"], 100)
        if not nombre:
            return error_response("El nombre no puede estar vacío")
        usuario.nombre = nombre

    db.session.commit()
    return jsonify({"mensaje": "Perfil actualizado", "usuario": usuario.to_dict()})
