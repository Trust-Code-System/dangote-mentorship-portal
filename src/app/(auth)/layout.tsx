import { AuthShell } from '@/components/auth/auth-shell';
import { FilmGrain } from '@/app/(landing)/visuals/film-grain';

// The Threshold — shared chrome for every authentication page
// (AUTH_UI_SPEC.md §2). Replaces the previous centred light column, which put a
// small card in the middle of a large empty page and shared nothing with the
// public brand experience.
//
// The shell owns the split-screen frame and the brand panel; each page supplies
// only its own card contents, so login / forgot / reset / invite / request
// access are automatically consistent.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthShell>{children}</AuthShell>
      {/* Same fine grain as the landing page — it is what stops the large dark
          areas from banding. Costs one composited layer and no request. */}
      <FilmGrain />
    </>
  );
}
