'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ComponentProps, type MouseEvent, type ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/dialog';

interface UnsavedContextValue {
  setDirty: (dirty: boolean) => void;
  /** Runs `proceed` immediately when clean, otherwise after the user confirms discarding. */
  guard: (proceed: () => void) => void;
}

const UnsavedContext = createContext<UnsavedContextValue>({ setDirty: () => {}, guard: (p) => p() });

/**
 * Discard confirmation for navigation the app controls (sidebar, Cancel, in-app links),
 * plus the browser's beforeunload prompt where supported (PRD §8.4).
 */
export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const dirtyRef = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);

  const setDirty = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  const guard = useCallback((proceed: () => void) => {
    if (!dirtyRef.current) return proceed();
    setPending(() => proceed);
  }, []);

  const value = useMemo(() => ({ setDirty, guard }), [setDirty, guard]);

  return (
    <UnsavedContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Discard unsaved changes?"
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        tone="danger"
        onConfirm={() => {
          const proceed = pending;
          dirtyRef.current = false;
          setPending(null);
          proceed?.();
        }}
      >
        <p>Your edits to this employee have not been saved.</p>
      </ConfirmDialog>
    </UnsavedContext.Provider>
  );
}

export function useUnsavedChanges(dirty: boolean) {
  const { setDirty, guard } = useContext(UnsavedContext);
  useEffect(() => {
    setDirty(dirty);
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);
  return guard;
}

export function useNavigationGuard() {
  return useContext(UnsavedContext).guard;
}

/** next/link that asks before leaving a dirty form. */
export function GuardedLink({ href, onClick, ...props }: ComponentProps<typeof Link> & { href: string }) {
  const guard = useNavigationGuard();
  const router = useRouter();
  return (
    <Link
      href={href}
      {...props}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        guard(() => router.push(href));
      }}
    />
  );
}
