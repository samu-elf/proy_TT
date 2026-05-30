# ==============================================================================
# SERVICIO DE AUDITORÍA
# Registra acciones CREATE / UPDATE / DELETE en la tabla auditoria_log.
# Expone: AuditoriaService.log(tabla, accion, id_registro, ...)
# ==============================================================================
#Servicio de auditoría para registrar acciones críticas del sistema.
import json
import logging
from flask import request
from app import db

logger = logging.getLogger(__name__)


class AuditoriaService:

    @staticmethod
    def registrar(
        tabla: str,
        accion: str,
        id_registro: int | None = None,
        datos_anteriores: dict | None = None,
        datos_nuevos: dict | None = None,
        id_usuario: int | None = None,
        id_cliente: int | None = None,
    ):
        """Registra un evento de auditoría en la base de datos."""
        try:
            from app.models import AuditoriaLog
            log = AuditoriaLog(
                tabla=tabla,
                accion=accion,
                id_registro=id_registro,
                datos_anteriores=json.dumps(datos_anteriores) if datos_anteriores else None,
                datos_nuevos=json.dumps(datos_nuevos) if datos_nuevos else None,
                id_usuario=id_usuario,
                id_cliente=id_cliente,
                ip_address=_get_ip(),
                user_agent=request.headers.get("User-Agent", "")[:200],
            )
            db.session.add(log)
            # No hacemos commit aquí para no romper transacciones existentes
        except Exception as e:
            logger.error(f"Error al registrar auditoría: {e}")

    @staticmethod
    def registrar_movimiento_inventario(
        id_producto: int,
        tipo: str,
        cantidad: int,
        stock_anterior: int,
        stock_nuevo: int,
        motivo: str = "",
        id_pedido: int | None = None,
        id_usuario: int | None = None,
    ):
        """Registra un movimiento de inventario."""
        try:
            from app.models import MovimientoInventario
            mov = MovimientoInventario(
                id_producto=id_producto,
                tipo=tipo,
                cantidad=cantidad,
                stock_anterior=stock_anterior,
                stock_nuevo=stock_nuevo,
                motivo=motivo,
                id_pedido=id_pedido,
                id_usuario=id_usuario,
            )
            db.session.add(mov)
        except Exception as e:
            logger.error(f"Error al registrar movimiento inventario: {e}")


def _get_ip() -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()[:45]
    return (request.remote_addr or "unknown")[:45]


# ==============================================================================
# GENERACIÓN DE PDFs (ReportLab)
# Genera los 5 reportes PDF del sistema para Vendedor y Administrador.
# Expone: generar_factura_pedido, generar_reporte_inventario,
#         generar_facturacion_global, generar_pago_vendedores, generar_manifiesto_carga
# ==============================================================================
"""
pdf_reportes.py — Chukuta Express v3.0
=======================================
Servicio centralizado de generación de PDFs con ReportLab.

Reportes disponibles:
  Vendedor:
    · generar_factura_pedido()     → Comprobante de venta / picking list
    · generar_reporte_inventario() → Auditoría de stock con alertas

  Administrador:
    · generar_facturacion_global() → Balance mensual del marketplace
    · generar_pago_vendedores()    → Payout summary por tienda
    · generar_manifiesto_carga()   → Consolidador logístico diario
"""
import io
import datetime
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable, KeepTogether,
)

# ═══════════════════════════════════════════════════════════════════════════════
# PALETA Y ESTILOS GLOBALES
# ═══════════════════════════════════════════════════════════════════════════════

C_PRIMARY   = colors.HexColor("#6c63ff")   # Violeta marca
C_DARK      = colors.HexColor("#1f2a38")   # Sidebar oscuro
C_SUCCESS   = colors.HexColor("#10b981")   # Verde éxito
C_WARNING   = colors.HexColor("#f59e0b")   # Ámbar advertencia
C_DANGER    = colors.HexColor("#ef4444")   # Rojo peligro
C_GRAY      = colors.HexColor("#6b7280")   # Texto secundario
C_LIGHT     = colors.HexColor("#f8fafc")   # Fondo suave
C_BORDER    = colors.HexColor("#e2e8f0")   # Líneas de tabla
C_WHITE     = colors.white
C_BLACK     = colors.HexColor("#111827")


def _estilo(nombre, **kwargs) -> ParagraphStyle:
    base = dict(fontName="Helvetica", fontSize=9, leading=12, textColor=C_BLACK)
    base.update(kwargs)
    return ParagraphStyle(nombre, **base)


# Estilos reutilizables
S_TITULO    = _estilo("titulo",   fontSize=20, fontName="Helvetica-Bold", textColor=C_DARK, spaceAfter=2)
S_SUBTITULO = _estilo("subtitulo", fontSize=10, textColor=C_GRAY, spaceAfter=4)
S_BODY      = _estilo("body",     fontSize=9)
S_BODY_B    = _estilo("body_b",   fontSize=9,  fontName="Helvetica-Bold")
S_BODY_R    = _estilo("body_r",   fontSize=9,  alignment=TA_RIGHT)
S_SMALL     = _estilo("small",    fontSize=7.5, textColor=C_GRAY)
S_SMALL_C   = _estilo("small_c",  fontSize=7.5, textColor=C_GRAY, alignment=TA_CENTER)
S_HEADER_W  = _estilo("hdr_w",    fontSize=8.5, fontName="Helvetica-Bold",
                       textColor=C_WHITE, alignment=TA_CENTER)
S_TOTAL     = _estilo("total",    fontSize=13,  fontName="Helvetica-Bold", textColor=C_PRIMARY, alignment=TA_RIGHT)
S_KPI_VAL   = _estilo("kpi_val",  fontSize=17,  fontName="Helvetica-Bold", alignment=TA_CENTER)
S_KPI_LBL   = _estilo("kpi_lbl",  fontSize=8,   textColor=C_GRAY, alignment=TA_CENTER)
S_BADGE_OK  = _estilo("bdg_ok",   fontSize=8,   fontName="Helvetica-Bold", textColor=C_SUCCESS, alignment=TA_CENTER)
S_BADGE_W   = _estilo("bdg_w",    fontSize=8,   fontName="Helvetica-Bold", textColor=C_WARNING, alignment=TA_CENTER)
S_BADGE_D   = _estilo("bdg_d",    fontSize=8,   fontName="Helvetica-Bold", textColor=C_DANGER,  alignment=TA_CENTER)


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS DE LAYOUT
# ═══════════════════════════════════════════════════════════════════════════════

