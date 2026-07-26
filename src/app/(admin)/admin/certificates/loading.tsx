import { Skeleton } from '@/components/ui/skeleton';

export default function AdminCertificatesLoading() {
  return (
    <section
      className="space-y-6"
      aria-busy="true"
      aria-label="Loading certificates"
    >
      <div className="space-y-2">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
      <Skeleton className="aspect-[297/210] w-full rounded-xl" />
    </section>
  );
}
