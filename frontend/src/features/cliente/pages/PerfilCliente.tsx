/**
 * PerfilCliente — ver y editar datos personales del cliente
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { clienteApi } from '../../../api/cliente';
import { useCliente } from '../../auth/context/ClienteContext';
import type { ClienteData } from '../../../types';

export default function PerfilCliente() {
  const { isAuthenticated, login, token } = useCliente();
  const [perfil,   setPerfil]   = useState<ClienteData | null>(null);
  const [nombre,   setNombre]   = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion,setDireccion]= useState('');
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState('');
  const [err,      setErr]      = useState('');

  useEffect(() => {
    if (!isAuthenticated) { setLoading(false); return; }
    clienteApi.perfil()
      .then(r => {
        setPerfil(r.data);
        setNombre(r.data.nombre ?? '');
        setTelefono(r.data.telefono ?? '');
        setDireccion(r.data.direccion_defecto ?? '');
      })
      .catch(() => setErr('No se pudo cargar el perfil'))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleGuardar = async () => {
    if (!nombre.trim()) { setErr('El nombre no puede estar vacío'); return; }
    setSaving(true); setErr(''); setMsg('');
    try {
      const r = await clienteApi.actualizarPerfil({
        nombre: nombre.trim(),
        telefono: telefono.trim() || undefined,
        direccion_defecto: direccion.trim() || undefined,
      });
      setPerfil(r.data.cliente);
      // Actualizar contexto para que el Navbar refleje el nuevo nombre
      if (token) login(token, r.data.cliente);
      setMsg('✅ Perfil actualizado correctamente');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container py-5 text-center">
        <div style={{ fontSize: '3rem' }}>👤</div>
        <h4 className="mt-3">Inicia sesión para ver tu perfil</h4>
        <Link to="/" className="btn btn-primary mt-3" style={{ background: '#6c63ff', border: 'none' }}>
          Ir al inicio
        </Link>
      </div>
    );
  }

  if (loading) {
    return <div className="container py-5 text-center"><div className="spinner-border text-primary" /></div>;
  }

  return (
    <div className="container py-4" style={{ maxWidth: 540 }}>
      <h2 className="fw-bold mb-4">👤 Mi Perfil</h2>

      {msg && <div className="alert alert-success py-2">{msg}</div>}
      {err && <div className="alert alert-danger py-2">{err}</div>}

      <div className="card border-0 shadow-sm rounded-3 p-4">
        {/* Avatar */}
        <div className="d-flex align-items-center gap-3 mb-4">
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#6c63ff', color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem', fontWeight: 700, flexShrink: 0,
          }}>
            {(perfil?.nombre ?? 'U').charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="fw-bold mb-0">{perfil?.nombre}</p>
            <p className="text-muted small mb-0">{perfil?.email}</p>
          </div>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold small">Nombre completo *</label>
          <input className="form-control" value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder="Tu nombre completo" />
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold small">Correo electrónico</label>
          <input className="form-control" value={perfil?.email ?? ''} disabled
            style={{ background: '#f9fafb', color: '#6b7280' }} />
          <small className="text-muted">El email no se puede cambiar</small>
        </div>

        <div className="mb-3">
          <label className="form-label fw-semibold small">Teléfono</label>
          <input className="form-control" value={telefono}
            onChange={e => setTelefono(e.target.value)}
            placeholder="+591 7XX XXX XXX" />
        </div>

        <div className="mb-4">
          <label className="form-label fw-semibold small">Dirección de entrega por defecto</label>
          <textarea className="form-control" rows={2} value={direccion}
            onChange={e => setDireccion(e.target.value)}
            placeholder="Ej: Av. 6 de Agosto #456, Sopocachi, La Paz" />
        </div>

        <button className="btn w-100 py-2 fw-bold text-white"
          style={{ background: '#6c63ff', border: 'none' }}
          onClick={handleGuardar} disabled={saving}>
          {saving ? 'Guardando...' : '💾 Guardar cambios'}
        </button>
      </div>

      <div className="mt-3 d-flex gap-2">
        <Link to="/mis-pedidos" className="btn btn-outline-secondary btn-sm flex-fill">
          📦 Mis pedidos
        </Link>
        <Link to="/productos" className="btn btn-outline-secondary btn-sm flex-fill">
          🛍 Seguir comprando
        </Link>
      </div>
    </div>
  );
}
