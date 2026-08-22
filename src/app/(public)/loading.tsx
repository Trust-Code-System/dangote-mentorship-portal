import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// Suspense fallback for the public/marketing area. It lives *inside* the (public)
// layout, so navigating to an async page keeps the SiteHeader and SiteFooter on
// screen and only the body changes, instead of falling back to the root
// loading.tsx which would blank the whole frame (§19 §9). Portal tone: this area
// runs the light `--surface-*` scale, unlike the dark Knowledge Library.
export default function PublicLoading() {
  return <BrandedRouteLoader className="px-4 py-12 sm:px-6" />;
}
