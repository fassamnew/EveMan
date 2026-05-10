'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, loadSession } from '../../../lib/session';

type NavItem = {
  href: string;
  label: string;
};

const navItems: NavItem[] = [
  { href: '/super-admin', label: 'Dashboard' },
  { href: '/super-admin/organizations', label: 'Organizations' },
  { href: '/super-admin/events', label: 'Events' },
  { href: '/super-admin/users', label: 'System Users' },
  { href: '/super-admin/audit', label: 'Audit Logs' },
  { href: '/super-admin/operations', label: 'Operations' },
  { href: '/super-admin/settings/subscription', label: 'Subscription' },
  { href: '/super-admin/settings/communications', label: 'Communications' },
  { href: '/super-admin/templates/badges', label: 'Badge Templates' },
  { href: '/super-admin/templates/registration-pages', label: 'Registration Templates' }
];

export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [email, setEmail] = useState('');

  useEffect(() => {
    const session = loadSession();
    if (!session || !session.roles.includes('SUPER_ADMIN')) {
      router.replace('/sa');
      return;
    }

    setEmail(session.email);
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-[1500px]">
        <aside className={`${menuOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-800 bg-slate-900 p-5 transition sm:translate-x-0 sm:static sm:block`}>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Control Plane</p>
          <h1 className="mt-2 text-2xl font-semibold">Super Admin</h1>
          <p className="mt-1 text-xs text-slate-400 truncate">{email || '...'}</p>

          <nav className="mt-6 space-y-1">
            {navItems.map(item => {
              const active = pathname === item.href || (item.href !== '/super-admin' && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block rounded-lg px-3 py-2 text-sm transition ${active ? 'bg-cyan-500/20 text-cyan-200' : 'text-slate-300 hover:bg-slate-800 hover:text-slate-100'}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => {
              clearSession();
              router.push('/sa');
            }}
            className="mt-6 w-full rounded-lg border border-rose-500/60 px-3 py-2 text-sm text-rose-200 transition hover:bg-rose-500/10"
          >
            Sign out
          </button>
        </aside>

        <div className="w-full sm:ml-0">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur sm:px-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setMenuOpen(open => !open)}
                className="rounded-md border border-slate-700 px-3 py-1 text-xs text-slate-200 sm:hidden"
              >
                Menu
              </button>
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Platform Administration</p>
            </div>
          </header>

          <section className="px-4 py-6 sm:px-6">{children}</section>
        </div>
      </div>
    </main>
  );
}
