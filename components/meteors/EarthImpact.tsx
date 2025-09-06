'use client';

import * as THREE from 'three';
import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, useGLTF } from '@react-three/drei';
import { GLTF } from 'three-stdlib';

import { getGlbFile } from './asteroidGLB';
import AsteroidExplosion from './AsteroidExplosion';
import Earth from "@/components/Earth";
import { Damage_Results } from './DamageValuesOptimized';
import { computeWaveRadii } from './utils/waveRadii';

type Meteor = {
  name: string;
  mass: number;
  diameter: number;
  speed: number;
  angle: number;
  density?: number;
  isCustom?: boolean;
};

type Impact = { lat: number; lon: number; };

type EffectsState = {
  fireball: boolean;
  sonicWave: boolean;
  shockwave: boolean;
  thermal: boolean;
  overpressure: boolean;
  ejecta: boolean;
  labels: boolean;
};

interface Props {
  meteor: Meteor;
  damage: Damage_Results;
  impact: Impact;
  t: number;           // 0..1 timeline
  impactTime: number;  // when impact happens on timeline
  onImpactSelect?: (lat: number, lon: number) => void;
  effects: EffectsState;
}

const EARTH_R = 1;
const EARTH_R_M = 6371000;
type GLTFResult = GLTF & { scene: THREE.Group };

function surfacemToChordUnits(m: number): number {
  const maxm = Math.min(m, EARTH_R_M * 0.9);
  const theta = maxm / EARTH_R_M;
  return EARTH_R * theta * 0.8;
}

