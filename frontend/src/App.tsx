import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState } from 'react';

import { ClienteProvider } from './cliente/context/ClienteContext';
import ClienteApp from './cliente/ClienteApp';

import Login from './components/Login';
import DashboardVendedor from './components/DashboardVendedor';
import DashboardAdmin from './components/DashboardAdmin';

function App() {
  const [userRole, setUserRole] = useState<number | null>(null);

  return (
    <ClienteProvider>
      <BrowserRouter>
        <Routes>
          {/* CLIENTE */}
          <Route path="/*" element={<ClienteApp />} />

          {/* ADMIN / VENDEDOR */}
          <Route
            path="/admin"
            element={
              userRole === null ? (
                <Login onLoginSuccess={setUserRole} />
              ) : userRole === 1 ? (
                <DashboardVendedor onLogout={() => setUserRole(null)} />
              ) : (
                <DashboardAdmin onLogout={() => setUserRole(null)} />
              )
            }
          />
        </Routes>
      </BrowserRouter>
    </ClienteProvider>
  );
}

export default App;