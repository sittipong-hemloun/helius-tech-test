import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-4 py-16">
      <p className="type-expanded text-[4rem] font-black leading-none text-ink-3">404</p>
      <h1 className="type-wide mt-4 text-2xl font-bold">This page doesn&apos;t exist.</h1>
      <div className="mt-8">
        <Link href="/employees" className="inline-flex h-10 items-center rounded-[var(--radius-control)] bg-ledger px-4 font-medium text-white hover:bg-ledger-deep">
          Back to employees
        </Link>
      </div>
    </main>
  );
}
