import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// One loading state across the app: the brand mark, not a grey approximation of
// the page that is about to arrive. See BrandedRouteLoader for why. (This also
// drops a hardcoded English `aria-label` — the loader's status text is
// translated, per CLAUDE.md §16.)
export default function AdminCertificatesLoading() {
  return <BrandedRouteLoader />;
}
