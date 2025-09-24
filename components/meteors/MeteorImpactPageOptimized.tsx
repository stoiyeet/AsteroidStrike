'use client';
import * as THREE from 'three';

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import EarthImpact from './EarthImpact';
import ImpactEffects from './ImpactEffects';
import styles from './MeteorImpactPage.module.css';
import { Damage_Inputs, computeImpactEffects, estimateAsteroidDeaths } from './DamageValuesOptimized';

// NEW: styles outside Canvas
import ImpactStyles from './styles/ImpactStyles';
import { LayoutIcon } from 'lucide-react';

type Meteor = {
  name: string;
  mass: number;
  diameter: number;
  speed: number;
  angle: number;
  density: number;
};

type EffectsState = {
  fireball: boolean;
  sonicWave: boolean;
  shockwave: boolean;
  thermal: boolean;
  overpressure: boolean;
  ejecta: boolean;
  labels: boolean;
};

const IMPACT_TIME = 0.40;

const formatAsteroidName = (id: string): string =>
  (id || 'Demo Meteor').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function MeteorImpactPageOptimized({ meteor }: { meteor: Meteor }) {
  const [impactLat, setImpactLat] = useState(44.60);
  const [impactLon, setImpactLon] = useState(79.47);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [mortality, setMortality] = useState<{deathCount: number; injuryCount: number} | null>(null);
  const [mortalityLoading, setMortalityLoading] = useState(false);

  // Add AbortController ref for cancelling requests
  const abortControllerRef = useRef<AbortController | null>(null);

  const [effects, setEffects] = useState<EffectsState>({
    fireball: true,
    sonicWave: true,
    shockwave: true,
    thermal: true,
    overpressure: true,
    ejecta: true,
    labels: false,
  });

  const inputs: Damage_Inputs = useMemo(() => ({
    mass: meteor.mass,
    L0: meteor.diameter,
    rho_i: meteor.density,
    v0: meteor.speed,
    theta_deg: meteor.angle,
    latitude: impactLat,
    longitude: impactLon,
  }), [meteor.mass, meteor.diameter, meteor.density, meteor.speed, meteor.angle, impactLat, impactLon]);

  const typedName = formatAsteroidName(meteor.name);
  const damage = useMemo(() => computeImpactEffects(inputs), [inputs]);

  // Debounced mortality calculation with AbortController
  const calculateMortality = useCallback(async (
    lat: number, 
    lon: number, 
    damageData: ReturnType<typeof computeImpactEffects>
  ) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Early return for global catastrophes - no API call needed
    if (damageData.earth_effect === "destroyed" || damageData.earth_effect === "strongly_disturbed") {
      setMortality({ deathCount: 8_250_000_000, injuryCount: 0 });
      setMortalityLoading(false);
      return;
    }

    // Create new AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setMortalityLoading(true);

    try {
      const result = await estimateAsteroidDeaths(
        lat, 
        lon, 
        damageData.r_clothing_m, 
        damageData.Dtc_m || 0, 
        damageData.r_2nd_burn_m, 
        damageData.earth_effect, 
        damageData.radius_M_ge_7_5_m || 0,
        meteor.diameter,
        damage.airburst,
        damage.zb_breakup,
        controller.signal
      );
      
      if (!controller.signal.aborted) {
        setMortality(result);
        setMortalityLoading(false);
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.warn('Mortality calculation failed:', error);
        setMortality(null);
        setMortalityLoading(false);
      }
    }
  }, []);

  // Debounced effect for mortality calculation
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateMortality(impactLat, impactLon, damage);
    }, 500); // 500ms debounce

    return () => {
      clearTimeout(timeoutId);
    };
  }, [impactLat, impactLon, damage, calculateMortality]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const toggles: ReadonlyArray<[keyof EffectsState, string]> = [
    ['fireball', 'Fireball Flash'],
    ['sonicWave', 'Sonic Wave'],
    ['shockwave', 'Surface Shockwave'],
    ['thermal', 'Thermal Damage Zone'],
    ['overpressure', 'Overpressure Zone'],
    ['ejecta', 'Ejecta & Crater'],
    ['labels', 'Effect Labels'],
  ];

  const getTimelineStatus = () => {
    if (t < IMPACT_TIME) return 'Approaching';
    if (t < IMPACT_TIME + 0.1) return 'Impact!';
    if (t < IMPACT_TIME + 0.3) return 'Shockwave';
    return 'Aftermath';
  };

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      setT((prev) => {
        let meteorSpeed = 1;
        if (prev <= IMPACT_TIME) {
          meteorSpeed = meteor.speed/11000;
        }
        const next = prev + 0.001*meteorSpeed;
        return next > 1 ? 1 : next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, meteor.speed]);

  useEffect(() => {
    if (t >= 1) setPlaying(false);
  }, [t]);

  const handleToggle = useCallback((key: keyof EffectsState) =>
    setEffects((prev) => ({ ...prev, [key]: !prev[key] })), []);

  // Memoize the mortality data to prevent unnecessary re-renders
  const mortalityData = useMemo(() => {
    if (mortalityLoading) {
      return { deathCount: undefined, injuryCount: undefined };
    }
    return mortality;
  }, [mortality, mortalityLoading]);

  return (
    <div className={styles.container}>
      {/* Mount styles in DOM (NOT inside Canvas) */}
      <ImpactStyles />

      {/* LEFT CONTROL PANEL */}
      <div className={styles.panel}>
        <h3 className={styles.title}>Impact Controls</h3>
        <p className={styles.description}>
          Double-click the Earth to set impact location. Use timeline controls to navigate the sequence.
        </p>

        <div className={styles.toggleGroup}>
          <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, color: '#88ccff' }}>
            VISUAL EFFECTS
          </div>
          {toggles.map(([key, label]) => (
            <label key={key} className={styles.toggleLabel}>
              <input
                type="checkbox"
                checked={effects[key]}
                onChange={() => handleToggle(key)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button
            onClick={() => setPlaying((p) => !p)}
            className={`${styles.button} ${playing ? styles.playPause : styles.play}`}
          >
            {playing ? '⏸ Pause' : '▶ Play'}
          </button>
          <button
            onClick={() => { setT(0); setPlaying(true); }}
            className={`${styles.button} ${styles.restart}`}
          >
            ↻ Restart
          </button>
        </div>

        <div className={styles.statusBox}>
          <div className={styles.statusTitle}>STATUS: {getTimelineStatus()}</div>
          <div className={styles.statusText}>Timeline: {(t * 100).toFixed(1)}%</div>
        </div>

        {/* Add loading indicator for mortality calculation */}
        {mortalityLoading && (
          <div className={styles.statusBox} style={{ marginTop: 10 }}>
            <div className={styles.statusTitle}>🔄 Calculating casualties...</div>
            <div className={styles.statusText}>Fetching population data</div>
          </div>
        )}
      </div>

      {/* RIGHT HUD */}
      <div className={styles.hud}>
        <ImpactEffects 
          effects={damage} 
          mortality={mortalityData} 
          impactLat={impactLat} 
          impactLon={impactLon} 
          name={meteor.name} 
        />
      </div>

      {/* 3D CANVAS */}
      <Canvas
        shadows
        camera={{ fov: 50, position: [0, 1.8, 3.5] }}
        style={{ background: 'radial-gradient(circle, #001122 0%, #000408 100%)' }}
      >
        <ambientLight intensity={0.9} />
        <directionalLight
          position={[8, 10, 6]}
          intensity={2.2}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-far={20}
          shadow-camera-left={-5}
          shadow-camera-right={5}
          shadow-camera-top={5}
          shadow-camera-bottom={-5}
        />

        <pointLight position={[-8, -3, -8]} intensity={0.3} color="#4488ff" />
        <Stars radius={120} depth={60} count={8000} factor={3} fade speed={0.2} />

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          minDistance={1.6}
          maxDistance={8}
          maxPolarAngle={Math.PI}
        />

        <React.Suspense
          fallback={
            <Html center style={{ color: '#fff', textAlign: 'center' }}>
              <div>Loading 3D Models...</div>
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Please wait while asteroid models load
              </div>
            </Html>
          }
        >
          <EarthImpact
            meteor={meteor}
            damage={damage}
            impact={{ lat: impactLat, lon: impactLon }}
            t={t}
            onImpactSelect={(la, lo) => { setImpactLat(la); setImpactLon(lo); }}
            effects={effects}
            impactTime={IMPACT_TIME}
          />
        </React.Suspense>
      </Canvas>

      {/* TIMELINE BAR */}
      <div className={styles.bottomBar}>
        <div className={styles.barInner}>
          <button
            onClick={() => setPlaying((p) => !p)}
            className={`${styles.button} ${playing ? styles.playPause : styles.play}`}
          >
            {playing ? '⏸' : '▶'}
          </button>

          <div className={styles.timelineControls}>
            <span className={styles.timelineLabel}>0%</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={t}
              onChange={(e) => setT(parseFloat(e.target.value))}
              className={styles.timelineInput}
            />
            <span className={styles.timelineEndLabel}>100%</span>
          </div>

          <button
            onClick={() => { setT(0); setPlaying(true); }}
            className={`${styles.button} ${styles.restart}`}
          >
            ↻
          </button>

          <div className={styles.timelineStatus}>{getTimelineStatus()}</div>
        </div>
      </div>
    </div>
  );
}
