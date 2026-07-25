'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Camera movement for the hero (brief §8).
 *
 * Two inputs, both heavily damped and both tightly bounded:
 *
 *  - **Scroll** pushes the camera *toward* the connection as the visitor leaves
 *    the hero, so the stream expands and becomes the way into the next section
 *    rather than the hero cutting to a new block.
 *  - **Pointer** adds at most ±0.4 units of parallax. The scene is never
 *    orbitable and nothing requires the pointer to reach it — the brief is
 *    explicit that visitors must not have to chase content.
 *
 * Under reduced motion the camera is placed once at its rest position and never
 * moves again.
 */
/**
 * The camera aims slightly left of the scene's centre, which pushes the whole
 * composition to the right of the frame. The hero copy is left-aligned
 * editorial, so this is what keeps the mentor form from sitting underneath the
 * headline while both figures stay comfortably inside the frustum — the scene
 * reads as balanced *against the text*, not balanced in isolation.
 */
const LOOK_AT_X = -0.7;

export function CameraRig({
  reduced,
  scrollProgress,
}: {
  reduced: boolean;
  /** 0 at the top of the hero → 1 once the hero has scrolled away. */
  scrollProgress: React.RefObject<number>;
}) {
  const { camera } = useThree();
  const target = useRef(new THREE.Vector3(0, 2.1, 11.5));
  const pointer = useRef({ x: 0, y: 0 });

  useFrame((state, delta) => {
    if (reduced) {
      camera.position.set(0, 2.1, 11.5);
      camera.lookAt(LOOK_AT_X, 2.05, 0);
      return;
    }

    // Pointer is normalised to [-1, 1] by R3F already.
    pointer.current.x = state.pointer.x;
    pointer.current.y = state.pointer.y;

    const progress = scrollProgress.current ?? 0;

    target.current.set(
      pointer.current.x * 0.4,
      2.1 + pointer.current.y * 0.22 + progress * 0.5,
      // Move in toward the connection as the hero leaves.
      11.5 - progress * 4.2,
    );

    // Frame-rate independent damping — `1 - e^{-kt}` rather than a fixed lerp,
    // so the movement feels the same on a 60Hz and a 144Hz display.
    const smoothing = 1 - Math.exp(-2.6 * delta);
    camera.position.lerp(target.current, smoothing);
    camera.lookAt(LOOK_AT_X, 2.05 - progress * 0.12, 0);
  });

  return null;
}
