/**
 * AuthAdminContext — sesión del panel interno (Admin / Vendedor / Operador)
 *
 * Funcionalidades:
 * - Inicialización lazy con verificación de expiración JWT (sin llamada al servidor)
 * - logout() limpia TODOS los tokens (admin + cliente) para evitar sesiones cruzadas
 * - login() persiste token y datos del usuario en localStorage de forma atómica
 * - Expone: userRole, userName, login(), logout(), isLoading
 */
import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';

export interface AdminUser {
  id: number;
  nombre: string;
  rol: number;
  nombre_rol?: string;
}

interface AuthAdminCtx {
  user:      AdminUser | null;
  userRole:  number | null;
  isLoading: boolean;
  login:  (token: string, user: AdminUser) => void;
  logout: () => void;
}

const AuthAdminContext = createContext<AuthAdminCtx | null>(null);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isJwtExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

function readSession(): AdminUser | null {
  try {
    const token = localStorage.getItem('admin_token');
    const raw   = localStorage.getItem('admin_user');
    if (!token || !raw) return null;
    if (isJwtExpired(token)) {
      clearAdminStorage();
      return null;
    }
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

function clearAdminStorage() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_user');
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthAdminProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: lee localStorage una sola vez al montar
  const [user, setUser] = useState<AdminUser | null>(readSession);
  const [isLoading] = useState(false);

  const login = useCallback((token: string, userData: AdminUser) => {
    try {
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(userData));
    } catch { /* localStorage bloqueado en modo privado */ }
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    // Limpia TODOS los tokens para evitar sesiones cruzadas
    clearAdminStorage();
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_data');
    setUser(null);
  }, []);

  return (
    <AuthAdminContext.Provider value={{
      user,
      userRole:  user?.rol ?? null,
      isLoading,
      login,
      logout,
    }}>
      {children}
    </AuthAdminContext.Provider>
  );
}

export function useAuthAdmin(): AuthAdminCtx {
  const ctx = useContext(AuthAdminContext);
  if (!ctx) throw new Error('useAuthAdmin debe usarse dentro de <AuthAdminProvider>');
  return ctx;
}
