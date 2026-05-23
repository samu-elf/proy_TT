"""
Application Factory — Chukuta Express
Registra todos los blueprints y extensiones.
"""
import logging
import os

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


def create_app(config=None):
    app = Flask(__name__)

    from config import get_config
    cfg = config or get_config()
    app.config.from_object(cfg)

    _configure_logging(app)

    db.init_app(app)

    CORS(
        app,
        resources={r"/*": {"origins": cfg.ALLOWED_ORIGINS}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization"],
        methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    )

    # ── Blueprints ────────────────────────────────────────────────────────────
    from app.api.auth     import auth_bp
    from app.api.productos import productos_bp
    from app.api.carrito  import carrito_bp
    from app.api.pedidos  import pedidos_bp
    from app.api.usuarios import usuarios_bp
    from app.api.vendedor import vendedor_bp
    from app.api.cliente  import cliente_bp
    from app.api.reportes  import reportes_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(productos_bp)
    app.register_blueprint(carrito_bp)
    app.register_blueprint(pedidos_bp)
    app.register_blueprint(usuarios_bp)
    app.register_blueprint(vendedor_bp)
    app.register_blueprint(cliente_bp)
    app.register_blueprint(reportes_bp)

    from app.utils.error_handlers import register_error_handlers
    register_error_handlers(app)

    @app.get("/health")
    def health():
        return {"status": "ok", "version": "2.1.0"}

    @app.cli.command("init-db")
    def init_db():
        """Crea tablas + datos iniciales (admin, roles, categorías)."""
        with app.app_context():
            db.create_all()
            _seed_initial_data()
            print("✓ Base de datos inicializada")
    return app

def _configure_logging(app: Flask):
    level = logging.DEBUG if app.config.get("DEBUG") else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

def _seed_initial_data():
    from werkzeug.security import generate_password_hash
    from app.models import Rol, Usuario, Categoria

    roles_data = [
        (1, "Vendedor",             "Gestiona sus propios productos y pedidos"),
        (2, "Administrador",        "Acceso total al sistema"),
        (3, "Operador Logístico",   "Gestiona estados de pedidos"),
    ]
    for id_rol, nombre, desc in roles_data:
        if not Rol.query.get(id_rol):
            db.session.add(Rol(id_rol=id_rol, nombre=nombre, descripcion=desc))

    if not Usuario.query.filter_by(email="admin@chukuta.com").first():
        admin_pw = os.getenv("ADMIN_PASSWORD", "Admin123!")
        db.session.add(Usuario(
            nombre="Administrador",
            email="admin@chukuta.com",
            password_hash=generate_password_hash(admin_pw),
            id_rol=2,
        ))
        print(f"  Admin creado: admin@chukuta.com / {admin_pw}")

    cats = [
        "Electrónica", "Ropa y Accesorios", "Alimentos y Bebidas",
        "Hogar y Jardín", "Deportes", "Juguetes", "Libros", "Otros",
    ]
    for nombre in cats:
        if not Categoria.query.filter_by(nombre_categoria=nombre).first():
            db.session.add(Categoria(nombre_categoria=nombre))

    db.session.commit()