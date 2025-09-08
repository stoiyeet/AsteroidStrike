"use client";
import React, { useRef, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import * as THREE from "three";



export interface AsteroidProps {
  orbitRadius: number;
  orbitSpeed: number;
  earthPosition: [number, number, number]; // tuple preferred over number[]
}


const Asteroid: React.FC<AsteroidProps> = ({ orbitRadius, orbitSpeed, earthPosition }) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  const map = useLoader(THREE.TextureLoader, "/textures/Asteroid.png");

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map,
        roughness: 0.95,
        metalness: 0.05,
      }),
    [map]
  );

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
    }
  });

  return (
    <mesh ref={meshRef} castShadow receiveShadow material={material}>
      <dodecahedronGeometry args={[1, 2]} />
    </mesh>
  );
};

export default Asteroid;
