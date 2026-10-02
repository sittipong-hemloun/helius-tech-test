import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell';
import { UnsavedChangesProvider } from '@/lib/unsaved-changes';

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <UnsavedChangesProvider>
      <AppShell>{children}</AppShell>
    </UnsavedChangesProvider>
  );
}
