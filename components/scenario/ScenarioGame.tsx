'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import SpaceScene from '@/components/SpaceScene';
import { useRouter } from 'next/navigation';
import asteroidInfo from '@/data/asteroidInfo.json';
import { computeImpactEffects, type Damage_Inputs } from '@/components/meteors/DamageValuesOptimized';

type EffectKey =
  | 'kineticImpactor'
  | 'nuclearDetonation'
  | 'gravityTractor'
  | 'laserAblation'
  | 'ionBeamShepherd'
  | 'analyze';

type EffectsState = Record<EffectKey, boolean>;

type ScenarioMeteor = {
  name: string;
  diameterM: number;
  massKg: number;
  speedMps: number;
  angleDeg: number;
  densityKgM3: number;
};

type Outcome = 'pending' | 'averted' | 'impact' | 'wasted';

function makeEmptyEffects(): EffectsState {
  return {
    kineticImpactor: false,
    nuclearDetonation: false,
    gravityTractor: false,
    laserAblation: false,
    ionBeamShepherd: false,
    analyze: false,
  };
}

// Physical constants and couplings
const G0 = 6.67430e-11;                 // m^3 kg^-1 s^-2
const R_EARTH_M = 6_371_000;            // m
const R_EARTH_KM = R_EARTH_M / 1000;    // km
const V_ESC_EARTH = 11_186;             // m/s
const LASER_CM_N_PER_W = 3e-5;          // momentum coupling N/W (laser ablation, order-of-magnitude)
const ION_THRUST_N_PER_KW = 5e-3;       // N per kW (ion beam shepherd, order-of-magnitude)
const GEOM_FACTOR = 0.7;                // projection to b-plane effectiveness
const AU_M = 1.496e11;                  // meters per AU
const MU_SUN = 1.327e20;                // m^3/s^2 (gravitational parameter of Sun)
const SECONDS_PER_DAY = 86400;

function erfApprox(x: number): number {
  // Abramowitz–Stegun approximation
  const sign = x < 0 ? -1 : 1;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * Math.abs(x));
  const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normalCdf(x: number, mu = 0, sigma = 1): number {
  const z = (x - mu) / (sigma * Math.SQRT2);
  return 0.5 * (1 + erfApprox(z));
}

function massFromDiameterAndDensity(diameterM: number, rhoKgM3: number): number {
  const r = diameterM / 2;
  const volume = (4 / 3) * Math.PI * r * r * r;
  return volume * rhoKgM3;
}

// Orbital mechanics functions
function meanAnomalyFromTime(t_days: number, a_au: number): number {
  const a_m = a_au * AU_M;
  const n = Math.sqrt(MU_SUN / (a_m * a_m * a_m)); // mean motion rad/s
  return n * t_days * SECONDS_PER_DAY; // radians
}

function eccentricAnomalyFromMean(M: number, e: number, tolerance = 1e-8): number {
  // Newton-Raphson iteration to solve Kepler's equation: M = E - e*sin(E)
  let E = M; // initial guess
  for (let i = 0; i < 20; i++) {
    const f = E - e * Math.sin(E) - M;
    const fp = 1 - e * Math.cos(E);
    const deltaE = -f / fp;
    E += deltaE;
    if (Math.abs(deltaE) < tolerance) break;
  }
  return E;
}

function trueAnomalyFromEccentric(E: number, e: number): number {
  const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
  const sinNu = Math.sqrt(1 - e * e) * Math.sin(E) / (1 - e * Math.cos(E));
  return Math.atan2(sinNu, cosNu);
}

function orbitalRadiusFromTrueAnomaly(nu: number, a_au: number, e: number): number {
  const a_m = a_au * AU_M;
  return a_m * (1 - e * e) / (1 + e * Math.cos(nu));
}

function orbitalVelocityFromRadius(r_m: number, a_au: number): number {
  const a_m = a_au * AU_M;
  return Math.sqrt(MU_SUN * (2 / r_m - 1 / a_m));
}

type TrajectoryState = {
  distance_au: number;
  distance_km: number;
  velocity_mps: number;
  trueAnomaly_deg: number;
  timeToEncounter_days: number;
  encounterVelocity_mps: number;
};

