'use client';
import * as THREE from 'three';

import React, { useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html, Stars } from '@react-three/drei';
import EarthImpact from './EarthImpact';
import ImpactEffects from './ImpactEffects';
import styles from './MeteorImpactPage.module.css';
import { Damage_Inputs, Damage_Results, computeImpactEffects } from './DamageValues';

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

const defaultDamage: Damage_Results = {
  E_J: 0,
  E_Mt: 0,
  Tre_years: 0,
  m_kg: 0,
  zb_breakup: 0,
  airburst: false,
  v_impact_for_crater: 0,
  Rf_m: null,
  r_clothing_m: 0,
  r_2nd_burn_m: 0,
  r_3rd_burn_m: 0,
  Dtc_m: null,
  dtc_m: null,
  Dfr_m: null,
  dfr_m: null,
  Vtc_km3: null,
  Vtc_over_Ve: null,
  earth_effect: 'negligible_disturbed',
  M: null,
  radius_M_ge_7_5_m: null,
  airblast_radius_building_collapse_m: null,
  airblast_radius_glass_shatter_m: null,
  airblast_peak_overpressure: null,
  deathCount: 0,
  injuryCount: 0
};

const IMPACT_TIME = 0.40;

const formatAsteroidName = (id: string): string =>
  (id || 'Demo Meteor').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function MeteorImpactPage({ meteor }: { meteor: Meteor }) {
  const [impactLat, setImpactLat] = useState(44.60);
  const [impactLon, setImpactLon] = useState(79.47);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [damage, setDamage] = useState<Damage_Results>(defaultDamage);


  const [effects, setEffects] = useState<EffectsState>({
    fireball: true,
    sonicWave: true,
    shockwave: true,
    thermal: true,
    overpressure: true,
    ejecta: true,
    labels: false,
  });

  const inputs: Damage_Inputs = {
    mass: meteor.mass,
    L0: meteor.diameter,
    rho_i: meteor.density,
    v0: meteor.speed,
    theta_deg: meteor.angle,
    latitude: impactLat,
    longitude: impactLon,
  };

  const typedName = formatAsteroidName(meteor.name);
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await computeImpactEffects(inputs);
      if (!cancelled) setDamage(result);
    })();

    return () => { cancelled = true; }; // cleanup if inputs change or component unmounts
  }, [inputs]);

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
  }, [playing]);

  useEffect(() => {
    if (t >= 1) setPlaying(false);
  }, [t]);

  const handleToggle = (key: keyof EffectsState) =>
    setEffects((prev) => ({ ...prev, [key]: !prev[key] }));

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
      </div>

      {/* RIGHT HUD */}
      <div className={styles.hud}>
        <ImpactEffects effects={damage} impactLat={impactLat} impactLon={impactLon} name={meteor.name} />
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
        {/* faint atmospheric shell */}
        <mesh>
          <sphereGeometry args={[1.02, 64, 64]} />
          <meshBasicMaterial color="#4abaff" transparent opacity={0.05} side={THREE.BackSide} />
        </mesh>

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
