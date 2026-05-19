"""
Validaciones de datos de entrada con mensajes claros en español.
"""
import re
from typing import Any


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"
    return bool(re.match(pattern, email)) and len(email) <= 150


def validate_password(password: str) -> tuple[bool, str]:
    if len(password) < 8:
        return False, "La contraseña debe tener al menos 8 caracteres"
    if len(password) > 128:
        return False, "La contraseña no puede superar los 128 caracteres"
    return True, ""


def validate_registro_cliente(data: dict) -> tuple[bool, str]:
    required = ["nombre", "email", "password"]
    for field in required:
        val = data.get(field, "")
        if not isinstance(val, str) or not val.strip():
            return False, f"El campo '{field}' es requerido"

    nombre = data["nombre"].strip()
    if len(nombre) < 2:
        return False, "El nombre debe tener al menos 2 caracteres"
    if len(nombre) > 100:
        return False, "El nombre no puede superar los 100 caracteres"

    if not validate_email(data["email"]):
        return False, "El formato del email es inválido"

    ok, msg = validate_password(data["password"])
    if not ok:
        return False, msg

    return True, ""


def validate_producto(data: dict) -> tuple[bool, str]:
    nombre = data.get("nombre", "").strip()
    if not nombre:
        return False, "El nombre del producto es requerido"
    if len(nombre) > 200:
        return False, "El nombre no puede superar los 200 caracteres"

    try:
        precio = float(data.get("precio_venta", 0))
        if precio <= 0:
            raise ValueError
    except (ValueError, TypeError):
        return False, "El precio de venta debe ser un número mayor a 0"

    try:
        stock = int(data.get("stock", 0))
        if stock < 0:
            raise ValueError
    except (ValueError, TypeError):
        return False, "El stock debe ser un número entero no negativo"

    if not data.get("id_categoria"):
        return False, "La categoría es requerida"

    return True, ""


def validate_pagination(args: dict) -> tuple[int, int]:
    """Devuelve (page, per_page) validados."""
    try:
        page = max(1, int(args.get("page", 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        per_page = min(100, max(1, int(args.get("per_page", 20))))
    except (ValueError, TypeError):
        per_page = 20
    return page, per_page


def sanitize_string(value: Any, max_length: int = 500) -> str:
    """Limpia y trunca una cadena de texto."""
    if not isinstance(value, str):
        return ""
    return value.strip()[:max_length]


def validate_url(url: str | None, max_len: int = 500) -> tuple[bool, str]:
    """Valida que una URL sea HTTP/HTTPS y no exceda el límite de longitud."""
    if not url:
        return True, ""
    if len(url) > max_len:
        return False, f"La URL no puede superar {max_len} caracteres"
    if not url.startswith(("http://", "https://")):
        return False, "La URL debe empezar con http:// o https://"
    return True, ""
