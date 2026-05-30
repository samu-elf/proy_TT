"""
Middleware de autenticación y autorización JWT.
Soporta múltiples tipos de usuario con control de roles granular.
"""
import datetime
import logging
from functools import wraps

import jwt
from flask import current_app, jsonify, request

logger = logging.getLogger(__name__)


# ─── Generación de Tokens ────────────────────────────────────────────────────

def generate_token(payload: dict, expiration_hours: int | None = None) -> str:
    """Genera un JWT firmado. El payload se copia para no mutar el original."""
    payload = payload.copy()
    hours = expiration_hours or current_app.config.get("JWT_EXPIRATION_HOURS", 24)
    payload["exp"] = datetime.datetime.utcnow() + datetime.timedelta(hours=hours)
    payload["iat"] = datetime.datetime.utcnow()

    return jwt.encode(
        payload,
        current_app.config["SECRET_KEY"],
        algorithm="HS256",
    )


def _decode_token(token: str) -> dict | None:
    """Decodifica y valida un JWT. Retorna None si es inválido o expirado."""
    try:
        return jwt.decode(
            token,
            current_app.config["SECRET_KEY"],
            algorithms=["HS256"],
        )
    except jwt.ExpiredSignatureError:
        logger.debug("Token expirado recibido")
        return None
    except jwt.InvalidTokenError as e:
        logger.debug(f"Token inválido: {e}")
        return None


def _extract_bearer(req) -> str | None:
    """Extrae el token Bearer del header Authorization."""
    auth = req.headers.get("Authorization", "")
    if auth.startswith("Bearer ") and len(auth) > 7:
        return auth.split(" ", 1)[1].strip()
    return None


def _get_client_ip() -> str:
    """Obtiene la IP real del cliente considerando proxies."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.remote_addr or "unknown"


# ─── Decoradores de Autenticación ────────────────────────────────────────────

def require_cliente(f):
    """Exige token JWT de tipo 'cliente'. Inyecta cliente_id en request."""
    @wraps(f)
    def decorated(*args, **kwargs):
        token = _extract_bearer(request)
        if not token:
            return jsonify({"error": "Token de autenticación requerido"}), 401

        data = _decode_token(token)
        if not data or data.get("tipo") != "cliente":
            return jsonify({"error": "Token inválido o expirado"}), 401

        request.cliente_id = data["id_cliente"]
        return f(*args, **kwargs)

    return decorated

def require_usuario(roles: list[int] | None = None):
    """
    Decorador factory para usuarios internos (vendedor, admin, operador).
    roles: lista de id_rol permitidos. None = cualquier usuario autenticado.
    """
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            token = _extract_bearer(request)
            if not token:
                return jsonify({"error": "Token de autenticación requerido"}), 401

            data = _decode_token(token)
            if not data or data.get("tipo") != "usuario":
                return jsonify({"error": "Token inválido o expirado"}), 401

            if roles and data.get("id_rol") not in roles:
                logger.warning(
                    f"Acceso denegado: usuario {data.get('id_usuario')} "
                    f"con rol {data.get('id_rol')} intentó acceder a ruta "
                    f"restringida a roles {roles} desde {_get_client_ip()}"
                )
                return jsonify({"error": "No tienes permisos para realizar esta acción"}), 403

            request.usuario_id = data["id_usuario"]
            request.usuario_rol = data["id_rol"]
            return f(*args, **kwargs)

        return decorated
    return decorator


# Aliases convenientes para los roles principales
def require_admin(f):
    """Exige rol de Administrador (rol=2)."""
    return require_usuario(roles=[2])(f)

def require_vendedor(f):
    """Exige rol de Vendedor (rol=1) o Admin (rol=2)."""
    return require_usuario(roles=[1, 2])(f)

def require_operador(f):
    """Exige rol de Operador Logístico (rol=3) o Admin (rol=2)."""
    return require_usuario(roles=[2, 3])(f)
