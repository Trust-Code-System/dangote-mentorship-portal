import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// Suspense fallback for the admin area. It lives *inside* the (admin) layout, so
// navigating between async admin pages keeps the AppShell on screen.
//
// Every admin route currently ships its own table/chart skeleton, so this only
// fires while the (admin) layout itself resolves — where a table skeleton would
// be a guess at a page we do not yet know the shape of. Matches the (dashboard)
// fallback so the two areas behave the same.
export default function AdminLoading() {
  return <BrandedRouteLoader />;
}
