// components/Earth.tsx

import * as THREE from 'three';
import React, { useRef } from 'react';
import { useLoader, ThreeEvent } from '@react-three/fiber';
import { TextureLoader } from 'three';
import Clouds from './Clouds';

interface EarthProps {
  onDoubleClick: (event: ThreeEvent<PointerEvent>) => void;
  showClouds?: boolean;
  cloudIntensity?: number;
  impactPosition?: THREE.Vector3 | null;
  blastRadius?: number;
  explosionStrength?: number;
}

const EARTH_R = 1;

export default function Earth({
  onDoubleClick,
  showClouds = true,
  cloudIntensity = 0.8,
  impactPosition = null,
  blastRadius = 0,
  explosionStrength = 0,
}: EarthProps) {
  const meshRef = useRef<THREE.Mesh>(null!);

  // Load textures
  const dayTex = useLoader(TextureLoader, '/textures/earthDay2.png');
  const normalTex = useLoader(TextureLoader, '/textures/earthNormal.png');
  const specularTex = useLoader(TextureLoader, '/textures/earthSpecular.png');

  // Texture settings
  dayTex.colorSpace = THREE.SRGBColorSpace;
  normalTex.colorSpace = THREE.LinearSRGBColorSpace;
  specularTex.colorSpace = THREE.LinearSRGBColorSpace;

  return (
    <group>
      {/* Main Earth */}
      <mesh ref={meshRef} onDoubleClick={onDoubleClick} receiveShadow castShadow>
        <sphereGeometry args={[EARTH_R, 128, 128]} />
        <meshPhongMaterial
          map={dayTex}
          normalMap={normalTex}
          normalScale={new THREE.Vector2(0.6, 0.6)} // Slight bump
          specularMap={specularTex}
          specular={0x444444}     // Light gray specular (oceans)
          shininess={25}          // Shine on water
          bumpScale={0.03}        // Subtle bump
          emissive={0x101010}     // Tiny self-glow to prevent pure black
          emissiveIntensity={0.5}
        />
      </mesh>

      {/* Atmosphere Glow (inner) */}
      <mesh>
        <sphereGeometry args={[EARTH_R * 1.008, 64, 64]} />
        <meshBasicMaterial 
          color="#4a90e2" 
          transparent 
          opacity={0.2} 
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Atmosphere Glow (outer) */}
      <mesh>
        <sphereGeometry args={[EARTH_R * 1.015, 32, 32]} />
        <meshBasicMaterial 
          color="#88ccff" 
          transparent 
          opacity={0.1} 
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Dynamic Clouds */}
      {showClouds && (
        <Clouds
          intensity={cloudIntensity}
          impactPosition={impactPosition}
          blastRadius={blastRadius}
          explosionStrength={explosionStrength}
        />
      )}
    </group>
  );
}