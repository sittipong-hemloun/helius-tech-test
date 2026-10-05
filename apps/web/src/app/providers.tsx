'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { Toaster } from 'sonner';

export function Providers({ children }: { children: ReactNode }) {
  // No refetch on window focus: it would replace an open edit form's values (and version) under the user.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } }));
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
