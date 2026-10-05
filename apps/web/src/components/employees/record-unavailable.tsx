'use client';

import { ArrowLeft } from 'lucide-react';
import { Notice } from '@/components/common/notice';
import { GuardedLink } from '@/components/common/unsaved-changes';
import { buttonVariants } from '@/components/ui/button';
import { lastListHref } from '@/lib/list-params';

/** Shown for an invalid ID or a record that no longer exists (detail and edit routes). */
export function RecordUnavailable() {
  return (
    <div className="max-w-xl">
      <Notice tone="warning" title="This employee record is unavailable.">
        It may have been deleted, or the link is wrong.
      </Notice>
      <GuardedLink href={lastListHref()} className={`${buttonVariants({ variant: 'secondary' })} mt-5`}>
        <ArrowLeft aria-hidden />
        Back to employees
      </GuardedLink>
    </div>
  );
}
