import { useState } from 'react';
import axios from 'axios';

interface LoginProps {
  onLoginSuccess: (rol: number) => void;
}

const Login = ({ onLoginSuccess }: LoginProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tipoLogin, setTipoLogin] = useState<number>(1); // 1: Vendedor, 2: Admin

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Usamos la ruta completa para evitar líos con el proxy mientras pruebas
      const response = await axios.post('http://localhost:5000/login', {
        email: email,
        password: password
      });
      
      if (response.data.status === 'success') {
        const rolRecibido = response.data.usuario.rol;
        
        // Verificamos que el rol coincida con el botón seleccionado
        if (Number(rolRecibido) === tipoLogin) {
            onLoginSuccess(Number(rolRecibido));
        } else {
            setError(`Este usuario no tiene permisos de ${tipoLogin === 1 ? 'Vendedor' : 'Administrador'}`);
        }
      }
    } catch (err: any) {
      setError(err.response?.data?.mensaje || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', fontFamily: 'sans-serif' }}>
      
      {/* Lado Izquierdo: Banner */}
      <div style={{ flex: 1, background: 'linear-gradient(135deg, #ff7e5f 0%, #feb47b 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'white', padding: '40px', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem' }}>CHUKUTA EXPRESS</h1>
        <p style={{ fontSize: '1.2rem' }}>Sistema de Gestión La Paz</p>
        <div style={{ marginTop: '50px', fontSize: '8rem' }}>📦</div>
      </div>

      {/* Lado Derecho: Formulario */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', backgroundColor: 'white' }}>
        <div style={{ width: '100%', maxWidth: '350px' }}>
          
          <div style={{ display: 'flex', backgroundColor: '#f0f0f0', borderRadius: '25px', padding: '5px', marginBottom: '25px' }}>
            <button type="button" onClick={() => setTipoLogin(1)} style={tipoLogin === 1 ? activeStyle : inactiveStyle}>Vendedor</button>
            <button type="button" onClick={() => setTipoLogin(2)} style={tipoLogin === 2 ? activeStyle : inactiveStyle}>Admin</button>
          </div>

          <h2 style={{ marginBottom: '20px' }}>{tipoLogin === 1 ? 'Acceso Ventas' : 'Panel de Control'}</h2>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <input type="email" placeholder="Correo" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
            <input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
            
            <button type="submit" disabled={loading} style={{...btnStyle, backgroundColor: tipoLogin === 1 ? '#ff4400' : '#2c3e50'}}>
              {loading ? 'Cargando...' : 'Ingresar'}
            </button>
          </form>

          {error && <p style={{ color: 'red', marginTop: '15px', textAlign: 'center', fontSize: '14px' }}>{error}</p>}
        </div>
      </div>
    </div>
  );
};

const activeStyle = { flex: 1, padding: '10px', borderRadius: '20px', border: 'none', backgroundColor: 'white', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' };
const inactiveStyle = { flex: 1, padding: '10px', border: 'none', backgroundColor: 'transparent', color: '#888', cursor: 'pointer' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #ddd' };
const btnStyle = { padding: '12px', color: 'white', border: 'none', borderRadius: '25px', fontWeight: 'bold', cursor: 'pointer' };

// AQUÍ ESTABA EL ERROR: Debe exportar Login, no App
export default Login;