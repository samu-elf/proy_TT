import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import { useCliente } from '../../features/auth/context/ClienteContext';
import LoginModal from '../../features/auth/components/LoginModal';

export default function Navbar() {
  const { cliente, logout, isAuthenticated, cantidadCarrito } = useCliente();
  const [showLogin, setShowLogin]   = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropOpen, setDropOpen]     = useState(false);
  const [busqueda, setBusqueda]     = useState('');
  const [sugerencias, setSugerencias] = useState<Array<{id_producto: number; nombre: string; imagen_url?: string}>>([]);
  const [buscando, setBuscando]     = useState(false);
  const [showSug, setShowSug]       = useState(false);
  const searchRef                   = useRef<HTMLDivElement>(null);
  const debounceSearch              = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate                    = useNavigate();
  const dropRef                     = useRef<HTMLDivElement>(null);
  const location                    = useLocation();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node))
        setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMobileOpen(false); setDropOpen(false); setBusqueda(''); setSugerencias([]); setShowSug(false); }, [location.pathname]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowSug(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); setDropOpen(false); setMobileOpen(false); };

  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setBusqueda(q);
    if (debounceSearch.current) clearTimeout(debounceSearch.current);
    if (!q.trim()) { setSugerencias([]); setShowSug(false); return; }
    debounceSearch.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
        const res = await fetch(`${baseUrl}/api/productos?q=${encodeURIComponent(q)}&per_page=6`);
        const data = await res.json();
        setSugerencias(data.items ?? []);
        setShowSug(true);
      } catch { /* silencioso */ }
      finally { setBuscando(false); }
    }, 300);
  };

  const handleSeleccionarProducto = (id: number) => {
    setShowSug(false);
    setBusqueda('');
    navigate(`/productos/${id}`);
  };

  const handleBuscarEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && busqueda.trim()) {
      setShowSug(false);
      navigate(`/productos?q=${encodeURIComponent(busqueda.trim())}`);
      setBusqueda('');
    }
  };

  const NAV_STYLE    = { color: 'rgba(255,255,255,0.85)' };
  const ACTIVE_STYLE = { color: 'white', textDecoration: 'underline', textUnderlineOffset: 4 };
  const isActive     = (p: string) =>
    location.pathname === p || location.pathname.startsWith(p + '/');

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark sticky-top"
        style={{ background: '#1a1a2e', boxShadow: '0 2px 10px rgba(0,0,0,0.3)', zIndex: 1000 }}>
        <div className="container-lg">
          <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to="/">
            <span style={{ fontSize: '1.3rem' }}>📦</span>
            <span style={{ fontSize: '1.05rem' }}>
              Chukuta<span style={{ color: '#ff7043' }}>Express</span>
            </span>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/carrito" className="d-lg-none position-relative"
              style={{ color: 'white', fontSize: '1.2rem', textDecoration: 'none' }}>
              🛒
              {cantidadCarrito > 0 && (
                <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                  style={{ fontSize: '0.6rem' }}>
                  {cantidadCarrito > 99 ? '99+' : cantidadCarrito}
                </span>
              )}
            </Link>
            <button className="navbar-toggler border-0"
              onClick={() => setMobileOpen(!mobileOpen)} aria-label="Menú">
              <span className="navbar-toggler-icon" />
            </button>
          </div>

          <div className={`collapse navbar-collapse ${mobileOpen ? 'show' : ''}`}>
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link" to="/productos"
                  style={isActive('/productos') ? ACTIVE_STYLE : NAV_STYLE}>
                  Catálogo
                </Link>
              </li>
            </ul>

            {/* ── Barra de búsqueda ── */}
            <div ref={searchRef} style={{ position: 'relative', flex: 1, maxWidth: 320, margin: '0 8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.12)',
                            border: '1px solid rgba(255,255,255,0.2)', borderRadius: 8,
                            padding: '4px 10px', gap: 6 }}>
                <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{buscando ? '⏳' : '🔍'}</span>
                <input
                  type="text"
                  placeholder="Buscar productos..."
                  value={busqueda}
                  onChange={handleBusquedaChange}
                  onFocus={() => sugerencias.length > 0 && setShowSug(true)}
                  onKeyDown={handleBuscarEnter}
                  style={{
                    background: 'transparent', border: 'none', outline: 'none',
                    color: 'white', fontSize: '0.85rem', width: '100%',
                  }}
                />
              </div>
              {showSug && sugerencias.length > 0 && (
                <div style={{
                  position: 'absolute', top: '110%', left: 0, right: 0,
                  background: 'white', borderRadius: 10,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  zIndex: 2000, overflow: 'hidden', border: '1px solid #e5e7eb',
                }}>
                  {sugerencias.map(p => (
                    <div key={p.id_producto}
                      onClick={() => handleSeleccionarProducto(p.id_producto)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', cursor: 'pointer',
                        borderBottom: '1px solid #f3f4f6', fontSize: '0.85rem', color: '#374151',
                      }}
                      onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                      onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}
                    >
                      {p.imagen_url && (
                        <img src={p.imagen_url} alt={p.nombre}
                          style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                      )}
                      <span>{p.nombre}</span>
                    </div>
                  ))}
                  <div
                    onClick={() => { navigate(`/productos?q=${encodeURIComponent(busqueda)}`); setShowSug(false); setBusqueda(''); }}
                    style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '0.8rem',
                             color: '#6c63ff', fontWeight: 600, background: '#f9fafb' }}
                  >
                    🔍 Ver todos los resultados para "{busqueda}"
                  </div>
                </div>
              )}
            </div>

            <div className="d-flex align-items-center gap-2 flex-wrap">
              <Link to="/carrito"
                className="btn btn-outline-light btn-sm d-none d-lg-flex align-items-center gap-1 position-relative">
                🛒 Carrito
                {cantidadCarrito > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger"
                    style={{ fontSize: '0.6rem' }}>
                    {cantidadCarrito > 99 ? '99+' : cantidadCarrito}
                  </span>
                )}
              </Link>

              {isAuthenticated ? (
                <>
                  <Link className="btn btn-outline-light btn-sm d-none d-lg-inline-flex" to="/mis-pedidos">
                    Mis pedidos
                  </Link>

                  <div ref={dropRef} style={{ position: 'relative' }}>
                    <button onClick={() => setDropOpen(!dropOpen)}
                      style={{
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        color: 'white', borderRadius: 8, padding: '5px 12px', fontSize: '0.875rem',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                      👤 {cliente?.nombre?.split(' ')[0] ?? 'Usuario'}
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>{dropOpen ? '▲' : '▼'}</span>
                    </button>

                    {dropOpen && (
                      <div style={{
                        position: 'absolute', right: 0, top: '110%', background: 'white',
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        minWidth: 210, zIndex: 1050, overflow: 'hidden', border: '1px solid #e5e7eb',
                      }}>
                        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                          <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#1a1a2e' }}>
                            {cliente?.nombre}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                            {cliente?.email}
                          </p>
                        </div>

                        {[
                          { to: '/mis-pedidos', label: '📦 Mis pedidos' },
                          { to: '/perfil',      label: '👤 Mi perfil'   },
                        ].map(({ to, label }) => (
                          <Link key={to} to={to} onClick={() => setDropOpen(false)}
                            style={{
                              display: 'block', padding: '10px 16px', fontSize: '0.875rem',
                              color: '#374151', textDecoration: 'none', borderBottom: '1px solid #f3f4f6',
                            }}
                            onMouseOver={e => (e.currentTarget.style.background = '#f9fafb')}
                            onMouseOut={e  => (e.currentTarget.style.background = 'transparent')}>
                            {label}
                          </Link>
                        ))}

                        <button onClick={handleLogout}
                          style={{
                            width: '100%', background: 'none', border: 'none',
                            padding: '10px 16px', textAlign: 'left', cursor: 'pointer',
                            fontSize: '0.875rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: 6,
                          }}
                          onMouseOver={e => (e.currentTarget.style.background = '#fef2f2')}
                          onMouseOut={e  => (e.currentTarget.style.background = 'none')}>
                          🚪 Cerrar sesión
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="d-lg-none w-100 border-top pt-2 mt-1">
                    <Link className="nav-link" to="/mis-pedidos" style={NAV_STYLE}>📦 Mis pedidos</Link>
                    <Link className="nav-link" to="/perfil"      style={NAV_STYLE}>👤 Mi perfil</Link>
                    <button className="nav-link border-0 bg-transparent" style={{ color: '#fc8181' }}
                      onClick={handleLogout}>🚪 Cerrar sesión</button>
                  </div>
                </>
              ) : (
                <button className="btn btn-sm fw-semibold"
                  onClick={() => { setShowLogin(true); setMobileOpen(false); }}
                  style={{ background: '#6c63ff', border: 'none', color: 'white', borderRadius: 8, padding: '6px 16px' }}>
                  Iniciar sesión
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </>
  );
}