function computeTrajectoryState(scenario: Scenario, elapsedDays: number): TrajectoryState {
  const totalTime = scenario.initialTimeRemainingDays;
  const timeFromStart = elapsedDays;
  const timeToEncounter = totalTime - timeFromStart;
  
  // Current mean anomaly (time runs backwards toward encounter)
  const M0 = meanAnomalyFromTime(-totalTime, scenario.semiMajorAxis_au);
  const M_current = M0 + meanAnomalyFromTime(timeFromStart, scenario.semiMajorAxis_au);
  
  // Solve for current position
  const E = eccentricAnomalyFromMean(M_current, scenario.eccentricity);
  const nu = trueAnomalyFromEccentric(E, scenario.eccentricity);
  const r_m = orbitalRadiusFromRadius(nu, scenario.semiMajorAxis_au, scenario.eccentricity);
  const v_mps = orbitalVelocityFromRadius(r_m, scenario.semiMajorAxis_au);
  
  // At encounter, compute hyperbolic excess velocity
  const encounterV = Math.sqrt(scenario.vInfMps * scenario.vInfMps + V_ESC_EARTH * V_ESC_EARTH);
  
  return {
    distance_au: r_m / AU_M,
    distance_km: r_m / 1000,
    velocity_mps: v_mps,
    trueAnomaly_deg: (nu * 180) / Math.PI,
    timeToEncounter_days: Math.max(0, timeToEncounter),
    encounterVelocity_mps: encounterV,
  };
}

function orbitalRadiusFromRadius(nu: number, a_au: number, e: number): number {
  const a_m = a_au * AU_M;
  return a_m * (1 - e * e) / (1 + e * Math.cos(nu));
}

type Scenario = {
  meteor: ScenarioMeteor;
  initialTimeRemainingDays: number;
  vInfMps: number;
  b0_km: number;             // nominal impact parameter (signed)
  sigma_b_km: number;        // 1-sigma miss uncertainty at B-plane
  keyholeCenter_km: number;  // center of a resonant keyhole corridor
  keyholeWidth_m: number;    // width of that corridor (meters)
  // Orbital elements for trajectory
  semiMajorAxis_au: number;  // a in AU
  eccentricity: number;      // e
  inclination_deg: number;   // i in degrees
  longitude_deg: number;     // longitude of ascending node
  periapsis_deg: number;     // argument of periapsis
  trueAnomaly0_deg: number;  // true anomaly at t=0
};

function randomIn(min: number, max: number): number { return min + Math.random() * (max - min); }
function randomChoice<T>(arr: ReadonlyArray<T>): T { return arr[Math.floor(Math.random() * arr.length)]; }

function generateScenario(): Scenario {
  // Draw a plausible NEO scenario
  const diamM = randomIn(120, 900);                 // 120 m – 900 m
  const rho = randomIn(1800, 3500);                 // 1.8–3.5 g/cc
  const mass = massFromDiameterAndDensity(diamM, rho);
  const vInf = randomIn(5000, 30000);               // 5–30 km/s at infinity
  const speedAtEncounter = Math.sqrt(vInf * vInf + V_ESC_EARTH * V_ESC_EARTH);
  const angle = randomIn(25, 80);                   // entry angle from horizontal
  const tDays = Math.round(randomIn(180, 1800));    // 6 months – 5 years

  // Nominal B-plane impact parameter (pick close to Earth)
  const sigma_km = randomIn(500, 5000);             // wide early covariance
  const b0 = randomIn(-2_000, 2_000);               // near miss by a few thousand km

  // Pick a resonance keyhole corridor (e.g. 7:6 / 13:12 etc.)
  const keyholeCenters = [-18_000, -12_000, -7_500, 7_000, 11_000, 17_000];
  const keyholeCenter = randomChoice(keyholeCenters) + randomIn(-500, 500);
  const keyholeWidth = randomIn(200, 1200);         // meters

  // Generate orbital elements for realistic trajectory
  const semiMajorAxis = randomIn(1.1, 3.5);        // AU, typical NEO range
  const eccentricity = randomIn(0.1, 0.8);         // moderately eccentric
  const inclination = randomIn(0, 25);             // degrees, most NEOs low-inc
  const longitude = randomIn(0, 360);              // degrees
  const periapsis = randomIn(0, 360);              // degrees
  const trueAnomaly0 = randomIn(0, 360);           // degrees

  const meteor: ScenarioMeteor = {
    name: 'custom_stone',
    diameterM: diamM,
    massKg: mass,
    speedMps: speedAtEncounter, // relative at encounter
    angleDeg: angle,
    densityKgM3: rho,
  };

  return {
    meteor,
    initialTimeRemainingDays: tDays,
    vInfMps: vInf,
    b0_km: b0,
    sigma_b_km: sigma_km,
    keyholeCenter_km: keyholeCenter,
    keyholeWidth_m: keyholeWidth,
    semiMajorAxis_au: semiMajorAxis,
    eccentricity: eccentricity,
    inclination_deg: inclination,
    longitude_deg: longitude,
    periapsis_deg: periapsis,
    trueAnomaly0_deg: trueAnomaly0,
  };
}

function parseWeightToNumber(weight: string | undefined): number | 0 {
  if (!weight) return 0;
  const str = weight.split(/\s+/)[0].toLowerCase().replace('~', '');
  if (str.includes('×10^')) {
    const [base, exp] = str.split('×10^');
    return Number(base) * Math.pow(10, Number(exp));
  }
  if (str.includes('*10^')) {
    const [base, exp] = str.split('*10^');
    return Number(base) * Math.pow(10, Number(exp));
  }
  if (str.includes('e')) return Number(str);
  const n = Number(str);
  return Number.isFinite(n) ? n : 0;
}

