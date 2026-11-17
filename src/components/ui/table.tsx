import * as React from 'react';
import { cn } from '@/lib/utils';

// Table (§19 §3) — for true admin data grids only (cards for everything a person
// reads). Header row uses surface-2; rows hover to surface. Wrap in overflow so
// it scrolls on small screens; feature grids collapse to cards on mobile.
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    // A bare table sits in the same white, hairline-framed surface as the
    // dashboard workspace (Samir reference). Inside a Card the frame is reset
    // (see Card), so a table is never double-bordered.
    <div className="table-frame relative w-full overflow-auto rounded-lg border border-border bg-surface shadow-elevation">
      <table ref={ref} className={cn('w-full caption-bottom text-body', className)} {...props} />
    </div>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('bg-surface-2 [&_tr]:border-b [&_tr]:border-border', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
));
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-surface data-[state=selected]:bg-green-soft',
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-11 px-4 text-left align-middle text-micro uppercase text-ink-2 [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-4 align-middle text-ink [&:has([role=checkbox])]:pr-0', className)} {...props} />
));
TableCell.displayName = 'TableCell';

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
