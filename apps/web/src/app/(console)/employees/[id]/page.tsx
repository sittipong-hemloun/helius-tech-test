import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EmployeeDetailView } from './employee-detail-view';

export const metadata: Metadata = { title: 'Employee' };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <EmployeeDetailView id={id} />;
}
