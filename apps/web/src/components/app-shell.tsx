'use client';

import { ArrowLeft, Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { GuardedLink, useNavigationGuard } from '@/lib/unsaved-changes';
import { useSession } from '@/lib/session';
import { cn } from './ui/cn';

const NAV = [
  { href: '/employees', label: 'Employees', adminOnly: false },
  { href: '/reports', label: 'Reports', adminOnly: false },
  { href: '/settings/integrations', label: 'Integrations', adminOnly: true },
];

/** Company name set solid, product name lighter after a rule: a plain text lockup, no logo art. */
function Brand() {
  return (
    <GuardedLink href="/employees" className="flex shrink-0 items-center gap-2.5 rounded px-1 py-1 text-white">
      <span className="text-[0.9375rem] font-bold tracking-tight">Chememan</span>
      <span aria-hidden className="h-4 w-px bg-white/40" />
      <span className="text-[0.875rem] text-white/85">Employee Console</span>
    </GuardedLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const pathname = usePathname();
  const guard = useNavigationGuard();
  const [open, setOpen] = useState(false);
  const isAdmin = session.user.role === 'ADMIN';
  const items = NAV.filter((n) => !n.adminOnly || isAdmin);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const signOut = () => guard(() => void logout());

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-sheet focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="on-brand sticky top-0 z-30 bg-ledger text-white">
        <div className="flex h-11 items-stretch gap-6 px-4 sm:px-6">
          <div className="flex items-center">
            <Brand />
          </div>

          <nav aria-label="Main" className="hidden items-stretch md:flex">
            {items.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <GuardedLink
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center border-b-[3px] px-3 pt-[3px] text-[0.875rem] text-white/80 hover:bg-white/10 hover:text-white',
                    active ? 'border-white font-semibold text-white' : 'border-transparent',
                  )}
                >
                  {label}
                </GuardedLink>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-4 text-[0.8125rem] md:flex">
            <span className="truncate" title={session.user.email}>
              {session.user.displayName}
              <span className="ml-2 text-white/70">{isAdmin ? 'Admin' : 'Viewer'}</span>
            </span>
            <button type="button" onClick={signOut} className="rounded px-1.5 py-1 text-white/85 underline-offset-4 hover:text-white hover:underline">
              Sign out
            </button>
          </div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="my-auto ml-auto inline-flex size-9 items-center justify-center rounded-[var(--radius-control)] hover:bg-white/10 md:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </header>

      {open ? (
        <div id="mobile-nav" className="border-b border-rule bg-sheet md:hidden">
          <nav aria-label="Main" className="flex flex-col py-1">
            {items.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <GuardedLink
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('border-l-[3px] px-4 py-2.5', active ? 'border-ledger bg-bar font-semibold text-ledger-deep' : 'border-transparent text-ink-2')}
                >
                  {label}
                </GuardedLink>
              );
            })}
          </nav>
          <div className="flex items-center justify-between border-t border-rule px-4 py-3 text-[0.8125rem]">
            <span className="min-w-0 truncate">
              {session.user.displayName}
              <span className="ml-2 text-ink-2">{isAdmin ? 'Admin' : 'Viewer'}</span>
            </span>
            <button type="button" onClick={signOut} className="rounded px-1.5 py-1 text-ledger underline-offset-4 hover:underline">
              Sign out
            </button>
          </div>
        </div>
      ) : null}

      <main id="main" className="min-w-0 px-4 pb-10 pt-4 sm:px-6">
        {children}
      </main>
    </div>
  );
}

/** Full-width white bar under the module bar: optional back link, title, meta line, actions. */
export function PageBar({ back, children, actions }: { back?: { href: string; label: string }; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="-mx-4 -mt-4 mb-4 border-b border-rule bg-sheet px-4 py-3 sm:-mx-6 sm:px-6">
      {back ? (
        <GuardedLink href={back.href} className="mb-1 inline-flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ledger hover:underline">
          <ArrowLeft aria-hidden className="size-3.5" />
          {back.label}
        </GuardedLink>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">{children}</div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export const pageTitleClass = 'text-[1.125rem] font-bold leading-snug';

export function PageHeader({ title, meta, actions, back }: { title: string; meta?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <PageBar back={back} actions={actions}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h1 className={pageTitleClass}>{title}</h1>
        {meta ? <div className="text-[0.8125rem] text-ink-2">{meta}</div> : null}
      </div>
    </PageBar>
  );
}
