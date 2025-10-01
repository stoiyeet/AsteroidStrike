import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';

interface AsteroidExplosionProps {
  airburst: boolean;
  position: THREE.Vector3;
  intensity: number; // 1.0 at start, fades to 0 over time
  fireballRadius: number;
}

const AsteroidExplosion: React.FC<AsteroidExplosionProps> = ({
  airburst,
  position,
  intensity,
  fireballRadius,
}) => {
  fireballRadius = airburst ? fireballRadius * 300 : fireballRadius;
  const explosionRef = useRef<THREE.Group>(null!);
  const flashRef = useRef<THREE.PointLight>(null!);
  const emissiveCoreRef = useRef<THREE.MeshStandardMaterial>(null!);

  // Colors: white-hot -> orange/yellow as it cools
  const hot = useMemo(() => new THREE.Color('#ffffff'), []);
  const warm = useMemo(() => new THREE.Color('#ffb84d'), []);
  const fire = useMemo(() => new THREE.Color('#ff6600'), []);
  const shock = useMemo(() => new THREE.Color('#ffaa00'), []);

  useFrame((state, dt) => {
    if (!explosionRef.current || !flashRef.current) return;

    // Grow as intensity falls, keep your spin
    const scale = 1 + (1 - intensity) * 15;
    explosionRef.current.scale.setScalar(scale);
    explosionRef.current.rotation.y += dt * 2;

    // Small high-frequency flicker for the flash
    const t = state.clock.elapsedTime;
    const flicker = 0.9 + 0.1 * Math.sin(t * 45) + 0.05 * (Math.random() - 0.5);

    // Square the falloff so it dies convincingly
    const i = Math.max(0, Math.min(1, intensity));
    const i2 = i * i;

    // Flash color shifts from white-hot -> orange as it cools
    const flashColor = hot.clone().lerp(fire, 1 - i);
    flashRef.current.color.copy(flashColor);

    // Range expands with the blast; decay=2 gives inverse-square falloff
    flashRef.current.distance = fireballRadius * (40 + (1 - i))*1.4;
    flashRef.current.decay = 2;

    // If your Canvas has physicallyCorrectLights, consider setting .power instead.
    flashRef.current.intensity = 250 * i2 * flicker; // tweak to taste

    // Emissive core bright at start, fades + warms
    if (emissiveCoreRef.current) {
      const emissiveColor = hot.clone().lerp(warm, 1 - i);
      emissiveCoreRef.current.emissive.copy(emissiveColor);
      emissiveCoreRef.current.emissiveIntensity = 10 * i2 * (0.95 + 0.1 * Math.sin(t * 30));
    }
  });

  const coreOpacity = intensity * 0.9;
  const fireballOpacity = intensity * 0.7;
  const outerOpacity = intensity * 0.4;

  return (
    <group ref={explosionRef} position={position}>
      {/* Actual light that illuminates the world */}
      {!airburst && ( 
      <pointLight
        ref={flashRef}
        color="#ffffff"
        intensity={0}            // animated in useFrame
        distance={0}             // animated in useFrame
        decay={2}
        castShadow={false}       // enable if you really want shadows (costly)
      />)}

      {/* Emissive inner core (adds "self-glow" & works great with bloom) */}
      <mesh>
        <sphereGeometry args={[fireballRadius * 1.6/100, 32, 32]} />
        <meshStandardMaterial
          ref={emissiveCoreRef}
          color="#202020"
          emissive="#ffffff"
          emissiveIntensity={0}  // animated in useFrame
          roughness={1}
          metalness={0}
          transparent
          opacity={Math.min(1, coreOpacity + 0.15)}
          depthWrite={false}
        />
      </mesh>

      {/* White-hot core shell (additive) */}
      <mesh>
        <sphereGeometry args={[fireballRadius * 2/100, 32, 32]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={coreOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {/* Secondary fireball (orange) */}
      <mesh>
        <sphereGeometry args={[fireballRadius * 4/100, 24, 24]} />
        <meshBasicMaterial
          color={fire}
          transparent
          opacity={fireballOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh>
        <sphereGeometry args={[fireballRadius * 6/100, 16, 16]} />
        <meshBasicMaterial
          color={shock}
          transparent
          opacity={outerOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
};

export default AsteroidExplosion;
