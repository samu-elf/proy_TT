/**
 * App.tsx — Raíz de Chukuta Express
 * Enruta según rol: 1=Vendedor, 2=Admin, 3=Operador
 */
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthAdminProvider, useAuthAdmin } from './features/auth/context/AuthAdminContext';
import { ClienteProvider } from './features/auth/context/ClienteContext';
import ClienteApp from './ClienteApp';
import AdminLogin from './features/auth/components/AdminLogin';
import DashboardVendedor from './features/vendedor/pages/DashboardVendedor';
import DashboardAdmin from './features/admin/pages/DashboardAdmin';

function AdminPanel() {
  const { userRole, logout } = useAuthAdmin();
  if (!userRole) return <AdminLogin />;
  if (userRole === 1) return <DashboardVendedor onLogout={logout} />;
  return <DashboardAdmin onLogout={logout} userRole={userRole} />;
}

export default function App() {
  return (
    <AuthAdminProvider>
      <ClienteProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/*"    element={<ClienteApp />} />
          </Routes>
        </BrowserRouter>
      </ClienteProvider>
    </AuthAdminProvider>
  );
}
