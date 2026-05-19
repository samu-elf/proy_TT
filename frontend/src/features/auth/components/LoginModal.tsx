import { useState, useEffect } from 'react';
import { authApi } from '../../../api/auth';
import { useCliente } from '../context/ClienteContext';

interface Props {
  onClose: () => void;
  onSuccess?: () => void;
}

type Modo = 'login' | 'registro';

export default function LoginModal({ onClose, onSuccess }: Props) {
  const { login } = useCliente();
  const [modo, setModo] = useState<Modo>('login');
  const [form, setForm] = useState({
    nombre: '', email: '', password: '', telefono: '', confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Cerrar con Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setError('');
  };

  const validate = (): boolean => {
    if (!form.email || !form.password) {
      setError('Email y contraseña son requeridos');
      return false;
    }
    if (modo === 'registro') {
      if (!form.nombre.trim()) {
        setError('El nombre es requerido');
        return false;
      }
      if (form.password.length < 8) {
        setError('La contraseña debe tener al menos 8 caracteres');
        return false;
      }
      if (form.password !== form.confirmPassword) {
        setError('Las contraseñas no coinciden');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const res =
        modo === 'login'
          ? await authApi.loginCliente(form.email, form.password)
          : await authApi.registroCliente({
              nombre: form.nombre,
              email: form.email,
              password: form.password,
              telefono: form.telefono,
            });

      login(res.data.token, res.data.cliente);
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const toggleModo = () => {
    setModo(modo === 'login' ? 'registro' : 'login');
    setError('');
  };

  return (
    <div
      className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
      style={{ background: 'rgba(0,0,0,0.6)', zIndex: 1050 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-4 p-4 shadow-lg"
        style={{ width: '100%', maxWidth: 420, margin: '0 1rem' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h2 id="modal-title" className="h5 fw-bold mb-0">
            {modo === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </h2>
          <button
            onClick={onClose}
            className="btn-close"
            aria-label="Cerrar"
          />
        </div>

        <p className="text-muted small mb-4">
          {modo === 'login'
            ? 'Accede a tu cuenta para continuar'
            : 'Regístrate gratis y empieza a comprar'}
        </p>

        <form onSubmit={handleSubmit} noValidate>
          {modo === 'registro' && (
            <div className="mb-3">
              <label className="form-label">Nombre completo *</label>
              <input
                name="nombre"
                className="form-control"
                placeholder="Juan Pérez"
                value={form.nombre}
                onChange={handleChange}
                autoComplete="name"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Correo electrónico *</label>
            <input
              name="email"
              type="email"
              className="form-control"
              placeholder="tucorreo@ejemplo.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Contraseña *</label>
            <input
              name="password"
              type="password"
              className="form-control"
              placeholder={modo === 'registro' ? 'Mínimo 8 caracteres' : '••••••••'}
              value={form.password}
              onChange={handleChange}
              autoComplete={modo === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {modo === 'registro' && (
            <>
              <div className="mb-3">
                <label className="form-label">Confirmar contraseña *</label>
                <input
                  name="confirmPassword"
                  type="password"
                  className="form-control"
                  placeholder="Repite la contraseña"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  autoComplete="new-password"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Teléfono (opcional)</label>
                <input
                  name="telefono"
                  type="tel"
                  className="form-control"
                  placeholder="+591 77777777"
                  value={form.telefono}
                  onChange={handleChange}
                />
              </div>
            </>
          )}

          {error && (
            <div className="alert alert-danger py-2 small mb-3" role="alert">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-100 mb-3"
            style={{ background: '#6c63ff', border: 'none' }}
          >
            {loading
              ? 'Procesando...'
              : modo === 'login'
              ? 'Iniciar sesión'
              : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center small text-muted mb-0">
          {modo === 'login' ? '¿No tienes cuenta? ' : '¿Ya tienes cuenta? '}
          <button
            type="button"
            onClick={toggleModo}
            className="btn btn-link p-0 small"
            style={{ color: '#6c63ff' }}
          >
            {modo === 'login' ? 'Regístrate aquí' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}
