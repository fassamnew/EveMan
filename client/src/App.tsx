import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import RegistrationForm from './RegistrationForm';
import Dashboard from './Dashboard';
import Scanner from './Scanner';
import CsvImport from './CsvImport';
import EventsManager from './EventsManager';
import Login from './Login';
import { LayoutDashboard, QrCode, Upload, LogOut, Calendar } from 'lucide-react';
import './App.css';

const Sidebar = () => {
  const location = useLocation();
  const navItems = [
    { path: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/portal/events', label: 'Events & Links', icon: Calendar },
    { path: '/portal/scan', label: 'QR Scanner', icon: QrCode },
    { path: '/portal/import', label: 'Bulk Import', icon: Upload },
  ];

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen flex flex-col sticky top-0 h-screen">
      <div className="p-8">
        <span className="text-xl font-black text-gray-900 tracking-tighter uppercase">
          EveMange <span className="text-primary italic">SaaS</span>
        </span>
      </div>
      
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-blue-500/20' 
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <button 
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-sm font-bold text-red-500 hover:bg-red-50 transition-all"
        >
          <LogOut className="w-5 h-5" />
          Logout
        </button>
      </div>
    </div>
  );
};

const PortalLayout = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  if (!token) return <Navigate to="/login" replace />;

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Registration Routes (Multi-Event) */}
        <Route path="/register/:slug" element={<RegistrationForm />} />
        
        {/* Organizer Portal Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/portal/*" element={
          <PortalLayout>
            <Routes>
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="events" element={<EventsManager />} />
              <Route path="scan" element={<Scanner />} />
              <Route path="import" element={<CsvImport />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </PortalLayout>
        } />

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
