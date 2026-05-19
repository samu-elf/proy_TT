"""
Blueprint de productos y categorías.
Endpoints públicos de lectura y privados de escritura (vendedor/admin).
CORRECCIÓN: Ruta /categorias movida antes de /<int:id> para evitar conflicto de rutas.
"""
import logging

from flask import Blueprint, jsonify, request


from app import db
from app.middleware import require_vendedor, require_admin
from app.models import Producto, Categoria
from app.services.auditoria import AuditoriaService
from app.utils.validators import validate_producto, validate_pagination, sanitize_string
from app.utils.error_handlers import error_response

logger = logging.getLogger(__name__)

productos_bp = Blueprint("productos", __name__, url_prefix="/productos")


# ─── Endpoints Públicos ──────────────────────────────────────────────────────

@productos_bp.get("")
def listar_productos():
    """Lista productos activos con stock > 0. Soporta filtros y paginación."""
    q = request.args.get("q", "").strip()
    categoria = request.args.get("categoria", "").strip()
    page, per_page = validate_pagination(request.args)

    query = (
        Producto.query
        .join(Categoria, Producto.id_categoria == Categoria.id_categoria)
        .filter(Producto.activo == True, Producto.stock > 0)
    )

    if q:
        safe_q = q.replace('%', '\\%').replace('_', '\\_')
        query = query.filter(Producto.nombre.ilike(f"%{safe_q}%", escape='\\'))

    if categoria:
        query = query.filter(Categoria.nombre_categoria == categoria)

    query = query.order_by(Producto.nombre)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })


@productos_bp.get("/categorias")
def listar_categorias():
    """
    CORRECCIÓN CRÍTICA: Esta ruta debe declararse ANTES de /<int:producto_id>
    para que Flask no intente convertir 'categorias' a int y devuelva 404.
    """
    categorias = (
        Categoria.query
        .filter_by(activa=True)
        .order_by(Categoria.nombre_categoria)
        .all()
    )
    return jsonify([c.to_dict() for c in categorias])


@productos_bp.get("/<int:producto_id>")
def obtener_producto(producto_id: int):
    """Obtiene un producto por ID incluyendo info de categoría."""
    producto = (
        Producto.query
        .join(Categoria)
        .filter(Producto.id_producto == producto_id, Producto.activo == True)
        .first()
    )
    if not producto:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify(producto.to_dict())


# ─── Endpoints Privados (Vendedor / Admin) ───────────────────────────────────

@productos_bp.get("/admin/todos")
@require_vendedor
def listar_todos_productos():
    """Lista todos los productos incluyendo inactivos (para gestión)."""
    page, per_page = validate_pagination(request.args)

    query = Producto.query.join(Categoria).order_by(Producto.nombre)

    # Vendedores solo ven sus productos; admins ven todos
    if request.usuario_rol == 1:
        query = query.filter(Producto.id_vendedor == request.usuario_id)

    paginated = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        "items": [p.to_dict() for p in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })


@productos_bp.post("")
@require_vendedor
def crear_producto():
    data = request.get_json(silent=True) or {}

    is_valid, msg = validate_producto(data)
    if not is_valid:
        return error_response(msg)

    categoria = Categoria.query.get(data["id_categoria"])
    if not categoria or not categoria.activa:
        return error_response("Categoría no válida")

    producto = Producto(
        nombre=sanitize_string(data["nombre"], 200),
        descripcion=sanitize_string(data.get("descripcion", ""), 2000),
        codigo=sanitize_string(data.get("codigo", ""), 50) or None,
        stock=int(data.get("stock", 0)),
        stock_minimo=int(data.get("stock_minimo", 5)),
        precio_venta=float(data["precio_venta"]),
        precio_costo=float(data["precio_costo"]) if data.get("precio_costo") else None,
        id_categoria=data["id_categoria"],
        id_vendedor=request.usuario_id,
        imagen_url=sanitize_string(data.get("imagen_url", "") or "", 500) or None,
        activo=bool(data.get("activo", True)),
    )
    db.session.add(producto)
    db.session.flush()

    AuditoriaService.registrar(
        tabla="almacen",
        accion="CREATE",
        id_registro=producto.id_producto,
        datos_nuevos=producto.to_dict(),
        id_usuario=request.usuario_id,
    )

    db.session.commit()
    logger.info(f"Producto creado: {producto.nombre} por usuario {request.usuario_id}")
    return jsonify(producto.to_dict()), 201


