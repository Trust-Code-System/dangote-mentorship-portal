'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

/**
 * The two human forms.
 *
 * Stylised and abstract by design (brief §1): a lathe-turned sculptural bust —
 * flared base, drawn-in waist, chest, shoulders that taper to a neck, and a
 * capsule head. It reads unmistakably as a person without a face, a texture
 * map, or any risk of the uncanny valley, and it is built entirely from
 * primitives so there is no model file to load, compress or host.
 *
 *  - **Mentor**: satin ceramic. Opaque, warm, settled, lit gold — experience.
 *  - **Mentee**: frosted translucent resin. Slighter, leaning in, lit green —
 *    ambition.
 *
 * `MeshPhysicalMaterial` with `transparent` + low roughness gives the frosted
 * look; `transmission` would be closer to real glass but forces an extra render
 * target every frame for a difference nobody would notice at this scale.
 */

/**
 * Normalised silhouette profile: `[radius 0–1, height 0–1]`, revolved around Y.
 * Tuned so the shoulders read as shoulders rather than the top of a cone —
 * this shape is the whole reason the forms feel human.
 */
const SILHOUETTE: [number, number][] = [
  [0.0, 0.0],
  [0.86, 0.005],
  [0.9, 0.04],
  [0.82, 0.16],
  [0.66, 0.32],
  [0.55, 0.46],
  [0.5, 0.58], // waist
  [0.56, 0.7], // chest
  [0.58, 0.79],
  [0.5, 0.87], // shoulder
  [0.3, 0.93],
  [0.16, 0.965], // neck
  [0.15, 1.0],
];

function useBodyGeometry(height: number, width: number) {
  return useMemo(() => {
    const points = SILHOUETTE.map(([r, y]) => new THREE.Vector2(r * width, y * height));
    // 48 radial segments: smooth in silhouette, still cheap.
    return new THREE.LatheGeometry(points, 48);
  }, [height, width]);
}

export function MentorForm({ position }: { position: [number, number, number] }) {
  const height = 2.2;
  const width = 0.66;
  const body = useBodyGeometry(height, width);
  const headRadius = width * 0.34;

  return (
    <group position={position}>
      <mesh geometry={body}>
        <meshPhysicalMaterial
          // Warm dark ceramic. The emissive is what stops the mentor
          // disappearing into the black bed on the darker side of the frame.
          color="#5C4830"
          roughness={0.5}
          metalness={0.15}
          clearcoat={0.4}
          clearcoatRoughness={0.5}
          emissive="#CD9933"
          emissiveIntensity={0.45}
        />
      </mesh>
      <mesh position={[0, height + headRadius * 0.72, 0]}>
        <capsuleGeometry args={[headRadius, headRadius * 0.7, 8, 24]} />
        <meshPhysicalMaterial
          color="#57432B"
          roughness={0.42}
          clearcoat={0.55}
          emissive="#CD9933"
          emissiveIntensity={0.4}
        />
      </mesh>
    </group>
  );
}

export function MenteeForm({ position }: { position: [number, number, number] }) {
  const height = 1.95;
  const width = 0.58;
  const body = useBodyGeometry(height, width);
  const headRadius = width * 0.34;

  return (
    // A slight lean toward the connection — reaching, not standing.
    <group position={position} rotation={[0, 0, 0.06]}>
      <mesh geometry={body}>
        <meshPhysicalMaterial
          color="#123A22"
          roughness={0.26}
          metalness={0.05}
          transparent
          opacity={0.56}
          clearcoat={0.75}
          clearcoatRoughness={0.28}
          emissive="#14B21F"
          emissiveIntensity={0.24}
        />
      </mesh>
      <mesh position={[0, height + headRadius * 0.72, 0]}>
        <capsuleGeometry args={[headRadius, headRadius * 0.7, 8, 24]} />
        <meshPhysicalMaterial
          color="#17472A"
          roughness={0.22}
          transparent
          opacity={0.62}
          clearcoat={0.85}
          emissive="#14B21F"
          emissiveIntensity={0.42}
        />
      </mesh>
    </group>
  );
}
