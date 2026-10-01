import type { Metadata } from 'next';
import { EmployeeDetailView } from './employee-detail-view';

export const metadata: Metadata = { title: 'Employee' };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EmployeeDetailView rawId={id} />;
}
