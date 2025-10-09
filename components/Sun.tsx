"use client";
import React, { useRef, createContext, useContext, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useTexture } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";

type SunCtx = {
  position: THREE.Vector3;
  sunToEarthDir: THREE.Vector3;
};

export const SunPositionContext = createContext<SunCtx>({
  position: new THREE.Vector3(),
  sunToEarthDir: new THREE.Vector3(1, 0, 0),
});

export const useSunPosition = () => useContext(SunPositionContext);

interface SunProps {
  /** Earth mesh ref so Sun orbits around it. */
  targetRef?: React.RefObject<THREE.Object3D>;
}

const Sun: React.FC<SunProps> = ({ targetRef }) => {
  const { scene } = useThree();
  const lightRef = useRef<THREE.DirectionalLight>(null!);
  const sunMeshRef = useRef<THREE.Mesh>(null!);

  const sunPos = useRef(new THREE.Vector3());
  const sunToEarthDir = useRef(new THREE.Vector3());
  const earthWorldPos = useRef(new THREE.Vector3());

  const sunTexture = useTexture("https://glb.asteroidstrike.earth/textures/Sun.png");
  useEffect(() => {
    sunTexture.colorSpace = THREE.SRGBColorSpace;
    sunTexture.anisotropy = 8;
  }, [sunTexture]);

  useEffect(() => {
    if (lightRef.current && !lightRef.current.target.parent) {
      scene.add(lightRef.current.target);
    }
  }, [scene]);

  useFrame(({ clock }) => {
    // Get Earth's current world position
    if (targetRef?.current) {
      targetRef.current.getWorldPosition(earthWorldPos.current);
    } else {
      earthWorldPos.current.set(-2.5, -0.2, 1); // Fallback
    }

    // Orbital parameters
    const elapsedTime = clock.getElapsedTime();
    const orbitRadius = 200;        // Large radius — Sun stays far away
    const orbitSpeed = 0.04;        // Slow, majestic orbit
    const elevationAngle = Math.PI / 6; // 30-degree tilt (like ecliptic)

    // Circular motion in XZ plane, elevated in Y
    const x = Math.cos(elapsedTime * orbitSpeed) * orbitRadius;
    const y = Math.sin(elapsedTime * orbitSpeed) * orbitRadius * Math.sin(elevationAngle);
    const z = Math.sin(elapsedTime * orbitSpeed) * orbitRadius * Math.cos(elevationAngle);

    // Set Sun position relative to Earth
    sunPos.current.set(
      earthWorldPos.current.x + x,
      earthWorldPos.current.y + y,
      earthWorldPos.current.z + z
    );

    // Update directional light
    if (lightRef.current) {
      lightRef.current.position.copy(sunPos.current);
      lightRef.current.target.position.copy(earthWorldPos.current);
      lightRef.current.target.updateMatrixWorld(true);

      // Direction FROM sun TO earth (used in Earth shader)
      sunToEarthDir.current
        .copy(earthWorldPos.current)
        .sub(sunPos.current)
        .normalize();
    }

    // Update visual Sun mesh
    if (sunMeshRef.current) {
      sunMeshRef.current.position.copy(sunPos.current);
      const pulse = 1 + Math.sin(elapsedTime * 1.2) * 0.04;
      sunMeshRef.current.scale.setScalar(pulse);
    }
  });

  return (
    <SunPositionContext.Provider
      value={{ position: sunPos.current, sunToEarthDir: sunToEarthDir.current }}
    >
      <group>
        {/* Directional light simulating sunlight */}
        <directionalLight
          ref={lightRef}
          intensity={1.5}
          color="#fff8dc"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={500}
          shadow-camera-left={-100}
          shadow-camera-right={100}
          shadow-camera-top={100}
          shadow-camera-bottom={-100}
        />

        {/* Visible Sun mesh — emissive and bloomy */}
        <mesh ref={sunMeshRef}>
          <sphereGeometry args={[5, 32, 32]} /> {/* Small disc from far away */}
          <meshStandardMaterial
            map={sunTexture}
            emissive="#ffffaa"
            emissiveIntensity={10}
            emissiveMap={sunTexture}
            toneMapped={false}
            roughness={0.3}
            metalness={0.0}
          />
        </mesh>
      </group>

      {/* Bloom for glow */}
      <EffectComposer multisampling={0}>
        <Bloom
          intensity={1.2}
          luminanceThreshold={0.7}
          luminanceSmoothing={0.2}
          mipmapBlur
        />
      </EffectComposer>
    </SunPositionContext.Provider>
  );
};

export default Sun;