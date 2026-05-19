/**
 * useAdminAuth — hook de login para el panel interno
 * Usa AuthAdminContext para persistir la sesión globalmente.
 */
import { useState } from 'react';
import { authApi } from '../../../api/auth';
import { useAuthAdmin } from '../context/AuthAdminContext';

export function useAdminAuth() {
  const { login } = useAuthAdmin();
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const doLogin = async (email: string, password: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await authApi.loginUsuario(email.trim().toLowerCase(), password);
      const { token, usuario } = res.data;
      login(token, {
        id:        Number(usuario.id),
        nombre:    usuario.nombre,
        rol:       Number(usuario.rol),
        nombre_rol: usuario.nombre_rol,
      });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexión');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { doLogin, loading, error, setError };
}
