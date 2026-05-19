"""
Blueprint de gestión de usuarios internos (admin).
CORRECCIÓN CRÍTICA: Passwords ahora se hashean con werkzeug.
"""
import logging
from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from app import db
from app.middleware import require_admin
from app.models import Usuario, RolUsuario, Cliente
from app.services.auditoria import AuditoriaService
from app.utils.error_handlers import error_response
from app.utils.validators import validate_email, validate_password, sanitize_string, validate_pagination

logger = logging.getLogger(__name__)

usuarios_bp = Blueprint("usuarios", __name__, url_prefix="/admin")


@usuarios_bp.get("/usuarios")
@require_admin
def listar_usuarios():
    page, per_page = validate_pagination(request.args)
    paginated = (
        Usuario.query
        .order_by(Usuario.nombre)
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "items": [u.to_dict() for u in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })


@usuarios_bp.get("/usuarios/<int:usuario_id>")
@require_admin
def obtener_usuario(usuario_id: int):
    usuario = Usuario.query.get_or_404(usuario_id)
    return jsonify(usuario.to_dict())


@usuarios_bp.post("/usuarios")
@require_admin
def crear_usuario():
    """
    Registra un nuevo usuario interno.
    CORRECCIÓN CRÍTICA: La contraseña se hashea antes de guardar.
    """
    data = request.get_json(silent=True) or {}

    nombre = sanitize_string(data.get("nombre", ""), 100)
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    id_rol = data.get("id_rol")

    # Validaciones
    if not nombre or len(nombre) < 2:
        return error_response("Nombre inválido (mínimo 2 caracteres)")
    if not validate_email(email):
        return error_response("Email inválido")

    ok, msg = validate_password(password)
    if not ok:
        return error_response(msg)

    if id_rol not in (RolUsuario.VENDEDOR, RolUsuario.ADMIN, RolUsuario.OPERADOR):
        return error_response("id_rol debe ser 1 (Vendedor), 2 (Admin) o 3 (Operador)")

    if Usuario.query.filter_by(email=email).first():
        return error_response("El email ya está registrado", 409)

    usuario = Usuario(
        nombre=nombre,
        email=email,
        password_hash=generate_password_hash(password),  # FIX: hashear password
        id_rol=id_rol,
    )
    db.session.add(usuario)
    db.session.flush()

    AuditoriaService.registrar(
        tabla="usuario",
        accion="CREATE",
        id_registro=usuario.id_usuario,
        datos_nuevos={"email": email, "id_rol": id_rol},
        id_usuario=request.usuario_id,
    )

    db.session.commit()
    logger.info(f"Usuario creado: {email} (rol={id_rol}) por admin {request.usuario_id}")
    return jsonify(usuario.to_dict()), 201


@usuarios_bp.put("/usuarios/<int:usuario_id>")
@require_admin
def actualizar_usuario(usuario_id: int):
    usuario = Usuario.query.get_or_404(usuario_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        usuario.nombre = sanitize_string(data["nombre"], 100)
    if "id_rol" in data and data["id_rol"] in (1, 2, 3):
        usuario.id_rol = data["id_rol"]
    if "activo" in data:
        usuario.activo = bool(data["activo"])
    if "password" in data and data["password"]:
        ok, msg = validate_password(data["password"])
        if not ok:
            return error_response(msg)
        usuario.password_hash = generate_password_hash(data["password"])

    db.session.commit()
    return jsonify(usuario.to_dict())


@usuarios_bp.delete("/usuarios/<int:usuario_id>")
@require_admin
def desactivar_usuario(usuario_id: int):
    """Desactiva un usuario (no se elimina físicamente por auditoría)."""
    if usuario_id == request.usuario_id:
        return error_response("No puedes desactivar tu propia cuenta")

    usuario = Usuario.query.get_or_404(usuario_id)
    usuario.activo = False
    db.session.commit()

    logger.info(f"Usuario {usuario_id} desactivado por admin {request.usuario_id}")
    return jsonify({"mensaje": "Usuario desactivado"}), 200


# ─── Gestión de Clientes (Admin) ──────────────────────────────────────────────

@usuarios_bp.get("/clientes")
@require_admin
def listar_clientes():
    page, per_page = validate_pagination(request.args)
    paginated = (
        Cliente.query
        .order_by(Cliente.nombre)
        .paginate(page=page, per_page=per_page, error_out=False)
    )
    return jsonify({
        "items": [c.to_dict() for c in paginated.items],
        "total": paginated.total,
        "page": paginated.page,
        "pages": paginated.pages,
    })

@usuarios_bp.post("/clientes")
@require_admin
def crear_cliente_admin():
    data = request.get_json(silent=True) or {}
    nombre = sanitize_string(data.get("nombre", ""), 100)
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")
    telefono = sanitize_string(data.get("telefono", ""), 20)

    if not nombre or len(nombre) < 2:
        return error_response("Nombre inválido (mínimo 2 caracteres)")
    if not validate_email(email):
        return error_response("Email inválido")
    
    ok, msg = validate_password(password)
    if not ok:
        return error_response(msg)

    if Cliente.query.filter_by(email=email).first():
        return error_response("El email ya está registrado", 409)

    cliente = Cliente(
        nombre=nombre,
        email=email,
        password_hash=generate_password_hash(password),
        telefono=telefono,
        verificado=True  # Creado por admin, se asume verificado
    )
    db.session.add(cliente)
    db.session.commit()
    
    logger.info(f"Cliente creado: {email} por admin {request.usuario_id}")
    return jsonify(cliente.to_dict()), 201

@usuarios_bp.put("/clientes/<int:cliente_id>")
@require_admin
def actualizar_cliente_admin(cliente_id: int):
    cliente = Cliente.query.get_or_404(cliente_id)
    data = request.get_json(silent=True) or {}

    if "nombre" in data:
        cliente.nombre = sanitize_string(data["nombre"], 100)
    if "telefono" in data:
        cliente.telefono = sanitize_string(data["telefono"], 20)
    if "activo" in data:
        cliente.activo = bool(data["activo"])
    if "password" in data and data["password"]:
        ok, msg = validate_password(data["password"])
        if not ok:
            return error_response(msg)
        cliente.password_hash = generate_password_hash(data["password"])

    db.session.commit()
    return jsonify(cliente.to_dict())

@usuarios_bp.delete("/clientes/<int:cliente_id>")
@require_admin
def desactivar_cliente_admin(cliente_id: int):
    cliente = Cliente.query.get_or_404(cliente_id)
    cliente.activo = False
    db.session.commit()
    logger.info(f"Cliente {cliente_id} desactivado por admin {request.usuario_id}")
    return jsonify({"mensaje": "Cliente desactivado"}), 200


# ─── Perfil del usuario autenticado ─────────────────────────────────────────

@usuarios_bp.get("/perfil")
@require_admin
def mi_perfil():
    """Retorna el perfil del usuario autenticado."""
    usuario = Usuario.query.get_or_404(request.usuario_id)
    return jsonify(usuario.to_dict())
