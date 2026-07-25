import { AdminTableLoadingSkeleton } from '@/components/shell/route-skeletons';

// Suspense fallback for the admin area. It lives *inside* the (admin) layout, so
// navigating between async admin pages keeps the AppShell on screen.
export default function AdminLoading() {
  return <AdminTableLoadingSkeleton />;
}