def _bs(valor) -> str:
    """Formatea un valor como moneda boliviana."""
    try:
        return f"Bs {float(valor):,.2f}"
    except (TypeError, ValueError):
        return "Bs 0.00"


def _fecha_iso(iso: str, hora: bool = True) -> str:
    """Formatea un string ISO a fecha legible en español."""
    try:
        dt = datetime.datetime.fromisoformat(iso)
        if hora:
            return dt.strftime("%d/%m/%Y %H:%M")
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return iso


def _encabezado_doc(titulo: str, subtitulo: str, meta: dict, doc_w: float) -> Table:
    """
    Encabezado bicolumna: marca a la izquierda, metadatos a la derecha.
    Devuelve una Table lista para añadir al story.
    """
    col_izq = [
        Paragraph("Chukuta Express", S_TITULO),
        Paragraph(titulo,   _estilo("t2", fontSize=12, fontName="Helvetica-Bold", textColor=C_PRIMARY)),
        Paragraph(subtitulo, S_SUBTITULO),
    ]
    col_der = [Paragraph(f"<b>{k}:</b> {v}", S_SMALL) for k, v in meta.items()]

    tbl = Table([[col_izq, col_der]], colWidths=[doc_w * 0.58, doc_w * 0.42])
    tbl.setStyle(TableStyle([
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("ALIGN",         (1, 0), (1, 0),   "RIGHT"),
        ("LINEBELOW",     (0, 0), (-1, 0),  1, C_PRIMARY),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  6),
    ]))
    return tbl


def _barra_seccion(texto: str, ancho: float) -> Table:
    """Barra de título de sección con fondo del color de la marca."""
    tbl = Table([[Paragraph(texto, S_HEADER_W)]], colWidths=[ancho])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), C_PRIMARY),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 8),
        ("ALIGN",         (0, 0), (-1, -1), "LEFT"),
    ]))
    return tbl


def _tabla_datos(filas: list, anchos: list, alternar: bool = True) -> Table:
    """
    Tabla estándar: primera fila = encabezado (fondo oscuro, texto blanco).
    Resto de filas con fondos alternados claro/blanco.
    """
    tbl = Table(filas, colWidths=anchos, repeatRows=1)
    estilo = [
        # Encabezado
        ("BACKGROUND",    (0, 0), (-1, 0),  C_DARK),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  C_WHITE),
        ("FONTNAME",      (0, 0), (-1, 0),  "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, 0),  8),
        ("ALIGN",         (0, 0), (-1, 0),  "CENTER"),
        # Cuerpo
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 5),
        ("GRID",          (0, 0), (-1, -1), 0.3, C_BORDER),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]
    if alternar:
        estilo.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_WHITE, C_LIGHT]))
    tbl.setStyle(TableStyle(estilo))
    return tbl


def _pie(story: list, texto: str, doc_w: float):
    """Añade línea separadora y texto de pie al story."""
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width=doc_w, color=C_BORDER, thickness=0.4))
    story.append(Spacer(1, 3))
    story.append(Paragraph(texto, S_SMALL))


