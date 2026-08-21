import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// Suspense fallback for the authenticated area. It lives *inside* the (dashboard)
// layout, so navigating to an async page keeps the AppShell — sidebar + top bar —
// on screen and only swaps the content region.
//
// Pages with a layout worth preserving keep their own skeleton (goals, messages,
// calendar, profile, …). This generic fallback only catches the routes that have
// none — certificate, final-review, help, mid-term-review — and it used to show
// the *dashboard's* four-stat-card skeleton, which is not their shape: it just
// read as a screen of empty grey boxes. The brand mark says "working" instead.
export default function DashboardLoading() {
  return <BrandedRouteLoader />;
}
