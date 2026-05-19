"""
Manejadores de error globales y utilidades de respuesta.
"""
import logging
from flask import jsonify

logger = logging.getLogger(__name__)


def register_error_handlers(app):

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({"error": "Solicitud inválida", "detalle": str(e)}), 400

    @app.errorhandler(401)
    def unauthorized(e):
        return jsonify({"error": "No autenticado"}), 401

    @app.errorhandler(403)
    def forbidden(e):
        return jsonify({"error": "Acceso denegado"}), 403

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"error": "Recurso no encontrado"}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"error": "Método no permitido"}), 405

    @app.errorhandler(409)
    def conflict(e):
        return jsonify({"error": "Conflicto de datos"}), 409

    @app.errorhandler(422)
    def unprocessable(e):
        return jsonify({"error": "Datos no procesables"}), 422

    @app.errorhandler(429)
    def too_many_requests(e):
        return jsonify({
            "error": "Demasiadas solicitudes. Por favor espera antes de intentar de nuevo.",
        }), 429

    @app.errorhandler(500)
    def internal_error(e):
        logger.error(f"Error interno: {e}", exc_info=True)
        return jsonify({"error": "Error interno del servidor"}), 500


def success_response(data, status_code: int = 200):
    return jsonify(data), status_code


def error_response(message: str, status_code: int = 400):
    return jsonify({"error": message}), status_code


def paginate_query(query, page: int, per_page: int):
    """Pagina una query SQLAlchemy y devuelve dict con metadatos."""
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": pagination.items,
        "total": pagination.total,
        "page": pagination.page,
        "per_page": pagination.per_page,
        "pages": pagination.pages,
        "has_next": pagination.has_next,
        "has_prev": pagination.has_prev,
    }
