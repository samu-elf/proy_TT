/**
 * Contexto global del cliente (sesión + carrito).
 * CORRECCIÓN: Persistencia robusta con manejo de errores de localStorage.
 */
import {
  createContext, useContext, useState, useCallback,
  type ReactNode,
} from 'react';
import type { ClienteData } from '../../../types';

interface ClienteContextType {
  cliente: ClienteData | null;
  token: string | null;
  isAuthenticated: boolean;
  cantidadCarrito: number;
  login: (token: string, data: ClienteData) => void;
  logout: () => void;
  setCantidadCarrito: (n: number) => void;
}

const ClienteContext = createContext<ClienteContextType | null>(null);

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function ClienteProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteData | null>(() =>
    safeJsonParse<ClienteData>(localStorage.getItem('cliente_data'))
  );

  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('cliente_token')
  );

  const [cantidadCarrito, setCantidadCarrito] = useState(0);

  const login = useCallback((newToken: string, data: ClienteData) => {
    setToken(newToken);
    setCliente(data);
    try {
      localStorage.setItem('cliente_token', newToken);
      localStorage.setItem('cliente_data', JSON.stringify(data));
    } catch {
      // localStorage puede estar lleno o bloqueado en modo privado
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setCliente(null);
    setCantidadCarrito(0);
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_data');
  }, []);

  return (
    <ClienteContext.Provider
      value={{
        cliente,
        token,
        isAuthenticated: !!token,
        cantidadCarrito,
        login,
        logout,
        setCantidadCarrito,
      }}
    >
      {children}
    </ClienteContext.Provider>
  );
}

export function useCliente(): ClienteContextType {
  const ctx = useContext(ClienteContext);
  if (!ctx) throw new Error('useCliente debe usarse dentro de <ClienteProvider>');
  return ctx;
}
