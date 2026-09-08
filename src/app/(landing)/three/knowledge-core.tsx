'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * The shared goal at the centre of the connection.
 *
 * A faceted icosahedron — a cut stone rather than a glowing orb (brief §29
 * explicitly rejects "a generic glowing orb as the entire concept"; here it is
 * one small element of a composition, faceted so it catches light directionally
 * instead of emitting uniformly).
 *
 * The soft halo around it is an additive back-faced shell rather than a
 * post-processing bloom pass: one extra draw call instead of a full-screen
 * effect chain, which is what keeps this scene inside its frame budget.
 */
export function KnowledgeCore({ reduced }: { reduced: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (reduced) return;
    if (coreRef.current) {
      // Slow, weighted rotation — a turning object, not a spinning one.
      coreRef.current.rotation.y += delta * 0.16;
      coreRef.current.rotation.x += delta * 0.05;
    }
    if (haloRef.current) {
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 0.9) * 0.045;
      haloRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <group position={[0, 2.15, 0]}>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.34, 0]} />
        <meshPhysicalMaterial
          color="#F4F1EA"
          roughness={0.16}
          metalness={0.35}
          clearcoat={1}
          emissive="#7ADE84"
          emissiveIntensity={0.95}
          flatShading
        />
      </mesh>

      {/* Additive halo shell — the "bloom" without a post pass. */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[0.6, 24, 24]} />
        <meshBasicMaterial
          color="#7ADE84"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
