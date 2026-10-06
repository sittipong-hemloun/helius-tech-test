'use client';

import { ArrowLeft, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';

const NAV = [{ href: '/employees', label: 'Employees' }];

/** Company name set solid, product name lighter after a rule: a plain text lockup, no logo art. */
function Brand() {
  return (
    <Link href="/employees" className="flex shrink-0 items-center gap-2.5 rounded px-1 py-1 text-white">
      <span className="text-[0.9375rem] font-bold tracking-tight">Chememan</span>
      <span aria-hidden className="h-4 w-px bg-white/40" />
      <span className="text-[0.875rem] text-white/85">Employee Console</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

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
            {NAV.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center border-b-[3px] px-3 pt-0.75 text-[0.875rem] text-white/80 hover:bg-white/10 hover:text-white',
                    active ? 'border-white font-semibold text-white' : 'border-transparent',
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="my-auto ml-auto inline-flex size-9 items-center justify-center rounded-(--radius-control) hover:bg-white/10 md:hidden"
          >
            {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
        </div>
      </header>

      {open ? (
        <div id="mobile-nav" className="border-b border-rule bg-sheet md:hidden">
          <nav aria-label="Main" className="flex flex-col py-1">
            {NAV.map(({ href, label }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn('border-l-[3px] px-4 py-2.5', active ? 'border-ledger bg-bar font-semibold text-ledger-deep' : 'border-transparent text-ink-2')}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
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
        <Link href={back.href} className="mb-1 inline-flex items-center gap-1 text-[0.8125rem] text-ink-2 hover:text-ledger hover:underline">
          <ArrowLeft aria-hidden className="size-3.5" />
          {back.label}
        </Link>
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
