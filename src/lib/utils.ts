import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Our type scale (§2) defines custom font-size utilities (text-display, text-h1,
// …, text-micro). tailwind-merge doesn't know these are font sizes, so by default
// it mis-classifies e.g. `text-small` as a text COLOR and strips a preceding
// `text-white` — which silently turned every green button's label dark. Register
// the tokens in the font-size group so colour and size no longer collide.
//
// The same trap applies to the public/landing editorial scale, where it is
// nastier because the size and colour tokens share a prefix: `text-blak-hero`
// (a size) and `text-blak-text` (a colour) look identical to tailwind-merge, so
// `cn('text-blak-statement', 'text-blak-text')` silently dropped the size and
// rendered a 3.5rem editorial statement at body size. Registering the five
// landing sizes here fixes it everywhere `cn()` is used.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        { text: ['display', 'h1', 'h2', 'h3', 'body', 'small', 'micro'] },
        { text: ['blak-hero', 'blak-statement', 'blak-section', 'blak-body', 'blak-label'] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
