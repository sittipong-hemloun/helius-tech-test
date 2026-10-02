import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="figures text-[0.8125rem] font-semibold text-ink-2">Error 404</p>
      <h1 className="mt-1 text-[1.25rem] font-bold">This page doesn&apos;t exist.</h1>
      <div className="mt-5">
        <Link href="/employees" className="inline-flex h-8 items-center rounded-[var(--radius-control)] bg-ledger px-3 font-medium text-white hover:bg-ledger-hover">
          Back to employees
        </Link>
      </div>
    </main>
  );
}
