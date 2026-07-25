'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/** Number of samples of the curve baked into the shader as a uniform array. */
const PATH_SAMPLES = 64;

/**
 * The knowledge stream — fine particles travelling the connection from the
 * mentor to the shared goal and on to the mentee.
 *
 * The whole flow runs on the GPU. The curve is sampled once on the CPU into a
 * 64-point uniform array; each particle then carries only a start offset, a
 * speed and a lateral jitter, and the vertex shader looks its position up along
 * that baked path. That keeps this to **one draw call and zero per-frame CPU
 * work** regardless of particle count — the alternative (sampling the curve per
 * particle per frame in JS) would not survive a few thousand particles.
 *
 * Colour runs gold → ivory → green along the path: experience becoming shared
 * understanding becoming growth.
 */
export function ContinuumStream({
  curve,
  count,
  reduced,
}: {
  curve: THREE.CatmullRomCurve3;
  count: number;
  reduced: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const { geometry, uniforms } = useMemo(() => {
    const offsets = new Float32Array(count);
    const speeds = new Float32Array(count);
    const jitter = new Float32Array(count * 2);
    const scales = new Float32Array(count);

    // Deterministic pseudo-random so the composition is identical on every
    // load and between server/client — no Math.random() surprises in review.
    let seed = 8_675_309;
    const random = () => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return seed / 4_294_967_296;
    };

    for (let i = 0; i < count; i += 1) {
      offsets[i] = random();
      speeds[i] = 0.045 + random() * 0.07;
      jitter[i * 2] = (random() - 0.5) * 0.85;
      jitter[i * 2 + 1] = (random() - 0.5) * 0.85;
      scales[i] = 0.55 + random() * 1.1;
    }

    const geo = new THREE.BufferGeometry();
    // Position is unused by the shader (everything comes from the path lookup)
    // but three needs an attribute to know the draw count.
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute('aOffset', new THREE.BufferAttribute(offsets, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1));
    geo.setAttribute('aJitter', new THREE.BufferAttribute(jitter, 2));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    // The path is a fixed arc; a generous bounding sphere avoids the frustum
    // culling the whole stream because the dummy positions are all at origin.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.5, 0), 12);

    const path = curve.getSpacedPoints(PATH_SAMPLES - 1);

    return {
      geometry: geo,
      uniforms: {
        uTime: { value: 0 },
        uPath: { value: path },
        uGold: { value: new THREE.Color('#CD9933') },
        uIvory: { value: new THREE.Color('#F4F1EA') },
        uGreen: { value: new THREE.Color('#14B21F') },
        uSize: { value: 26 },
      },
    };
  }, [curve, count]);

  useFrame((_state, delta) => {
    // Frozen on a composed still frame under reduced motion (spec §8).
    if (reduced) return;
    const time = materialRef.current?.uniforms.uTime;
    if (!time) return;
    time.value += delta;
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        vertexShader={/* glsl */ `
          uniform float uTime;
          uniform vec3 uPath[${PATH_SAMPLES}];
          uniform float uSize;

          attribute float aOffset;
          attribute float aSpeed;
          attribute vec2 aJitter;
          attribute float aScale;

          varying float vProgress;
          varying float vFade;

          void main() {
            // Where this particle currently sits along the connection.
            float t = fract(aOffset + uTime * aSpeed);
            vProgress = t;

            float f = t * float(${PATH_SAMPLES - 1});
            int i = int(floor(f));
            vec3 a = uPath[i];
            vec3 b = uPath[min(i + 1, ${PATH_SAMPLES - 1})];
            vec3 pos = mix(a, b, fract(f));

            // Spread the particles into a ribbon around the line, pinching at
            // both ends so the stream appears to emerge from each figure.
            float pinch = sin(t * 3.14159265);
            pos.x += aJitter.x * pinch * 0.45;
            pos.y += aJitter.y * pinch * 0.55;
            pos.z += aJitter.x * pinch * 0.75;

            // Fade in and out at the ends rather than popping.
            vFade = smoothstep(0.0, 0.12, t) * (1.0 - smoothstep(0.88, 1.0, t));

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = uSize * aScale * (1.0 / -mvPosition.z);
            gl_Position = projectionMatrix * mvPosition;
          }
        `}
        fragmentShader={/* glsl */ `
          uniform vec3 uGold;
          uniform vec3 uIvory;
          uniform vec3 uGreen;

          varying float vProgress;
          varying float vFade;

          void main() {
            // Soft round sprite — no texture needed.
            vec2 uv = gl_PointCoord - 0.5;
            float d = length(uv);
            float alpha = smoothstep(0.5, 0.05, d) * vFade;
            if (alpha < 0.01) discard;

            // gold (experience) -> ivory (shared understanding) -> green (growth)
            vec3 color = vProgress < 0.5
              ? mix(uGold, uIvory, smoothstep(0.0, 0.5, vProgress))
              : mix(uIvory, uGreen, smoothstep(0.5, 1.0, vProgress));

            gl_FragColor = vec4(color, alpha * 0.85);
          }
        `}
      />
    </points>
  );
}