function parseSizeKmToMeters(size: string | undefined): number | 0 {
  if (!size) return 0;
  const token = size.split(/\s|×|x/gi)[0].replace('~', '');
  const n = Number(token);
  return Number.isFinite(n) ? n * 1000 : 0;
}

function getDensityKgM3(material: string | undefined, provided?: string): number {
  if (provided && !provided.toLowerCase().includes('unknown')) {
    const v = Number(provided.split(/\s+/)[0].replace('~', ''));
    if (Number.isFinite(v)) return v * 1000;
  }
  const map: Record<string, number> = {
    metallic: 5300,
    'm-type': 5300,
    iron: 7800,
    stone: 3000,
    's-type': 2700,
    's/q-type': 2700,
    'sq-type': 2700,
    'q-type': 2600,
    basaltic: 3000,
    'c-type': 1900,
    carbonaceous: 1900,
    'd-type': 2200,
    'p-type': 2600,
    ice: 900,
    cometary: 600,
  };
  if (!material) return 2700;
  const norm = material.toLowerCase();
  if (map[norm]) return map[norm];
  for (const k of Object.keys(map)) if (norm.includes(k)) return map[k];
  return 2700;
}

function formatNumber(n: number, digits = 1) {
  return n.toLocaleString('en-US', { maximumFractionDigits: digits });
}

