'use client';

import { FileBarChart, LogOut, Menu, PlugZap, Users, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { GuardedLink, useNavigationGuard } from '@/lib/unsaved-changes';
import { useSession } from '@/lib/session';
import { cn } from './ui/cn';

const NAV = [
  { href: '/employees', label: 'Employees', icon: Users, adminOnly: false },
  { href: '/reports', label: 'Reports', icon: FileBarChart, adminOnly: false },
  { href: '/settings/integrations', label: 'Integrations', icon: PlugZap, adminOnly: true },
];

function Brand() {
  return (
    <GuardedLink href="/employees" className="block rounded px-1 py-1 leading-none">
      <span className="type-expanded block text-[1.05rem] font-extrabold tracking-tight">Employee</span>
      <span className="type-expanded block text-[1.05rem] font-extrabold tracking-tight text-ledger">Console</span>
    </GuardedLink>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { session, logout } = useSession();
  const pathname = usePathname();
  const guard = useNavigationGuard();
  const [open, setOpen] = useState(false);
  const isAdmin = session.user.role === 'ADMIN';

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {NAV.filter((n) => !n.adminOnly || isAdmin).map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <GuardedLink
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2 text-[0.9375rem] text-ink-2 hover:bg-bar hover:text-ink',
              active && 'bg-sheet font-semibold text-ink shadow-[inset_3px_0_0_var(--color-ledger)]',
            )}
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </GuardedLink>
        );
      })}
    </nav>
  );

  const account = (
    <div className="border-t border-rule pt-4">
      <p className="truncate text-sm font-medium" title={session.user.email}>
        {session.user.displayName}
      </p>
      <p className="truncate text-[0.8125rem] text-ink-3">{session.user.email}</p>
      <p className="mt-1 text-[0.8125rem] text-ink-2">{isAdmin ? 'Admin' : 'Viewer'} access</p>
      <button
        type="button"
        onClick={() => guard(() => void logout())}
        className="mt-3 inline-flex items-center gap-2 rounded px-1 py-1 text-sm text-ink-2 hover:text-ink"
      >
        <LogOut aria-hidden className="size-4" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-sheet focus:px-3 focus:py-2">
        Skip to content
      </a>
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:border-r lg:border-rule lg:px-4 lg:py-6">
        <div className="flex flex-col gap-8">
          <Brand />
          {nav}
        </div>
        {account}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-rule bg-ground/95 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mobile-nav"
          className="inline-flex size-10 items-center justify-center rounded-[var(--radius-control)] border border-rule bg-sheet"
        >
          {open ? <X aria-hidden className="size-5" /> : <Menu aria-hidden className="size-5" />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </header>
      {open ? (
        <div id="mobile-nav" className="border-b border-rule bg-ground px-4 pb-4 pt-2 lg:hidden">
          {nav}
          <div className="mt-4">{account}</div>
        </div>
      ) : null}

      <main id="main" className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
        {children}
      </main>
    </div>
  );
}

export function PageHeader({ title, meta, actions }: { title: string; meta?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="type-expanded text-[2rem] font-extrabold leading-none tracking-tight sm:text-[2.5rem]">{title}</h1>
        {meta ? <div className="mt-2 text-ink-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
