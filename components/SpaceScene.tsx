'use client';

// components/SpaceScene.tsx
import React, { useRef, Suspense, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars, Text } from "@react-three/drei";
import * as THREE from "three";

import { OrbitControls as OrbitControlsImpl } from "three-stdlib"; // add this import

import Earth from "@/components/Earth";
import Asteroid from "@/components/Asteroid";
import Sun from "@/components/Sun";
import KineticImpactor from "@/components/KineticImpactor";
import LaserDefense from "@/components/LaserDefense";
import NuclearDetonation from "@/components/NuclearDetonation";
import GravityTractor from "@/components/GravityTractor";
import AsteroidAnalyzer from "@/components/AsteroidAnalyzer";
import IonBeamShepherd from "@/components/ionBeamShepherd";

// === Types ===
// IMPORTANT: Keep this in sync with ai/page.tsx EFFECTS_CONFIG keys
type EffectKey =
  | "kineticImpactor"
  | "nuclearDetonation"
  | "gravityTractor"
  | "laserAblation"
  | "ionBeamShepherd"
  | "analyze";

type SpaceSceneProps = {
  effects: Record<EffectKey, boolean>;
  followingAsteroid: boolean;
  asteroidClicked: boolean;
  onAsteroidClick: () => void;
  onAnalysisComplete?: () => void;
};

// === Stationary Asteroid (with deflection offset) ===
const StationaryAsteroid = React.forwardRef<
  THREE.Group,
  {
    onAsteroidClick: () => void;
    showLabel: boolean;
    isVisible: boolean;
    offset: THREE.Vector3;
  }
>(function StationaryAsteroid({ onAsteroidClick, showLabel, isVisible, offset }, ref) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame(() => {
    if (!groupRef.current) return;

    // Fixed position relative to Earth with offset for deflections
    const basePosition = new THREE.Vector3(50, 0, 0); // Stationary position
    
    // Apply persistent deflection offset
    groupRef.current.position.copy(basePosition.clone().add(offset));
    groupRef.current.scale.setScalar(0.4);
    groupRef.current.visible = isVisible;

    // Spin asteroid in place
    groupRef.current.rotation.x += 0.01;
    groupRef.current.rotation.y += 0.005;

    
  });

  React.useImperativeHandle(ref, () => groupRef.current);

  if (!isVisible) return null;

  return (
    <group ref={groupRef}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onAsteroidClick();
        }}
        onPointerOver={() => (document.body.style.cursor = "pointer")}
        onPointerOut={() => (document.body.style.cursor = "default")}
      >
        <Asteroid
          orbitRadius={6}
          orbitSpeed={0.2}
          earthPosition={[50, 0, 0]}
        />
      </mesh>
      {showLabel && (
        <Text
          position={[0, 3, 0]}
          fontSize={1}
          color="white"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="black"
        >
          Impactor-2025
        </Text>
      )}
    </group>
  );
});

// === Camera Follow Asteroid ===
const CameraFollowAsteroid: React.FC<{
  asteroidRef: React.RefObject<THREE.Group | null>;
  isFollowing: boolean;
}> = ({ asteroidRef, isFollowing }) => {
  const { camera } = useThree();

  useFrame(() => {
    if (!isFollowing || !asteroidRef.current) return;

    const asteroidPosition = new THREE.Vector3();
    asteroidRef.current.getWorldPosition(asteroidPosition);

    const offset = new THREE.Vector3(8, 5, 8);
    const targetPosition = asteroidPosition.clone().add(offset);

    camera.position.lerp(targetPosition, 0.05);
    camera.lookAt(asteroidPosition);
  });

  return null;
};

