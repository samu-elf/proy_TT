"""
Servicio de auditoría para registrar acciones críticas del sistema.
"""
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
