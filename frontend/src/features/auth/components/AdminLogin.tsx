/**
 * AdminLogin — pantalla de login para el panel interno
 * Usa useAdminAuth (que escribe en AuthAdminContext).
 * Al hacer login exitoso, App.tsx re-renderiza y muestra el dashboard correcto.
 */
import { useState, useRef, useEffect } from 'react';
import { useAdminAuth } from '../hooks/useAdminAuth';

export default function AdminLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const emailRef                = useRef<HTMLInputElement>(null);
  const { doLogin, loading, error, setError } = useAdminAuth();

  useEffect(() => { emailRef.current?.focus(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) { setError('Email y contraseña son requeridos'); return; }
    await doLogin(email, password);
    // Si el login fue exitoso, AuthAdminContext actualiza userRole y App.tsx
    // re-renderiza mostrando el dashboard. No se necesita navegación.
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* ── Branding left panel ─────────────────────────────────────────── */}
      <div className="d-none d-lg-flex flex-column justify-content-between p-5"
        style={{ width: '45%', flexShrink: 0, background: 'linear-gradient(150deg,#1a1a2e 0%,#16213e 60%,#0f3460 100%)', color: 'white' }}>
        <div>
          <span style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            📦 Chukuta<span style={{ color: '#ff7043' }}>Express</span>
          </span>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem', marginTop: 4 }}>
            Sistema de gestión multivendedor · La Paz, Bolivia
          </p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '7rem' }}>🏪</div>
          <h2 style={{ fontWeight: 700, fontSize: '1.5rem', marginTop: 20 }}>Panel de control</h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.88rem', marginTop: 8 }}>
            Gestiona productos, pedidos, inventario<br/>y usuarios desde un solo lugar
          </p>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem' }}>
          © {new Date().getFullYear()} Chukuta Express
        </p>
      </div>

      {/* ── Form right panel ────────────────────────────────────────────── */}
      <div className="flex-grow-1 d-flex flex-column justify-content-center align-items-center p-4"
        style={{ background: 'white' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>

          {/* Mobile logo */}
          <div className="d-lg-none text-center mb-4">
            <p style={{ fontWeight: 800, fontSize: '1.3rem', margin: 0 }}>
              📦 Chukuta<span style={{ color: '#ff7043' }}>Express</span>
            </p>
          </div>

          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
            Iniciar sesión
          </h1>
          <p style={{ color: '#6b7280', fontSize: '0.88rem', marginBottom: 28 }}>
            Accede al panel de administración
          </p>

          <form onSubmit={handleSubmit} noValidate>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Correo electrónico
              </label>
              <input ref={emailRef} type="email" className="form-control"
                placeholder="usuario@chukuta.com" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                autoComplete="username" disabled={loading}
                style={{ height: 44 }} />
            </div>

            <div style={{ marginBottom: 22 }}>
              <label style={{ display: 'block', fontSize: '0.83rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
                Contraseña
              </label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} className="form-control"
                  placeholder="••••••••" value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(''); }}
                  autoComplete="current-password" disabled={loading}
                  style={{ height: 44, paddingRight: 44 }} />
                <button type="button" onClick={() => setShowPwd(!showPwd)} tabIndex={-1}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '1rem' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div className="alert alert-danger py-2" style={{ fontSize: '0.84rem', marginBottom: 16 }} role="alert">
                ⚠ {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              style={{ width: '100%', height: 46, background: loading ? '#9ca3af' : '#1a1a2e',
                color: 'white', border: 'none', borderRadius: 8, fontWeight: 700,
                fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s' }}>
              {loading ? 'Verificando...' : 'Ingresar al sistema'}
            </button>
          </form>

          {/* Demo credentials */}
          <div style={{ marginTop: 24, padding: '12px 14px', background: '#f8f9fa',
            borderRadius: 8, border: '1px solid #e9ecef', fontSize: '0.78rem', color: '#374151' }}>
            <strong style={{ color: '#6b7280' }}>DEMO —</strong>{' '}
            admin@chukuta.com · Admin123!
          </div>

          <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.78rem', marginTop: 20 }}>
            ¿Problemas para ingresar?{' '}
            <a href="mailto:soporte@chukuta.com" style={{ color: '#6c63ff' }}>Contacta soporte</a>
          </p>
        </div>
      </div>
    </div>
  );
}
