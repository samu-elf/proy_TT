import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useCliente } from '../context/ClienteContext';
import LoginModal from './LoginModal';

export default function Navbar() {
  const { cliente, logout, isAuthenticated, cantidadCarrito } = useCliente();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
        <Link className="navbar-brand fw-bold" to="/">
          🛍 ChukutaExpress
        </Link>

        <div className="ms-auto d-flex align-items-center gap-3">

          <Link className="nav-link text-white" to="/productos">
            Catálogo
          </Link>

          <Link className="nav-link text-white position-relative" to="/carrito">
            🛒 Carrito
            {cantidadCarrito > 0 && (
              <span className="badge bg-danger ms-1">
                {cantidadCarrito}
              </span>
            )}
          </Link>

          {isAuthenticated ? (
            <>
              <Link className="nav-link text-white" to="/mis-pedidos">
                Mis pedidos
              </Link>

              <span className="text-light small">
                👋 {cliente?.nombre?.split(' ')[0] ?? 'Usuario'}
              </span>

              <button className="btn btn-outline-light btn-sm" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setShowLogin(true)}>
              Iniciar sesión
            </button>
          )}

        </div>
      </nav>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}