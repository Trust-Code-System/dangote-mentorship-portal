import { DashboardLoadingSkeleton } from '@/components/shell/route-skeletons';

// Suspense fallback for the authenticated area. It lives *inside* the (dashboard)
// layout, so navigating to an async page keeps the AppShell — sidebar + top bar —
// on screen and only swaps the content region for a skeleton.
export default function DashboardLoading() {
  return <DashboardLoadingSkeleton />;
}
