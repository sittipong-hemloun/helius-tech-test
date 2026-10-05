import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { EditEmployeeView } from './edit-employee-view';

export const metadata: Metadata = { title: 'Edit employee' };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <EditEmployeeView id={id} />;
}
