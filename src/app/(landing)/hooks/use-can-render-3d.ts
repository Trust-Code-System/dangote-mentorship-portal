'use client';

import { useEffect, useState } from 'react';

export type RenderTier = 'unknown' | 'none' | 'medium' | 'high';

/**
 * Decides whether this device should get the WebGL hero at all, and at what
 * quality (LANDING_PAGE_MASTER_SPEC.md §5).
 *
 * `'none'` means the canvas is never mounted and `HeroFallback` is used — that
 * covers small viewports, low-memory / low-core devices, and any browser where
 * a WebGL context cannot actually be created (blocked, disabled, or software
 * rendering unavailable). We probe by creating a real context rather than
 * sniffing the user agent, then throw it away immediately.
 *
 * Returns `'unknown'` until mounted so the server render and first client
 * render agree; the fallback is what shows during that window, which is also
 * exactly what we want for the LCP.
 */
export function useCanRender3D(): RenderTier {
  const [tier, setTier] = useState<RenderTier>('unknown');

  // A one-shot capability probe, not a subscription: it creates and destroys a
  // real WebGL context, so it has to happen after mount and its single state
  // write is the point of the hook.
  useEffect(() => {
    // Small viewports never get WebGL: the fallback composition reads better at
    // that size and the battery/thermal cost is not worth it.
    if (window.matchMedia('(max-width: 767px)').matches) {
      setTier('none');
      return;
    }

    // Coarse capability heuristics. Both properties are optional in the DOM
    // spec, so a missing value is treated as "capable" rather than penalised.
    const nav = navigator as Navigator & { deviceMemory?: number };
    const memory = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency ?? 8;
    if (memory < 4 || cores <= 4) {
      setTier('none');
      return;
    }

    // Probe for a genuinely usable context.
    let probe: HTMLCanvasElement | null = document.createElement('canvas');
    let gl: WebGLRenderingContext | null = null;
    try {
      gl = (probe.getContext('webgl2') ??
        probe.getContext('webgl')) as WebGLRenderingContext | null;
    } catch {
      gl = null;
    }

    if (!gl) {
      setTier('none');
      probe = null;
      return;
    }

    // Release the probe context straight away — browsers cap the number of live
    // contexts and the real scene needs one.
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    probe = null;

    const isTablet = window.matchMedia('(max-width: 1023px)').matches;
    setTier(isTablet ? 'medium' : 'high');
  }, []);

  return tier;
}
