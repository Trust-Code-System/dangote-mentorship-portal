'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { MentorForm, MenteeForm } from './forms';
import { KnowledgeCore } from './knowledge-core';
import { ContinuumStream } from './continuum-stream';
import { CameraRig } from './camera-rig';
import type { RenderTier } from '../hooks/use-can-render-3d';

/** Particle budget per quality tier (LANDING_PAGE_MASTER_SPEC.md §5). */
const PARTICLE_BUDGET: Record<Exclude<RenderTier, 'none' | 'unknown'>, number> = {
  high: 2400,
  medium: 900,
};

/**
 * The Mentorship Continuum scene graph.
 *
 * Composition: mentor left, mentee right, the shared goal between and above
 * them, and the knowledge stream arcing through all three. Dark and
 * architectural — depth fog and a faint ground plane suggest scale without ever
 * becoming a literal room.
 *
 * Budget held deliberately low: ~8 draw calls, 6 materials, no shadow maps, no
 * post-processing, no environment map file.
 */
export function ContinuumScene({
  tier,
  reduced,
  scrollProgress,
}: {
  tier: Exclude<RenderTier, 'none' | 'unknown'>;
  reduced: boolean;
  scrollProgress: React.RefObject<number>;
}) {
  // The connection: mentor shoulder → up through the shared goal → mentee
  // shoulder. One curve drives the particle stream.
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(-3.1, 2.0, 0.2),
        new THREE.Vector3(-1.6, 2.7, 0.6),
        new THREE.Vector3(0, 2.15, 0),
        new THREE.Vector3(1.6, 2.65, -0.6),
        new THREE.Vector3(3.0, 1.85, -0.2),
      ]),
    [],
  );

  return (
    <>
      {/* Depth fog: the environment recedes into black rather than ending. */}
      <color attach="background" args={['#000000']} />
      <fog attach="fog" args={['#000000', 7, 17]} />

      <CameraRig reduced={reduced} scrollProgress={scrollProgress} />

      {/* Three lights only. Gold from the mentor's side, green from the
          mentee's, and a low ambient so the forms never go fully black. */}
      <ambientLight intensity={0.4} color="#DDE7E0" />
      <pointLight position={[-4.6, 3.4, 2.8]} intensity={38} distance={20} color="#CD9933" />
      <pointLight position={[4.6, 3.0, 2.8]} intensity={44} distance={20} color="#14B21F" />
      {/* A cool key from above and behind picks out the silhouette edges so the
          forms read as sculpture rather than as flat shapes. */}
      <directionalLight position={[0, 6, -4]} intensity={1.4} color="#9FB8A8" />

      <MentorForm position={[-3.35, 0, 0]} />
      <MenteeForm position={[3.25, 0, 0]} />
      <KnowledgeCore reduced={reduced} />
      <ContinuumStream curve={curve} count={PARTICLE_BUDGET[tier]} reduced={reduced} />

      {/* Ground: a horizon line, not a floor. Additive so it reads as light on
          a dark surface rather than as a plane. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[9, 48]} />
        <meshBasicMaterial
          color="#0B2416"
          transparent
          opacity={0.55}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </>
  );
}
