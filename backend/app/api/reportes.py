"""
Blueprint de Reportes PDF — Chukuta Express v3.0
=================================================
Genera y sirve PDFs firmados por rol.

Vendedor  (require_vendedor):
  GET /vendedor/reportes/factura/<pedido_id>   → Comprobante de venta
  GET /vendedor/reportes/inventario            → Auditoría de stock

Admin (require_admin):
  GET /admin/reportes/facturacion?mes=&anio=   → Balance mensual + comisiones
  GET /admin/reportes/pago-vendedores?mes=&anio= → Payout summary
  GET /admin/reportes/manifiesto?fecha=        → Manifiesto logístico diario
"""
import datetime
import logging

from flask import Blueprint, Response, request
from sqlalchemy import extract, func

from app import db
from app.middleware import require_admin, require_vendedor
from app.models import (
    DetallePedido, EstadoPedido,
    Pedido, Producto, Usuario,
)
from app.services.pdf_reportes import (
    generar_factura_pedido,
    generar_reporte_inventario,
    generar_facturacion_global,
    generar_pago_vendedores,
    generar_manifiesto_carga,
)
from app.utils.error_handlers import error_response

logger = logging.getLogger(__name__)

reportes_bp = Blueprint("reportes", __name__)

# Tasa de comisión del marketplace (configurable, idealmente en settings.py)
TASA_COMISION = 0.10
TASA_IMPUESTO = 0.013  # IT Bolivia ≈ 1.3% sobre ingresos brutos


# ═══════════════════════════════════════════════════════════════════════════════
# HELPER
# ═══════════════════════════════════════════════════════════════════════════════

def _pdf_response(pdf_bytes: bytes, filename: str) -> Response:
    """Devuelve el PDF como respuesta inline descargable."""
    return Response(
        pdf_bytes,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Content-Length": str(len(pdf_bytes)),
            "Cache-Control": "no-store",
        },
    )


def _zona_por_direccion(direccion: str) -> str:
    """
    Inferencia básica de zona geográfica por palabras clave en la dirección.
    En producción reemplazar con geocoding o tabla de zonas en BD.
    """
    if not direccion:
        return "Sin zona"
    d = direccion.lower()
    zonas = {
        "Centro":          ["centro", "plaza murillo", "mercado", "camacho"],
        "Sopocachi":       ["sopocachi", "av. 6 de agosto", "6 agosto"],
        "Miraflores":      ["miraflores", "villa fátima", "fatima"],
        "Zona Sur":        ["calacoto", "san miguel", "achumani", "chasquipampa", "cota cota"],
        "Obrajes":         ["obrajes", "irpavi", "florida"],
        "El Alto":         ["el alto", "senkata", "16 de julio", "ciudad satélite"],
        "Norte (La Paz)":  ["norte", "max paredes", "villa victoria"],
    }
    for zona, kws in zonas.items():
        if any(kw in d for kw in kws):
            return zona
    return "Zona General"


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES DEL VENDEDOR
# ═══════════════════════════════════════════════════════════════════════════════

@reportes_bp.get("/vendedor/reportes/factura/<int:pedido_id>")
@require_vendedor
def factura_pedido_pdf(pedido_id: int):
    """
    Comprobante de venta individual.
    Se genera para pedidos con pago verificado que contengan productos del vendedor.
    """
    vid = request.usuario_id

    # Subquery: pedidos que incluyen al menos un producto de este vendedor
    subq = (
        db.session.query(DetallePedido.id_pedido)
        .join(Producto, DetallePedido.id_producto == Producto.id_producto)
        .filter(Producto.id_vendedor == vid)
        .subquery()
    )
    pedido = (
        Pedido.query
        .filter(Pedido.id_pedido == pedido_id, Pedido.id_pedido.in_(subq))
        .first()
    )
    if not pedido:
        return error_response("Pedido no encontrado o no contiene productos de tu tienda", 404)

    # Solo ítems del vendedor
    mis_detalles = [
        d.to_dict()
        for d in pedido.detalles
        if d.producto and d.producto.id_vendedor == vid
    ]
    vendedor = Usuario.query.get(vid)

    pedido_dict = pedido.to_dict()
    if pedido.cliente:
        pedido_dict["cliente_nombre"]   = pedido.cliente.nombre
        pedido_dict["cliente_telefono"] = pedido.cliente.telefono or "—"

    vendedor_dict = {
        "nombre": vendedor.nombre if vendedor else "—",
        "email":  vendedor.email  if vendedor else "—",
    }

    try:
        pdf_bytes = generar_factura_pedido(pedido_dict, vendedor_dict, mis_detalles)
    except Exception as exc:
        logger.exception("Error generando factura PDF pedido #%d: %s", pedido_id, exc)
        return error_response("Error interno al generar el PDF", 500)

    logger.info("Factura PDF generada: pedido #%d por vendedor %d", pedido_id, vid)
    return _pdf_response(pdf_bytes, f"factura_pedido_{pedido_id}.pdf")


