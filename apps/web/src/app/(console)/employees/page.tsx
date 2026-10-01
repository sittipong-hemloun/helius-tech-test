import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeesView } from './employees-view';

export const metadata: Metadata = { title: 'Employees' };

/** First paint keeps the page layout (PRD §8.5) while the client view streams in. No salary is shown. */
function EmployeesFallback() {
  return (
    <div aria-busy="true" aria-label="Loading employees">
      <div className="mb-6">
        <h1 className="type-expanded text-[2rem] font-extrabold leading-none tracking-tight sm:text-[2.5rem]">Employees</h1>
        <p className="mt-2 text-ink-3">Loading employees…</p>
      </div>
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_10rem_auto]">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[4.25rem] w-full" />
        ))}
      </div>
      <div className="rounded-[var(--radius-sheet)] border border-rule bg-sheet p-4">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="my-3 h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  return (
    <Suspense fallback={<EmployeesFallback />}>
      <EmployeesView />
    </Suspense>
  );
}
