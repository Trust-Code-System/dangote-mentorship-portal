import { Skeleton } from '@/components/ui/skeleton';

// Destination-shaped loading UIs for authenticated routes. Rendered inside the
// AppShell content slot via loading.tsx — never full-screen, never blank shell.

export function PageHeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

export function GoalsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <Skeleton className="h-80 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </div>
    </div>
  );
}

export function MeetingsLoadingSkeleton() {
  return (
    <div className="space-y-10" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-48 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}

export function SessionsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-40 w-full" />
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    </div>
  );
}

export function MessagesLoadingSkeleton() {
  return (
    <div
      className="grid min-h-[calc(100vh-6.5rem)] overflow-hidden rounded-lg border border-border lg:grid-cols-[17rem_1fr]"
      aria-busy="true"
    >
      <div className="space-y-2 border-r border-border p-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex-1 space-y-3">
          <Skeleton className="ml-auto h-16 w-2/3" />
          <Skeleton className="h-16 w-2/3" />
          <Skeleton className="ml-auto h-16 w-1/2" />
        </div>
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function CalendarLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <Skeleton className="h-[28rem] w-full" />
    </div>
  );
}

export function JournalLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
        <Skeleton className="h-72 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    </div>
  );
}

export function ProfileLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="flex items-center gap-4">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function AdminTableLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-28" />
      </div>
      <div className="overflow-hidden rounded-lg border border-border">
        <Skeleton className="h-12 w-full rounded-none" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-none border-t border-border" />
        ))}
      </div>
    </div>
  );
}

export function DashboardLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    </div>
  );
}

/** Chart-card layout for Insights and similar analytics pages. */
export function InsightsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <PageHeaderSkeleton />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
