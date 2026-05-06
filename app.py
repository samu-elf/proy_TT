from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import datetime
import os

app = Flask(__name__)
CORS(app, origins=["http://localhost:5173"])

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://postgres:postgres@localhost:5432/chukutaexpress'
app.config['SECRET_KEY'] = 'chukuta_secret_2024'  # Cambia esto en producción

db = SQLAlchemy(app)

# ─── MODELOS ───────────────────────────────────────────────
class Usuario(db.Model):
    __tablename__ = 'usuario'
    id_usuario = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String)
    email = db.Column(db.String, unique=True)
    password = db.Column(db.String)
    id_rol = db.Column(db.Integer)

class Cliente(db.Model):
    __tablename__ = 'cliente'
    id_cliente = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    telefono = db.Column(db.String(20))
    direccion = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class Carrito(db.Model):
    __tablename__ = 'carrito'
    id_carrito = db.Column(db.Integer, primary_key=True)
    id_cliente = db.Column(db.Integer, db.ForeignKey('cliente.id_cliente'))
    id_producto = db.Column(db.Integer)
    cantidad = db.Column(db.Integer, default=1)

class Pedido(db.Model):
    __tablename__ = 'pedido'
    id_pedido = db.Column(db.Integer, primary_key=True)
    id_cliente = db.Column(db.Integer, db.ForeignKey('cliente.id_cliente'))
    total = db.Column(db.Numeric(10, 2))
    estado = db.Column(db.String(30), default='pendiente')
    direccion_entrega = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.datetime.utcnow)

class DetallePedido(db.Model):
    __tablename__ = 'detalle_pedido'
    id_detalle = db.Column(db.Integer, primary_key=True)
    id_pedido = db.Column(db.Integer, db.ForeignKey('pedido.id_pedido'))
    id_producto = db.Column(db.Integer)
    cantidad = db.Column(db.Integer)
    precio_unitario = db.Column(db.Numeric(10, 2))

# ─── HELPERS ───────────────────────────────────────────────
def generate_token(payload):
    payload['exp'] = datetime.datetime.utcnow() + datetime.timedelta(hours=24)
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_cliente_token(request):
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    try:
        token = auth.split(' ')[1]
        data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        if data.get('tipo') != 'cliente':
            return None
        return data
    except:
        return None

# ─── AUTH ADMIN/VENDEDOR (existente, sin cambios) ──────────
@app.route('/login', methods=['POST'])
def login_general():
    data = request.json
    user = Usuario.query.filter_by(email=data.get('email')).first()
    if user and user.password == str(data.get('password')):
        return jsonify({
            "status": "success",
            "mensaje": f"Bienvenido {user.nombre}",
            "usuario": {"nombre": user.nombre, "rol": user.id_rol}
        }), 200
    return jsonify({"status": "error", "mensaje": "Correo o contraseña incorrectos"}), 401

# ─── AUTH CLIENTE ───────────────────────────────────────────
@app.route('/cliente/registro', methods=['POST'])
def registro_cliente():
    data = request.json
    if Cliente.query.filter_by(email=data.get('email')).first():
        return jsonify({"status": "error", "mensaje": "El email ya está registrado"}), 400
    
    nuevo = Cliente(
        nombre=data.get('nombre'),
        email=data.get('email'),
        password=generate_password_hash(data.get('password')),
        telefono=data.get('telefono', ''),
        direccion=data.get('direccion', '')
    )
    db.session.add(nuevo)
    db.session.commit()
    
    token = generate_token({'id_cliente': nuevo.id_cliente, 'tipo': 'cliente'})
    return jsonify({
        "status": "success",
        "token": token,
        "cliente": {"id": nuevo.id_cliente, "nombre": nuevo.nombre, "email": nuevo.email}
    }), 201

@app.route('/cliente/login', methods=['POST'])
def login_cliente():
    data = request.json
    cliente = Cliente.query.filter_by(email=data.get('email')).first()
    if not cliente or not check_password_hash(cliente.password, data.get('password')):
        return jsonify({"status": "error", "mensaje": "Credenciales incorrectas"}), 401
    
    token = generate_token({'id_cliente': cliente.id_cliente, 'tipo': 'cliente'})
    return jsonify({
        "status": "success",
        "token": token,
        "cliente": {"id": cliente.id_cliente, "nombre": cliente.nombre, "email": cliente.email}
    }), 200

# ─── PRODUCTOS (público) ─────────────────────────────────────
@app.route('/productos', methods=['GET'])
def get_productos():
    categoria = request.args.get('categoria')
    busqueda = request.args.get('q', '')
    
    sql = """
        SELECT a.id_producto, a.nombre, a.codigo, a.stock, a.precio_venta, c.nombre_categoria
        FROM almacen a
        JOIN categoria c ON a.id_categoria = c.id_categoria
        WHERE a.stock > 0
    """
    params = {}
    if busqueda:
        sql += " AND LOWER(a.nombre) LIKE :busqueda"
        params['busqueda'] = f'%{busqueda.lower()}%'
    if categoria:
        sql += " AND c.nombre_categoria = :categoria"
        params['categoria'] = categoria
    
    rows = db.session.execute(db.text(sql), params)
    return jsonify([{
        "id_producto": r[0], "nombre": r[1], "codigo": r[2],
        "stock": r[3], "precio_venta": float(r[4]), "nombre_categoria": r[5]
    } for r in rows])

