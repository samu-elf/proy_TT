import { useState } from 'react';
import { useCliente } from '../context/ClienteContext';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

export default function LoginModal({ onClose, onSuccess }: Props) {
  const { login } = useCliente();
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [form, setForm] = useState({ nombre: '', email: '', password: '', telefono: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    const url = modo === 'login' ? '/cliente/login' : '/cliente/registro';
    try {
      const res = await fetch(`http://localhost:5000${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.status === 'success') {
        login(data.token, data.cliente);
        onSuccess?.();
        onClose();
      } else {
        setError(data.mensaje || 'Error al procesar');
      }
    } catch {
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <h2 style={{ marginBottom: '4px' }}>
          {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
        </h2>
        <p style={{ color: '#718096', marginBottom: '20px', fontSize: '0.9rem' }}>
          {modo === 'login' ? 'Para continuar con tu compra' : 'Es rápido y gratuito'}
        </p>

        {modo === 'registro' && (
          <input name="nombre" placeholder="Nombre completo" value={form.nombre}
            onChange={handleChange} style={inputStyle} />
        )}
        <input name="email" type="email" placeholder="Correo electrónico"
          value={form.email} onChange={handleChange} style={inputStyle} />
        <input name="password" type="password" placeholder="Contraseña"
          value={form.password} onChange={handleChange} style={inputStyle} />
        {modo === 'registro' && (
          <input name="telefono" placeholder="Teléfono (opcional)"
            value={form.telefono} onChange={handleChange} style={inputStyle} />
        )}

        {error && (
          <p style={{ color: '#e53e3e', background: '#fff5f5', padding: '10px', borderRadius: '8px', margin: '0 0 12px' }}>
            {error}
          </p>
        )}

        <button onClick={handleSubmit} disabled={loading} style={submitBtnStyle}>
          {loading ? 'Procesando...' : modo === 'login' ? 'Entrar' : 'Registrarme'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem', color: '#718096' }}>
          {modo === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}
            style={{ background: 'none', border: 'none', color: '#6c63ff', cursor: 'pointer', fontWeight: 600 }}>
            {modo === 'login' ? 'Regístrate' : 'Inicia sesión'}
          </button>
        </p>

        <button onClick={onClose} style={closeBtnStyle}>✕</button>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
};
const modalStyle: React.CSSProperties = {
  background: 'white', borderRadius: '16px', padding: '32px',
  width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px', marginBottom: '12px',
  border: '1px solid #e2e8f0', borderRadius: '8px',
  fontSize: '0.95rem', boxSizing: 'border-box'
};
const submitBtnStyle: React.CSSProperties = {
  width: '100%', padding: '13px', background: '#6c63ff',
  color: 'white', border: 'none', borderRadius: '8px',
  fontSize: '1rem', fontWeight: 700, cursor: 'pointer'
};
const closeBtnStyle: React.CSSProperties = {
  position: 'absolute', top: '16px', right: '16px',
  background: 'none', border: 'none', fontSize: '1.2rem',
  cursor: 'pointer', color: '#718096'
};