import { BrandMark } from '@/components/brand-logo';

// Root Suspense fallback. This boundary sits *outside* every route-group layout,
// so it only appears on initial/full page loads or when a layout itself is still
// resolving (e.g. right after login, while the dashboard/admin layout fetches the
// user + notifications). The group-level loading.tsx files handle in-app
// navigation with content skeletons inside the shell. Here — where there is no
// shell yet — a calm, branded splash reads as the app starting up rather than a
// half-loaded broken page. Language-agnostic (§16); honours reduced motion.
export default function Loading() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Dangote Mentorship Programme"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg"
    >
      <BrandMark className="brand-splash-mark size-20" />
      <div className="h-1 w-40 overflow-hidden rounded-full bg-surface-2">
        <div className="brand-splash-bar h-full w-1/3 rounded-full bg-green" />
      </div>
    </div>
  );
}
