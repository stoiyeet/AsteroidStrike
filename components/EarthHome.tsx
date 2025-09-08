"use client";
import React, { Suspense, useRef, useMemo, useState } from "react";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

const Earth: React.FC = () => {
  const meshRef = useRef<THREE.Mesh>(null!);

  const dayMap = useLoader(THREE.TextureLoader, "/textures/earthDay.png");
  const nightMap = useLoader(THREE.TextureLoader, "/textures/earthNight.png");

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [lastX, setLastX] = useState(0);

  // Shader with sunlight & texture swapping
  const earthMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: dayMap },
        nightTexture: { value: nightMap },
        sunDirection: { value: new THREE.Vector3(1, 0, 1).normalize() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;

        varying vec2 vUv;
        varying vec3 vNormal;

        void main() {
          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = texture2D(nightTexture, vUv).rgb;

          // Angle between normal and sun
          float sunFactor = dot(normalize(vNormal), normalize(sunDirection));
          sunFactor = smoothstep(-0.1, 0.1, sunFactor);

          // Mix day & night
          vec3 color = mix(nightColor * 0.3, dayColor, sunFactor);

          // Add glow for night lights
          if (sunFactor < 0.5) {
            color += nightColor * (1.0 - sunFactor) * 0.4;
          }

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, [dayMap, nightMap]);

  // Animate sunlight + auto spin with offset starting position
  useFrame(({ clock }) => {
    if (meshRef.current && !isDragging) {
      meshRef.current.rotation.y += 0.002; // auto rotation
    }
    if (earthMaterial.uniforms.sunDirection) {
      // Add π/3 (60 degrees) offset to start the sun in a different position
      const time = clock.getElapsedTime() * 0.1 + Math.PI / 3;
      earthMaterial.uniforms.sunDirection.value
        .set(Math.cos(time) * 5, 0, Math.sin(time) * 5)
        .normalize();
    }
  });

  // Drag handlers
  const onPointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setLastX(e.clientX);
  };
  const onPointerUp = () => setIsDragging(false);
  const onPointerMove = (e: React.PointerEvent) => {
    if (isDragging && meshRef.current) {
      const deltaX = e.clientX - lastX;
      meshRef.current.rotation.y += deltaX * 0.005;
      setLastX(e.clientX);
    }
  };

  return (
    <mesh
      ref={meshRef}
      material={earthMaterial}
      position={[-2.5, -0.2, 1]} // ✅ same positioning
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove}
    >
      <sphereGeometry args={[2, 64, 64]} /> {/* ✅ same sizing */}
    </mesh>
  );
};

const EarthScene: React.FC<{ opacity?: number }> = ({ opacity = 1 }) => {
  return (
    <div className="w-full h-full" style={{ opacity }}>
      <Canvas
        camera={{ position: [2, 1.5, 3], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Lighting just to enhance visuals */}
        <directionalLight position={[5, 0, 5]} intensity={1.5} castShadow />
        <ambientLight intensity={0.15} />

        {/* Background stars */}
        <Stars radius={100} depth={50} count={4000} factor={4} fade />

        <Suspense fallback={null}>
          <Earth />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default EarthScene;