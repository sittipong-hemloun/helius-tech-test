import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: true,
        retry: (count, err) => err instanceof ApiError && (err.status === 0 || err.status >= 500) && count < 2,
      },
      mutations: { retry: false },
    },
  });
}