export default function EarthImpact({
  meteor,
  damage,
  impact,
  t,
  impactTime,
  onImpactSelect,
  effects,
}: Props) {
  const impactPos = useMemo(
    () => latLonToVec3(impact.lat, impact.lon, EARTH_R + 0.001),
    [impact]
  );

  const entryStart = useMemo(
    () => latLonToVec3(impact.lat + (90 - meteor.angle)*12/17, impact.lon, EARTH_R * 1.8),
    [impact, meteor.angle]
  );

  // Asteroid model (only load GLB for non-custom asteroids)
  const modelUrl = meteor.isCustom ? '' : getGlbFile(meteor.name || '');
  const gltf = meteor.isCustom ? null : (useGLTF(modelUrl) as GLTFResult);
  const asteroidRef = useRef<THREE.Group>(null!);

  // Asteroid size
  const desiredAsteroidRadiusUnits = useMemo(() => {
    const diameterKm = Math.max(meteor.diameter / 1000, 0); // diameter is in meters, convert to km
    const radiusKm = diameterKm / 2;
    const minVisible = 0.002 * EARTH_R;
    const maxVisible = 0.05 * EARTH_R;
    const calculatedSize = (radiusKm / EARTH_R_M) * EARTH_R;
    return Math.max(minVisible, Math.min(calculatedSize, maxVisible));
  }, [meteor.diameter]);

  const asteroidScale = useMemo(() => {
    if (meteor.isCustom) {
      // For custom asteroids, we use the sphere directly at the desired size
      return 1;
    }
    if (!gltf) return 1;
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    let current = sphere.radius;
    if (current < 1){
      current = 2;
    }
    return desiredAsteroidRadiusUnits / current;
  }, [gltf?.scene, desiredAsteroidRadiusUnits, meteor.isCustom]);

  // Get material color based on asteroid type
  const getAsteroidMaterial = () => {
    if (!meteor.isCustom) return null;
    
    const materialName = meteor.name?.split('_')[1] || 'stone';
    switch (materialName) {
      case 'iron':
        return { color: '#8C7853', metalness: 0.8, roughness: 0.3 };
      case 'ice':
        return { color: '#B8E6FF', metalness: 0.1, roughness: 0.1 };
      case 'stone':
      default:
        return { color: '#8B7355', metalness: 0.2, roughness: 0.8 };
    }
  };

  const customMaterial = getAsteroidMaterial();

  // Flight path
  const asteroidPos = useMemo(() => {
    if (t >= impactTime) return impactPos.clone();
    const alpha = THREE.MathUtils.clamp(t / impactTime, 0, 1);
    const curved = Math.pow(alpha, 2);
    return entryStart.clone().lerp(impactPos, curved);
  }, [t, impactTime, entryStart, impactPos]);

  // Spin
  useFrame((_, dt) => {
    if (asteroidRef.current) {
      asteroidRef.current.rotation.y += 0.8 * dt;
      asteroidRef.current.rotation.x += 0.3 * dt;
    }
  });

  // Timeline
  const post = Math.max(0, t - impactTime);
  const sonicFrac = THREE.MathUtils.smoothstep(post / 0.8, 0, 1);
  const shockFrac = THREE.MathUtils.smoothstep(post / 1.2, 0, 1);
  const explosionIntensity = Math.max(0, 1 - post / 0.3);
  const explosionStrength = t >= impactTime ? explosionIntensity : 0;

  const damageExpansionCurve = (delay: number) => {
    const adjustedPost = Math.max(0, post - delay);
    const progress = Math.min(adjustedPost / 2.0, 1);
    return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
  };

  function handleDoubleClick(e: any) {
    if (!onImpactSelect) return;
    const p = e.point.clone().normalize();
    const lat = THREE.MathUtils.radToDeg(Math.asin(p.y));
    const lon = THREE.MathUtils.radToDeg(Math.atan2(p.z, p.x));
    onImpactSelect(lat, lon);
  }

  // Wave radii (centralized)
  const {second_degree_burn, third_degree_burn, fireball_radius, buildingCollapseEarthquake, glassShatter, buildingCollapseShockwave, clothingIgnition } =
    computeWaveRadii(damage);

  // Zones
  const thermalZones = [
    { radius: clothingIgnition,     color: '#ff1100', label: 'Complete Vaporization', opacity: 0.35, borderColor: '#ffffff', delay: 0.0,  priority: 3 },
    { radius: third_degree_burn,   color: '#ff4400', label: '100% 3rd Degree Burns', opacity: 0.25, borderColor: '#ffaa00', delay: 0.15, priority: 2 },
    { radius: second_degree_burn,  color: '#ff8800', label: '100% 2nd Degree Burns', opacity: 0.18, borderColor: '#ffcc00', delay: 0.30, priority: 1 },
  ];

  const pressureZones = [
    { radius: buildingCollapseShockwave, color: '#0066cc', label: 'Total Destruction',       opacity: 0.28, borderColor: '#00aaff', delay: 0.10, priority: 3 },
    { radius: glassShatter,              color: '#0099dd', label: 'Heavy Structural Damage', opacity: 0.20, borderColor: '#44ccff', delay: 0.25, priority: 2 },
  ];

  const blastRadius = surfacemToChordUnits(fireball_radius || 0);

  return (
    <group>
      {/* Earth */}
      <Earth
        onDoubleClick={handleDoubleClick}
        impactPosition={impactPos}
        blastRadius={blastRadius}
        explosionStrength={explosionStrength}
      />

      {/* Asteroid flight */}
      {t < impactTime && (
        <group ref={asteroidRef} position={asteroidPos}>
          {/* Render custom sphere or GLB model */}
          {meteor.isCustom ? (
            <mesh>
              <sphereGeometry args={[desiredAsteroidRadiusUnits * 2, 32, 32]} />
              <meshStandardMaterial
                color={customMaterial?.color || '#8B7355'}
                metalness={customMaterial?.metalness || 0.2}
                roughness={customMaterial?.roughness || 0.8}
              />
            </mesh>
          ) : (
            gltf && <primitive object={gltf.scene} scale={asteroidScale * 2} />
          )}
          
          {/* Atmospheric heating effects */}
          <mesh>
            <sphereGeometry args={[desiredAsteroidRadiusUnits * 1.8, 32, 32]} />
            <meshBasicMaterial
              color="#ff2200"
              transparent
              opacity={0.8 * Math.pow(t / impactTime, 1.2) * (0.8 + 0.2 * Math.sin(t * 20))}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[desiredAsteroidRadiusUnits * 2.8, 24, 24]} />
            <meshBasicMaterial
              color="#ff4400"
              transparent
              opacity={0.6 * Math.pow(t / impactTime, 1.5)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
          <mesh>
            <sphereGeometry args={[desiredAsteroidRadiusUnits * 4.0, 16, 16]} />
            <meshBasicMaterial
              color="#ff6622"
              transparent
              opacity={0.3 * Math.pow(t / impactTime, 1.8)}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}

      {/* Fireball */}
      {effects.fireball && t >= impactTime && t < impactTime + 0.3 && (
        <AsteroidExplosion
          position={impactPos}
          intensity={explosionIntensity}
          fireballRadius={surfacemToChordUnits(fireball_radius || 0)}
        />
      )}

      {/* Ejecta / crater */}
      {effects.ejecta && t >= impactTime && (
        <mesh position={impactPos.clone().multiplyScalar(1.008)} rotation={ringRotation(impactPos)}>
          <ringGeometry
            args={[0, surfacemToChordUnits(((damage.Dtc_m || damage.Dfr_m || 0) * damageExpansionCurve(0.05))), 64, 1]}
          />
          <meshBasicMaterial
            color="#aa3322"
            transparent
            opacity={0.7 * Math.max(0.3, 1.0 - post / 3.0)}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Shockwave (propagates from impact) */}
      {effects.shockwave && t >= impactTime + 0.1 && buildingCollapseShockwave > 0 && (
        <group position={impactPos.clone().multiplyScalar(1.015)} rotation={ringRotation(impactPos)}>
          {(() => {
            const wave = damageExpansionCurve(0);
            const reach = buildingCollapseShockwave;
            const innerR = Math.max(1e-3, surfacemToChordUnits(reach * 0.90 * wave));
            const outerR = surfacemToChordUnits(reach * 1.00 * wave);
            const fillR  = Math.max(1e-3, surfacemToChordUnits(reach * 0.90 * wave));
            const pulseInner = surfacemToChordUnits(reach * 1.00 * wave);
            const pulseOuter = surfacemToChordUnits(reach * 1.15 * wave);

            return (
              <>
                <mesh>
                  <ringGeometry args={[innerR, outerR, 64, 1]} />
                  <meshBasicMaterial
                    color="#00ddff"
                    transparent
                    opacity={0.9 * (0.7 + 0.3 * Math.sin(post * 8))}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh>
                  <ringGeometry args={[0, fillR, 64, 1]} />
                  <meshBasicMaterial
                    color="#0099cc"
                    transparent
                    opacity={0.15 * (0.8 + 0.2 * Math.sin(post * 6))}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh>
                  <ringGeometry args={[pulseInner, pulseOuter, 32, 1]} />
                  <meshBasicMaterial
                    color="#44eeff"
                    transparent
                    opacity={0.6 * (0.5 + 0.5 * Math.sin(post * 10))}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </>
            );
          })()}
        </group>
      )}

      {/* Sonic wave (propagates from impact) */}
      {effects.sonicWave && t >= impactTime + 0.1 && glassShatter > 0 && (
        <group position={impactPos.clone().multiplyScalar(1.012)} rotation={ringRotation(impactPos)}>
          {(() => {
            const wave = damageExpansionCurve(0.1);
            const reach = glassShatter;
            const innerR = Math.max(1e-3, surfacemToChordUnits(reach * 0.95 * wave));
            const outerR = surfacemToChordUnits(reach * 1.00 * wave);
            const fillR  = Math.max(1e-3, surfacemToChordUnits(reach * 0.95 * wave));
            const pulseInner = surfacemToChordUnits(reach * 1.00 * wave);
            const pulseOuter = surfacemToChordUnits(reach * 1.20 * wave);

            return (
              <>
                <mesh>
                  <ringGeometry args={[innerR, outerR, 64, 1]} />
                  <meshBasicMaterial
                    color="#88ddff"
                    transparent
                    opacity={1 * sonicFrac}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh>
                  <ringGeometry args={[0, fillR, 64, 1]} />
                  <meshBasicMaterial
                    color="#66bbdd"
                    transparent
                    opacity={0.10 * sonicFrac}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
                <mesh>
                  <ringGeometry args={[pulseInner, pulseOuter, 32, 1]} />
                  <meshBasicMaterial
                    color="#aaeeff"
                    transparent
                    opacity={0.7 * sonicFrac * (0.6 + 0.4 * Math.sin(post * 12))}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    side={THREE.DoubleSide}
                  />
                </mesh>
              </>
            );
          })()}
        </group>
      )}

      {/* Thermal zones */}
      {effects.thermal && t >= impactTime && thermalZones.map((zone, i) =>
        zone.radius && zone.radius > 0 ? (
          <EnhancedDamageDisk
            key={`thermal-${i}`}
            position={impactPos}
            color={zone.color}
            borderColor={zone.borderColor}
            kmRadius={zone.radius}
            label={effects.labels ? zone.label : undefined}
            opacity={zone.opacity}
            expansionFactor={damageExpansionCurve(zone.delay)}
            priority={zone.priority}
            type="thermal"
            index={i}
          />
        ) : null
      )}

      {/* Overpressure zones */}
      {effects.overpressure && t >= impactTime && pressureZones.map((zone, i) =>
        zone.radius && zone.radius > 0 ? (
          <EnhancedDamageDisk
            key={`pressure-${i}`}
            position={impactPos}
            color={zone.color}
            borderColor={zone.borderColor}
            kmRadius={zone.radius}
            label={effects.labels ? zone.label : undefined}
            opacity={zone.opacity}
            expansionFactor={damageExpansionCurve(zone.delay)}
            priority={zone.priority}
            type="pressure"
            index={i}
          />
        ) : null
      )}

      {/* Impact label (DOM via Html overlay; uses CSS vars) */}
      {effects.labels && (
        <Html position={impactPos.clone().multiplyScalar(1.05)} center>
          <div className="impact-label" style={{ ['--label-color' as any]: '#ffff00' }}>
            <div className="impact-icon">⚡</div>
            <div className="impact-title">IMPACT POINT</div>
            <div className="impact-energy">{damage.E_Mt.toFixed(2)} MT TNT Equivalent</div>
          </div>
        </Html>
      )}
    </group>
  );
}

function latLonToVec3(lat: number, lon: number, R: number): THREE.Vector3 {
  const la = THREE.MathUtils.degToRad(lat);
  const lo = THREE.MathUtils.degToRad(lon);
  return new THREE.Vector3(
    R * Math.cos(la) * Math.cos(lo),
    R * Math.sin(la),
    R * Math.cos(la) * Math.sin(lo)
  );
}

export function ringRotation(surfacePoint: THREE.Vector3) {
  const normal = surfacePoint.clone().normalize();
  const tmp = Math.abs(normal.x) > 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(tmp, normal).normalize();
  const binormal = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  const m = new THREE.Matrix4().makeBasis(tangent, binormal, normal);
  return new THREE.Euler().setFromRotationMatrix(m);
}

function EnhancedDamageDisk({
  position,
  kmRadius,
  color,
  borderColor,
  label,
  opacity = 0.15,
  expansionFactor = 1,
  priority = 1,
  type,
  index,
}: {
  position: THREE.Vector3;
  kmRadius: number;
  color: string;
  borderColor: string;
  label?: string;
  opacity?: number;
  expansionFactor?: number;
  priority?: number;
  type: string;
  index: number;
}) {
  const currentRadius = surfacemToChordUnits(kmRadius) * expansionFactor;
  if (currentRadius < 0.001) return null;

  const inner = Math.max(currentRadius - 0.006, 0);
  const labelAngle = (type === 'thermal' ? 45 : 135) + (index * 30);
  const labelRadius = Math.max(currentRadius * 0.7, 0.02);
  const labelX = Math.cos(THREE.MathUtils.degToRad(labelAngle)) * labelRadius;
  const labelY = Math.sin(THREE.MathUtils.degToRad(labelAngle)) * labelRadius;

  return (
    <group position={position.clone().multiplyScalar(1.02 + (priority || 1) * 0.003)} rotation={ringRotation(position)}>
      {/* Fill */}
      <mesh>
        <ringGeometry args={[0, currentRadius, 64, 1]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * (expansionFactor || 1)} side={THREE.DoubleSide} />
      </mesh>

      {/* Border */}
      <mesh>
        <ringGeometry args={[inner, currentRadius, 64, 1]} />
        <meshBasicMaterial
          color={borderColor}
          transparent
          opacity={0.8 * (expansionFactor || 1)}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer glow */}
      <mesh>
        <ringGeometry args={[currentRadius, currentRadius + 0.003, 32, 1]} />
        <meshBasicMaterial
          color={borderColor}
          transparent
          opacity={0.4 * (expansionFactor || 1)}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* DOM label (Html overlay) */}
      {label && (expansionFactor || 0) > 0.3 && (
        <Html position={[labelX, labelY, 0.025]} center>
          <div className="damage-zone-label" style={{ ['--zone-color' as any]: borderColor }}>
            <div className="zone-type">{type.toUpperCase()}</div>
            <div className="zone-name">{label}</div>
            <div className="zone-radius">{(kmRadius / 1000).toFixed(1)} km</div>
          </div>
        </Html>
      )}
    </group>
  );
}

useGLTF.preload('/meteors/psyche.glb');
