import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { EmployeesView } from './employees-view';

export const metadata: Metadata = { title: 'Employees' };

/** First paint keeps the page layout (PRD §8.5) while the client view streams in. No salary is shown. */
function EmployeesFallback() {
  return (
    <div aria-busy="true" aria-label="Loading employees">
      <PageHeader title="Employees" meta="Loading employees…" />
      <div className="rounded-[var(--radius-sheet)] border border-rule bg-sheet">
        <div className="border-b border-rule px-3 py-2">
          <Skeleton className="h-8 w-full max-w-xl" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="border-b border-rule px-3 py-2 last:border-b-0">
            <Skeleton className="h-3.5 w-full" />
          </div>
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
