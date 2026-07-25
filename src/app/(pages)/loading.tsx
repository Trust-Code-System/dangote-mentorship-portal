/**
 * Suspense fallback for the Knowledge Library.
 *
 * It sits *inside* the `(pages)` layout, so the navigation and footer stay on
 * screen while an async page resolves — rather than falling back to the root
 * loading state, which would blank the whole dark frame to white and produce a
 * jarring flash between two public pages.
 *
 * Shapes only, no copy: a loading state must not hardcode English.
 */
export default function PagesLoading() {
  return (
    <div className="px-4 pb-24 pt-36 sm:px-6 lg:pt-44" aria-busy="true">
      <div className="mx-auto w-full max-w-[1280px] animate-pulse space-y-6">
        <div className="h-3 w-32 rounded bg-blak-ivory/10" />
        <div className="h-12 w-full max-w-2xl rounded bg-blak-ivory/10" />
        <div className="h-12 w-full max-w-xl rounded bg-blak-ivory/[0.07]" />
        <div className="h-4 w-full max-w-lg rounded bg-blak-ivory/[0.06]" />
        <div className="h-64 w-full rounded-2xl bg-blak-ivory/[0.04]" />
      </div>
    </div>
  );
}
