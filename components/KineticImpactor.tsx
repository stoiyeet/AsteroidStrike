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
  const explosionRef = useRef<THREE.Mesh>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const flashRef = useRef<THREE.Mesh>(null);
  const debrisRef = useRef<THREE.Points>(null);
  const trailRef = useRef<THREE.Points>(null);
  const engineGlowRef = useRef<THREE.Mesh>(null);
  
  const startTime = useRef<number>(0);
  const hasStarted = useRef<boolean>(false);
  const isComplete = useRef<boolean>(false);
  const hasImpacted = useRef<boolean>(false);

  // Launch position (from Earth's direction)
  const launchPosition = useMemo(() => {
    const targetPos = asteroidPosition.clone();
    const earthPos = new THREE.Vector3(0, 0, 0);
    const direction = targetPos.clone().sub(earthPos).normalize();
    return earthPos.clone().add(direction.multiplyScalar(25)); // Launch from near Earth
  }, [asteroidPosition]);

  // Create impactor geometry and materials
  const impactorGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.3, 0.5, 2.5, 8);
    geometry.rotateZ(Math.PI / 2); // Point it horizontally
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
      colors[i * 3] = 1.0 * intensity; // Red
      colors[i * 3 + 1] = 0.4 * intensity; // Green
      colors[i * 3 + 2] = 0.0; // Blue
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

  // Create explosion material
  const explosionMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          intensity: { value: 1.0 },
          color1: { value: new THREE.Color(1, 0.8, 0) }, // Orange
          color2: { value: new THREE.Color(1, 0.3, 0) }, // Red
          color3: { value: new THREE.Color(1, 1, 0.8) }, // Yellow-white
        },
        vertexShader: `
          varying vec2 vUv;
          varying vec3 vPosition;
          uniform float time;
          
          void main() {
            vUv = uv;
            vPosition = position;
            
            // Animate explosion expansion
            vec3 pos = position;
            float expansionFactor = 1.0 + time * 8.0;
            pos *= expansionFactor;
            
            // Add noise for irregular explosion
            float noise = sin(pos.x * 10.0 + time * 20.0) * 
                         sin(pos.y * 10.0 + time * 20.0) * 
                         sin(pos.z * 10.0 + time * 20.0) * 0.1;
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
            
            // Create fireball gradient
            vec3 color = mix(color3, color1, smoothstep(0.0, 0.5, dist));
            color = mix(color, color2, smoothstep(0.5, 1.0, dist));
            
            // Add pulsing effect
            float pulse = sin(time * 30.0) * 0.3 + 0.7;
            color *= pulse;
            
            // Fade out over time
            float fadeOut = 1.0 - smoothstep(0.5, 1.0, time);
            
            gl_FragColor = vec4(color, intensity * fadeOut * (1.0 - dist * 0.5));
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Create shockwave material
  const shockwaveMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          color: { value: new THREE.Color(0.6, 0.8, 1.0) },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float time;
          
          void main() {
            vUv = uv;
            vec3 pos = position;
            
            // Expand shockwave
            float expansion = time * 15.0;
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
            
            gl_FragColor = vec4(color, ring * fadeOut * 0.6);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

  // Create flash material
  const flashMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(2, 2, 2),
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

  // Create debris particles
  const debrisGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(300 * 3);
    const velocities = new Float32Array(300 * 3);
    
    for (let i = 0; i < 300; i++) {
      // Random positions around impact center
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 2;
      
      // Random velocities
      velocities[i * 3] = (Math.random() - 0.5) * 20;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 20;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 20;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
    
    return geometry;
  }, []);

  const debrisMaterial = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: new THREE.Color(1, 0.5, 0.1),
        size: 0.1,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
      }),
    []
  );

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
    const flightDuration = 2.5; // 2.5 seconds flight time
    const explosionDuration = 3.0; // 3 seconds explosion
    const totalDuration = flightDuration + explosionDuration;

    // Phase 1: Impactor flight
    if (elapsed < flightDuration) {
      const flightProgress = elapsed / flightDuration;
      
      if (impactorRef.current && trailRef.current && engineGlowRef.current) {
        // Interpolate impactor position
        const currentPos = new THREE.Vector3().lerpVectors(
          launchPosition,
          asteroidPosition,
          flightProgress
        );
        
        impactorRef.current.position.copy(currentPos);
        impactorRef.current.visible = true;
        
        // Point impactor toward target
        const direction = asteroidPosition.clone().sub(currentPos).normalize();
        impactorRef.current.lookAt(currentPos.clone().add(direction));
        
        // Engine glow pulsing
        const pulse = 0.6 + Math.sin(elapsed * 15) * 0.4;
        engineGlowMaterial.opacity = pulse;
        const scale = 1 + Math.sin(elapsed * 12) * 0.2;
        engineGlowRef.current.scale.setScalar(scale);
        
        // Update trail
        const trailPositions = trailGeometry.attributes.position.array as Float32Array;
        for (let i = 49; i > 0; i--) {
          trailPositions[i * 3] = trailPositions[(i - 1) * 3];
          trailPositions[i * 3 + 1] = trailPositions[(i - 1) * 3 + 1];
          trailPositions[i * 3 + 2] = trailPositions[(i - 1) * 3 + 2];
        }
        // Add slight offset for engine exhaust position
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
      // Hide impactor and trail after impact
      if (impactorRef.current) impactorRef.current.visible = false;
      if (trailRef.current) trailRef.current.visible = false;
      
      if (!hasImpacted.current) {
        hasImpacted.current = true;
      }
      
      const explosionElapsed = elapsed - flightDuration;
      const explosionProgress = Math.min(explosionElapsed / explosionDuration, 1);

      // Update explosion effects
      if (explosionRef.current && explosionMaterial) {
        explosionMaterial.uniforms.time.value = explosionProgress;
        explosionMaterial.uniforms.intensity.value = Math.max(0, 1.0 - explosionProgress * 1.5); // Fade faster
        
        // Hide explosion sphere completely after short duration
        if (explosionProgress > 0.4) {
          explosionRef.current.visible = false;
        } else {
          explosionRef.current.visible = true;
        }
      }

      // Update shockwave
      if (shockwaveRef.current && shockwaveMaterial) {
        shockwaveMaterial.uniforms.time.value = explosionProgress;
      }

      // Update flash (brief initial flash)
      if (flashRef.current && flashMaterial) {
        if (explosionProgress < 0.1) {
          flashMaterial.opacity = (1 - explosionProgress * 10) * 0.8;
        } else {
          flashMaterial.opacity = 0;
        }
      }

      // Update debris
      if (debrisRef.current && debrisGeometry) {
        const positions = debrisGeometry.attributes.position.array as Float32Array;
        const velocities = debrisGeometry.attributes.velocity.array as Float32Array;
        
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += velocities[i] * 0.015 * explosionProgress;
          positions[i + 1] += velocities[i + 1] * 0.015 * explosionProgress;
          positions[i + 2] += velocities[i + 2] * 0.015 * explosionProgress;
        }
        
        debrisGeometry.attributes.position.needsUpdate = true;
        debrisMaterial.opacity = Math.max(0, 0.8 - explosionProgress);
      }

      // Camera shake effect
      if (explosionProgress < 0.4) {
        const shakeIntensity = (0.4 - explosionProgress) * 0.3;
        state.camera.position.add(
          new THREE.Vector3(
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity,
            (Math.random() - 0.5) * shakeIntensity
          )
        );
      }
    }

    // Complete the effect
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
        {/* Main body */}
        <mesh geometry={impactorGeometry} material={impactorMaterial} />
        
        {/* Reinforced nose cone */}
        <mesh geometry={noseConeGeometry} material={noseConeMaterial} position={[1.5, 0, 0]} />
        
        {/* Solar panels */}
        <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <boxGeometry args={[0.03, 2.5, 1]} />
          <meshStandardMaterial color={0x1a237e} metalness={0.1} roughness={0.8} />
        </mesh>
        <mesh position={[0, -1.5, 0]} rotation={[0, 0, Math.PI/2]}>
          <boxGeometry args={[0.03, 2.5, 1]} />
          <meshStandardMaterial color={0x1a237e} metalness={0.1} roughness={0.8} />
        </mesh>
        
        {/* Thruster nozzles */}
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
        
        {/* Main engine exhaust glow */}
        <mesh 
          ref={engineGlowRef}
          position={[-2, 0, 0]}
          material={engineGlowMaterial}
        >
          <coneGeometry args={[0.25, 1.2]} />
        </mesh>
        
        {/* Status lights */}
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

        {/* Engine illumination */}
        <pointLight
          position={[-2, 0, 0]}
          color={0xFF4500}
          intensity={2}
          distance={6}
        />
      </group>
      
      {/* Engine trail */}
      <points ref={trailRef} geometry={trailGeometry} material={trailMaterial} />
      
      {/* Impact explosion effects positioned at asteroid */}
      <group position={asteroidPosition}>
        {/* Main explosion fireball */}
        <mesh ref={explosionRef} material={explosionMaterial}>
          <sphereGeometry args={[1.5, 32, 32]} />
        </mesh>
        
        {/* Shockwave */}
        <mesh ref={shockwaveRef} material={shockwaveMaterial}>
          <sphereGeometry args={[2, 32, 32]} />
        </mesh>
        
        {/* Initial flash */}
        <mesh ref={flashRef} material={flashMaterial}>
          <sphereGeometry args={[4, 16, 16]} />
        </mesh>
        
        {/* Debris particles */}
        <points ref={debrisRef} geometry={debrisGeometry} material={debrisMaterial} />
        
        {/* Impact flash light */}
        <pointLight
          color={0xFFFFFF}
          intensity={15}
          distance={25}
          decay={2}
        />
      </group>
    </group>
  );
};

export default KineticImpactor;