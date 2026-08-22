import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// Suspense fallback for the auth area. It lives *inside* the (auth) layout, so
// navigating to an async page (e.g. invite/reset token lookups) keeps the calm
// centered frame and ambient glow on screen and only the card region changes,
// instead of falling back to the root loading.tsx which would blank everything
// (§19 §9). The layout caps width at 440px, so this stays short rather than
// taking the 60vh the in-shell default uses.
export default function AuthLoading() {
  return <BrandedRouteLoader className="min-h-[22rem]" />;
}