export default function ScenarioGame() {
  const router = useRouter();

  // Scenario state
  const [mounted, setMounted] = useState(false);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const meteor = scenario?.meteor as ScenarioMeteor | undefined;

  // Game state
  const [effects, setEffects] = useState<EffectsState>(makeEmptyEffects());
  const [followingAsteroid, setFollowingAsteroid] = useState(false);
  const [asteroidClicked, setAsteroidClicked] = useState(false);
  const [analyzerActive, setAnalyzerActive] = useState(false);

  const [elapsedDays, setElapsedDays] = useState(0); // elapsed time since start
  const [budgetBn, setBudgetBn] = useState(0);
  const [deltaVApplied, setDeltaVApplied] = useState(0); // m/s
  const [deflectionMeters, setDeflectionMeters] = useState(0); // integrated b-plane miss distance from applied actions
  const [outcome, setOutcome] = useState<Outcome>('pending');
  const [stage, setStage] = useState(0);
  const [notes, setNotes] = useState<string>('');
  const [impactProbability, setImpactProbability] = useState(0.35);
  const [trueWillImpact, setTrueWillImpact] = useState<boolean>(false);
  const [analysisCompleted, setAnalysisCompleted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true); // auto-advance time

  // Technique configuration (user-tunable)
  const [gtMassTon, setGtMassTon] = useState(2.0);        // spacecraft mass (t)
  const [gtStandoffM, setGtStandoffM] = useState(200);    // m
  const [laserPowerMW, setLaserPowerMW] = useState(1.5);  // MW
  const [ionPowerKW, setIonPowerKW] = useState(50);       // kW
  const [impactorMassKg, setImpactorMassKg] = useState(500);
  const [impactorSpeedKmps, setImpactorSpeedKmps] = useState(10);
  const [betaEnhancement, setBetaEnhancement] = useState(3);
  const [nukeYieldMt, setNukeYieldMt] = useState(1.0);
  const [nukeStandoffKm, setNukeStandoffKm] = useState(10);
  const [geomFactor, setGeomFactor] = useState(GEOM_FACTOR);

  // Derived focusing capture radius (impact cross section)
  const bCrit_km = useMemo(() => {
    if (!scenario) return R_EARTH_KM * Math.sqrt(1 + (V_ESC_EARTH * V_ESC_EARTH) / (12_000 * 12_000));
    const vInf = scenario.vInfMps;
    const factor = Math.sqrt(1 + (V_ESC_EARTH * V_ESC_EARTH) / (vInf * vInf));
    return R_EARTH_KM * factor;
  }, [scenario]);

  // Update impact probability from B-plane Gaussian
  const recalcImpactProbability = useCallback((b0_km: number, sigma_km: number, bcrit_km: number) => {
    const p = normalCdf(bcrit_km, b0_km, sigma_km) - normalCdf(-bcrit_km, b0_km, sigma_km);
    setImpactProbability(Math.max(0, Math.min(1, p)));
  }, []);

  useEffect(() => {
    if (scenario) recalcImpactProbability(scenario.b0_km, scenario.sigma_b_km, bCrit_km);
  }, [scenario, bCrit_km, recalcImpactProbability]);

  // Current trajectory state (computed from orbital mechanics)
  const trajectoryState = useMemo(() => {
    if (!scenario) return null;
    return computeTrajectoryState(scenario, elapsedDays);
  }, [scenario, elapsedDays]);

  // Generate non-deterministic scenario client-side only to avoid SSR hydration mismatch
  useEffect(() => {
    setMounted(true);
    if (!scenario) {
      const s = generateScenario();
      setScenario(s);
    }
    setTrueWillImpact(Math.random() < 0.6);
  }, []);

  // Auto-advance time when playing
  useEffect(() => {
    if (!isPlaying || !trajectoryState) return;
    const interval = setInterval(() => {
      setElapsedDays(prev => {
        const next = prev + 0.5; // advance by 0.5 days per tick
        if (trajectoryState.timeToEncounter_days <= 0) {
          setIsPlaying(false); // stop when encounter reached
        }
        return next;
      });
    }, 100); // 100ms intervals for smooth animation
    return () => clearInterval(interval);
  }, [isPlaying, trajectoryState]);

  // Physics-based required delta-v approximation
  const deltaVRequired = useMemo(() => {
    if (!trajectoryState) return 0;
    const safety = 1.2;
    const t = Math.max(trajectoryState.timeToEncounter_days, 1) * SECONDS_PER_DAY; // s
    return (R_EARTH_M * safety) / t; // m/s
  }, [trajectoryState]);

  // Distance-based decision triggers
  const currentPhase = useMemo(() => {
    if (!trajectoryState) return 'loading';
    const distAu = trajectoryState.distance_au;
    if (distAu > 2.0) return 'early_detection';      // > 2 AU: early detection
    if (distAu > 1.0) return 'mission_planning';     // 1-2 AU: mission planning
    if (distAu > 0.1) return 'deployment';           // 0.1-1 AU: deployment phase
    if (distAu > 0.01) return 'last_chance';         // 0.01-0.1 AU: last chance
    return 'encounter';                              // < 0.01 AU: encounter
  }, [trajectoryState]);

  // Compute headline effects for educational sidebar
  const damage = useMemo(() => {
    if (!meteor) {
      return computeImpactEffects({
        mass: 1e10,
        L0: 300,
        rho_i: 2500,
        v0: 15000,
        theta_deg: 45,
        latitude: 44.6,
        longitude: 79.47,
      });
    }
    const inputs: Damage_Inputs = {
      mass: meteor.massKg,
      L0: meteor.diameterM,
      rho_i: meteor.densityKgM3,
      v0: meteor.speedMps,
      theta_deg: meteor.angleDeg,
      latitude: 44.6,
      longitude: 79.47,
    };
    return computeImpactEffects(inputs);
  }, [meteor]);

  // Continuous technique accelerations (m/s^2)
  const accelGravityTractor = useMemo(() => {
    const m_sc = gtMassTon * 1000;
    const r = Math.max(gtStandoffM, 10);
    return G0 * m_sc / (r * r);
  }, [gtMassTon, gtStandoffM]);

  const accelLaser = useMemo(() => {
    const P = laserPowerMW * 1e6;
    const F = LASER_CM_N_PER_W * P;
    return F / Math.max(meteor?.massKg || 1, 1);
  }, [laserPowerMW, meteor?.massKg]);

  const accelIon = useMemo(() => {
    const F = ION_THRUST_N_PER_KW * ionPowerKW;
    return F / Math.max(meteor?.massKg || 1, 1);
  }, [ionPowerKW, meteor?.massKg]);

  const applyTimeAdvance = useCallback((days: number) => {
    if (!trajectoryState) return;
    const dt = Math.max(days, 0) * SECONDS_PER_DAY;
    const T = Math.max(trajectoryState.timeToEncounter_days, 0) * SECONDS_PER_DAY; // lead time at start of interval

    // Sum active accelerations
    let aTotal = 0;
    if (effects.gravityTractor) aTotal += accelGravityTractor;
    if (effects.laserAblation) aTotal += accelLaser;
    if (effects.ionBeamShepherd) aTotal += accelIon;

    // Δv accumulation
    const dV = aTotal * dt;
    if (dV > 0) {
      setDeltaVApplied((v) => v + dV);
      // Integrated miss distance on b-plane (projected)
      const dMiss = geomFactor * aTotal * (T * dt - 0.5 * dt * dt);
      setDeflectionMeters((m) => m + dMiss);
    }
    setElapsedDays((t) => t + days);
  }, [accelGravityTractor, accelIon, accelLaser, effects.gravityTractor, effects.ionBeamShepherd, effects.laserAblation, geomFactor, trajectoryState]);

  const applyImpulse = useCallback((tech: 'kineticImpactor' | 'nuclearDetonation') => {
    let dV = 0;
    if (tech === 'kineticImpactor') {
      const mImp = Math.max(impactorMassKg, 1);
      const vImp = Math.max(impactorSpeedKmps, 1) * 1000;
      dV = (betaEnhancement * mImp * vImp) / Math.max(meteor?.massKg || 1, 1);
    } else {
      // Cube-root scaling with yield, reduced by standoff range factor
      const rangeFactor = 1 / (1 + nukeStandoffKm / 10);
      dV = 0.25 * Math.cbrt(Math.max(nukeYieldMt, 0.01)) * rangeFactor; // m/s
    }
    if (dV > 0) {
      setDeltaVApplied((v) => v + dV);
      const T = Math.max(trajectoryState?.timeToEncounter_days || 0, 0) * SECONDS_PER_DAY;
      const dMiss = geomFactor * dV * T;
      setDeflectionMeters((m) => m + dMiss);
    }
  }, [betaEnhancement, impactorMassKg, impactorSpeedKmps, meteor?.massKg, nukeStandoffKm, nukeYieldMt, geomFactor, trajectoryState?.timeToEncounter_days]);

  const toggleEffect = useCallback((key: EffectKey, value: boolean) => {
    setEffects((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleDecision = useCallback((choiceId: string) => {
    // Stage-specific branching
    if (stage === 0) {
      if (choiceId === 'monitor') {
        setNotes('You chose to monitor. Uncertainty remains high.');
        applyTimeAdvance(30);
      } else if (choiceId === 'analyze') {
        setAnalyzerActive(true);
        toggleEffect('analyze', true);
        setBudgetBn((b) => b + 0.2);
        // Don't auto-close; wait for user to close the analyzer
        applyTimeAdvance(60);
        setNotes('Analyzing asteroid composition and trajectory...');
      } else if (choiceId === 'plan_mission') {
        setNotes('You funded mission design. This accelerates deployment timelines.');
        setBudgetBn((b) => b + 1.0);
        applyTimeAdvance(90);
      }
      setStage(1);
      return;
    }

    if (stage === 1) {
      if (choiceId === 'tractor') {
        toggleEffect('gravityTractor', true);
        setNotes('Gravity tractor deployed. Very gentle, needs long lead time.');
        setBudgetBn((b) => b + 1.2);
      } else if (choiceId === 'laser') {
        toggleEffect('laserAblation', true);
        setNotes('Laser ablation online. Slow but steady thrust.');
        setBudgetBn((b) => b + 2.4);
      } else if (choiceId === 'ion') {
        toggleEffect('ionBeamShepherd', true);
        setNotes('Ion beam shepherd fired up. Continuous gentle push.');
        setBudgetBn((b) => b + 1.8);
      } else if (choiceId === 'nothing1') {
        setNotes('You deferred action. Options will narrow as time passes.');
      }
      applyTimeAdvance(180);
      setStage(2);
      return;
    }

    if (stage === 2) {
      if (choiceId === 'kinetic') {
        toggleEffect('kineticImpactor', true);
        applyImpulse('kineticImpactor');
        setBudgetBn((b) => b + 1.5);
        setNotes('Kinetic impactor executed. Single strong nudge applied.');
      } else if (choiceId === 'nuclear') {
        toggleEffect('nuclearDetonation', true);
        applyImpulse('nuclearDetonation');
        setBudgetBn((b) => b + 5.0);
        setNotes('Nuclear standoff detonation executed. Significant momentum change.');
      } else if (choiceId === 'nothing2') {
        setNotes('No last-ditch action taken.');
      }
      applyTimeAdvance(170);
      setStage(3);
      return;
    }

    if (stage === 3) {
      // Final evaluation
      const bFinal_km = (scenario ? scenario.b0_km : 0) + (deflectionMeters / 1000);
      const inKeyhole = scenario ? Math.abs(bFinal_km - scenario.keyholeCenter_km) * 1000 < scenario.keyholeWidth_m / 2 : false;
      const willHit = Math.abs(bFinal_km) < bCrit_km;
      if (willHit) {
        setOutcome('impact');
        setNotes(`Predicted impact: |b|=${Math.abs(bFinal_km).toFixed(0)} km < b_crit=${bCrit_km.toFixed(0)} km.`);
      } else if (inKeyhole) {
        setOutcome('averted');
        setNotes(`Immediate miss (b=${bFinal_km.toFixed(0)} km), but you threaded a resonance keyhole (${scenario?.keyholeCenter_km.toFixed(0)}±${((scenario?.keyholeWidth_m||0)/1000).toFixed(1)} km). Future return risk increased.`);
      } else {
        // Miss. If real was a miss and you acted, it's wasted spending
        if (!trueWillImpact && (effects.gravityTractor || effects.laserAblation || effects.ionBeamShepherd || effects.kineticImpactor || effects.nuclearDetonation)) {
          setOutcome('wasted');
          setNotes('It was a miss regardless; mitigations were unnecessary (wasted funds).');
        } else {
          setOutcome('averted');
          setNotes(`Successful deflection: final b=${bFinal_km.toFixed(0)} km ≥ b_crit=${bCrit_km.toFixed(0)} km.`);
        }
      }
      setStage(4);
      return;
    }
  }, [applyImpulse, applyTimeAdvance, bCrit_km, deflectionMeters, effects.gravityTractor, effects.ionBeamShepherd, effects.kineticImpactor, effects.laserAblation, effects.nuclearDetonation, recalcImpactProbability, scenario, stage, toggleEffect, trueWillImpact]);

  useEffect(() => {
    if (outcome === 'impact') {
      // Route to the detailed impact viz using existing page
      const q = new URLSearchParams({
        mass: String(meteor?.massKg ?? 0),
        diameter: String(meteor?.diameterM ?? 0),
        speed: String(meteor?.speedMps ?? 0),
        name: meteor?.name ?? 'custom',
        angle: String(meteor?.angleDeg ?? 45),
        density: String(meteor?.densityKgM3 ?? 2500),
      });
      const to = `/meteors/impact?${q.toString()}`;
      // Give a short moment for the nuclear/kinetic visuals to show
      const id = setTimeout(() => router.push(to), 1200);
      return () => clearTimeout(id);
    }
  }, [outcome, meteor, router]);

  // Remove unused variables - we now use trajectoryState for all distance/time calculations

  const canContinue = stage <= 3;

  const resetToNewScenario = useCallback(() => {
    const s = generateScenario();
    setScenario(s);
    setElapsedDays(0);
    setBudgetBn(0);
    setDeltaVApplied(0);
    setDeflectionMeters(0);
    setOutcome('pending');
    setStage(0);
    setNotes('');
    setEffects(makeEmptyEffects());
    setIsPlaying(true);
    setAnalysisCompleted(false);
    setTrueWillImpact(Math.random() < 0.6);
  }, []);

  if (!mounted || !scenario || !meteor) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black text-white">
        Loading scenario…
      </div>
    );
  }

  return (
    <div className="fixed inset-0 grid grid-cols-5 gap-0">
      <div className="col-span-3 relative bg-black">
        <SpaceScene
          effects={effects}
          followingAsteroid={followingAsteroid}
          asteroidClicked={asteroidClicked}
          onAsteroidClick={() => {
            setAsteroidClicked(true);
            setFollowingAsteroid((v) => !v);
          }}
          onAnalysisComplete={() => {
            // Called when user closes the analyzer or clicks "Recommend Action"
            if (!analysisCompleted) {
              setAnalysisCompleted(true);
              setAnalyzerActive(false);
              toggleEffect('analyze', false);
              // Reduce covariance dramatically
              if (scenario) {
                const newSigma = Math.max(50, scenario.sigma_b_km * 0.15);
                setScenario((s) => (s ? { ...s, sigma_b_km: newSigma } : s));
                recalcImpactProbability(scenario.b0_km, newSigma, bCrit_km);
              }
              setNotes('Analysis complete. Trajectory refined.');
            }
          }}
        />

        {/* HUD */}
        <div className="absolute top-4 left-4 z-20 bg-black/70 border border-white/20 rounded-xl p-3">
          <div className="text-sm opacity-90">Choose-Your-Own-Adventure</div>
          <div className="font-bold">Incoming NEO Scenario</div>
        </div>

        {/* Analyzer UI is rendered within SpaceScene when effects.analyze is true */}

        {/* Timeline footer */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 flex items-center gap-4 text-xs">
          <button onClick={() => setIsPlaying(!isPlaying)} className="text-white hover:text-blue-300">
            {isPlaying ? '⏸' : '▶'}
          </button>
          <span>|</span>
          <span>Distance: {trajectoryState ? formatNumber(trajectoryState.distance_au, 3) : '...'} AU</span>
          <span>|</span>
          <span>Velocity: {trajectoryState ? formatNumber(trajectoryState.velocity_mps / 1000, 1) : '...'} km/s</span>
          <span>|</span>
          <span>Time to encounter: {trajectoryState ? Math.round(trajectoryState.timeToEncounter_days) : '...'} days</span>
          <span>|</span>
          <span>Phase: {currentPhase.replace('_', ' ')}</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="col-span-2 h-full overflow-y-auto bg-gradient-to-b from-gray-900 to-black border-l border-white/10 p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xl font-semibold">Policy Console</div>
          <button onClick={resetToNewScenario} className="text-xs bg-white/10 hover:bg-white/20 border border-white/15 rounded-md px-3 py-1">New Scenario</button>
        </div>
        <div className="text-sm text-gray-300 mb-4">You are the decision maker. Each choice advances time.</div>

        {/* Real-time trajectory parameters */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Current distance</div>
            <div className="text-lg font-bold">{trajectoryState ? formatNumber(trajectoryState.distance_au, 3) : '...'} AU</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Current velocity</div>
            <div className="text-lg font-bold">{trajectoryState ? formatNumber(trajectoryState.velocity_mps/1000, 1) : '...'} km/s</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">True anomaly</div>
            <div className="text-lg font-bold">{trajectoryState ? formatNumber(trajectoryState.trueAnomaly_deg, 1) : '...'}°</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Encounter velocity</div>
            <div className="text-lg font-bold">{trajectoryState ? formatNumber(trajectoryState.encounterVelocity_mps/1000, 1) : '...'} km/s</div>
          </div>
        </div>

        {/* B-plane parameters */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">b_crit (focusing)</div>
            <div className="text-lg font-bold">{bCrit_km.toFixed(0)} km</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Nominal b</div>
            <div className="text-lg font-bold">{scenario ? scenario.b0_km.toFixed(0) : '...'} km</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">σ_b (1σ)</div>
            <div className="text-lg font-bold">{scenario ? scenario.sigma_b_km.toFixed(0) : '...'} km</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">v∞ (hyperbolic excess)</div>
            <div className="text-lg font-bold">{scenario ? (scenario.vInfMps/1000).toFixed(1) : '...'} km/s</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Impact probability</div>
            <div className="text-lg font-bold">{Math.round(impactProbability * 100)}%</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Budget spent</div>
            <div className="text-lg font-bold">${budgetBn.toFixed(1)}B</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Δv required</div>
            <div className="text-lg font-bold">{deltaVRequired.toFixed(3)} m/s</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="text-gray-400">Δv applied</div>
            <div className={`text-lg font-bold ${deltaVApplied >= deltaVRequired ? 'text-green-400' : 'text-yellow-300'}`}>{deltaVApplied.toFixed(3)} m/s</div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10 col-span-2">
            <div className="text-gray-400">Integrated b-plane deflection</div>
            <div className="text-lg font-bold">{(deflectionMeters/1000).toFixed(0)} km</div>
          </div>
        </div>

        {/* Technique configuration */}
        <details className="mb-4 bg-white/5 rounded-lg border border-white/10">
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Technique Parameters</summary>
          <div className="p-3 grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-gray-400">Gravity Tractor mass (t)</div>
              <input type="range" min={0.5} max={10} step={0.1} value={gtMassTon} onChange={(e) => setGtMassTon(parseFloat(e.target.value))} className="w-full" />
              <div>{gtMassTon.toFixed(1)} t, standoff {gtStandoffM} m</div>
              <input type="range" min={50} max={1000} step={10} value={gtStandoffM} onChange={(e) => setGtStandoffM(parseFloat(e.target.value))} className="w-full" />
            </div>
            <div>
              <div className="text-gray-400">Laser Power (MW)</div>
              <input type="range" min={0.1} max={5} step={0.1} value={laserPowerMW} onChange={(e) => setLaserPowerMW(parseFloat(e.target.value))} className="w-full" />
              <div>{laserPowerMW.toFixed(1)} MW</div>
            </div>
            <div>
              <div className="text-gray-400">Ion Beam Power (kW)</div>
              <input type="range" min={10} max={200} step={5} value={ionPowerKW} onChange={(e) => setIonPowerKW(parseFloat(e.target.value))} className="w-full" />
              <div>{ionPowerKW.toFixed(0)} kW</div>
            </div>
            <div>
              <div className="text-gray-400">Impactor mass (kg), speed (km/s), β</div>
              <input type="range" min={200} max={3000} step={50} value={impactorMassKg} onChange={(e) => setImpactorMassKg(parseFloat(e.target.value))} className="w-full" />
              <div>{impactorMassKg.toFixed(0)} kg</div>
              <input type="range" min={5} max={20} step={0.5} value={impactorSpeedKmps} onChange={(e) => setImpactorSpeedKmps(parseFloat(e.target.value))} className="w-full" />
              <div>{impactorSpeedKmps.toFixed(1)} km/s</div>
              <input type="range" min={1} max={5} step={0.5} value={betaEnhancement} onChange={(e) => setBetaEnhancement(parseFloat(e.target.value))} className="w-full" />
              <div>β={betaEnhancement.toFixed(1)}</div>
            </div>
            <div>
              <div className="text-gray-400">Nuclear yield (Mt), standoff (km)</div>
              <input type="range" min={0.1} max={10} step={0.1} value={nukeYieldMt} onChange={(e) => setNukeYieldMt(parseFloat(e.target.value))} className="w-full" />
              <div>{nukeYieldMt.toFixed(1)} Mt</div>
              <input type="range" min={1} max={100} step={1} value={nukeStandoffKm} onChange={(e) => setNukeStandoffKm(parseFloat(e.target.value))} className="w-full" />
              <div>{nukeStandoffKm.toFixed(0)} km</div>
            </div>
            <div>
              <div className="text-gray-400">Geometry factor to b-plane</div>
              <input type="range" min={0.3} max={1.0} step={0.05} value={geomFactor} onChange={(e) => setGeomFactor(parseFloat(e.target.value))} className="w-full" />
              <div>{geomFactor.toFixed(2)}</div>
            </div>
          </div>
        </details>

        {/* Stage content */}
        <div className="mb-4">
          <div className="text-xs tracking-wide text-gray-400">Stage {stage + 1} of 4</div>
          <div className="text-lg font-semibold mb-2">
            {stage === 0 && 'Initial Detection (~18 months)'}
            {stage === 1 && 'Plan Early Mitigation (~12 months)'}
            {stage === 2 && 'Last-Ditch Options (~6 months)'}
            {stage === 3 && 'Final Decision (~days)'}
            {stage >= 4 && 'Outcome'}
          </div>

          {stage === 0 && (
            <div className="space-y-2">
              <button onClick={() => handleDecision('monitor')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                📡 Continue monitoring for a month (cheap, no mitigation)
              </button>
              <button onClick={() => handleDecision('analyze')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-blue-400/30">
                🔍 Fund precision tracking and composition analysis ($0.2B)
              </button>
              <button onClick={() => handleDecision('plan_mission')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-amber-400/30">
                🛠️ Approve mission design & procurement ($1.0B)
              </button>
            </div>
          )}

          {stage === 1 && (
            <div className="space-y-2">
              <button onClick={() => handleDecision('tractor')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                🛸 Deploy a Gravity Tractor now (slow tug, $1.2B)
              </button>
              <button onClick={() => handleDecision('laser')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                🔦 Activate Laser Ablation array (continuous thrust, $2.4B)
              </button>
              <button onClick={() => handleDecision('ion')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                ⚡ Start Ion Beam Shepherd (steady push, $1.8B)
              </button>
              <button onClick={() => handleDecision('nothing1')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-rose-400/30">
                ⏳ Take no action yet
              </button>
            </div>
          )}

          {stage === 2 && (
            <div className="space-y-2">
              <button onClick={() => handleDecision('kinetic')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                🚀 Execute a Kinetic Impactor (impulsive nudge, $1.5B)
              </button>
              <button onClick={() => handleDecision('nuclear')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-white/10">
                ☢️ Perform Nuclear Standoff (large impulse, $5.0B)
              </button>
              <button onClick={() => handleDecision('nothing2')} className="w-full text-left bg-white/5 hover:bg-white/10 rounded-lg p-3 border border-rose-400/30">
                🧘 Do nothing and hope for a miss
              </button>
            </div>
          )}

          {stage === 3 && (
            <div className="space-y-2">
              <div className="text-sm text-gray-300">Final review before closest approach.</div>
              <button onClick={() => handleDecision('finalize')} className="w-full text-left bg-blue-600 hover:bg-blue-700 rounded-lg p-3">
                Evaluate Outcome
              </button>
            </div>
          )}

          {stage >= 4 && (
            <div className="space-y-3">
              {outcome === 'averted' && (
                <div className="bg-green-600/20 border border-green-400/40 rounded-lg p-3">✅ Success: The asteroid misses Earth. Your Δv surpassed the requirement.</div>
              )}
              {outcome === 'impact' && (
                <div className="bg-red-600/20 border border-red-400/40 rounded-lg p-3">❌ Failure: Impact occurs. Redirecting to detailed impact visualization…</div>
              )}
              {outcome === 'wasted' && (
                <div className="bg-amber-600/20 border border-amber-400/40 rounded-lg p-3">ℹ️ No impact would have occurred. Funds were wasted.</div>
              )}
            </div>
          )}
        </div>

        {notes && (
          <div className="text-xs text-gray-300 mb-4">{notes}</div>
        )}

        {/* Educational facts */}
        <div className="mt-2 border-t border-white/10 pt-3 text-sm">
          <div className="font-semibold mb-2">Asteroid Facts ({meteor.name.replace('_', ' ')})</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-gray-400">Diameter</div>
              <div className="font-semibold">{formatNumber(meteor.diameterM)} m</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-gray-400">Mass</div>
              <div className="font-semibold">{(meteor.massKg).toExponential(2)} kg</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-gray-400">Speed</div>
              <div className="font-semibold">{formatNumber(meteor.speedMps/1000, 1)} km/s</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3 border border-white/10">
              <div className="text-gray-400">Energy</div>
              <div className="font-semibold">{(damage.E_Mt).toFixed(2)} MT TNT</div>
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-2">Required miss distance on the B-plane is set by gravitational focusing: b_crit = R⊕√(1+(v_esc/v∞)^2). Small Δv applied early integrates as Δb ≈ ∫ Δv(t)·(t_enc−t) dt.</div>
        </div>

        {canContinue && stage !== 3 && (
          <button onClick={() => setStage((s) => s + 1)} className="mt-4 w-full bg-white/10 hover:bg-white/20 rounded-lg p-3 text-sm border border-white/10">
            Next Step
          </button>
        )}
      </div>
    </div>
  );
}


