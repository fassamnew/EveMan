import React, { useState } from 'react';
import RegistrationForm from './RegistrationForm';
import Dashboard from './Dashboard';
import Scanner from './Scanner';
import CsvImport from './CsvImport';
import './App.css';

function App() {
  const [view, setView] = useState<'register' | 'dashboard' | 'scan' | 'import'>('register');

  const navItems = [
    { key: 'register', label: 'Registration', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
    { key: 'scan', label: 'QR Scanner', icon: 'M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h2M4 8h16M4 16h16M4 4h16' },
    { key: 'dashboard', label: 'Live Stats', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
    { key: 'import', label: 'Import', icon: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans antialiased">
      {/* Dynamic Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-2">
              <div className="bg-primary p-2 rounded-xl">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </div>
              <span className="text-xl font-black text-gray-900 tracking-tighter uppercase ml-2 hidden sm:block">EveMange <span className="text-primary italic">2026</span></span>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {navItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key as any)}
                  className={`flex items-center gap-2 px-3 sm:px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    view === item.key 
                      ? 'bg-primary text-white shadow-lg shadow-blue-500/20 active:scale-95' 
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon} />
                  </svg>
                  <span className="hidden md:block">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow relative">
        <div className="absolute inset-0 overflow-auto">
          {view === 'register' && <RegistrationForm />}
          {view === 'scan' && <Scanner />}
          {view === 'dashboard' && <Dashboard />}
          {view === 'import' && <CsvImport />}
        </div>
      </main>
    </div>
  );
}

export default App;