@reportes_bp.get("/vendedor/reportes/inventario")
@require_vendedor
def inventario_pdf():
    """Reporte de inventario bajo demanda con semáforo de alertas de stock."""
    vid      = request.usuario_id
    vendedor = Usuario.query.get(vid)

    productos = (
        Producto.query
        .filter_by(id_vendedor=vid)
        .order_by(Producto.nombre)
        .all()
    )
    prods_list = [p.to_dict() for p in productos]
    vendedor_dict = {
        "nombre": vendedor.nombre if vendedor else "—",
        "email":  vendedor.email  if vendedor else "—",
    }

    try:
        pdf_bytes = generar_reporte_inventario(prods_list, vendedor_dict)
    except Exception as exc:
        logger.exception("Error generando inventario PDF vendedor %d: %s", vid, exc)
        return error_response("Error interno al generar el PDF", 500)

    fecha_hoy = datetime.date.today().strftime("%Y%m%d")
    logger.info("Inventario PDF generado para vendedor %d", vid)
    return _pdf_response(pdf_bytes, f"inventario_{fecha_hoy}.pdf")


# ═══════════════════════════════════════════════════════════════════════════════
# REPORTES DEL ADMINISTRADOR
# ═══════════════════════════════════════════════════════════════════════════════

@reportes_bp.get("/admin/reportes/facturacion")
@require_admin
def facturacion_global_pdf():
    """
    Balance financiero mensual: GMV, comisiones e impuestos.
    Query params: mes (1-12), anio (4 dígitos). Default: mes/año actual.
    """
    hoy = datetime.date.today()
    try:
        mes  = int(request.args.get("mes",  hoy.month))
        anio = int(request.args.get("anio", hoy.year))
        if not (1 <= mes <= 12 and 2020 <= anio <= 2100):
            raise ValueError
    except (TypeError, ValueError):
        return error_response("Parámetros inválidos: mes debe ser 1-12 y anio un año válido")

    # GMV y resumen por estado del período
    por_estado = (
        db.session.query(
            Pedido.estado,
            func.count(Pedido.id_pedido).label("cantidad"),
            func.coalesce(func.sum(Pedido.total), 0).label("total"),
        )
        .filter(
            extract("month", Pedido.created_at) == mes,
            extract("year",  Pedido.created_at) == anio,
        )
        .group_by(Pedido.estado)
        .all()
    )
    gmv = float(sum(r.total for r in por_estado))

    # Transacciones verificadas por método de pago
    por_metodo = (
        db.session.query(
            Pedido.metodo_pago,
            func.count(Pedido.id_pedido).label("cantidad"),
            func.coalesce(func.sum(Pedido.total), 0).label("total"),
        )
        .filter(
            extract("month", Pedido.created_at) == mes,
            extract("year",  Pedido.created_at) == anio,
            Pedido.pago_verificado == True,
        )
        .group_by(Pedido.metodo_pago)
        .all()
    )

    data = {
        "gmv_total":           gmv,
        "comisiones_netas":    gmv * TASA_COMISION,
        "impuestos_retenidos": gmv * TASA_IMPUESTO,
        "tasa_comision":       TASA_COMISION,
        "pedidos_por_estado": [
            {"estado": r.estado, "cantidad": r.cantidad, "total": float(r.total)}
            for r in por_estado
        ],
        "por_metodo_pago": [
            {"metodo": m.metodo_pago or "sin_método", "cantidad": m.cantidad, "total": float(m.total)}
            for m in por_metodo
        ],
    }

    try:
        pdf_bytes = generar_facturacion_global(data, mes, anio)
    except Exception as exc:
        logger.exception("Error generando facturación PDF %d/%d: %s", mes, anio, exc)
        return error_response("Error interno al generar el PDF", 500)

    logger.info("Facturación global PDF %d/%d por admin %d", mes, anio, request.usuario_id)
    return _pdf_response(pdf_bytes, f"facturacion_{anio}_{mes:02d}.pdf")


