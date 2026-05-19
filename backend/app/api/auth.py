"""
Blueprint de autenticación.
Maneja login/registro de clientes y login de usuarios internos.
CORRECCIÓN CRÍTICA: passwords de usuarios ahora también se hashean.
"""
import datetime
import logging

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash, generate_password_hash


from app import db
from app.middleware import generate_token
from app.models import Cliente, Usuario
from app.utils.validators import validate_registro_cliente, sanitize_string

logger = logging.getLogger(__name__)

auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/auth/cliente/registro")
def registro_cliente():
    data = request.get_json(silent=True) or {}

    is_valid, error_msg = validate_registro_cliente(data)
    if not is_valid:
        return jsonify({"error": error_msg}), 400

    email = data["email"].lower().strip()
    if Cliente.query.filter_by(email=email).first():
        return jsonify({"error": "El email ya está registrado"}), 409

    cliente = Cliente(
        nombre=sanitize_string(data["nombre"], 100),
        email=email,
        password_hash=generate_password_hash(data["password"]),
        telefono=sanitize_string(data.get("telefono", ""), 20),
        direccion_defecto=sanitize_string(data.get("direccion", ""), 500),
    )
    db.session.add(cliente)
    db.session.commit()

    logger.info(f"Nuevo cliente registrado: {email}")

    token = generate_token({"id_cliente": cliente.id_cliente, "tipo": "cliente"})
    return jsonify({"token": token, "cliente": cliente.to_dict()}), 201


@auth_bp.post("/auth/cliente/login")
def login_cliente():
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email y contraseña son requeridos"}), 400

    cliente = Cliente.query.filter_by(email=email, activo=True).first()

    # Constant-time comparison: always check a hash even if user doesn't exist
    if not cliente:
        # Dummy check to prevent timing attacks
        check_password_hash(
            "scrypt:32768:8:1$dummy$0000000000000000000000000000000000000000000000000000000000000000",
            password,
        )
        return jsonify({"error": "Credenciales incorrectas"}), 401

    if not check_password_hash(cliente.password_hash, password):
        return jsonify({"error": "Credenciales incorrectas"}), 401

    token = generate_token({"id_cliente": cliente.id_cliente, "tipo": "cliente"})
    logger.info(f"Login cliente exitoso: {email}")
    return jsonify({"token": token, "cliente": cliente.to_dict()}), 200


@auth_bp.post("/auth/login")
def login_usuario():
    """
    Login para usuarios internos: vendedores (rol=1), admins (rol=2),
    operadores logísticos (rol=3).

    CORRECCIÓN CRÍTICA: Ahora verifica password_hash en lugar de texto plano.
    """
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "Email y contraseña son requeridos"}), 400

    usuario = Usuario.query.filter_by(email=email, activo=True).first()

    # Constant-time comparison: always check a hash even if user doesn't exist
    if not usuario:
        check_password_hash(
            "scrypt:32768:8:1$dummy$0000000000000000000000000000000000000000000000000000000000000000",
            password,
        )
        logger.warning(f"Intento de login fallido: {email}")
        return jsonify({"error": "Credenciales incorrectas"}), 401

    if not check_password_hash(usuario.password_hash, password):
        logger.warning(f"Intento de login fallido: {email}")
        return jsonify({"error": "Credenciales incorrectas"}), 401

    # Actualizar último login
    usuario.ultimo_login = datetime.datetime.utcnow()
    db.session.commit()

    token = generate_token({
        "id_usuario": usuario.id_usuario,
        "id_rol": usuario.id_rol,
        "tipo": "usuario",
    })

    logger.info(f"Login usuario exitoso: {email} (rol={usuario.id_rol})")

    return jsonify({
        "token": token,
        "usuario": {
            "id": usuario.id_usuario,
            "nombre": usuario.nombre,
            "rol": usuario.id_rol,
            "nombre_rol": usuario.to_dict()["nombre_rol"],
        },
    }), 200


@auth_bp.post("/auth/cliente/logout")
def logout_cliente():
    """
    El JWT es stateless; el logout real se gestiona en el frontend.
    Este endpoint sirve para registrar el evento y futuras listas negras.
    """
    return jsonify({"mensaje": "Sesión cerrada correctamente"}), 200
