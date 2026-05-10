'use client';

import { useParams, useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, loadSession } from '../../../lib/session';
import { useTheme } from '../../../lib/theme-provider';
import { Menu, X, Sun, Moon } from 'lucide-react';

const navItems = [
  { label: 'Dashboard', href: '', icon: '📊' },
  { label: 'Events & Links', href: '/events', icon: '🗓' },
  { label: 'Attendees', href: '/attendees', icon: '👥' },
  { label: 'Imports', href: '/imports', icon: '📥' },
  { label: 'Badge Templates', href: '/templates/badges', icon: '🏷' },
  { label: 'Communications', href: '/communications', icon: '📨' },
  { label: 'Analytics', href: '/analytics', icon: '📈' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

export default function OrgLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  const orgCode = params.orgCode as string;

  useEffect(() => {
    const session = loadSession();
    if (!session || session.organizationCode !== orgCode) {
      router.replace(`/o/${orgCode}/login`);
      return;
    }
    setEmail(session.email);
    setIsAuthorized(true);
  }, [orgCode, router]);

  if (!isAuthorized) {
    return null;
  }

  const isActive = (href: string) => {
    if (href === '') {
      return pathname === `/o/${orgCode}`;
    }
    return pathname.includes(href);
  };

  return (
    <div
      className={`flex h-screen flex-col overflow-hidden transition-colors ${
        theme === 'dark'
          ? 'bg-slate-950 text-slate-100'
          : 'bg-white text-slate-950'
      }`}
    >
      {/* Header */}
      <header
        className={`border-b ${
          theme === 'dark'
            ? 'border-slate-800 bg-slate-900/80'
            : 'border-slate-200 bg-slate-50'
        } backdrop-blur`}
      >
        <div className="flex items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`rounded-lg p-2 transition lg:hidden ${
                theme === 'dark'
                  ? 'hover:bg-slate-800'
                  : 'hover:bg-slate-100'
              }`}
            >
              {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div>
              <p
                className={`text-xs font-semibold uppercase tracking-wide ${
                  theme === 'dark' ? 'text-cyan-300' : 'text-blue-600'
                }`}
              >
                Organization Portal
              </p>
              <h1 className="text-lg font-bold capitalize">{orgCode}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`rounded-lg p-2 transition ${
                theme === 'dark'
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-slate-100 hover:bg-slate-200'
              }`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <div className="hidden items-center gap-3 sm:flex">
              <span className={`text-sm ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                {email}
              </span>
              <button
                onClick={() => {
                  clearSession();
                  router.push(`/o/${orgCode}`);
                }}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  theme === 'dark'
                    ? 'border border-rose-500/60 text-rose-200 hover:bg-rose-500/10'
                    : 'border border-rose-300 text-rose-700 hover:bg-rose-100'
                }`}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 top-[65px] z-40 w-64 transform border-r transition-transform duration-300 lg:relative lg:top-0 lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } ${
            theme === 'dark'
              ? 'border-slate-800 bg-slate-900'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <nav className="space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const href = `/o/${orgCode}${item.href}`;
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    router.push(href);
                    setSidebarOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition ${
                    isActive(item.href)
                      ? theme === 'dark'
                        ? 'bg-cyan-500/10 text-cyan-300'
                        : 'bg-blue-100 text-blue-700'
                      : theme === 'dark'
                      ? 'text-slate-300 hover:bg-slate-800'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>
          <div className={`border-t p-4 sm:hidden ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}>
            <p className={`text-xs mb-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
              {email}
            </p>
            <button
              onClick={() => {
                clearSession();
                router.push(`/o/${orgCode}`);
              }}
              className={`w-full rounded-lg px-3 py-2 text-sm font-medium transition ${
                theme === 'dark'
                  ? 'border border-rose-500/60 text-rose-200 hover:bg-rose-500/10'
                  : 'border border-rose-300 text-rose-700 hover:bg-rose-100'
              }`}
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-[65px] z-30 bg-black/50 transition lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main
          className={`flex-1 overflow-auto ${
            theme === 'dark' ? 'bg-slate-950' : 'bg-white'
          }`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
