import React from 'react';

interface ComprobanteVisualProps {
  isOpen: boolean;
  onClose: () => void;
  urlComprobante: string | null | undefined;
  idPedido?: number | string;
}

const ComprobanteVisual: React.FC<ComprobanteVisualProps> = ({
  isOpen,
  onClose,
  urlComprobante,
  idPedido
}) => {
  if (!isOpen) return null;

  // Determinar si el archivo es un PDF revisando la extensión de la URL
  const esPDF = urlComprobante?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            Comprobante de Pago {idPedido ? `#${idPedido}` : ''}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1.5 hover:bg-gray-200 rounded-lg text-sm"
          >
            ✕ Cerrar
          </button>
        </div>

        {/* Contenido / Visor */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-100 flex items-center justify-center min-h-[300px]">
          {!urlComprobante ? (
            <div className="text-center text-gray-500">
              <p className="text-lg font-medium">No se cargó ningún archivo</p>
              <p className="text-sm">El pedido no registra una ruta de comprobante válida.</p>
            </div>
          ) : esPDF ? (
            /* Visor para PDFs */
            <iframe
              src={urlComprobante}
              title="Comprobante PDF"
              className="w-full h-[60vh] rounded-lg border border-gray-300 bg-white"
            />
          ) : (
            /* Visor para Imágenes (PNG, JPG) */
            <div className="relative max-w-full max-h-[60vh] overflow-hidden rounded-lg shadow-sm border border-gray-200 bg-white p-2">
              <img
                src={urlComprobante}
                alt="Comprobante de pago"
                className="max-w-full max-h-[55vh] object-contain mx-auto rounded"
                onError={(e) => {
                  // Manejo por si la URL de la imagen se rompe o da error 404
                  (e.target as HTMLImageElement).src = 'https://placehold.co/600x400?text=Error+al+cargar+la+imagen';
                }}
              />
            </div>
          )}
        </div>

        {/* Pie del Modal / Acciones */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-end gap-3">
          {urlComprobante && (
            <a
              href={urlComprobante}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"
            >
              Abrir en pestaña nueva ↗
            </a>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cerrar ventana
          </button>
        </div>

      </div>
    </div>
  );
};

export default ComprobanteVisual;