import type { Metadata } from 'next';
import { ReportDetailView } from './report-detail-view';

export const metadata: Metadata = { title: 'Workforce Snapshot' };

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReportDetailView id={id} />;
}
