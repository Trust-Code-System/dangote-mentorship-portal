import { PublicPageShell } from '@/components/public/public-page-shell';

/**
 * The BLAK MOH Knowledge Library — /about, /faq, /confidentiality, /contact.
 *
 * These pages used to live in `(public)` behind the light `SiteHeader` /
 * `SiteFooter`, which shared nothing with the cinematic landing page: a visitor
 * clicking "About the programme" in the footer left the brand entirely. They
 * now sit in their own route group with the same dark chrome, the same
 * navigation component and the same footer component as `/`.
 *
 * Route groups do not appear in the URL, so `/about` and `/faq` keep their
 * existing paths — every bookmark, link and test still resolves.
 *
 * `(public)` still exists for `/design`, the dev-gated component gallery, which
 * genuinely wants the light portal chrome.
 */
export default function PagesLayout({ children }: { children: React.ReactNode }) {
  return <PublicPageShell>{children}</PublicPageShell>;
}
