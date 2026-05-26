"""
recibo_cliente.py — Chukuta Express
====================================
Genera el PDF de recibo/comprobante de compra para el cliente.
Usa ReportLab con la misma paleta de colores que pdf_reportes.py.
"""
import io
import datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle,
    Paragraph, Spacer, HRFlowable,
)

# ── Paleta (misma que pdf_reportes.py) ──────────────────────────────────────
C_PRIMARY = colors.HexColor("#6c63ff")
C_DARK    = colors.HexColor("#1f2a38")
C_SUCCESS = colors.HexColor("#10b981")
C_GRAY    = colors.HexColor("#6b7280")
C_LIGHT   = colors.HexColor("#f8fafc")
C_BORDER  = colors.HexColor("#e2e8f0")
C_WHITE   = colors.white
C_BLACK   = colors.HexColor("#111827")


def _s(nombre, **kw) -> ParagraphStyle:
    base = dict(fontName="Helvetica", fontSize=9, leading=13, textColor=C_BLACK)
    base.update(kw)
    return ParagraphStyle(nombre, **base)


S_TITULO   = _s("titulo",   fontSize=22, fontName="Helvetica-Bold", textColor=C_DARK, spaceAfter=2)
S_SUBTITULO= _s("subtit",   fontSize=10, textColor=C_GRAY, spaceAfter=4)
S_BODY     = _s("body")
S_BODY_B   = _s("body_b",   fontName="Helvetica-Bold")
S_BODY_R   = _s("body_r",   alignment=TA_RIGHT)
S_BODY_C   = _s("body_c",   alignment=TA_CENTER)
S_SMALL    = _s("small",    fontSize=7.5, textColor=C_GRAY)
S_SMALL_C  = _s("small_c",  fontSize=7.5, textColor=C_GRAY, alignment=TA_CENTER)
S_HDR_W    = _s("hdr_w",    fontSize=8.5, fontName="Helvetica-Bold",
                textColor=C_WHITE, alignment=TA_CENTER)
S_TOTAL    = _s("total",    fontSize=14,  fontName="Helvetica-Bold",
                textColor=C_PRIMARY, alignment=TA_RIGHT)
S_GRACIAS  = _s("gracias",  fontSize=10,  fontName="Helvetica-Bold",
                textColor=C_SUCCESS, alignment=TA_CENTER, spaceAfter=4)


def _bs(valor) -> str:
    try:
        return f"Bs {float(valor):,.2f}"
    except (TypeError, ValueError):
        return "Bs 0.00"


def _estado_label(estado: str) -> str:
    mapa = {
        "pendiente":       "Pendiente",
        "confirmado":      "Confirmado",
        "en_preparacion":  "En preparación",
        "en_camino":       "En camino",
        "entregado":       "Entregado",
        "cancelado":       "Cancelado",
    }
    return mapa.get(estado, estado.title())


def _metodo_label(metodo: str) -> str:
    mapa = {
        "qr":            "Pago por QR",
        "transferencia": "Transferencia bancaria",
        "efectivo":      "Efectivo",
    }
    return mapa.get(metodo, metodo.title())


