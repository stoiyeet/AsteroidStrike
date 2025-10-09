// components/Clouds.tsx

import * as THREE from 'three';
import React, { useRef, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { TextureLoader } from 'three';

const CLOUDS_RADIUS = 1.006;
const BASE_ROTATION_SPEED = 0.0003;

export default function Clouds({
  intensity = 1,
  impactPosition = null,
  blastRadius = 0,
  explosionStrength = 0,
}: {
  intensity?: number;
  impactPosition?: THREE.Vector3 | null;
  blastRadius?: number;
  explosionStrength?: number;
}) {
  const cloudRef = useRef<THREE.Group>(null!);
  const texture = useLoader(TextureLoader, 'https://glb.asteroidstrike.earth/textures/earthClouds.png');

  // Simple rotation animation
  useFrame(() => {
    if (!cloudRef.current) return;
    cloudRef.current.rotation.y += BASE_ROTATION_SPEED;
  });

  return (
    <group ref={cloudRef}>
      
      {/* Additional cloud layers for depth */}
      <mesh renderOrder={0}>
        <sphereGeometry args={[CLOUDS_RADIUS * 0.998, 64, 64]} />
        <meshPhongMaterial
          map={texture}
          opacity={0.15 * intensity}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
      
      <mesh renderOrder={0}>
        <sphereGeometry args={[CLOUDS_RADIUS * 1.002, 64, 64]} />
        <meshPhongMaterial
          map={texture}
          opacity={0.1 * intensity}
          transparent
          depthWrite={false}
          blending={THREE.NormalBlending}
        />
      </mesh>
    </group>
  );
}