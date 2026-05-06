import { Suspense } from 'react';
import RetrieveClient from './retrieve-client';

export default function RetrievePage() {
  return (
    <Suspense
      fallback={<main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">Loading...</main>}
    >
      <RetrieveClient />
    </Suspense>
  );
}
