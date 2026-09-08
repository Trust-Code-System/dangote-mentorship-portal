import { BrandedRouteLoader } from '@/components/shell/branded-route-loader';

/**
 * Suspense fallback for the Knowledge Library.
 *
 * It sits *inside* the `(pages)` layout, so the navigation and footer stay on
 * screen while an async page resolves — rather than falling back to the root
 * loading state, which would blank the whole dark frame and produce a jarring
 * flash between two public pages.
 *
 * `tone="dark"` because this area runs the `--blak-*` scale, and the top padding
 * clears the fixed nav so the mark lands in the visual centre of the content.
 */
export default function PagesLoading() {
  return <BrandedRouteLoader tone="dark" className="min-h-[70vh] px-4 pb-24 pt-36 sm:px-6" />;
}
