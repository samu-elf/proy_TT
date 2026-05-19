/**
 * main.tsx — Punto de entrada de Chukuta Express
 *
 * CORRECCIÓN: Este archivo faltaba en el proyecto original.
 * Sin él, Vite no puede arrancar (error "Failed to load url /src/main.tsx").
 *
 * También importa Bootstrap CSS aquí para que los estilos se apliquen
 * globalmente en toda la aplicación.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

// Bootstrap CSS — DEBE importarse antes que cualquier componente propio
// para que sus clases (btn, container, navbar, etc.) funcionen correctamente.
import 'bootstrap/dist/css/bootstrap.min.css';

import App from './App';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No se encontró el elemento #root en index.html');

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
);