@app.route('/productos/<int:id>', methods=['GET'])
def get_producto(id):
    row = db.session.execute(db.text("""
        SELECT a.id_producto, a.nombre, a.codigo, a.stock, a.precio_venta, c.nombre_categoria
        FROM almacen a JOIN categoria c ON a.id_categoria = c.id_categoria
        WHERE a.id_producto = :id
    """), {'id': id}).fetchone()
    if not row:
        return jsonify({"error": "Producto no encontrado"}), 404
    return jsonify({
        "id_producto": row[0], "nombre": row[1], "codigo": row[2],
        "stock": row[3], "precio_venta": float(row[4]), "nombre_categoria": row[5]
    })

@app.route('/categorias', methods=['GET'])
def get_categorias():
    rows = db.session.execute(db.text("SELECT DISTINCT nombre_categoria FROM categoria ORDER BY nombre_categoria"))
    return jsonify([r[0] for r in rows])

# ─── CARRITO (requiere token cliente) ────────────────────────
@app.route('/cliente/carrito', methods=['GET'])
def get_carrito():
    token_data = verify_cliente_token(request)
    if not token_data:
        return jsonify({"error": "No autorizado"}), 401
    
    rows = db.session.execute(db.text("""
        SELECT c.id_carrito, a.id_producto, a.nombre, a.precio_venta, c.cantidad,
               (a.precio_venta * c.cantidad) as subtotal
        FROM carrito c
        JOIN almacen a ON c.id_producto = a.id_producto
        WHERE c.id_cliente = :id
    """), {'id': token_data['id_cliente']})
    
    items = [{"id_carrito": r[0], "id_producto": r[1], "nombre": r[2],
              "precio_venta": float(r[3]), "cantidad": r[4], "subtotal": float(r[5])} for r in rows]
    total = sum(i['subtotal'] for i in items)
    return jsonify({"items": items, "total": total})

@app.route('/cliente/carrito', methods=['POST'])
def agregar_carrito():
    token_data = verify_cliente_token(request)
    if not token_data:
        return jsonify({"error": "No autorizado"}), 401
    
    data = request.json
    existing = Carrito.query.filter_by(
        id_cliente=token_data['id_cliente'],
        id_producto=data['id_producto']
    ).first()
    
    if existing:
        existing.cantidad += data.get('cantidad', 1)
    else:
        item = Carrito(
            id_cliente=token_data['id_cliente'],
            id_producto=data['id_producto'],
            cantidad=data.get('cantidad', 1)
        )
        db.session.add(item)
    
    db.session.commit()
    return jsonify({"status": "ok", "mensaje": "Producto agregado al carrito"})

@app.route('/cliente/carrito/<int:id_carrito>', methods=['DELETE'])
def eliminar_carrito(id_carrito):
    token_data = verify_cliente_token(request)
    if not token_data:
        return jsonify({"error": "No autorizado"}), 401
    
    item = Carrito.query.filter_by(
        id_carrito=id_carrito,
        id_cliente=token_data['id_cliente']
    ).first()
    if item:
        db.session.delete(item)
        db.session.commit()
    return jsonify({"status": "ok"})

# ─── PEDIDOS ─────────────────────────────────────────────────
@app.route('/cliente/pedido', methods=['POST'])
def crear_pedido():
    token_data = verify_cliente_token(request)
    if not token_data:
        return jsonify({"error": "No autorizado"}), 401
    
    data = request.json
    id_cliente = token_data['id_cliente']
    
    # Obtener carrito
    rows = db.session.execute(db.text("""
        SELECT c.id_producto, a.precio_venta, c.cantidad
        FROM carrito c JOIN almacen a ON c.id_producto = a.id_producto
        WHERE c.id_cliente = :id
    """), {'id': id_cliente}).fetchall()
    
    if not rows:
        return jsonify({"error": "Carrito vacío"}), 400
    
    total = sum(float(r[1]) * r[2] for r in rows)
    pedido = Pedido(id_cliente=id_cliente, total=total, direccion_entrega=data.get('direccion', ''))
    db.session.add(pedido)
    db.session.flush()
    
    for r in rows:
        detalle = DetallePedido(
            id_pedido=pedido.id_pedido,
            id_producto=r[0],
            cantidad=r[2],
            precio_unitario=float(r[1])
        )
        db.session.add(detalle)
        # Reducir stock
        db.session.execute(db.text(
            "UPDATE almacen SET stock = stock - :cant WHERE id_producto = :id"
        ), {'cant': r[2], 'id': r[0]})
    
    # Limpiar carrito
    db.session.execute(db.text("DELETE FROM carrito WHERE id_cliente = :id"), {'id': id_cliente})
    db.session.commit()
    
    return jsonify({"status": "ok", "id_pedido": pedido.id_pedido, "total": total})

@app.route('/cliente/pedidos', methods=['GET'])
def mis_pedidos():
    token_data = verify_cliente_token(request)
    if not token_data:
        return jsonify({"error": "No autorizado"}), 401
    
    rows = db.session.execute(db.text("""
        SELECT p.id_pedido, p.total, p.estado, p.created_at
        FROM pedido p WHERE p.id_cliente = :id ORDER BY p.created_at DESC
    """), {'id': token_data['id_cliente']})
    
    return jsonify([{
        "id_pedido": r[0], "total": float(r[1]),
        "estado": r[2], "fecha": r[3].isoformat()
    } for r in rows])

if __name__ == '__main__':
    app.run(debug=True)