def _nuevo_doc(orientacion="portrait") -> tuple:
    """Crea un BytesIO + SimpleDocTemplate con márgenes estándar."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.8*cm, bottomMargin=1.8*cm,
    )
    return buf, doc


# ═══════════════════════════════════════════════════════════════════════════════
# 1. FACTURA DE PEDIDO  (Vendedor)
# ═══════════════════════════════════════════════════════════════════════════════

def generar_factura_pedido(pedido: dict, vendedor: dict, mis_detalles: list) -> bytes:
    """
    Comprobante de venta + picking list para el vendedor.

    pedido       – dict del modelo Pedido (to_dict + cliente_nombre/telefono)
    vendedor     – dict del modelo Usuario (nombre, email)
    mis_detalles – lista de DetallePedido.to_dict() del vendedor
    """
    buf, doc = _nuevo_doc()
    W = doc.width
    story = []

    # ── Encabezado ────────────────────────────────────────────────────────────
    estado = pedido.get("estado", "—").replace("_", " ").title()
    metodo = (pedido.get("metodo_pago") or "—").replace("_", " ").title()
    pago_v = "✔ Verificado" if pedido.get("pago_verificado") else "Pendiente"
    fecha  = _fecha_iso(pedido.get("fecha", ""))

    story.append(_encabezado_doc(
        titulo="Factura / Comprobante de Venta",
        subtitulo=f"Tienda: {vendedor.get('nombre', '—')}",
        meta={
            "N° Pedido":    f"#{pedido.get('id_pedido', '—')}",
            "Fecha":        fecha,
            "Seguimiento":  pedido.get("codigo_seguimiento") or "—",
            "Estado":       estado,
            "Pago":         f"{metodo} — {pago_v}",
        },
        doc_w=W,
    ))
    story.append(Spacer(1, 8))

    # ── Datos de entrega ──────────────────────────────────────────────────────
    story.append(_barra_seccion("📦  Datos de Entrega al Cliente", W))
    story.append(Spacer(1, 4))

    filas_entrega = [
        [Paragraph("<b>Cliente:</b>",   S_BODY), Paragraph(pedido.get("cliente_nombre", "—"), S_BODY)],
        [Paragraph("<b>Teléfono:</b>",  S_BODY), Paragraph(pedido.get("cliente_telefono", "—"), S_BODY)],
        [Paragraph("<b>Dirección:</b>", S_BODY), Paragraph(pedido.get("direccion_entrega", "—"), S_BODY)],
    ]
    if pedido.get("notas"):
        filas_entrega.append([
            Paragraph("<b>Notas:</b>", S_BODY),
            Paragraph(pedido["notas"], S_BODY),
        ])

    tbl_e = Table(filas_entrega, colWidths=[3.5*cm, W - 3.5*cm])
    tbl_e.setStyle(TableStyle([
        ("VALIGN",       (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING",   (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
        ("LEFTPADDING",  (0, 0), (-1, -1), 2),
    ]))
    story.append(tbl_e)
    story.append(Spacer(1, 10))

    # ── Detalle de productos ──────────────────────────────────────────────────
    story.append(_barra_seccion("🛒  Productos a Preparar (Picking List)", W))
    story.append(Spacer(1, 4))

    col_w_prod = [W*0.44, W*0.09, W*0.22, W*0.25]
    filas_prod = [["Producto", "Cant.", "Precio Unit.", "Subtotal"]]
    subtotal_items = 0.0

    for d in mis_detalles:
        sub = float(d.get("subtotal") or float(d.get("precio_unitario", 0)) * int(d.get("cantidad", 1)))
        subtotal_items += sub
        filas_prod.append([
            d.get("nombre_producto", "—"),
            str(d.get("cantidad", 0)),
            _bs(d.get("precio_unitario", 0)),
            _bs(sub),
        ])

    tbl_prod = _tabla_datos(filas_prod, col_w_prod)
    # Alineaciones específicas
    tbl_prod.setStyle(TableStyle([
        ("ALIGN",  (1, 0), (-1, -1), "RIGHT"),
        ("ALIGN",  (0, 1), (0, -1),  "LEFT"),
    ]))
    story.append(tbl_prod)
    story.append(Spacer(1, 8))

    # ── Totales ───────────────────────────────────────────────────────────────
    total_pedido = float(pedido.get("total", subtotal_items))
    envio = total_pedido - subtotal_items
    envio_txt = _bs(envio) if envio > 0.01 else "Incluido"

    filas_tot = [
        ["Subtotal productos:", _bs(subtotal_items)],
        ["Costo de envío:",     envio_txt],
        ["TOTAL DEL PEDIDO:",   _bs(total_pedido)],
    ]
    tbl_tot = Table(filas_tot, colWidths=[W - 4.5*cm, 4.5*cm])
    tbl_tot.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE",      (0, 0), (-1, -2), 9),
        ("FONTNAME",      (0, -1),(-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, -1),(-1, -1), 13),
        ("TEXTCOLOR",     (0, -1),(-1, -1), C_PRIMARY),
        ("LINEABOVE",     (0, -1),(-1, -1), 0.8, C_PRIMARY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl_tot)

    _pie(story,
         "Documento generado automáticamente por Chukuta Express. "
         "El repartidor debe entregar este comprobante al cliente junto con su pedido.",
         W)

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 2. REPORTE DE INVENTARIO  (Vendedor)
# ═══════════════════════════════════════════════════════════════════════════════

def generar_reporte_inventario(productos: list, vendedor: dict) -> bytes:
    """
    Auditoría de stock con semáforo de alertas para el vendedor.

    productos – lista de Producto.to_dict() del vendedor
    vendedor  – dict del modelo Usuario
    """
    buf, doc = _nuevo_doc()
    W = doc.width
    story = []

    ahora = datetime.datetime.now().strftime("%d/%m/%Y %H:%M")
    total  = len(productos)
    agotados   = sum(1 for p in productos if p.get("stock", 0) == 0)
    criticos   = sum(1 for p in productos if 0 < p.get("stock", 0) <= p.get("stock_minimo", 5))
    normales   = total - agotados - criticos

    story.append(_encabezado_doc(
        titulo="Reporte de Inventario y Alertas de Stock",
        subtitulo=f"Tienda: {vendedor.get('nombre', '—')}",
        meta={
            "Generado": ahora,
            "Total SKUs": str(total),
        },
        doc_w=W,
    ))
    story.append(Spacer(1, 8))

    # ── KPIs de resumen ───────────────────────────────────────────────────────
    kpi_data = [
        [Paragraph("✅  En Stock Normal", S_KPI_LBL),
         Paragraph("⚠️  Stock Crítico",    S_KPI_LBL),
         Paragraph("❌  Agotado",          S_KPI_LBL)],
        [Paragraph(str(normales),  _estilo("kv_ok", fontSize=22, fontName="Helvetica-Bold",
                                           textColor=C_SUCCESS, alignment=TA_CENTER)),
         Paragraph(str(criticos),  _estilo("kv_w",  fontSize=22, fontName="Helvetica-Bold",
                                           textColor=C_WARNING, alignment=TA_CENTER)),
         Paragraph(str(agotados),  _estilo("kv_d",  fontSize=22, fontName="Helvetica-Bold",
                                           textColor=C_DANGER,  alignment=TA_CENTER))],
    ]
    tbl_kpi = Table(kpi_data, colWidths=[W/3, W/3, W/3])
    tbl_kpi.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND",    (0, 0), (-1, -1), C_LIGHT),
        ("GRID",          (0, 0), (-1, -1), 0.3, C_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(tbl_kpi)
    story.append(Spacer(1, 10))

    # ── Tabla de productos ────────────────────────────────────────────────────
    story.append(_barra_seccion("📋  Catálogo Completo de Inventario", W))
    story.append(Spacer(1, 4))

    col_w_inv = [W*0.11, W*0.30, W*0.19, W*0.12, W*0.11, W*0.17]
    filas_inv = [["SKU / ID", "Producto", "Categoría", "Stock Act.", "Stock Mín.", "Estado"]]

    # Ordenar: agotados → críticos → normales, y alfabético dentro de cada grupo
    def _orden(p):
        s = p.get("stock", 0)
        sm = p.get("stock_minimo", 5)
        if s == 0:   prioridad = 0
        elif s <= sm: prioridad = 1
        else:         prioridad = 2
        return (prioridad, p.get("nombre", "").lower())

    for p in sorted(productos, key=_orden):
        stock  = p.get("stock", 0)
        sm     = p.get("stock_minimo", 5)
        sku    = p.get("codigo") or f"#{p.get('id_producto', '—')}"
        if stock == 0:
            estado_txt = "❌ Agotado"
        elif stock <= sm:
            estado_txt = "⚠️ Stock Crítico"
        else:
            estado_txt = "✅ Normal"

        filas_inv.append([
            sku,
            p.get("nombre", "—"),
            p.get("nombre_categoria", "—"),
            str(stock),
            str(sm),
            estado_txt,
        ])

    tbl_inv = _tabla_datos(filas_inv, col_w_inv)
    # Color en columna Estado según valor
    for i, p in enumerate(sorted(productos, key=_orden), start=1):
        s  = p.get("stock", 0)
        sm = p.get("stock_minimo", 5)
        if s == 0:
            tbl_inv.setStyle(TableStyle([
                ("TEXTCOLOR", (5, i), (5, i), C_DANGER),
                ("FONTNAME",  (5, i), (5, i), "Helvetica-Bold"),
            ]))
        elif s <= sm:
            tbl_inv.setStyle(TableStyle([
                ("TEXTCOLOR", (5, i), (5, i), C_WARNING),
                ("FONTNAME",  (5, i), (5, i), "Helvetica-Bold"),
            ]))
        else:
            tbl_inv.setStyle(TableStyle([
                ("TEXTCOLOR", (5, i), (5, i), C_SUCCESS),
            ]))

    story.append(tbl_inv)

    _pie(story,
         "Reporte generado bajo demanda. Datos en tiempo real al momento de la generación. "
         "Contacte a sus proveedores para productos con estado Crítico o Agotado.",
         W)

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 3. REPORTE DE FACTURACIÓN GLOBAL  (Administrador)
# ═══════════════════════════════════════════════════════════════════════════════

def generar_facturacion_global(data: dict, mes: int, anio: int) -> bytes:
    """
    Balance financiero mensual del marketplace.

    data = {
      gmv_total:           float,
      comisiones_netas:    float,
      impuestos_retenidos: float,
      tasa_comision:       float,
      pedidos_por_estado:  [{ estado, cantidad, total }],
      por_metodo_pago:     [{ metodo, cantidad, total }],
    }
    """
    buf, doc = _nuevo_doc()
    W = doc.width
    story = []

    MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
             "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
    periodo = f"{MESES[mes-1]} {anio}" if 1 <= mes <= 12 else f"{mes}/{anio}"

    story.append(_encabezado_doc(
        titulo="Reporte de Facturación Global y Comisiones",
        subtitulo="Administración del Marketplace — Documento Contable Oficial",
        meta={
            "Período":  periodo,
            "Tasa com.": f"{data.get('tasa_comision', 0)*100:.1f}%",
            "Generado": datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
        },
        doc_w=W,
    ))
    story.append(Spacer(1, 8))

    # ── KPIs principales ──────────────────────────────────────────────────────
    gmv     = float(data.get("gmv_total", 0))
    com     = float(data.get("comisiones_netas", 0))
    imp     = float(data.get("impuestos_retenidos", 0))
    tasa    = float(data.get("tasa_comision", 0))

    kpi_vals = [
        (_bs(gmv),  "GMV Total",          C_PRIMARY),
        (_bs(com),  "Comisiones Netas",    C_SUCCESS),
        (_bs(imp),  "Impuestos Retenidos", C_WARNING),
    ]
    row_lbl = []
    row_val = []
    row_sub = []
    for val, lbl, col in kpi_vals:
        row_lbl.append(Paragraph(lbl, S_KPI_LBL))
        row_val.append(Paragraph(val, _estilo(f"kv_{lbl}", fontSize=14,
                                              fontName="Helvetica-Bold",
                                              textColor=col, alignment=TA_CENTER)))
        row_sub.append(Paragraph("" if lbl == "GMV Total" else f"Tasa {tasa*100:.1f}%" if "Com" in lbl else "IT 13%", S_KPI_LBL))

    tbl_kpi = Table([row_lbl, row_val, row_sub], colWidths=[W/3, W/3, W/3])
    tbl_kpi.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("BACKGROUND",    (0, 0), (-1, -1), C_LIGHT),
        ("GRID",          (0, 0), (-1, -1), 0.3, C_BORDER),
        ("TOPPADDING",    (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(tbl_kpi)
    story.append(Spacer(1, 12))

    # ── Por método de pago ────────────────────────────────────────────────────
    story.append(_barra_seccion("💳  Transacciones por Pasarela de Pago", W))
    story.append(Spacer(1, 4))

    metodos = data.get("por_metodo_pago", [])
    if metodos:
        col_w_mp = [W*0.32, W*0.20, W*0.24, W*0.24]
        filas_mp = [["Método de Pago", "Transacciones", "Monto Total", "% del GMV"]]
        for m in metodos:
            monto = float(m.get("total", 0))
            pct   = (monto / gmv * 100) if gmv else 0
            filas_mp.append([
                str(m.get("metodo") or "—").replace("_", " ").title(),
                str(m.get("cantidad", 0)),
                _bs(monto),
                f"{pct:.1f}%",
            ])
        story.append(_tabla_datos(filas_mp, col_w_mp))
    else:
        story.append(Paragraph("Sin transacciones verificadas para este período.", S_SMALL))
    story.append(Spacer(1, 12))

    # ── Por estado de pedido ──────────────────────────────────────────────────
    story.append(_barra_seccion("📊  Resumen de Pedidos por Estado", W))
    story.append(Spacer(1, 4))

    por_estado = data.get("pedidos_por_estado", [])
    if por_estado:
        col_w_pe = [W*0.38, W*0.22, W*0.20, W*0.20]
        filas_pe = [["Estado", "Cantidad", "Monto Total", "% GMV"]]
        for pe in por_estado:
            monto = float(pe.get("total", 0))
            pct   = (monto / gmv * 100) if gmv else 0
            filas_pe.append([
                str(pe.get("estado") or "—").replace("_", " ").title(),
                str(pe.get("cantidad", 0)),
                _bs(monto),
                f"{pct:.1f}%",
            ])
        story.append(_tabla_datos(filas_pe, col_w_pe))

    _pie(story,
         f"Documento contable oficial — Chukuta Express | Período: {periodo}. "
         "Generado al cierre del ciclo fiscal mensual. Uso exclusivo de tesorería y auditoría.",
         W)

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 4. PAGO A VENDEDORES — PAYOUT SUMMARY  (Administrador)
# ═══════════════════════════════════════════════════════════════════════════════

def generar_pago_vendedores(vendedores: list, periodo: str, tasa_comision: float = 0.10) -> bytes:
    """
    Matriz de pagos para dispersión de fondos a comercios.

    vendedores – lista de dicts:
        { id_vendedor, nombre_tienda, email, ventas_brutas, disputas_retenidas }
    periodo    – str legible, ej. "Mayo 2026"
    """
    buf, doc = _nuevo_doc()
    W = doc.width
    story = []

    story.append(_encabezado_doc(
        titulo="Pago a Vendedores — Payout Summary",
        subtitulo="Documento de Tesorería — Chukuta Express",
        meta={
            "Período":   periodo,
            "Comisión":  f"{tasa_comision*100:.1f}%",
            "Generado":  datetime.datetime.now().strftime("%d/%m/%Y %H:%M"),
            "Vendedores": str(len(vendedores)),
        },
        doc_w=W,
    ))
    story.append(Spacer(1, 8))

    # ── Tabla de vendedores ───────────────────────────────────────────────────
    story.append(_barra_seccion("💰  Detalle de Liquidación por Tienda", W))
    story.append(Spacer(1, 4))

    col_w_v = [W*0.05, W*0.26, W*0.17, W*0.17, W*0.15, W*0.20]
    filas_v = [["ID", "Tienda / Vendedor", "Ventas Brutas", "Comisión", "Retenciones", "Neto a Pagar"]]

    tot_bruto = tot_com = tot_ret = tot_neto = 0.0
    for v in vendedores:
        bruto = float(v.get("ventas_brutas", 0))
        com   = bruto * tasa_comision
        ret   = float(v.get("disputas_retenidas", 0))
        neto  = bruto - com - ret
        tot_bruto += bruto; tot_com += com; tot_ret += ret; tot_neto += neto
        filas_v.append([
            str(v.get("id_vendedor", "—")),
            v.get("nombre_tienda", v.get("nombre", "—")),
            _bs(bruto),
            _bs(com),
            _bs(ret) if ret > 0 else "—",
            _bs(neto),
        ])

    # Fila de totales
    filas_v.append(["", "TOTALES", _bs(tot_bruto), _bs(tot_com), _bs(tot_ret), _bs(tot_neto)])

    tbl_v = _tabla_datos(filas_v, col_w_v)
    last  = len(filas_v) - 1
    tbl_v.setStyle(TableStyle([
        ("ALIGN",      (2, 0), (-1, -1), "RIGHT"),
        ("ALIGN",      (0, 0), (0, -1),  "CENTER"),
        ("FONTNAME",   (0, last), (-1, last), "Helvetica-Bold"),
        ("LINEABOVE",  (0, last), (-1, last), 1, C_PRIMARY),
        ("TEXTCOLOR",  (5, last), (5, last),  C_PRIMARY),
        ("BACKGROUND", (0, last), (-1, last), C_LIGHT),
    ]))
    story.append(tbl_v)
    story.append(Spacer(1, 12))

    # ── Resumen de tesorería ──────────────────────────────────────────────────
    story.append(_barra_seccion("🏦  Resumen Ejecutivo de Tesorería", W))
    story.append(Spacer(1, 4))

    filas_res = [
        ["Total ventas brutas del período:", _bs(tot_bruto)],
        ["Total comisiones recaudadas:",      _bs(tot_com)],
        ["Total retenciones por disputas:",   _bs(tot_ret)],
        ["TOTAL A DESEMBOLSAR:",              _bs(tot_neto)],
    ]
    tbl_res = Table(filas_res, colWidths=[W - 5*cm, 5*cm])
    tbl_res.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "RIGHT"),
        ("FONTSIZE",      (0, 0), (-1, -2), 9),
        ("FONTNAME",      (0, -1),(-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, -1),(-1, -1), 13),
        ("TEXTCOLOR",     (0, -1),(-1, -1), C_PRIMARY),
        ("LINEABOVE",     (0, -1),(-1, -1), 1, C_PRIMARY),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(tbl_res)

    _pie(story,
         f"Payout {periodo} — Chukuta Express. "
         "Revisar con el departamento financiero antes de ejecutar transferencias. "
         "Este documento tiene validez como soporte de dispersión de fondos.",
         W)

    doc.build(story)
    return buf.getvalue()


# ═══════════════════════════════════════════════════════════════════════════════
# 5. MANIFIESTO DE CARGA / CONSOLIDADOR LOGÍSTICO  (Administrador)
# ═══════════════════════════════════════════════════════════════════════════════

def generar_manifiesto_carga(pedidos: list, fecha: Optional[str] = None) -> bytes:
    """
    Consolidador logístico diario agrupado por zona geográfica.

    pedidos – lista de dicts:
        {
          id_pedido, cliente_nombre, cliente_telefono, direccion_entrega,
          zona (str|None), vendedor_nombre, repartidor_nombre (str|None),
          detalles: [{ nombre_producto, cantidad }]
        }
    fecha   – 'YYYY-MM-DD' o None (usa hoy)
    """
    buf, doc = _nuevo_doc()
    W = doc.width
    story = []

    if not fecha:
        fecha = datetime.date.today().isoformat()
    try:
        fecha_fmt = datetime.date.fromisoformat(fecha).strftime("%d/%m/%Y")
    except Exception:
        fecha_fmt = fecha

    story.append(_encabezado_doc(
        titulo="Manifiesto de Carga — Consolidador Logístico Diario",
        subtitulo="Coordinación de Distribución — Chukuta Express",
        meta={
            "Fecha de despacho": fecha_fmt,
            "Pedidos a entregar": str(len(pedidos)),
            "Generado": datetime.datetime.now().strftime("%H:%M hs"),
        },
        doc_w=W,
    ))
    story.append(Spacer(1, 8))

    if not pedidos:
        story.append(Paragraph("✅  No hay pedidos programados para hoy.", S_BODY))
        doc.build(story)
        return buf.getvalue()

    # ── Agrupar por zona ──────────────────────────────────────────────────────
    zonas: dict[str, list] = {}
    for p in pedidos:
        zona = (p.get("zona") or "Sin zona asignada").strip() or "Sin zona asignada"
        zonas.setdefault(zona, []).append(p)

    for zona_nombre, zpedidos in sorted(zonas.items()):
        story.append(_barra_seccion(f"📍  Zona: {zona_nombre}   ({len(zpedidos)} pedidos)", W))
        story.append(Spacer(1, 4))

        for p in zpedidos:
            detalles_str = "  ·  ".join(
                f"{d.get('nombre_producto','?')} ×{d.get('cantidad',1)}"
                for d in (p.get("detalles") or [])
            ) or "—"
            repartidor = p.get("repartidor_nombre") or "⚠️ Sin asignar"

            filas_card = [
                # Fila 1: número de pedido + vendedor + repartidor
                [
                    Paragraph(f"<b>Pedido #{p.get('id_pedido','—')}</b>", S_BODY_B),
                    Paragraph(f"<b>Vendedor:</b> {p.get('vendedor_nombre','—')}", S_BODY),
                    Paragraph(f"<b>Repartidor:</b> {repartidor}", S_BODY),
                ],
                # Fila 2: cliente + dirección
                [
                    Paragraph(f"<b>Cliente:</b> {p.get('cliente_nombre','—')}  📞 {p.get('cliente_telefono','—')}", S_BODY),
                    Paragraph(f"<b>Dirección:</b> {p.get('direccion_entrega','—')}", S_BODY),
                    Paragraph("", S_BODY),
                ],
                # Fila 3: productos (span completo)
                [
                    Paragraph(f"<b>Productos:</b>  {detalles_str}", S_SMALL),
                    Paragraph("", S_SMALL),
                    Paragraph("", S_SMALL),
                ],
            ]
            tbl_card = Table(filas_card, colWidths=[W*0.28, W*0.42, W*0.30])
            tbl_card.setStyle(TableStyle([
                ("VALIGN",        (0, 0), (-1, -1), "TOP"),
                ("BACKGROUND",    (0, 0), (-1, 0),  C_LIGHT),
                ("SPAN",          (0, 2), (2, 2)),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING",   (0, 0), (-1, -1), 6),
                ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
                ("BOX",           (0, 0), (-1, -1), 0.6, C_BORDER),
                ("LINEBELOW",     (0, 0), (-1, 0),  0.3, C_BORDER),
                ("LINEBELOW",     (0, 1), (-1, 1),  0.3, C_BORDER),
            ]))
            story.append(KeepTogether(tbl_card))
            story.append(Spacer(1, 5))

        story.append(Spacer(1, 8))

    _pie(story,
         "Manifiesto generado automáticamente antes del inicio de rutas. "
         "Distribuir a cada repartidor antes de salir. "
         "Cualquier modificación comunicar al coordinador logístico.",
         W)

    doc.build(story)
    return buf.getvalue()


# ==============================================================================
# PDF — COMPROBANTE DE PEDIDO PARA EL CLIENTE
# Muestra resumen del pedido y su estado actual. Se genera cuando el estado
# es confirmado, en_preparacion, en_camino o entregado.
# Expone: generar_comprobante_cliente(pedido, detalles)
# ==============================================================================

def generar_comprobante_cliente(pedido: dict, detalles: list) -> bytes:
    """
    Comprobante de pedido para el cliente final.
    Incluye: estado actual, datos del pedido, productos, total, método de pago.
    pedido   – dict del modelo Pedido (to_dict con include_detalles=False + cliente_nombre/telefono)
    detalles – lista de dicts DetallePedido.to_dict() con nombre_producto
    """
    from reportlab.lib import colors as RC
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle,
        Paragraph, Spacer, HRFlowable,
    )
    import io, datetime

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=1.8*cm, bottomMargin=1.8*cm)
    W = doc.width

    C_PRI   = RC.HexColor("#6c63ff")
    C_DARK  = RC.HexColor("#1f2a38")
    C_GRAY  = RC.HexColor("#6b7280")
    C_LIGHT = RC.HexColor("#f8fafc")
    C_BRD   = RC.HexColor("#e2e8f0")
    C_W     = RC.white

    ESTADO_LABELS = {
        "confirmado":     ("✅", "Confirmado",    RC.HexColor("#17a2b8")),
        "en_preparacion": ("📦", "En preparación", RC.HexColor("#6c63ff")),
        "en_camino":      ("🚚", "En camino",     RC.HexColor("#fd7e14")),
        "entregado":      ("🎉", "Entregado",     RC.HexColor("#28a745")),
        "pendiente":      ("⏳", "Pendiente",     RC.HexColor("#ffc107")),
        "cancelado":      ("❌", "Cancelado",     RC.HexColor("#dc3545")),
    }

    def _s(nombre, **kw):
        base = dict(fontName="Helvetica", fontSize=9, leading=12, textColor=C_DARK)
        base.update(kw)
        return ParagraphStyle(nombre, **base)

    S_TITLE  = _s("t",  fontSize=20, fontName="Helvetica-Bold", textColor=C_DARK, spaceAfter=2)
    S_SUB    = _s("s",  fontSize=10, textColor=C_GRAY)
    S_BODY   = _s("b")
    S_SMALL  = _s("sm", fontSize=7.5, textColor=C_GRAY)
    S_HW     = _s("hw", fontSize=8.5, fontName="Helvetica-Bold", textColor=C_W, alignment=TA_CENTER)
    S_TOTAL  = _s("to", fontSize=13, fontName="Helvetica-Bold", textColor=C_PRI, alignment=TA_RIGHT)

    story = []

    # Encabezado
    estado_val = pedido.get("estado", "pendiente")
    icono, label, col_est = ESTADO_LABELS.get(estado_val, ("📋", estado_val, C_DARK))
    fecha_str = pedido.get("fecha", "")
    try:
        fecha_str = datetime.datetime.fromisoformat(fecha_str).strftime("%d/%m/%Y %H:%M")
    except Exception:
        pass

    enc_izq = [
        Paragraph("Chukuta Express", S_TITLE),
        Paragraph("Comprobante de Pedido", _s("cp", fontSize=12, fontName="Helvetica-Bold", textColor=C_PRI)),
        Paragraph(f"Para: {pedido.get('cliente_nombre', '—')}", S_SUB),
    ]
    enc_der = [
        Paragraph(f"<b>N° Pedido:</b> #{pedido.get('id_pedido', '—')}", S_SMALL),
        Paragraph(f"<b>Fecha:</b> {fecha_str}", S_SMALL),
        Paragraph(f"<b>Seguimiento:</b> {pedido.get('codigo_seguimiento') or '—'}", S_SMALL),
    ]
    tenc = Table([[enc_izq, enc_der]], colWidths=[W*0.58, W*0.42])
    tenc.setStyle(TableStyle([
        ("VALIGN", (0,0),(-1,-1),"TOP"),
        ("ALIGN", (1,0),(1,0),"RIGHT"),
        ("LINEBELOW",(0,0),(-1,0),1,C_PRI),
        ("BOTTOMPADDING",(0,0),(-1,0),6),
    ]))
    story.append(tenc)
    story.append(Spacer(1,6))

    # Pastilla de estado
    t_est = Table([[Paragraph(f"{icono}  Estado: {label}", _s("est", fontSize=11,
                    fontName="Helvetica-Bold", textColor=C_W, alignment=TA_CENTER))]], colWidths=[W])
    t_est.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,-1),col_est),
        ("TOPPADDING",(0,0),(-1,-1),8),
        ("BOTTOMPADDING",(0,0),(-1,-1),8),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[col_est]),
    ]))
    story.append(t_est)
    story.append(Spacer(1,10))

    # Datos del pedido
    def _barra(txt):
        t = Table([[Paragraph(txt, S_HW)]], colWidths=[W])
        t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),C_DARK),
                                ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
        return t

    story.append(_barra("📋  Datos del Pedido"))
    story.append(Spacer(1,4))
    metodo = (pedido.get("metodo_pago") or "—").replace("_"," ").title()
    pago_v = "✔ Verificado" if pedido.get("pago_verificado") else "⏳ Pendiente verificación"
    info = [
        [Paragraph("<b>Teléfono:</b>", S_BODY), Paragraph(pedido.get("cliente_telefono","—"), S_BODY)],
        [Paragraph("<b>Dirección de entrega:</b>", S_BODY), Paragraph(pedido.get("direccion_entrega","—"), S_BODY)],
        [Paragraph("<b>Método de pago:</b>", S_BODY), Paragraph(metodo, S_BODY)],
        [Paragraph("<b>Estado del pago:</b>", S_BODY), Paragraph(pago_v, S_BODY)],
    ]
    if pedido.get("notas"):
        info.append([Paragraph("<b>Notas:</b>", S_BODY), Paragraph(pedido["notas"], S_BODY)])
    ti = Table(info, colWidths=[4*cm, W-4*cm])
    ti.setStyle(TableStyle([("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),3),("BOTTOMPADDING",(0,0),(-1,-1),3)]))
    story.append(ti)
    story.append(Spacer(1,10))

    # Productos
    story.append(_barra("🛒  Productos del Pedido"))
    story.append(Spacer(1,4))
    filas = [["Producto","Cant.","Precio Unit.","Subtotal"]]
    total_calc = 0.0
    for d in detalles:
        sub = float(d.get("subtotal") or float(d.get("precio_unitario",0))*int(d.get("cantidad",1)))
        total_calc += sub
        filas.append([d.get("nombre_producto","—"), str(d.get("cantidad",0)),
                      f'Bs {float(d.get("precio_unitario",0)):,.2f}', f'Bs {sub:,.2f}'])
    tp = Table(filas, colWidths=[W*0.44, W*0.1, W*0.22, W*0.24], repeatRows=1)
    tp.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),C_PRI),("TEXTCOLOR",(0,0),(-1,0),C_W),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,0),8),
        ("ALIGN",(1,0),(-1,-1),"RIGHT"),("ALIGN",(0,1),(0,-1),"LEFT"),
        ("FONTSIZE",(0,1),(-1,-1),8),("ROWBACKGROUNDS",(0,1),(-1,-1),[C_W,C_LIGHT]),
        ("GRID",(0,0),(-1,-1),0.3,C_BRD),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),5),("RIGHTPADDING",(0,0),(-1,-1),5),
    ]))
    story.append(tp)
    story.append(Spacer(1,6))

    # Total
    tot_real = float(pedido.get("total", total_calc))
    t_tot = Table([["TOTAL:", f'Bs {tot_real:,.2f}']], colWidths=[W-4.5*cm, 4.5*cm])
    t_tot.setStyle(TableStyle([
        ("ALIGN",(0,0),(-1,-1),"RIGHT"),
        ("FONTNAME",(0,0),(-1,-1),"Helvetica-Bold"),
        ("FONTSIZE",(0,0),(-1,-1),13),
        ("TEXTCOLOR",(0,0),(-1,-1),C_PRI),
        ("LINEABOVE",(0,0),(-1,-1),1,C_PRI),
        ("TOPPADDING",(0,0),(-1,-1),6),("BOTTOMPADDING",(0,0),(-1,-1),6),
    ]))
    story.append(t_tot)
    story.append(Spacer(1,10))
    story.append(HRFlowable(width=W, color=C_BRD, thickness=0.4))
    story.append(Spacer(1,4))
    story.append(Paragraph(
        "Este comprobante es generado automáticamente por Chukuta Express. "
        "Consérvalo como respaldo de tu compra.", S_SMALL))

    doc.build(story)
    return buf.getvalue()


# ==============================================================================
# PDF — GUÍA DE ENVÍO (Delivery) PARA EL VENDEDOR
# Etiqueta logística con datos del destinatario para adjuntar al paquete.
# Expone: generar_guia_envio(pedido, detalles_vendedor, vendedor)
# ==============================================================================

def generar_guia_envio(pedido: dict, detalles_vendedor: list, vendedor: dict) -> bytes:
    """
    Guía de envío / etiqueta logística para el repartidor.
    pedido            – dict del modelo Pedido + cliente_nombre / cliente_telefono
    detalles_vendedor – lista de dicts DetallePedido del vendedor con nombre_producto
    vendedor          – dict del modelo Usuario (nombre, email)
    """
    from reportlab.lib import colors as RC
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER
    from reportlab.platypus import (
        SimpleDocTemplate, Table, TableStyle,
        Paragraph, Spacer, HRFlowable,
    )
    import io, datetime

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=1.8*cm, bottomMargin=1.8*cm)
    W = doc.width

    C_PRI   = RC.HexColor("#6c63ff")
    C_DARK  = RC.HexColor("#1f2a38")
    C_ACC   = RC.HexColor("#ff7043")
    C_LIGHT = RC.HexColor("#f8fafc")
    C_BRD   = RC.HexColor("#e2e8f0")
    C_W     = RC.white
    C_GRAY  = RC.HexColor("#6b7280")

    def _s(n, **kw):
        base = dict(fontName="Helvetica", fontSize=9, leading=12, textColor=C_DARK)
        base.update(kw)
        return ParagraphStyle(n, **base)

    S_HW   = _s("hw",  fontSize=9, fontName="Helvetica-Bold", textColor=C_W, alignment=TA_CENTER)
    S_BIG  = _s("big", fontSize=22, fontName="Helvetica-Bold", textColor=C_DARK, alignment=TA_CENTER)
    S_MED  = _s("med", fontSize=13, fontName="Helvetica-Bold", textColor=C_DARK)
    S_BODY = _s("bd")
    S_SMALL= _s("sm",  fontSize=7.5, textColor=C_GRAY)

    story = []

    fecha_str = pedido.get("fecha","")
    try:
        fecha_str = datetime.datetime.fromisoformat(fecha_str).strftime("%d/%m/%Y %H:%M")
    except Exception:
        pass

    # Encabezado de guía
    t_header = Table([[
        Paragraph("Chukuta Express", _s("ch", fontSize=16, fontName="Helvetica-Bold", textColor=C_DARK)),
        Paragraph(f"GUÍA DE ENVÍO\n#{pedido.get('id_pedido','—')}", _s("gi", fontSize=18,
                   fontName="Helvetica-Bold", textColor=C_ACC, alignment=TA_CENTER)),
    ]], colWidths=[W*0.5, W*0.5])
    t_header.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"MIDDLE"),
        ("LINEBELOW",(0,0),(-1,0),2,C_ACC),
        ("BOTTOMPADDING",(0,0),(-1,0),8),
    ]))
    story.append(t_header)
    story.append(Spacer(1,10))

    # ── DESTINATARIO (grande) ──────────────────────────────────────────────
    def _barra(txt, color=C_PRI):
        t = Table([[Paragraph(txt, S_HW)]], colWidths=[W])
        t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),color),
                                ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5)]))
        return t

    story.append(_barra("📦  DESTINATARIO", C_DARK))
    story.append(Spacer(1,6))

    story.append(Paragraph(pedido.get("cliente_nombre","—"), S_BIG))
    story.append(Spacer(1,4))

    t_dest = Table([
        [Paragraph("<b>📞 Teléfono:</b>", S_MED),
         Paragraph(pedido.get("cliente_telefono","—"), _s("ph", fontSize=13, fontName="Helvetica-Bold", textColor=C_PRI))],
        [Paragraph("<b>📍 Dirección:</b>", _s("dir", fontSize=10, fontName="Helvetica-Bold")),
         Paragraph(pedido.get("direccion_entrega","—"), _s("da", fontSize=10))],
    ], colWidths=[3.5*cm, W-3.5*cm])
    t_dest.setStyle(TableStyle([
        ("VALIGN",(0,0),(-1,-1),"TOP"),
        ("TOPPADDING",(0,0),(-1,-1),5),("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("BACKGROUND",(0,0),(-1,-1),C_LIGHT),
        ("BOX",(0,0),(-1,-1),1,C_BRD),
    ]))
    story.append(t_dest)
    story.append(Spacer(1,10))

    # ── REMITENTE ──────────────────────────────────────────────────────────
    story.append(_barra("🏪  REMITENTE / TIENDA", C_PRI))
    story.append(Spacer(1,4))
    story.append(Paragraph(vendedor.get("nombre","—"),
                 _s("vn", fontSize=13, fontName="Helvetica-Bold")))
    story.append(Paragraph(vendedor.get("email","—"), S_SMALL))
    story.append(Spacer(1,10))

    # ── CONTENIDO DEL PAQUETE ──────────────────────────────────────────────
    story.append(_barra("📋  CONTENIDO DEL PAQUETE"))
    story.append(Spacer(1,4))

    filas = [["Producto","Cant.","Peso aprox."]]
    for d in detalles_vendedor:
        filas.append([d.get("nombre_producto","—"), str(d.get("cantidad",1)), "—"])

    tc = Table(filas, colWidths=[W*0.60, W*0.20, W*0.20], repeatRows=1)
    tc.setStyle(TableStyle([
        ("BACKGROUND",(0,0),(-1,0),C_DARK),("TEXTCOLOR",(0,0),(-1,0),C_W),
        ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold"),("FONTSIZE",(0,0),(-1,0),8),
        ("ALIGN",(1,0),(-1,-1),"CENTER"),
        ("FONTSIZE",(0,1),(-1,-1),8),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[C_W,C_LIGHT]),
        ("GRID",(0,0),(-1,-1),0.3,C_BRD),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),5),
    ]))
    story.append(tc)
    story.append(Spacer(1,10))

    # ── Info del pedido ────────────────────────────────────────────────────
    metodo = (pedido.get("metodo_pago") or "—").replace("_"," ").title()
    estado = (pedido.get("estado") or "—").replace("_"," ").title()
    t_info = Table([
        ["N° Pedido:", f'#{pedido.get("id_pedido","—")}',
         "Fecha:", fecha_str],
        ["Estado:", estado, "Método pago:", metodo],
        ["Seguimiento:", pedido.get("codigo_seguimiento") or "—", "", ""],
    ], colWidths=[3*cm, W*0.30, 3*cm, W*0.27])
    t_info.setStyle(TableStyle([
        ("FONTNAME",(0,0),(0,-1),"Helvetica-Bold"),("FONTNAME",(2,0),(2,-1),"Helvetica-Bold"),
        ("FONTSIZE",(0,0),(-1,-1),8),
        ("BACKGROUND",(0,0),(-1,-1),C_LIGHT),
        ("GRID",(0,0),(-1,-1),0.3,C_BRD),
        ("TOPPADDING",(0,0),(-1,-1),4),("BOTTOMPADDING",(0,0),(-1,-1),4),
        ("LEFTPADDING",(0,0),(-1,-1),6),
    ]))
    story.append(t_info)
    story.append(Spacer(1,10))

    story.append(HRFlowable(width=W, color=C_BRD, thickness=0.4))
    story.append(Spacer(1,4))
    story.append(Paragraph(
        f"Guía generada: {datetime.datetime.now().strftime('%d/%m/%Y %H:%M')} — "
        "Chukuta Express. El repartidor debe presentar este documento al entregar el paquete.",
        S_SMALL))

    doc.build(story)
    return buf.getvalue()
