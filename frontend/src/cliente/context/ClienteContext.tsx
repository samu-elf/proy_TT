import { createContext, useContext, useState, ReactNode } from 'react';

interface ClienteData {
  id: number;
  nombre: string;
  email: string;
}

interface ClienteContextType {
  cliente: ClienteData | null;
  token: string | null;
  login: (token: string, data: ClienteData) => void;
  logout: () => void;
  isAuthenticated: boolean;
  cantidadCarrito: number;
  setCantidadCarrito: (n: number) => void;
}

const ClienteContext = createContext<ClienteContextType | null>(null);

export function ClienteProvider({ children }: { children: ReactNode }) {
  const [cliente, setCliente] = useState<ClienteData | null>(() => {
    try {
      const saved = localStorage.getItem('cliente_data');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState<string | null>(
    localStorage.getItem('cliente_token')
  );

  const [cantidadCarrito, setCantidadCarrito] = useState(0);

  const login = (newToken: string, data: ClienteData) => {
    setToken(newToken);
    setCliente(data);
    localStorage.setItem('cliente_token', newToken);
    localStorage.setItem('cliente_data', JSON.stringify(data));
  };

  const logout = () => {
    setToken(null);
    setCliente(null);
    setCantidadCarrito(0);
    localStorage.removeItem('cliente_token');
    localStorage.removeItem('cliente_data');
  };

  return (
    <ClienteContext.Provider
      value={{
        cliente,
        token,
        login,
        logout,
        isAuthenticated: !!token,
        cantidadCarrito,
        setCantidadCarrito
      }}
    >
      {children}
    </ClienteContext.Provider>
  );
}

export function useCliente() {
  const ctx = useContext(ClienteContext);
  if (!ctx) throw new Error('useCliente debe usarse dentro de ClienteProvider');
  return ctx;
}