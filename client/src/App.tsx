import React, { useState } from 'react';
import RegistrationForm from './RegistrationForm';
import Dashboard from './Dashboard';
import Scanner from './Scanner';
import CsvImport from './CsvImport';
import './App.css';

function App() {
  const [view, setView] = useState<'register' | 'dashboard' | 'scan' | 'import'>('register');

  return (
    <div className="App">
      <nav style={{ padding: '10px', background: '#333', color: '#fff', display: 'flex', gap: '10px', justifyContent: 'center' }}>
        <button onClick={() => setView('register')} style={{ cursor: 'pointer' }}>Registration</button>
        <button onClick={() => setView('scan')} style={{ cursor: 'pointer' }}>QR Scanner</button>
        <button onClick={() => setView('dashboard')} style={{ cursor: 'pointer' }}>Live Dashboard</button>
        <button onClick={() => setView('import')} style={{ cursor: 'pointer' }}>Import Data</button>
      </nav>
      {view === 'register' && <RegistrationForm />}
      {view === 'scan' && <Scanner />}
      {view === 'dashboard' && <Dashboard />}
      {view === 'import' && <CsvImport />}
    </div>
  );
}

export default App;