def generar_recibo_cliente(pedido, cliente, detalles: list, titulo="RECIBO DE COMPRA") -> bytes:
    """
    Genera el PDF del recibo del cliente.

    :param pedido:   instancia de Pedido (ORM)
    :param cliente:  instancia de Cliente (ORM)
    :param detalles: lista de dicts con keys:
                     nombre_producto, cantidad, precio_unitario, subtotal
    :param titulo:   titulo principal del documento
    :returns: bytes del PDF
    """
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm,  bottomMargin=2*cm,
    )
    W = doc.width
    story = []

    # ── CABECERA ─────────────────────────────────────────────────────────────
    fecha_pedido = pedido.created_at
    if isinstance(fecha_pedido, str):
        try:
            fecha_pedido = datetime.datetime.fromisoformat(fecha_pedido)
        except ValueError:
            fecha_pedido = datetime.datetime.utcnow()

    header_data = [
        [
            Paragraph("<b>📦 ChukutaExpress</b>", _s("brand", fontSize=18,
                      fontName="Helvetica-Bold", textColor=C_PRIMARY)),
            Paragraph(
                f"<b>{titulo}</b><br/>"
                f"<font color='#6b7280' size='8'>N° {pedido.id_pedido:06d}</font>",
                _s("rec_title", fontSize=14, fontName="Helvetica-Bold",
                   textColor=C_DARK, alignment=TA_RIGHT)
            ),
        ]
    ]
    header_table = Table(header_data, colWidths=[W * 0.55, W * 0.45])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(header_table)
    story.append(HRFlowable(width=W, color=C_PRIMARY, thickness=2))
    story.append(Spacer(1, 0.4*cm))

    # ── INFO PEDIDO + CLIENTE ─────────────────────────────────────────────────
    fecha_fmt = fecha_pedido.strftime("%d de %B de %Y, %H:%M")
    estado_lbl = _estado_label(pedido.estado)
    metodo_lbl = _metodo_label(pedido.metodo_pago or "")

    info_data = [
        [
            # Columna izquierda: datos del pedido
            Table([
                [Paragraph("<b>DATOS DEL PEDIDO</b>", _s("sec_hdr", fontSize=8,
                           fontName="Helvetica-Bold", textColor=C_GRAY, spaceAfter=4))],
                [Paragraph(f"<b>Fecha:</b> {fecha_fmt}", S_BODY)],
                [Paragraph(f"<b>Estado:</b> {estado_lbl}", S_BODY)],
                [Paragraph(f"<b>Método de pago:</b> {metodo_lbl}", S_BODY)],
                [Paragraph(f"<b>Código seguimiento:</b> {pedido.codigo_seguimiento or '—'}", S_BODY)],
                [Paragraph(f"<b>Dirección:</b> {pedido.direccion_entrega}", S_BODY)],
            ], colWidths=[W * 0.47]),

            # Columna derecha: datos del cliente
            Table([
                [Paragraph("<b>DATOS DEL CLIENTE</b>", _s("sec_hdr2", fontSize=8,
                           fontName="Helvetica-Bold", textColor=C_GRAY, spaceAfter=4))],
                [Paragraph(f"<b>Nombre:</b> {cliente.nombre}", S_BODY)],
                [Paragraph(f"<b>Email:</b> {cliente.email}", S_BODY)],
                [Paragraph(f"<b>Teléfono:</b> {cliente.telefono or '—'}", S_BODY)],
            ], colWidths=[W * 0.47]),
        ]
    ]
    info_table = Table(info_data, colWidths=[W * 0.5, W * 0.5])
    info_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 0.5*cm))

    # ── TABLA DE PRODUCTOS ────────────────────────────────────────────────────
    story.append(Paragraph("<b>DETALLE DE PRODUCTOS</b>",
                           _s("det_hdr", fontSize=8, fontName="Helvetica-Bold", textColor=C_GRAY)))
    story.append(Spacer(1, 0.2*cm))

    col_widths = [W * 0.44, W * 0.13, W * 0.20, W * 0.20]
    tbl_data = [
        [
            Paragraph("Producto", S_HDR_W),
            Paragraph("Cant.", S_HDR_W),
            Paragraph("Precio Unit.", S_HDR_W),
            Paragraph("Subtotal", S_HDR_W),
        ]
    ]

    subtotal_global = 0.0
    for i, det in enumerate(detalles):
        nombre    = det.get("nombre_producto") or "—"
        cantidad  = int(det.get("cantidad", 0))
        p_unit    = float(det.get("precio_unitario", 0))
        subtotal  = float(det.get("subtotal", p_unit * cantidad))
        subtotal_global += subtotal

        bg = C_LIGHT if i % 2 == 0 else C_WHITE
        tbl_data.append([
            Paragraph(nombre, S_BODY),
            Paragraph(str(cantidad), S_BODY_C),
            Paragraph(_bs(p_unit), S_BODY_R),
            Paragraph(_bs(subtotal), _s("sub_r", fontName="Helvetica-Bold", alignment=TA_RIGHT)),
        ])

    # Fila de total
    tbl_data.append([
        Paragraph("", S_BODY), Paragraph("", S_BODY), Paragraph("", S_BODY),
        Paragraph("", S_BODY),
    ])
    tbl_data.append([
        Paragraph("<b>TOTAL A PAGAR</b>", _s("tot_lbl", fontSize=10,
                  fontName="Helvetica-Bold", textColor=C_DARK, alignment=TA_RIGHT)),
        Paragraph("", S_BODY),
        Paragraph("", S_BODY),
        Paragraph(f"<b>{_bs(pedido.total)}</b>",
                  _s("tot_val", fontSize=13, fontName="Helvetica-Bold",
                     textColor=C_PRIMARY, alignment=TA_RIGHT)),
    ])

    n_rows = len(tbl_data)
    det_table = Table(tbl_data, colWidths=col_widths, repeatRows=1)
    det_table.setStyle(TableStyle([
        # Cabecera
        ("BACKGROUND",    (0, 0), (-1, 0), C_PRIMARY),
        ("TEXTCOLOR",     (0, 0), (-1, 0), C_WHITE),
        ("ROWBACKGROUNDS", (0, 1), (-1, n_rows-3), [C_LIGHT, C_WHITE]),
        # Bordes
        ("GRID",          (0, 0), (-1, n_rows-3), 0.4, C_BORDER),
        ("LINEABOVE",     (0, n_rows-1), (-1, n_rows-1), 1.5, C_PRIMARY),
        # Padding
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
        # Total row spans
        ("SPAN",          (0, n_rows-1), (2, n_rows-1)),
        ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
    ]))
    story.append(det_table)
    story.append(Spacer(1, 0.8*cm))

    # ── MENSAJE DE AGRADECIMIENTO ─────────────────────────────────────────────
    story.append(HRFlowable(width=W, color=C_BORDER, thickness=1))
    story.append(Spacer(1, 0.4*cm))
    story.append(Paragraph(
        "¡Gracias por tu compra en ChukutaExpress! 🎉",
        S_GRACIAS,
    ))
    story.append(Paragraph(
        "Tu pedido ha sido registrado y será procesado a la brevedad. "
        "Si tienes preguntas, contáctanos por nuestros canales oficiales.",
        _s("agra_body", fontSize=8.5, textColor=C_GRAY, alignment=TA_CENTER),
    ))
    story.append(Spacer(1, 0.3*cm))
    story.append(Paragraph(
        f"Documento generado el {datetime.datetime.now().strftime('%d/%m/%Y a las %H:%M')}",
        S_SMALL_C,
    ))

    doc.build(story)
    return buf.getvalue()
