// ExplosionFlash.tsx
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ExplosionFlashProps {
    onFlashComplete: () => void;
}

const ExplosionFlash: React.FC<ExplosionFlashProps> = ({ onFlashComplete }) => {
    const meshRef = useRef<THREE.Mesh>(null!);
    const startTime = useRef(Date.now());
    const maxDuration = 20000; // Milliseconds

    useFrame(() => {
        const elapsed = Date.now() - startTime.current;
        if (elapsed > maxDuration) {
            onFlashComplete();
            return;
        }
        const material = meshRef.current.material as THREE.MeshBasicMaterial;
        // Quickly fade the flash
        const progress = elapsed / maxDuration;
        material.opacity = 1 - progress * progress*10; // slow → fast
    });

    return (
        <mesh ref={meshRef} position={[0, 0, 2]}>
            <planeGeometry args={[20, 20]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={1} toneMapped={false} />
        </mesh>
    );
};

export default ExplosionFlash;