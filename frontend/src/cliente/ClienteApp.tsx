import { Routes, Route } from 'react-router-dom';

import Navbar from './components/Navbar';
import Catalogo from './pages/Catalogo';
import ProductoDetalle from './pages/ProductoDetalle';
import Carrito from './pages/Carrito';
import MisPedidos from './pages/MisPedidos';

function ClienteApp() {
  return (
    <>
      <Navbar />

      <main style={{ minHeight: '100vh', background: '#f8f9fa' }}>
        <Routes>
          <Route path="/" element={<Catalogo />} />
          <Route path="/productos" element={<Catalogo />} />
          <Route path="/producto/:id" element={<ProductoDetalle />} />
          <Route path="/carrito" element={<Carrito />} />
          <Route path="/mis-pedidos" element={<MisPedidos />} />
        </Routes>
      </main>
    </>
  );
}

export default ClienteApp;