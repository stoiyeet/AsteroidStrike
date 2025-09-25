import * as THREE from 'three';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { surfacemToChordUnits, EARTH_R_M, ringRotation } from '@/components/meteors/EarthImpact';

// Vertex shader
const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform float uExpansionFactor;
  uniform float uMaxRadius;
  uniform float uHeight;
  uniform vec3 uColor;
  uniform vec3 uLightDir;
  uniform vec3 uCameraPos;
  varying vec2 vUv;

  float rand(vec2 n) { 
    return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    vec2 d = fp * fp * (3.0 - 2.0 * fp);
    float n0 = rand(ip);
    float n1 = rand(ip + vec2(1.0, 0.0));
    float n2 = rand(ip + vec2(0.0, 1.0));
    float n3 = rand(ip + vec2(1.0, 1.0));
    float m1 = mix(n0, n1, d.x);
    float m2 = mix(n2, n3, d.x);
    return mix(m1, m2, d.y);
  }

  void main() {
    vec2 uv = (vUv - 0.5) * 2.0;
    float dist = length(uv);
    float radialFade = 1.0 - smoothstep(0.0, 1.0, dist);

    // Noise factor for edge splotchiness
    float noiseFactor = smoothstep(0.05, 1.0, dist);

    // Faint, even ripples with animated brightness
    float rippleBase = noise(uv * 8.0 + uTime * 0.2) * 0.2 + 
                       noise(uv * 16.0 - uTime * 0.3) * 0.1;
    float ripple = mix(1.0, 1.0 + rippleBase * sin(uTime), noiseFactor);

    float alpha = radialFade * ripple;
    alpha = clamp(alpha * 1.5, 0.0, 1.0); // slightly less aggressive than before

    float heightIntensity = clamp(uHeight / 100.0, 0.0, 1.0);
    vec3 waveColor = mix(vec3(0.0, 0.8, 1.0), vec3(0.0, 0.15, 0.4), heightIntensity);

    // Softer shading
    vec3 normal = normalize(vec3(uv, 0.8)); // slightly flatter normal
    float diffuse = max(dot(normal, normalize(uLightDir)), 0.0);

    vec3 viewDir = normalize(uCameraPos - vec3(0.0, 0.0, 0.0));
    vec3 halfDir = normalize(normalize(uLightDir) + viewDir);
    float spec = pow(max(dot(normal, halfDir), 0.0), 32.0); // softer highlight
    vec3 specular = vec3(1.0) * spec * 0.6; // reduce glint strength

    vec3 finalColor = waveColor * (0.7 + 0.3 * diffuse) + specular;

    gl_FragColor = vec4(finalColor, alpha * heightIntensity);
  }
`;



const TsunamiWaves = ({
  position,
  height,
  expansionFactor,
  showLabels
}: {
  position: THREE.Vector3;
  height: number;
  expansionFactor: number;
  showLabels: boolean;
}) => {
  const meshRef = useRef<THREE.Mesh>(null!);

  const maxRadius = Math.min(height * 100, EARTH_R_M * 0.8);
  const currentRadius = surfacemToChordUnits(maxRadius * expansionFactor);

  const uniforms = React.useMemo(
    () => ({
      uTime: { value: 0 },
      uExpansionFactor: { value: expansionFactor },
      uMaxRadius: { value: currentRadius },
      uHeight: { value: height },
      uColor: { value: new THREE.Color(height > 50 ? '#0d00ffff' : '#1429eaff') },
      uLightDir: { value: new THREE.Vector3(0.3, 0.6, 0.7).normalize() },
      uCameraPos: { value: new THREE.Vector3() }
    }),
    [expansionFactor, currentRadius, height]
  );

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uExpansionFactor.value = expansionFactor;
    uniforms.uMaxRadius.value = currentRadius;
    uniforms.uHeight.value = height;
    uniforms.uCameraPos.value.copy(state.camera.position);
  });

  if (currentRadius < 0.001) return null;

  return (
    <group
      position={position.clone().multiplyScalar(1.001)}
      rotation={ringRotation(position)}
    >
      <mesh ref={meshRef}>
        <circleGeometry args={[currentRadius, 128]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
          blending={THREE.NormalBlending} // so alpha really controls opacity
          side={THREE.DoubleSide}
        />
      </mesh>

      {showLabels && expansionFactor > 0.3 && (
        <Html
          position={[currentRadius * 0.6, currentRadius * 0.3, 0.03]}
          center
        >
          <div
            className="damage-zone-label"
            style={{ ['--zone-color' as string]: '#0066cc' }}
          >
            <div className="zone-type">TSUNAMI</div>
            <div className="zone-name">Wave Height: {height.toFixed(1)}m</div>
            <div className="zone-radius">
              Max Range: {(maxRadius / 1000).toFixed(0)} km
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};

export default TsunamiWaves;
