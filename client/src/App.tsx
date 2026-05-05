import React, { useState } from 'react';
import RegistrationForm from './RegistrationForm';
import Dashboard from './Dashboard';
import Scanner from './Scanner';
import CsvImport from './CsvImport';
import BulkEmail from './BulkEmail';
import Login from './Login';
import { authFetch, clearAuth, getAccessToken } from './api';
import './App.css';

function App() {
  const [view, setView] = useState<'register' | 'dashboard' | 'scan' | 'import' | 'email'>('register');
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAccessToken()));

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await authFetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
      }
    } catch {
      // Local logout should still happen even if API logout fails.
    } finally {
      clearAuth();
      setIsAuthenticated(false);
      setView('register');
    }
  };

  const adminView = view === 'import' || view === 'email';

  return (
    <div className="App">
      <nav style={{ padding: '10px', background: '#333', color: '#fff', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => setView('register')} style={{ cursor: 'pointer' }}>Registration</button>
        <button onClick={() => setView('scan')} style={{ cursor: 'pointer' }}>QR Scanner</button>
        <button onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>Live Dashboard</button>
        <button onClick={() => setView('import')} style={{ cursor: 'pointer' }}>Import Data</button>
        <button onClick={() => setView('email')} style={{ cursor: 'pointer' }}>Bulk Email</button>
        {isAuthenticated && <button onClick={handleLogout} style={{ cursor: 'pointer' }}>Logout</button>}
      </nav>
      {view === 'register' && <RegistrationForm />}
      {view === 'scan' && <Scanner />}
      {view === 'dashboard' && <Dashboard />}
      {adminView && !isAuthenticated && <Login onSuccess={() => setIsAuthenticated(true)} />}
      {view === 'import' && isAuthenticated && <CsvImport />}
      {view === 'email' && isAuthenticated && <BulkEmail />}
    </div>
  );
}

export default App;
