'use client';

import { useParams, useRouter } from 'next/navigation';
import { useTheme } from '../../../lib/theme-provider';

export default function OrgDashboardPage() {
  const router = useRouter();
  const params = useParams();
  const { theme } = useTheme();
  const orgCode = params.orgCode as string;

  const quickLinks = [
    {
      title: 'Create New Event',
      description: 'Set up a new event with registration links',
      href: `/o/${orgCode}/events`,
      icon: '🗓',
      color: 'cyan',
    },
    {
      title: 'View Attendees',
      description: 'Manage registrations and approvals',
      href: `/o/${orgCode}/attendees`,
      icon: '👥',
      color: 'emerald',
    },
    {
      title: 'Import Attendees',
      description: 'Bulk upload from CSV',
      href: `/o/${orgCode}/imports`,
      icon: '📥',
      color: 'violet',
    },
    {
      title: 'Design Badges',
      description: 'Create badge templates',
      href: `/o/${orgCode}/templates/badges`,
      icon: '🏷',
      color: 'amber',
    },
    {
      title: 'Send Communications',
      description: 'Email attendees and manage templates',
      href: `/o/${orgCode}/communications`,
      icon: '📨',
      color: 'sky',
    },
    {
      title: 'View Analytics',
      description: 'Registration metrics and reports',
      href: `/o/${orgCode}/analytics`,
      icon: '📈',
      color: 'rose',
    },
  ];

  const colorClasses = {
    cyan: theme === 'dark' 
      ? 'bg-cyan-500/10 text-cyan-300' 
      : 'bg-cyan-100 text-cyan-700',
    emerald: theme === 'dark' 
      ? 'bg-emerald-500/10 text-emerald-300' 
      : 'bg-emerald-100 text-emerald-700',
    violet: theme === 'dark' 
      ? 'bg-violet-500/10 text-violet-300' 
      : 'bg-violet-100 text-violet-700',
    amber: theme === 'dark' 
      ? 'bg-amber-500/10 text-amber-300' 
      : 'bg-amber-100 text-amber-700',
    sky: theme === 'dark' 
      ? 'bg-sky-500/10 text-sky-300' 
      : 'bg-sky-100 text-sky-700',
    rose: theme === 'dark' 
      ? 'bg-rose-500/10 text-rose-300' 
      : 'bg-rose-100 text-rose-700',
  };

  return (
    <main className={`min-h-screen px-4 py-8 sm:px-6 lg:px-8 ${
      theme === 'dark' ? 'bg-slate-950' : 'bg-white'
    }`}>
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${theme === 'dark' ? 'text-slate-100' : 'text-slate-950'}`}>
            Welcome to {orgCode}
          </h1>
          <p className={`mt-2 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
            Manage your events, registrations, and communications all in one place
          </p>
        </div>

        {/* Quick Links Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <button
              key={link.href}
              onClick={() => router.push(link.href)}
              className={`group rounded-xl border p-6 text-left transition-all hover:shadow-lg ${
                theme === 'dark'
                  ? 'border-slate-800 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100'
              }`}
            >
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg text-2xl ${
                  colorClasses[link.color as keyof typeof colorClasses]
                }`}
              >
                {link.icon}
              </div>
              <h3 className={`font-semibold transition ${
                theme === 'dark'
                  ? 'text-slate-100 group-hover:text-cyan-200'
                  : 'text-slate-950 group-hover:text-blue-600'
              }`}>
                {link.title}
              </h3>
              <p className={`mt-2 text-sm ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                {link.description}
              </p>
            </button>
          ))}
        </div>

        {/* Stats Section */}
        <div className={`mt-12 rounded-xl border p-8 ${
          theme === 'dark'
            ? 'border-slate-800 bg-slate-900/60'
            : 'border-slate-200 bg-slate-50'
        }`}>
          <h2 className={`mb-6 text-lg font-semibold ${
            theme === 'dark' ? 'text-slate-100' : 'text-slate-950'
          }`}>
            Quick Stats
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Total Events
              </p>
              <p className={`mt-2 text-3xl font-bold ${
                theme === 'dark' ? 'text-cyan-300' : 'text-blue-600'
              }`}>
                —
              </p>
            </div>
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Registered Attendees
              </p>
              <p className={`mt-2 text-3xl font-bold ${
                theme === 'dark' ? 'text-emerald-300' : 'text-emerald-600'
              }`}>
                —
              </p>
            </div>
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Pending Approvals
              </p>
              <p className={`mt-2 text-3xl font-bold ${
                theme === 'dark' ? 'text-amber-300' : 'text-amber-600'
              }`}>
                —
              </p>
            </div>
            <div>
              <p className={`text-sm font-medium ${
                theme === 'dark' ? 'text-slate-400' : 'text-slate-600'
              }`}>
                Check-ins Today
              </p>
              <p className={`mt-2 text-3xl font-bold ${
                theme === 'dark' ? 'text-rose-300' : 'text-rose-600'
              }`}>
                —
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

            className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-left transition hover:border-cyan-500/50 hover:bg-slate-800/60"
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10 text-slate-300 text-xl">⚙</div>
            <h2 className="font-semibold text-slate-100 group-hover:text-cyan-200">Settings</h2>
            <p className="mt-1 text-sm text-slate-400">Configure link types, colors, and org-wide preferences.</p>
          </button>
        </div>
      </div>
    </main>
  );
}
