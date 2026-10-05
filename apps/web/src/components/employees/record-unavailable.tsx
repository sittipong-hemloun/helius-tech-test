'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Notice } from '@/components/common/notice';
import { buttonVariants } from '@/components/ui/button';

/** Shown for an invalid ID or a record that no longer exists (detail and edit routes). */
export function RecordUnavailable() {
  return (
    <div className="max-w-xl">
      <Notice tone="warning" title="This employee record is unavailable.">
        It may have been deleted, or the link is wrong.
      </Notice>
      <Link href="/employees" className={`${buttonVariants({ variant: 'secondary' })} mt-5`}>
        <ArrowLeft aria-hidden />
        Back to employees
      </Link>
    </div>
  );
}
