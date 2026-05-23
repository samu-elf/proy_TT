/**
 * reportesAdmin.ts — Chukuta Express v3.0
 *
 * Cliente de la API de reportes PDF para el panel de Administrador.
 * Todos los métodos descargan/abren el PDF en una nueva pestaña,
 * inyectando el admin_token de forma automática.
 */

// ─── Helper interno ───────────────────────────────────────────────────────────

function _abrirPdfAdmin(ruta: string, nombreArchivo: string): void {
  const token   = localStorage.getItem('admin_token') ?? '';
  const baseUrl = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:5000';

  fetch(`${baseUrl}${ruta}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
    .then(r => {
      if (!r.ok) throw new Error(`Error ${r.status} al generar el PDF`);
      return r.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href    = url;
      a.target  = '_blank';
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    })
    .catch(err => alert(`No se pudo generar el PDF: ${(err as Error).message}`));
}

// ─── API de Reportes Admin ────────────────────────────────────────────────────

export const reportesAdminApi = {
  /**
   * Reporte de Facturación Global y Comisiones Ganadas.
   * Detonante: cierre mensual fiscal.
   *
   * @param mes   Mes del período (1–12). Default: mes actual.
   * @param anio  Año del período (ej. 2026). Default: año actual.
   */
  descargarFacturacionGlobal(mes?: number, anio?: number): void {
    const hoy = new Date();
    const m   = mes  ?? hoy.getMonth() + 1;
    const a   = anio ?? hoy.getFullYear();
    const pad = String(m).padStart(2, '0');
    _abrirPdfAdmin(
      `/admin/reportes/facturacion?mes=${m}&anio=${a}`,
      `facturacion_${a}_${pad}.pdf`,
    );
  },

  /**
   * Reporte de Pago a Vendedores (Payout Summary).
   * Detonante: cierre del ciclo de dispersión de fondos.
   *
   * @param mes   Mes del período (1–12). Default: mes actual.
   * @param anio  Año del período (ej. 2026). Default: año actual.
   */
  descargarPagoVendedores(mes?: number, anio?: number): void {
    const hoy = new Date();
    const m   = mes  ?? hoy.getMonth() + 1;
    const a   = anio ?? hoy.getFullYear();
    const pad = String(m).padStart(2, '0');
    _abrirPdfAdmin(
      `/admin/reportes/pago-vendedores?mes=${m}&anio=${a}`,
      `payout_${a}_${pad}.pdf`,
    );
  },

  /**
   * Manifiesto de Carga / Consolidador Logístico Diario.
   * Detonante: cada mañana antes de iniciar rutas de despacho.
   *
   * @param fecha  Fecha en formato 'YYYY-MM-DD'. Default: hoy.
   */
  descargarManifiestoLogistico(fecha?: string): void {
    const f   = fecha ?? new Date().toISOString().slice(0, 10);
    const tag = f.replace(/-/g, '');
    _abrirPdfAdmin(
      `/admin/reportes/manifiesto?fecha=${f}`,
      `manifiesto_${tag}.pdf`,
    );
  },
};
