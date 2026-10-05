'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PAGE_SIZES } from '@/lib/list-params';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';

interface Props {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

function pageWindow(page: number, totalPages: number): (number | 'gap')[] {
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

export function Pagination({ page, pageSize, total, totalPages, onPage, onPageSize }: Props) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
      <div className="flex items-center gap-2 text-[0.8125rem] text-ink-2">
        <label htmlFor="page-size">Rows per page</label>
        <div className="w-16">
          <select id="page-size" value={pageSize} onChange={(e) => onPageSize(Number(e.target.value))} className="select-control">
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft aria-hidden />
          </Button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-ink-3" aria-hidden>
                …
              </span>
            ) : (
              <Button
                key={p}
                variant={p === page ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => onPage(p)}
                aria-current={p === page ? 'page' : undefined}
                aria-label={`Page ${p}`}
                className={cn('figures min-w-7', p === page && 'border-ledger bg-ledger font-semibold text-white hover:bg-ledger')}
              >
                {p}
              </Button>
            ),
          )}
          <Button variant="ghost" size="sm" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Next page">
            <ChevronRight aria-hidden />
          </Button>
        </nav>
      ) : (
        <span className="text-[0.8125rem] text-ink-2">{total > 0 ? 'All results on one page' : ''}</span>
      )}
    </div>
  );
}
