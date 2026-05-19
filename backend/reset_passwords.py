"""
reset_passwords.py — Herramienta de emergencia para regenerar contraseñas.

Uso:
    (venv) python reset_passwords.py

Regenera los hashes de contraseña de todos los usuarios internos y clientes
de prueba usando werkzeug.security (scrypt), que es el método que usa Flask
por defecto. Ejecutar UNA VEZ después de importar el dump SQL.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from werkzeug.security import generate_password_hash

# Credenciales por defecto — cámbialas en producción
USUARIOS = [
    ("admin@chukuta.com",    "Admin123!"),
    ("vendedor1@test.com",   "Vendedor123!"),
    ("vendedor2@test.com",   "Vendedor123!"),
    ("operador@chukuta.com", "Admin123!"),
]

CLIENTES = [
    ("cliente1@test.com", "Cliente123!"),
    ("cliente2@test.com", "Cliente123!"),
    ("cliente3@test.com", "Cliente123!"),
]


def main():
    from app import create_app, db
    from app.models import Usuario, Cliente

    app = create_app()
    with app.app_context():
        print("── Actualizando contraseñas de usuarios internos ──")
        for email, pwd in USUARIOS:
            u = Usuario.query.filter_by(email=email).first()
            if u:
                u.password_hash = generate_password_hash(pwd)
                print(f"  ✓ {email}")
            else:
                print(f"  ✗ No encontrado: {email}")

        print("── Actualizando contraseñas de clientes ──")
        for email, pwd in CLIENTES:
            c = Cliente.query.filter_by(email=email).first()
            if c:
                c.password_hash = generate_password_hash(pwd)
                print(f"  ✓ {email}")
            else:
                print(f"  ✗ No encontrado: {email}")

        db.session.commit()
        print("\n✅ Listo. Contraseñas actualizadas correctamente.")
        print("\nCredenciales de prueba:")
        print("  Admin:    admin@chukuta.com     / Admin123!")
        print("  Vendedor: vendedor1@test.com    / Vendedor123!")
        print("  Cliente:  cliente1@test.com     / Cliente123!")


if __name__ == "__main__":
    main()
