/**
 * Portal de clientes — rutas públicas y autenticadas de la tienda.
 */
import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/layout/Navbar';
import Catalogo from './features/catalogo/pages/Catalogo';
import ProductoDetalle from './features/catalogo/pages/ProductoDetalle';
import Carrito from './features/carrito/pages/Carrito';
import MisPedidos from './features/pedidos/pages/MisPedidos';
import PerfilCliente from './features/cliente/pages/PerfilCliente';

function NotFound() {
  return (
    <div className="container py-5 text-center">
      <div style={{ fontSize: '4rem' }}>🗺️</div>
      <h2 className="fw-bold mt-3">Página no encontrada</h2>
      <p className="text-muted">La dirección que buscas no existe.</p>
      <Link to="/productos" className="btn btn-primary mt-2"
        style={{ background: '#6c63ff', border: 'none' }}>
        Ir al catálogo
      </Link>
    </div>
  );
}

export default function ClienteApp() {
  return (
    <>
      <Navbar />
      <main style={{ minHeight: '100vh', background: '#f8f9fa' }}>
        <Routes>
          <Route index              element={<Catalogo />} />
          <Route path="productos"   element={<Catalogo />} />
          <Route path="producto/:id" element={<ProductoDetalle />} />
          <Route path="carrito"     element={<Carrito />} />
          <Route path="mis-pedidos" element={<MisPedidos />} />
          <Route path="perfil"      element={<PerfilCliente />} />
          <Route path="*"           element={<NotFound />} />
        </Routes>
      </main>
    </>
  );
}
