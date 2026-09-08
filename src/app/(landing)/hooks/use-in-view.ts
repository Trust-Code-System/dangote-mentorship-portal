'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Fires once, the first time an element enters the viewport.
 *
 * The whole reveal system on this page is built on this: a boolean, a class
 * toggle, and a CSS transition. There are roughly forty revealed blocks, so the
 * cheapness matters — each one is a single IntersectionObserver that disconnects
 * the moment it has done its job, and never re-runs on scroll-back.
 */
export function useInView<T extends HTMLElement>(amount = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // No IntersectionObserver (very old browser): show the content rather than
    // leaving it hidden forever.
    if (typeof IntersectionObserver === 'undefined') {
      const handle = window.requestAnimationFrame(() => setInView(true));
      return () => window.cancelAnimationFrame(handle);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { threshold: amount },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [amount]);

  return { ref, inView };
}
