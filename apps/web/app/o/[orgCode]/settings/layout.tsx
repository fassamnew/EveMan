'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useTheme } from '../../../../lib/theme-provider';

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const { theme } = useTheme();
  const orgCode = params.orgCode as string;

  const navItems = [
    { label: 'Link Types', href: `/o/${orgCode}/settings` },
    { label: 'Custom Roles', href: `/o/${orgCode}/settings/roles` },
    { label: 'Bulk Invitations', href: `/o/${orgCode}/settings/invitations` },
  ];

  return (
    <div className={`flex flex-col gap-6 p-6 sm:flex-row sm:gap-8 ${
      theme === 'dark' ? 'bg-slate-950' : 'bg-white'
    }`}>
      {/* Sidebar Navigation */}
      <nav className={`w-full space-y-1 rounded-lg border p-4 sm:w-48 sm:flex-shrink-0 ${
        theme === 'dark'
          ? 'border-slate-800 bg-slate-900'
          : 'border-slate-200 bg-slate-50'
      }`}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (pathname.includes('/settings/roles') && item.href.includes('/roles')) ||
            (pathname.includes('/settings/invitations') && item.href.includes('/invitations'));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-2 transition ${
                isActive
                  ? theme === 'dark'
                    ? 'bg-cyan-500/10 text-cyan-300'
                    : 'bg-blue-100 text-blue-700'
                  : theme === 'dark'
                  ? 'text-slate-300 hover:bg-slate-800'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Main Content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}