// === Scene Content ===
const SceneContent: React.FC<{
  effects: Record<EffectKey, boolean>;
  followingAsteroid: boolean;
  asteroidClicked: boolean;
  onAsteroidClick: () => void;
}> = ({ effects, followingAsteroid, asteroidClicked, onAsteroidClick }) => {
  const { camera } = useThree();                  // <- you'll need this for clamping
  const controlsRef = useRef<OrbitControlsImpl>(null); // <- new
  const MAX_ZOOM_OUT = 150;      

  const earthRef = useRef<THREE.Object3D>(null);
  const asteroidRef = useRef<THREE.Group | null>(null);
  const sunRef = useRef<THREE.Group>(null);

  const [asteroidVisible, setAsteroidVisible] = useState(true);
  const [currentAsteroidPosition, setCurrentAsteroidPosition] = useState(new THREE.Vector3(50, 0, 0)); // Match asteroid position

  // Persistent offset (e.g. laser nudges, gravity tractor effects)
  const [deflectionOffset, setDeflectionOffset] = useState(new THREE.Vector3());

  // Nuclear detonation state
  const [nuclearActive, setNuclearActive] = useState(false);
  const [nuclearPosition, setNuclearPosition] = useState<[number, number, number]>([0, 0, 0]);

  // Gravity tractor state
  const [gravityTractorActive, setGravityTractorActive] = useState(false);

  // Ion beam shepherd state
  const [ionBeamActive, setIonBeamActive] = useState(false);

  // Analysis state
  const [analysisActive, setAnalysisActive] = useState(false);

  // Kinetic impactor state
  const [kineticImpactorActive, setKineticImpactorActive] = useState(false);

  useFrame(() => {
    if (asteroidRef.current) {
      const newPos = new THREE.Vector3();
      asteroidRef.current.getWorldPosition(newPos);
      setCurrentAsteroidPosition(newPos);
    }

    // Sun orbit
    if (sunRef.current) {
      const time = Date.now() * 0.000001;
      const sunOrbitRadius = 700;
      const sunX = Math.cos(time) * sunOrbitRadius;
      const sunZ = Math.sin(time) * sunOrbitRadius;
      const sunY = Math.sin(time * 0.1) * 20;
      sunRef.current.position.set(sunX, sunY, sunZ);
    }
  });

  // Handle kinetic impactor
  React.useEffect(() => {
    if (effects.kineticImpactor && !kineticImpactorActive && asteroidVisible) {
      console.log('Activating kinetic impactor');
      setKineticImpactorActive(true);
    } else if (!effects.kineticImpactor && kineticImpactorActive) {
      console.log('Deactivating kinetic impactor');
      setKineticImpactorActive(false);
      setDeflectionOffset(new THREE.Vector3()); // Reset any deflections
    }
  }, [effects.kineticImpactor, kineticImpactorActive, asteroidVisible]);

  // Handle kinetic impact completion
  const handleKineticImpactComplete = useCallback(() => {
    console.log('Kinetic impact complete - hiding asteroid temporarily');
    setKineticImpactorActive(false);
    setAsteroidVisible(false);
    setTimeout(() => {
      setDeflectionOffset(new THREE.Vector3());
      setAsteroidVisible(true);
    }, 3000);
  }, []);

  // Handle nuclear detonation
  React.useEffect(() => {
    if (effects.nuclearDetonation && !nuclearActive && asteroidVisible) {
      setNuclearPosition([
        currentAsteroidPosition.x,
        currentAsteroidPosition.y,
        currentAsteroidPosition.z
      ]);
      setNuclearActive(true);
    } else if (!effects.nuclearDetonation && nuclearActive) {
      setNuclearActive(false);
      setDeflectionOffset(new THREE.Vector3());
    }
  }, [effects.nuclearDetonation, nuclearActive, asteroidVisible, currentAsteroidPosition]);

  // Handle gravity tractor
  React.useEffect(() => {
    if (effects.gravityTractor && asteroidVisible) {
      if (!gravityTractorActive) {
        setGravityTractorActive(true);
      }
    } else {
      // turn it off & reset when effect clears
      if (gravityTractorActive) {
        setGravityTractorActive(false);
        setDeflectionOffset(new THREE.Vector3());
      }
    }
  }, [effects.gravityTractor, gravityTractorActive, asteroidVisible]);

  // Handle ion beam shepherd
  React.useEffect(() => {
    if (effects.ionBeamShepherd && !ionBeamActive && asteroidVisible) {
      setIonBeamActive(true);
    } else if (!effects.ionBeamShepherd && ionBeamActive) {
      // turn it off & reset
      setIonBeamActive(false);
      setDeflectionOffset(new THREE.Vector3()); // reset asteroid offset
    }
  }, [effects.ionBeamShepherd, ionBeamActive, asteroidVisible]);

  // Handle analysis
  React.useEffect(() => {
    if (effects.analyze && !analysisActive) {
      setAnalysisActive(true);
    } else if (!effects.analyze && analysisActive) {
      setAnalysisActive(false);
    }
  }, [effects.analyze, analysisActive]);

  const handleNuclearComplete = useCallback(() => {
    setNuclearActive(false);
    setTimeout(() => {
      setDeflectionOffset(new THREE.Vector3());
    }, 2000);
  }, []);

  const handleNuclearDestroy = useCallback(() => {
    setAsteroidVisible(false);
    setTimeout(() => {
      setAsteroidVisible(true);
      setDeflectionOffset(new THREE.Vector3());
    }, 5000);
  }, []);

  const handleGravityTractorComplete = useCallback(() => {
    setGravityTractorActive(false);
    setTimeout(() => {
      setDeflectionOffset(new THREE.Vector3());
    }, 2000);
  }, []);

  const handleIonBeamComplete = useCallback(() => {
    setIonBeamActive(false);
    setTimeout(() => {
      setDeflectionOffset(new THREE.Vector3());
    }, 2000);
  }, []);

  const handleAnalysisComplete = useCallback(() => {
    setAnalysisActive(false);
  }, []);

  const handleEarthDoubleClick = useCallback(() => {
    console.log("Earth double-clicked");
  }, []);

  return (
    <>
      <Stars count={15000} fade speed={0.1} radius={200} depth={100} />

      <OrbitControls
        ref={controlsRef}
        enablePan={false}
        enableZoom={true}
        enabled={!followingAsteroid}
        maxDistance={MAX_ZOOM_OUT}   // <- cap zoom-out in normal mode
        minDistance={5}
      />

      {/* Ambient light for better visibility */}
      <ambientLight intensity={0.3} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Earth */}
      <group scale={[30, 30, 30]} ref={earthRef}>
        <Earth onDoubleClick={handleEarthDoubleClick} />
      </group>

      {/* Asteroid */}
      <StationaryAsteroid
        ref={asteroidRef}
        onAsteroidClick={onAsteroidClick}
        showLabel={asteroidClicked}
        isVisible={asteroidVisible}
        offset={deflectionOffset}
      />

      {/* Sun */}
      <group ref={sunRef} position={[500, 0, 0]}>
        <Sun targetRef={earthRef as React.RefObject<THREE.Object3D>} />
      </group>

      {/* Effects */}
      {asteroidVisible && (
        <KineticImpactor
          isActive={kineticImpactorActive}
          asteroidPosition={currentAsteroidPosition}
          onComplete={handleKineticImpactComplete}
        />
      )}

      {asteroidVisible && (
        <LaserDefense
          isActive={effects.laserAblation}
          asteroidPosition={currentAsteroidPosition}
          onComplete={handleKineticImpactComplete}
          onDeflect={(delta) => setDeflectionOffset((prev) => prev.clone().add(delta))}
        />
      )}

      <NuclearDetonation
        position={nuclearPosition}
        isActive={nuclearActive}
        onComplete={handleNuclearComplete}
        onDestroy={handleNuclearDestroy}
      />

      {asteroidVisible && (
        <GravityTractor
          asteroidPosition={currentAsteroidPosition}
          isActive={gravityTractorActive}
          onComplete={handleGravityTractorComplete}
          onDeflect={(delta) => setDeflectionOffset((prev) => prev.clone().add(delta))}
        />
      )}

      {asteroidVisible && (
        <IonBeamShepherd
          asteroidPosition={currentAsteroidPosition}
          isActive={ionBeamActive}
          asteroidRadius={2.0}
          deflectionStrength={0.08}
          onDeflect={(delta) => setDeflectionOffset(prev => prev.clone().add(delta))}
          onComplete={handleIonBeamComplete}
        />
      )}

      <CameraFollowAsteroid asteroidRef={asteroidRef} isFollowing={followingAsteroid} />
    </>
  );
};

// === Main SpaceScene ===
const SpaceScene: React.FC<SpaceSceneProps> = ({
  effects,
  followingAsteroid,
  asteroidClicked,
  onAsteroidClick,
  onAnalysisComplete,
}) => {
  return (
    <>
      <Canvas camera={{ position: [100, 20, 30], fov: 50 }}>
        <Suspense fallback={null}>
          <SceneContent
            effects={effects}
            followingAsteroid={followingAsteroid}
            asteroidClicked={asteroidClicked}
            onAsteroidClick={onAsteroidClick}
          />
        </Suspense>
      </Canvas>

      {/* ✅ Only Analyzer overlay here */}
      <AsteroidAnalyzer
        isActive={effects.analyze}
        asteroidPosition={new THREE.Vector3(50, 0, 0)} // replace with live position if needed
        onComplete={onAnalysisComplete ?? (() => console.log("Analysis complete"))}
      />
    </>
  );
};

export default SpaceScene;