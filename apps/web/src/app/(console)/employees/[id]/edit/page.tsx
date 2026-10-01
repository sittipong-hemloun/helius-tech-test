import type { Metadata } from 'next';
import { EditEmployeeView } from './edit-employee-view';

export const metadata: Metadata = { title: 'Edit employee' };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <EditEmployeeView rawId={id} />;
}