@reportes_bp.get("/admin/reportes/pago-vendedores")
@require_admin
def pago_vendedores_pdf():
    """
    Payout summary para dispersión de fondos.
    Query params: mes (1-12), anio (4 dígitos). Default: mes/año actual.
    """
    hoy = datetime.date.today()
    try:
        mes  = int(request.args.get("mes",  hoy.month))
        anio = int(request.args.get("anio", hoy.year))
        if not (1 <= mes <= 12 and 2020 <= anio <= 2100):
            raise ValueError
    except (TypeError, ValueError):
        return error_response("Parámetros inválidos: mes debe ser 1-12 y anio un año válido")

    MESES_ES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    periodo  = f"{MESES_ES[mes-1]} {anio}"

    # Ventas brutas por vendedor en pedidos entregados del período
    ventas = (
        db.session.query(
            Producto.id_vendedor,
            func.coalesce(
                func.sum(DetallePedido.precio_unitario * DetallePedido.cantidad), 0
            ).label("ventas_brutas"),
        )
        .join(DetallePedido, DetallePedido.id_producto == Producto.id_producto)
        .join(Pedido, DetallePedido.id_pedido == Pedido.id_pedido)
        .filter(
            Pedido.estado == EstadoPedido.ENTREGADO,
            extract("month", Pedido.created_at) == mes,
            extract("year",  Pedido.created_at) == anio,
        )
        .group_by(Producto.id_vendedor)
        .all()
    )

    ids_vendedores = {r.id_vendedor for r in ventas}
    usuarios_map   = {
        u.id_usuario: u
        for u in Usuario.query.filter(Usuario.id_usuario.in_(ids_vendedores)).all()
    }

    vendedores_list = []
    for r in ventas:
        u = usuarios_map.get(r.id_vendedor)
        vendedores_list.append({
            "id_vendedor":        r.id_vendedor,
            "nombre_tienda":      u.nombre if u else f"Tienda #{r.id_vendedor}",
            "email":              u.email  if u else "—",
            "ventas_brutas":      float(r.ventas_brutas),
            "disputas_retenidas": 0.0,  # Extensible con tabla de disputas
        })

    try:
        pdf_bytes = generar_pago_vendedores(vendedores_list, periodo, TASA_COMISION)
    except Exception as exc:
        logger.exception("Error generando payout PDF %d/%d: %s", mes, anio, exc)
        return error_response("Error interno al generar el PDF", 500)

    logger.info("Payout PDF %d/%d por admin %d", mes, anio, request.usuario_id)
    return _pdf_response(pdf_bytes, f"payout_{anio}_{mes:02d}.pdf")


@reportes_bp.get("/admin/reportes/manifiesto")
@require_admin
def manifiesto_logistico_pdf():
    """
    Manifiesto de carga diario agrupado por zona geográfica.
    Query param: fecha (YYYY-MM-DD). Default: hoy.
    """
    fecha_param = request.args.get("fecha", "")
    try:
        fecha_obj = datetime.date.fromisoformat(fecha_param) if fecha_param else datetime.date.today()
    except ValueError:
        return error_response("Formato de fecha inválido. Use YYYY-MM-DD")

    # Pedidos activos del día (confirmados, en preparación o en camino)
    pedidos_dia = (
        Pedido.query
        .filter(
            func.date(Pedido.created_at) == fecha_obj,
            Pedido.estado.in_([
                EstadoPedido.CONFIRMADO,
                EstadoPedido.EN_PREPARACION,
                EstadoPedido.EN_CAMINO,
            ]),
        )
        .order_by(Pedido.created_at)
        .all()
    )

    pedidos_list = []
    for p in pedidos_dia:
        # Vendedores únicos en el pedido
        vendedores_pedido = sorted({
            d.producto.vendedor.nombre
            for d in p.detalles
            if d.producto and d.producto.vendedor
        })
        detalles = [
            {"nombre_producto": d.producto.nombre if d.producto else "—", "cantidad": d.cantidad}
            for d in p.detalles
        ]
        pedidos_list.append({
            "id_pedido":         p.id_pedido,
            "cliente_nombre":    p.cliente.nombre    if p.cliente else "—",
            "cliente_telefono":  p.cliente.telefono  if p.cliente else "—",
            "direccion_entrega": p.direccion_entrega,
            "zona":              _zona_por_direccion(p.direccion_entrega),
            "vendedor_nombre":   ", ".join(vendedores_pedido) or "—",
            "repartidor_nombre": None,  # Extensible con tabla de asignaciones
            "detalles":          detalles,
        })

    try:
        pdf_bytes = generar_manifiesto_carga(pedidos_list, fecha_obj.isoformat())
    except Exception as exc:
        logger.exception("Error generando manifiesto PDF %s: %s", fecha_obj, exc)
        return error_response("Error interno al generar el PDF", 500)

    logger.info(
        "Manifiesto PDF %s generado: %d pedidos por admin %d",
        fecha_obj, len(pedidos_list), request.usuario_id,
    )
    return _pdf_response(pdf_bytes, f"manifiesto_{fecha_obj.strftime('%Y%m%d')}.pdf")
