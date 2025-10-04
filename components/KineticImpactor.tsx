// components/KineticImpactor.tsx
"use client";
import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface KineticImpactorProps {
  asteroidPosition: THREE.Vector3;
  isActive: boolean;
  onComplete?: () => void;
}

const KineticImpactor: React.FC<KineticImpactorProps> = ({
  asteroidPosition,
  isActive,
  onComplete,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const impactorRef = useRef<THREE.Group>(null);
  const impactGroupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);
  const engineGlowRef = useRef<THREE.Mesh>(null);
  
  const dustCloudRefs = useRef<THREE.Mesh[]>([]);
  const rockDebrisRefs = useRef<THREE.Mesh[]>([]);
  
  const startTime = useRef<number>(0);
  const hasStarted = useRef<boolean>(false);
  const isComplete = useRef<boolean>(false);
  const hasImpacted = useRef<boolean>(false);

  // Launch position (from Earth's direction)
  const launchPosition = useMemo(() => {
    const targetPos = asteroidPosition.clone();
    const earthPos = new THREE.Vector3(0, 0, 0);
    const direction = targetPos.clone().sub(earthPos).normalize();
    return earthPos.clone().add(direction.multiplyScalar(25));
  }, [asteroidPosition]);

  // Create impactor geometry and materials
  const impactorGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.3, 0.5, 2.5, 8);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }, []);

  const impactorMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: 0xE0E0E0,
      metalness: 0.9,
      roughness: 0.1,
    }),
    []
  );

  const noseConeGeometry = useMemo(() => {
    const geometry = new THREE.ConeGeometry(0.3, 0.6, 8);
    geometry.rotateZ(Math.PI / 2);
    return geometry;
  }, []);

  const noseConeMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({
      color: 0xA0A0A0,
      metalness: 0.8,
      roughness: 0.2,
    }),
    []
  );

  // Create engine trail
  const trailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(50 * 3);
    const colors = new Float32Array(50 * 3);
    
    for (let i = 0; i < 50; i++) {
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = 0;
      
      const intensity = (50 - i) / 50;
      colors[i * 3] = 1.0 * intensity;
      colors[i * 3 + 1] = 0.4 * intensity;
      colors[i * 3 + 2] = 0.0;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geometry;
  }, []);

  const trailMaterial = useMemo(
    () => new THREE.PointsMaterial({
      size: 0.2,
      transparent: true,
      opacity: 0.7,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
    }),
    []
  );

  // Physical impact dust cloud material (grey/brown, not fiery)
  const explosionMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          intensity: { value: 1.0 },
          color1: { value: new THREE.Color(0.65, 0.65, 0.65) }, // Grey dust
          color2: { value: new THREE.Color(0.5, 0.42, 0.35) }, // Brown rock
          color3: { value: new THREE.Color(0.85, 0.85, 0.85) }, // Light grey
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPosition;
          uniform float time;
          
          void main() {
            vUv = uv;
            vPosition = position;
            
            vec3 pos = position;
            float expansionFactor = 1.0 + time * 5.0;
            pos *= expansionFactor;
            
            float noise = sin(pos.x * 8.0 + time * 10.0) * 
                         sin(pos.y * 8.0 + time * 10.0) * 
                         sin(pos.z * 8.0 + time * 10.0) * 0.2;
            pos += normalize(pos) * noise;
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          varying vec3 vPosition;
          uniform float time;
          uniform float intensity;
          uniform vec3 color1;
          uniform vec3 color2;
          uniform vec3 color3;
          
          void main() {
            float dist = length(vPosition);
            float t = clamp(time * 1.5, 0.0, 1.0);
            
            vec3 color = mix(color3, color1, smoothstep(0.0, 0.5, dist));
            color = mix(color, color2, smoothstep(0.5, 1.0, dist));
            
            float variation = sin(time * 15.0) * 0.1 + 0.9;
            color *= variation;
            
            float fadeOut = 1.0 - smoothstep(0.5, 1.0, time);
            
            gl_FragColor = vec4(color, intensity * fadeOut * (0.65 - dist * 0.35));
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      }),
    []
  );

  // Crater ring material (ground dust ring, not energy shockwave)
  const shockwaveMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(0.68, 0.68, 0.68) },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float time;
          
          void main() {
            vUv = uv;
            vec3 pos = position;
            
            float expansion = time * 10.0;
            pos *= (1.0 + expansion);
            
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float time;
          uniform vec3 color;
          
          void main() {
            float dist = length(vUv - 0.5) * 2.0;
            float ring = smoothstep(0.6, 1.0, dist) * smoothstep(1.0, 0.6, dist);
            float fadeOut = 1.0 - smoothstep(0.2, 1.0, time);
            
            gl_FragColor = vec4(color, ring * fadeOut * 0.35);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.NormalBlending,
      }),
    []
  );

  // Brief white flash (not intense)
  const flashMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.2, 1.2, 1.2),
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      }),
    []
  );

  // Engine glow material
  const engineGlowMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: 0xFF4500,
        transparent: true,
        opacity: 0.8,
      }),
    []
  );

  // Dust cloud spheres data
  const dustClouds = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i / 8) * Math.PI * 2,
      elevation: (i % 3) * 0.3 - 0.3,
      speed: 2 + (i % 3) * 0.5,
      size: 0.6 + Math.random() * 0.4,
      color: i % 2 === 0 ? new THREE.Color(0.6, 0.6, 0.6) : new THREE.Color(0.5, 0.42, 0.35),
    }));
  }, []);

  // Rock debris chunks data
  const rockDebris = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i / 12) * Math.PI * 2,
      elevation: ((i % 4) / 4) * Math.PI / 2,
      speed: 3 + (i % 4),
      size: [0.15 + Math.random() * 0.2, 0.12 + Math.random() * 0.15, 0.18 + Math.random() * 0.2] as [number, number, number],
      color: i % 3 === 0 ? 0x696969 : i % 3 === 1 ? 0x8B7355 : 0x5A5A5A,
      rotationSpeed: [
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20,
        (Math.random() - 0.5) * 20
      ] as [number, number, number],
    }));
  }, []);

  useFrame((state) => {
    if (!isActive) {
      hasStarted.current = false;
      isComplete.current = false;
      hasImpacted.current = false;
      return;
    }

    if (!hasStarted.current) {
      startTime.current = state.clock.elapsedTime;
      hasStarted.current = true;
    }

    const elapsed = state.clock.elapsedTime - startTime.current;
    const flightDuration = 2.5;
    const explosionDuration = 3.0;
    const totalDuration = flightDuration + explosionDuration;

    // Phase 1: Impactor flight
    if (elapsed < flightDuration) {
      const flightProgress = elapsed / flightDuration;
      
      if (impactorRef.current && trailRef.current && engineGlowRef.current) {
        const currentPos = new THREE.Vector3().lerpVectors(
          launchPosition,
          asteroidPosition,
          flightProgress
        );
        
        impactorRef.current.position.copy(currentPos);
        impactorRef.current.visible = true;
        
        const direction = asteroidPosition.clone().sub(currentPos).normalize();
        impactorRef.current.lookAt(currentPos.clone().add(direction));
        
        const pulse = 0.6 + Math.sin(elapsed * 15) * 0.4;
        engineGlowMaterial.opacity = pulse;
        const scale = 1 + Math.sin(elapsed * 12) * 0.2;
        engineGlowRef.current.scale.setScalar(scale);
        
        const trailPositions = trailGeometry.attributes.position.array as Float32Array;
        for (let i = 49; i > 0; i--) {
          trailPositions[i * 3] = trailPositions[(i - 1) * 3];
          trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
          trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
        }
        const exhaustPos = currentPos.clone().add(direction.clone().multiplyScalar(-1.5));
        trailPositions[0] = exhaustPos.x;
        trailPositions[1] = exhaustPos.y;
        trailPositions[2] = exhaustPos.z;
        
        trailGeometry.attributes.position.needsUpdate = true;
        trailRef.current.visible = true;
      }
    }
    // Phase 2: Impact and explosion
    else {
      if (impactorRef.current) impactorRef.current.visible = false;
      if (trailRef.current) trailRef.current.visible = false;
      
      if (!hasImpacted.current) {
        hasImpacted.current = true;
      }
      
      const explosionElapsed = elapsed - flightDuration;
      const explosionProgress = Math.min(explosionElapsed / explosionDuration, 1);

      // Animate dust cloud spheres
      dustCloudRefs.current.forEach((cloud, i) => {
        if (!cloud) return;
        
        const data = dustClouds[i];
        const horizontalDist = explosionProgress * data.speed;
        
        cloud.position.set(
          Math.cos(data.angle) * horizontalDist,
          data.elevation + Math.sin(explosionProgress * Math.PI) * 0.8,
          Math.sin(data.angle) * horizontalDist
        );
        
        // Scale up dust clouds as they expand
        const scale = 1 + explosionProgress * 2.5;
        cloud.scale.setScalar(scale);
        
        // Slow rotation
        cloud.rotation.y += 0.01;
        
        // Fade out
        const material = cloud.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0, 0.6 - explosionProgress * 0.6);
      });

      // Animate rock debris chunks
      rockDebrisRefs.current.forEach((rock, i) => {
        if (!rock) return;
        
        const data = rockDebris[i];
        const speed = data.speed;
        const horizontalDist = explosionProgress * speed * Math.cos(data.elevation);
        const verticalVel = speed * Math.sin(data.elevation);
        const gravity = -4.9;
        const verticalDist = verticalVel * explosionElapsed + 0.5 * gravity * explosionElapsed * explosionElapsed;
        
        rock.position.set(
          Math.cos(data.angle) * horizontalDist,
          Math.max(0, verticalDist),
          Math.sin(data.angle) * horizontalDist
        );
        
        // Tumbling motion
        rock.rotation.x += data.rotationSpeed[0] * 0.016;
        rock.rotation.y += data.rotationSpeed[1] * 0.016;
        rock.rotation.z += data.rotationSpeed[2] * 0.016;
        
        // Fade out
        const material = rock.material as THREE.MeshStandardMaterial;
        material.opacity = Math.max(0, 1 - explosionProgress * 0.8);
      });

      // Reduced camera shake
      if (explosionProgress < 0.25) {
        const shakeIntensity = (0.25 - explosionProgress) * 0.12;
        state.camera.position.add(
          new THREE.Vector3(
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity
          )
        );
      }
    }

    if (elapsed > totalDuration && !isComplete.current) {
      isComplete.current = true;
      onComplete?.();
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      {/* Kinetic Impactor Spacecraft */}
      <group ref={impactorRef}>
        <mesh geometry={impactorGeometry} material={impactorMaterial} />
        
        <mesh geometry={noseConeGeometry} material={noseConeMaterial} position={[1.5, 0, 0]} />
        
        <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <boxGeometry args={[0.03, 2.5, 1]} />
          <meshStandardMaterial color={0x1a237e} metalness={0.1} roughness={0.8} />
        </mesh>
        <mesh position={[0, -1.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <boxGeometry args={[0.03, 2.5, 1]} />
          <meshStandardMaterial color={0x1a237e} metalness={0.1} roughness={0.8} />
        </mesh>
        
        {Array.from({ length: 4 }).map((_, i) => (
          <mesh 
            key={i}
            position={[
              -1.5,
              Math.cos(i * Math.PI / 2) * 0.25,
              Math.sin(i * Math.PI / 2) * 0.25
            ]}
          >
            <cylinderGeometry args={[0.06, 0.1, 0.3]} />
            <meshStandardMaterial color={0x333333} metalness={0.8} roughness={0.3} />
          </mesh>
        ))}
        
        <mesh 
          ref={engineGlowRef}
          position={[-2, 0, 0]}
          material={engineGlowMaterial}
        >
          <coneGeometry args={[0.25, 1.2]} />
        </mesh>
        
        <mesh position={[1, 0, 0.35]}>
          <sphereGeometry args={[0.04]} />
          <meshBasicMaterial color={0x00FF00} />
        </mesh>
        <mesh position={[0.6, 0.2, 0.35]}>
          <sphereGeometry args={[0.03]} />
          <meshBasicMaterial color={0xFF0000} />
        </mesh>
        <mesh position={[0.6, -0.2, 0.35]}>
          <sphereGeometry args={[0.03]} />
          <meshBasicMaterial color={0xFF0000} />
        </mesh>

        <pointLight
          position={[-2, 0, 0]}
          color={0xFF4500}
          intensity={2}
          distance={6}
        />
      </group>
      
      <points ref={trailRef} geometry={trailGeometry} material={trailMaterial} />
      
      {/* Physical impact effects at asteroid position */}
      <group ref={impactGroupRef} position={asteroidPosition}>
        {/* Dust cloud spheres */}
        {dustClouds.map((data, i) => (
          <mesh
            key={`dust-${data.id}`}
            ref={(el) => {
              if (el) dustCloudRefs.current[i] = el;
            }}
          >
            <sphereGeometry args={[data.size, 16, 16]} />
            <meshBasicMaterial
              color={data.color}
              transparent
              opacity={0.6}
            />
          </mesh>
        ))}

        {/* Rock debris chunks */}
        {rockDebris.map((data, i) => (
          <mesh
            key={`rock-${data.id}`}
            ref={(el) => {
              if (el) rockDebrisRefs.current[i] = el;
            }}
          >
            <boxGeometry args={data.size} />
            <meshStandardMaterial
              color={data.color}
              roughness={0.9}
              metalness={0.1}
              transparent
              opacity={1}
            />
          </mesh>
        ))}
        
        {/* Brief impact flash */}
        <mesh>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={new THREE.Color(1.2, 1.2, 1.2)}
            transparent
            opacity={hasImpacted.current ? 0.3 : 0}
          />
        </mesh>
        
        {/* Warm orange light for physical impact */}
        <pointLight
          color={0xFFA500}
          intensity={6}
          distance={16}
          decay={2}
        />
      </group>
    </group>
  );
};

export default KineticImpactor;