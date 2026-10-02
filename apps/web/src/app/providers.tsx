'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';
import { makeQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        position="bottom-right"
        closeButton
        toastOptions={{
          classNames: {
            toast: 'rounded-[var(--radius-sheet)] border border-rule bg-sheet text-ink font-sans',
            title: 'font-semibold',
            description: 'text-ink-2',
          },
        }}
      />
    </QueryClientProvider>
  );
}
