import type { Metadata } from 'next';
import { NewEmployeeView } from './new-employee-view';

export const metadata: Metadata = { title: 'Add employee' };

export default function NewEmployeePage() {
  return <NewEmployeeView />;
}
