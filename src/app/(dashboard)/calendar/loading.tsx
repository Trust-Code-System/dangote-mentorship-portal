import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

// One loading state across the app: the brand mark, not a grey approximation of
// the page that is about to arrive. See BrandedRouteLoader for why.
export default function Loading() {
  return <BrandedRouteLoader />;
}
