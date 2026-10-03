import type { ReactNode } from 'react';
import { UnsavedChangesProvider } from '@/components/common/unsaved-changes';
import { AppShell } from '@/components/layout/app-shell';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <AppShell>{children}</AppShell>
    </UnsavedChangesProvider>
  );
}
