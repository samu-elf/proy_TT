from .auth      import auth_bp
from .productos import productos_bp
from .carrito   import carrito_bp
from .pedidos   import pedidos_bp
from .usuarios  import usuarios_bp
from .vendedor  import vendedor_bp
from .cliente   import cliente_bp

__all__ = [
    "auth_bp", "productos_bp", "carrito_bp", "pedidos_bp",
    "usuarios_bp", "vendedor_bp", "cliente_bp",
]