@productos_bp.put("/<int:producto_id>")
@require_vendedor
def actualizar_producto(producto_id: int):
    producto = Producto.query.get_or_404(producto_id)

    # Vendedores solo pueden editar sus propios productos
    if request.usuario_rol == 1 and producto.id_vendedor != request.usuario_id:
        return error_response("No tienes permiso para editar este producto", 403)

    data = request.get_json(silent=True) or {}
    datos_anteriores = producto.to_dict()

    if "nombre" in data:
        producto.nombre = sanitize_string(data["nombre"], 200)
    if "descripcion" in data:
        producto.descripcion = sanitize_string(data["descripcion"], 2000)
    if "precio_venta" in data:
        try:
            precio = float(data["precio_venta"])
            if precio <= 0:
                return error_response("El precio debe ser mayor a 0")
            producto.precio_venta = precio
        except (ValueError, TypeError):
            return error_response("Precio inválido")
    if "stock" in data:
        try:
            stock = int(data["stock"])
            if stock < 0:
                return error_response("El stock no puede ser negativo")
            producto.stock = stock
        except (ValueError, TypeError):
            return error_response("Stock inválido")
    if "id_categoria" in data:
        producto.id_categoria = data["id_categoria"]
    if "activo" in data:
        producto.activo = bool(data["activo"])
    if "imagen_url" in data:
        url = sanitize_string(data.get("imagen_url", "") or "", 500)
        producto.imagen_url = url or None
    if "stock_minimo" in data:
        try:
            sm = int(data["stock_minimo"])
            if sm >= 0:
                producto.stock_minimo = sm
        except (ValueError, TypeError):
            pass

    AuditoriaService.registrar(
        tabla="almacen",
        accion="UPDATE",
        id_registro=producto_id,
        datos_anteriores=datos_anteriores,
        datos_nuevos=producto.to_dict(),
        id_usuario=request.usuario_id,
    )

    db.session.commit()
    return jsonify(producto.to_dict())


@productos_bp.patch("/<int:producto_id>/stock")
@require_vendedor
def ajustar_stock(producto_id: int):
    """Ajuste manual de stock con registro de movimiento."""
    producto = Producto.query.get_or_404(producto_id)
    data = request.get_json(silent=True) or {}

    try:
        nuevo_stock = int(data["stock"])
        if nuevo_stock < 0:
            return error_response("El stock no puede ser negativo")
    except (ValueError, TypeError, KeyError):
        return error_response("Stock inválido")

    stock_anterior = producto.stock
    motivo = sanitize_string(data.get("motivo", "Ajuste manual"), 200)

    AuditoriaService.registrar_movimiento_inventario(
        id_producto=producto_id,
        tipo="ajuste",
        cantidad=nuevo_stock - stock_anterior,
        stock_anterior=stock_anterior,
        stock_nuevo=nuevo_stock,
        motivo=motivo,
        id_usuario=request.usuario_id,
    )

    producto.stock = nuevo_stock
    db.session.commit()

    return jsonify({"mensaje": "Stock actualizado", "stock_nuevo": nuevo_stock})


# ─── Gestión de Categorías ───────────────────────────────────────────────────

@productos_bp.post("/categorias")
@require_admin
def crear_categoria():
    data = request.get_json(silent=True) or {}
    nombre = sanitize_string(data.get("nombre", ""), 100)
    if not nombre:
        return error_response("El nombre de la categoría es requerido")

    if Categoria.query.filter_by(nombre_categoria=nombre).first():
        return error_response("Ya existe una categoría con ese nombre", 409)

    cat = Categoria(
        nombre_categoria=nombre,
        descripcion=sanitize_string(data.get("descripcion", ""), 500),
    )
    db.session.add(cat)
    db.session.commit()
    return jsonify(cat.to_dict()), 201


@productos_bp.delete("/<int:producto_id>")
@require_vendedor
def eliminar_producto(producto_id: int):
    """
    Soft-delete: desactiva el producto (no lo borra de la BD).
    Vendedores solo pueden eliminar sus propios productos.
    """
    producto = Producto.query.get_or_404(producto_id)

    if request.usuario_rol == 1 and producto.id_vendedor != request.usuario_id:
        return error_response("No tienes permiso para eliminar este producto", 403)

    datos_anteriores = producto.to_dict()
    producto.activo = False

    AuditoriaService.registrar(
        tabla="almacen",
        accion="DELETE",
        id_registro=producto_id,
        datos_anteriores=datos_anteriores,
        id_usuario=request.usuario_id,
    )

    db.session.commit()
    logger.info(f"Producto {producto_id} desactivado por usuario {request.usuario_id}")
    return jsonify({"mensaje": "Producto desactivado correctamente"}), 200
