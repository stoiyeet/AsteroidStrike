'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Asteroid } from './types';
import { generateAsteroid, getTorinoScale, getPalermoScale } from './gameUtils';
import EarthVisualization from './components/EarthVisualization';
import 'katex/dist/katex.min.css';

import { BlockMath, InlineMath } from 'react-katex';

type GamePhase = 'onboarding' | 'briefing' | 'selection' | 'result';

type MitigationMethod = 'kinetic' | 'nuclear' | 'gravity_tractor' | 'laser' | 'ion_beam';

interface ScenarioResult {
  success: boolean;
  successProbability: number;
  costEfficient: boolean;
  feedback: string[];
  details: {
    deflectionDifficulty: 'easy' | 'moderate' | 'difficult' | 'extreme';
    recommendedMethod: MitigationMethod;
    recommendedTimeframe: number;
    actualCost: number;
    optimalCost: number;
    requiredDeltaVms: number;
    deliveredDeltaVms: number;
    recommendedRequiredDeltaVms: number;
    recommendedDeliveredDeltaVms: number;
    recommendedSuccessProbability: number;
    travelTimeYears?: number;
    deflectionWindowYears?: number;
    cruiseDistanceKm?: number;
    alongTrackSeparationKm?: number;
    cruiseDistanceAU?: number;
    alongTrackSeparationAU?: number;
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatMass(kg: number): string {
  if (kg >= 1e12) return `${(kg / 1e12).toFixed(2)} trillion kg`;
  if (kg >= 1e9) return `${(kg / 1e9).toFixed(2)} billion kg`;
  if (kg >= 1e6) return `${(kg / 1e6).toFixed(2)} million kg`;
  if (kg >= 1e3) return `${(kg / 1e3).toFixed(2)} thousand kg`;
  return `${kg.toLocaleString()} kg`;
}

function assessDeflectionDifficulty(asteroid: Asteroid, yearsUntilImpact: number): 'easy' | 'moderate' | 'difficult' | 'extreme' {
  const massScore = asteroid.massKg / 1e12; // Normalize by trillion kg
  const velocityScore = asteroid.velocityKmps / 70; // Normalize by max velocity
  const timeScore = Math.max(0, 1 - (yearsUntilImpact / 25)); // Less time = harder

  const difficultyScore = (massScore * 0.4) + (velocityScore * 0.3) + (timeScore * 0.3);

  if (difficultyScore < 0.3) return 'easy';
  if (difficultyScore < 0.6) return 'moderate';
  if (difficultyScore < 0.8) return 'difficult';
  return 'extreme';
}

// --- Physics helpers (educational approximations)
const EARTH_RADIUS_M = 6371e3;
const AU_KM = 149597870.7; // Astronomical Unit in kilometers

function requiredDeltaVAlongTrack(yearsUntilImpact: number, safetyRadii: number = 2.5): number {
  // Educational approximation: need along-track displacement ~ safetyRadii * R_E over time t
  const tSeconds = Math.max(1, yearsUntilImpact) * 365.25 * 24 * 3600;
  const missDistanceMeters = safetyRadii * EARTH_RADIUS_M;
  return missDistanceMeters / tSeconds; // m/s
}

// Method parameter types
type KineticParams = { impactorMassKg: number; impactVelocityKmps: number; ejectaBeta: number };
type NuclearParams = { yieldMt: number; coupling: number; exhaustVelocityKms: number };
type GravityTractorParams = { spacecraftMassKg: number; standoffDistanceM: number; dutyCycle: number; operationYearsFraction: number };
type IonBeamParams = { thrustN: number; operationYearsFraction: number };
type LaserParams = { thrustN: number; operationYearsFraction: number };

function getRecommendedParams(
  method: MitigationMethod,
  difficulty: 'easy' | 'moderate' | 'difficult' | 'extreme'
): KineticParams | NuclearParams | GravityTractorParams | IonBeamParams | LaserParams {
  if (method === 'kinetic') {
    // DART-like to heavy impactor
    return { impactorMassKg: difficulty === 'extreme' ? 3000 : 2000, impactVelocityKmps: 10, ejectaBeta: difficulty === 'extreme' ? 5 : 4 } as KineticParams;
  }
  if (method === 'nuclear') {
    // Aggressive but educational values
    return { yieldMt: difficulty === 'extreme' ? 40 : 10, coupling: difficulty === 'extreme' ? 0.02 : 0.01, exhaustVelocityKms: 3.0 } as NuclearParams;
  }
  if (method === 'gravity_tractor') {
    return { spacecraftMassKg: difficulty === 'extreme' ? 8000 : 5000, standoffDistanceM: 50, dutyCycle: 0.8, operationYearsFraction: 0.9 } as GravityTractorParams;
  }
  if (method === 'ion_beam') {
    return { thrustN: difficulty === 'extreme' ? 1.0 : 0.8, operationYearsFraction: 0.9 } as IonBeamParams;
  }
  // laser
  return { thrustN: difficulty === 'extreme' ? 0.3 : 0.2, operationYearsFraction: 0.9 } as LaserParams;
}

function findSuggestedTimeframe(
  method: MitigationMethod,
  asteroid: Asteroid,
  safetyRadii: number
): number | null {
  for (let years = 1; years <= 25; years += 1) {
    const diffY = assessDeflectionDifficulty(asteroid, years);
    const params = getRecommendedParams(method, diffY);
    const delivered = computeDeliveredDeltaV(method, asteroid, years, params);
    const required = requiredDeltaVAlongTrack(years, safetyRadii);
    if (delivered >= required) return years;
  }
  return null;
}

function findBufferedRecommendation(
  method: MitigationMethod,
  asteroid: Asteroid,
  safetyRadii: number,
  options?: { ratioMargin?: number; minProbability?: number; minYears?: number; maxYears?: number }
): number | null {
  const ratioMargin = options?.ratioMargin ?? 1.1;
  const minProbability = options?.minProbability ?? 0.6;
  const minYears = options?.minYears ?? 1;
  const maxYears = options?.maxYears ?? 25;

  for (let years = minYears; years <= maxYears; years += 1) {
    const diffY = assessDeflectionDifficulty(asteroid, years);
    const params = getRecommendedParams(method, diffY);
    const delivered = computeDeliveredDeltaV(method, asteroid, years, params);
    const required = requiredDeltaVAlongTrack(years, safetyRadii);
    const prob = calculateSuccessProbability(method, diffY, years, asteroid, delivered, required);
    if (delivered >= required * ratioMargin && prob >= minProbability) {
      return years;
    }
  }
  return null;
}

function findBestRecommendation(
  asteroid: Asteroid,
  safetyRadii: number,
  options?: { ratioMargin?: number; minProbability?: number; minYears?: number; maxYears?: number }
): { method: MitigationMethod; years: number; probability: number } | null {
  const methods: MitigationMethod[] = ['nuclear', 'kinetic', 'gravity_tractor', 'ion_beam', 'laser'];
  const ratioMargin = options?.ratioMargin ?? 1.1;
  const minProbability = options?.minProbability ?? 0.6;
  const minYears = options?.minYears ?? 1;
  const maxYears = options?.maxYears ?? 25;

  type Cand = { method: MitigationMethod; years: number; probability: number };
  const buffered: Cand[] = [];
  for (const m of methods) {
    const y = findBufferedRecommendation(m, asteroid, safetyRadii, { ratioMargin, minProbability, minYears, maxYears });
    if (y) {
      const diffY = assessDeflectionDifficulty(asteroid, y);
      const params = getRecommendedParams(m, diffY);
      const delivered = computeDeliveredDeltaV(m, asteroid, y, params);
      const required = requiredDeltaVAlongTrack(y, safetyRadii);
      const prob = calculateSuccessProbability(m, diffY, y, asteroid, delivered, required);
      buffered.push({ method: m, years: y, probability: prob });
    }
  }
  if (buffered.length > 0) {
    buffered.sort((a, b) => (a.years - b.years) || (b.probability - a.probability));
    return buffered[0];
  }

  const suggested: Cand[] = [];
  for (const m of methods) {
    const y = findSuggestedTimeframe(m, asteroid, safetyRadii);
    if (y) {
      const diffY = assessDeflectionDifficulty(asteroid, y);
      const params = getRecommendedParams(m, diffY);
      const delivered = computeDeliveredDeltaV(m, asteroid, y, params);
      const required = requiredDeltaVAlongTrack(y, safetyRadii);
      const prob = calculateSuccessProbability(m, diffY, y, asteroid, delivered, required);
      suggested.push({ method: m, years: y, probability: prob });
    }
  }
  if (suggested.length > 0) {
    suggested.sort((a, b) => (a.years - b.years) || (b.probability - a.probability));
    return suggested[0];
  }

  // Fallback: choose highest probability at maxYears
  let best: Cand | null = null;
  for (const m of methods) {
    const y = maxYears;
    const diffY = assessDeflectionDifficulty(asteroid, y);
    const params = getRecommendedParams(m, diffY);
    const delivered = computeDeliveredDeltaV(m, asteroid, y, params);
    const required = requiredDeltaVAlongTrack(y, safetyRadii);
    const prob = calculateSuccessProbability(m, diffY, y, asteroid, delivered, required);
    const cand: Cand = { method: m, years: y, probability: prob };
    if (!best || cand.probability > best.probability) best = cand;
  }
  return best;
}

function computeDeliveredDeltaV(
  method: MitigationMethod,
  asteroid: Asteroid,
  yearsUntilImpact: number,
  params: KineticParams | NuclearParams | GravityTractorParams | IonBeamParams | LaserParams
): number {
  const mass = asteroid.massKg; // kg
  const seconds = Math.max(0, yearsUntilImpact) * 365.25 * 24 * 3600;
  if (method === 'kinetic') {
    const p = (params as KineticParams);
    const impactVelocity = p.impactVelocityKmps * 1000; // m/s
    const momentum = p.impactorMassKg * impactVelocity; // kg*m/s
    const impulse = p.ejectaBeta * momentum; // kg*m/s
    return impulse / mass; // m/s
  }
  if (method === 'nuclear') {
    const p = (params as NuclearParams);
    const YJ = p.yieldMt * 4.184e15; // Joules
    const vExhaust = Math.max(100, p.exhaustVelocityKms * 1000); // m/s
    const coupling = Math.max(0, Math.min(1, p.coupling));
    // Educational model: Δv ≈ 2 k E / (v_e m_a)
    return (2 * coupling * YJ) / (vExhaust * mass);
  }
  if (method === 'gravity_tractor') {
    const p = (params as GravityTractorParams);
    const G = 6.674e-11;
    // Interpret standoffDistanceM as altitude above the asteroid surface.
    const r = Math.max(1, p.standoffDistanceM + asteroid.diameterM / 2); // meters
    const a = G * p.spacecraftMassKg / (r * r); // m/s^2
    const effectiveSeconds = seconds * Math.max(0, Math.min(1, p.operationYearsFraction)) * Math.max(0, Math.min(1, p.dutyCycle));
    return a * effectiveSeconds;
  }
  if (method === 'ion_beam') {
    const p = (params as IonBeamParams);
    const effectiveSeconds = seconds * Math.max(0, Math.min(1, p.operationYearsFraction));
    return (p.thrustN / mass) * effectiveSeconds;
  }
  if (method === 'laser') {
    const p = (params as LaserParams);
    const effectiveSeconds = seconds * Math.max(0, Math.min(1, p.operationYearsFraction));
    return (p.thrustN / mass) * effectiveSeconds;
  }
  return 0;
}

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function calculateSuccessProbability(
  method: MitigationMethod,
  difficulty: string,
  yearsUntilImpact: number,
  asteroid: Asteroid,
  deliveredDeltaVms: number,
  requiredDeltaVms: number
): number {
  // Core driver: ratio of delivered Δv to required Δv
  const ratio = requiredDeltaVms <= 0 ? 0 : deliveredDeltaVms / requiredDeltaVms;
  // Map ratio to probability via logistic centered at 1.0
  const base = logistic(5 * (ratio - 1));
  // Adjustments for operational complexity and difficulty
  let adjustment = 0;
  if (difficulty === 'extreme') adjustment -= 0.20;
  else if (difficulty === 'difficult') adjustment -= 0.10;
  if (method === 'gravity_tractor' && yearsUntilImpact < 10) adjustment -= 0.10;
  if (method === 'ion_beam' && yearsUntilImpact < 8) adjustment -= 0.08;
  if (method === 'kinetic' && yearsUntilImpact >= 5) adjustment += 0.05;
  if (method === 'nuclear' && (difficulty === 'extreme' || asteroid.size === 'large')) adjustment += 0.10;
  const p = Math.max(0.02, Math.min(0.98, base + adjustment));
  return p;
}

function getRecommendedMethod(difficulty: string, yearsUntilImpact: number, asteroidSize: string): MitigationMethod {
  if (yearsUntilImpact >= 10 && difficulty !== 'extreme') return 'gravity_tractor';
  if (yearsUntilImpact >= 5 && (difficulty === 'easy' || difficulty === 'moderate')) return 'kinetic';
  if (difficulty === 'extreme' || asteroidSize === 'large') return 'nuclear';
  if (yearsUntilImpact >= 3) return 'kinetic';
  return 'nuclear';
}

function getMethodCost(method: MitigationMethod): number {
  const costs = {
    kinetic: 2.0,
    nuclear: 5.0,
    gravity_tractor: 3.0,
    laser: 2.5,
    ion_beam: 3.5,
  };
  return costs[method];
}

// Deprecated RNG success in favor of deterministic probability shown to the user

function getMethodExplanation(method: MitigationMethod): string {
  const explanations = {
    kinetic: 'Kinetic impactors work best with early detection and moderate-sized asteroids. The DART mission successfully demonstrated this technique in 2022.',
    nuclear: 'Nuclear deflection is recommended for large asteroids or short-notice scenarios where maximum energy delivery is critical.',
    gravity_tractor: 'Gravity tractors require extended timeframes (10+ years) but offer precise, controllable deflection without fragmenting the asteroid.',
    laser: 'Laser ablation gradually vaporizes surface material, creating thrust over time. Best for early-detected, smaller asteroids.',
    ion_beam: 'Ion beam shepherds provide continuous low thrust, ideal for long-duration missions with substantial lead time.',
  };
  return explanations[method];
}

function getDifficultyExplanation(difficulty: string, asteroid: Asteroid): string {
  const mass = (asteroid.massKg / 1e12).toFixed(2);
  const velocity = asteroid.velocityKmps.toFixed(1);

  if (difficulty === 'easy') {
    return `Small asteroid (${mass} trillion kg) with manageable velocity (${velocity} km/s). Standard deflection methods highly effective.`;
  } else if (difficulty === 'moderate') {
    return `Medium-sized threat (${mass} trillion kg, ${velocity} km/s). Requires careful mission planning and adequate lead time.`;
  } else if (difficulty === 'difficult') {
    return `Challenging scenario (${mass} trillion kg, ${velocity} km/s). Advanced techniques and early intervention critical.`;
  } else {
    return `Extreme deflection challenge (${mass} trillion kg, ${velocity} km/s). Maximum response required - consider nuclear option.`;
  }
}

const METHOD_INFO = {
  kinetic: {
    name: 'Kinetic Impactor',
    description: 'High-speed spacecraft impacts the asteroid, transferring momentum to alter its trajectory.',
    realWorld: 'NASA\'s DART mission successfully demonstrated this in 2022',
    bestFor: 'Medium asteroids with 5+ years warning',
  },
  nuclear: {
    name: 'Nuclear Deflection',
    description: 'Nuclear detonation near the asteroid surface vaporizes material, creating thrust.',
    realWorld: 'Studied extensively but never tested in space',
    bestFor: 'Large asteroids or short-notice scenarios',
  },
  gravity_tractor: {
    name: 'Gravity Tractor',
    description: 'Spacecraft uses its gravitational pull to gradually tug the asteroid off course.',
    realWorld: 'Proposed by NASA, requires 10+ years lead time',
    bestFor: 'Small to medium asteroids with long warning',
  },
  laser: {
    name: 'Laser Ablation',
    description: 'Powerful lasers vaporize surface material, creating thrust via ablation.',
    realWorld: 'Theoretical concept under research',
    bestFor: 'Smaller asteroids with extended timeframes',
  },
  ion_beam: {
    name: 'Ion Beam Shepherd',
    description: 'Ion engine provides continuous low thrust to gradually alter trajectory.',
    realWorld: 'Based on proven ion propulsion technology',
    bestFor: 'Long-duration missions with 15+ years',
  },
};

const METHOD_BADGE: Record<MitigationMethod, string> = {
  kinetic: 'KI',
  nuclear: 'ND',
  gravity_tractor: 'GT',
  laser: 'LA',
  ion_beam: 'IB',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AsteroidDefensePage() {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<GamePhase>('onboarding');
  const [asteroid, setAsteroid] = useState<Asteroid | null>(null);
  const [selectedYears, setSelectedYears] = useState<number>(10);
  const [selectedMethod, setSelectedMethod] = useState<MitigationMethod | null>(null);
  const [result, setResult] = useState<ScenarioResult | null>(null);
  const [showRiskScales, setShowRiskScales] = useState<boolean>(false);
  const [showMath, setShowMath] = useState<boolean>(false);
  const [showTimeframeInfo, setShowTimeframeInfo] = useState<boolean>(false);
  const resultScrollRef = useRef<HTMLDivElement | null>(null);

  const [safetyRadii] = useState<number>(2.5);

  // Method parameter states (educational defaults)
  const [kineticParams, setKineticParams] = useState<KineticParams>({ impactorMassKg: 600, impactVelocityKmps: 6.6, ejectaBeta: 3.0 });
  const [nuclearParams, setNuclearParams] = useState<NuclearParams>({ yieldMt: 1.0, coupling: 0.005, exhaustVelocityKms: 3.0 });
  const [gravityParams, setGravityParams] = useState<GravityTractorParams>({ spacecraftMassKg: 2000, standoffDistanceM: 50, dutyCycle: 0.7, operationYearsFraction: 0.7 });
  const [ionParams, setIonParams] = useState<IonBeamParams>({ thrustN: 0.2, operationYearsFraction: 0.8 });
  const [laserParams, setLaserParams] = useState<LaserParams>({ thrustN: 0.05, operationYearsFraction: 0.8 });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Scroll to top when we enter the result phase
  useEffect(() => {
    if (phase === 'result') {
      const el = resultScrollRef.current;
      // Try on next frame to ensure layout is ready
      requestAnimationFrame(() => {
        if (el) {
          el.scrollTop = 0;
          try { el.scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { /* noop */ }
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
      // Fallback after a short delay
      setTimeout(() => {
        if (resultScrollRef.current) {
          resultScrollRef.current.scrollTop = 0;
        } else if (typeof window !== 'undefined') {
          window.scrollTo(0, 0);
        }
      }, 100);
    }
  }, [phase]);

  // Generate asteroid when entering briefing phase
  useEffect(() => {
    if (phase === 'briefing' && !asteroid) {
      const loadAsteroid = async () => {
        // Auto-refetch to avoid tiny/small objects so users always have interactive scenarios
        const now = new Date();
        let attempts = 0;
        const maxAttempts = 5;
        while (attempts < maxAttempts) {
          const candidate = await generateAsteroid(now);
          candidate.isDetected = true;
          if (candidate.size === 'medium' || candidate.size === 'large') {
            setAsteroid(candidate);
            return;
          }
          attempts += 1;
        }
        // Fallback: if all attempts were tiny/small, accept the last one to avoid infinite loop
        const fallback = await generateAsteroid(now);
        fallback.isDetected = true;
        setAsteroid(fallback);
      };
      loadAsteroid();
    }
  }, [phase, asteroid]);


  const handleSubmitPlan = () => {
    if (!asteroid || !selectedMethod) return;

    const difficulty = assessDeflectionDifficulty(asteroid, selectedYears);
    const best = findBestRecommendation(asteroid, safetyRadii);
    const recommendedMethod = best?.method ?? getRecommendedMethod(difficulty, selectedYears, asteroid.size);
    const recommendedTimeframe = best?.years ?? (difficulty === 'extreme' ? 1 : difficulty === 'difficult' ? 3 : difficulty === 'moderate' ? 10 : 15);

    const actualCost = getMethodCost(selectedMethod);
    const optimalCost = getMethodCost(recommendedMethod);
    const costEfficient = actualCost <= optimalCost * 1.2; // Within 20% of optimal

    // Determine method parameters to compute delivered Δv (m/s)
    const deliveredDeltaVms = computeDeliveredDeltaV(
      selectedMethod,
      asteroid,
      selectedYears,
      selectedMethod === 'kinetic' ? kineticParams
        : selectedMethod === 'nuclear' ? nuclearParams
          : selectedMethod === 'gravity_tractor' ? gravityParams
            : selectedMethod === 'ion_beam' ? ionParams
              : laserParams
    );

    // Required Δv using along-track miss distance model
    const requiredDeltaVms = requiredDeltaVAlongTrack(selectedYears, safetyRadii);

    // Deterministic success probability
    const successProbability = calculateSuccessProbability(
      selectedMethod,
      difficulty,
      selectedYears,
      asteroid,
      deliveredDeltaVms,
      requiredDeltaVms
    );

    const success = successProbability >= 0.5;

    // Calculate scientific metrics
    const kineticEnergy = 0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2); // Joules
    const energyMegatons = kineticEnergy / (4.184e15); // Convert to megatons TNT

    // Mission timeline calculations
    const travelTime = Math.min(selectedYears * 0.3, 2); // Max 2 years travel
    const interceptDistance = asteroid.velocityKmps * (selectedYears - travelTime) * 365.25 * 24 * 3600; // km (along-track separation to original encounter)
    const cruiseDistanceKm = asteroid.velocityKmps * travelTime * 365.25 * 24 * 3600; // km (approx along-track during cruise)
    const alongTrackSeparationKm = interceptDistance; // km
    const cruiseDistanceAU = cruiseDistanceKm / AU_KM;
    const alongTrackSeparationAU = alongTrackSeparationKm / AU_KM;
    const deflectionWindowYears = Math.max(0, selectedYears - travelTime);

    const feedback: string[] = [];

    // Success/failure feedback with scientific reasoning
    if (success) {
      feedback.push(`Mission Successful: The ${selectedMethod.replace('_', ' ')} approach delivered approximately ${(deliveredDeltaVms * 100).toFixed(3)} cm/s against a requirement of ${(requiredDeltaVms * 100).toFixed(3)} cm/s, moving the asteroid's closest approach point beyond a conservative miss distance. Intercept occurred ~${deflectionWindowYears.toFixed(1)} years before the potential encounter (along-track separation ≈ ${alongTrackSeparationAU.toFixed(2)} AU, ${(alongTrackSeparationKm / 1e6).toFixed(2)} million km).`);

      if (selectedMethod === 'kinetic') {
        const impactorMass = 500; // kg (DART-like)
        const momentum = impactorMass * 6.6 * 1000; // kg⋅m/s (6.6 km/s impact speed)
        feedback.push(`Kinetic impactor (${impactorMass} kg at 6.6 km/s) transferred ${(momentum / 1000).toFixed(0)} kN·s of momentum; ejecta momentum (beta ~3–5) multiplied the impulse. Comparable physics to DART (2022).`);
      } else if (selectedMethod === 'nuclear') {
        feedback.push(`Nuclear standoff detonation parameters (yield and coupling) produced ablative thrust with effective exhaust velocity ~3 km/s. This educational model estimates Δv from coupled energy and exhaust velocity.`);
      } else if (selectedMethod === 'gravity_tractor') {
        const G = 6.674e-11;
        const msc = gravityParams.spacecraftMassKg;
        const altitude = gravityParams.standoffDistanceM; // above surface
        const rCenter = Math.max(1, altitude + asteroid.diameterM / 2);
        const tractorForce = G * msc * asteroid.massKg / Math.pow(rCenter, 2);
        feedback.push(`Gravity tractor (${msc.toFixed(0)} kg at ${altitude.toFixed(0)} m above surface; center distance ${(rCenter).toFixed(0)} m) applied ${tractorForce.toExponential(2)} N over ${(selectedYears * Math.max(0, Math.min(1, gravityParams.operationYearsFraction)) * Math.max(0, Math.min(1, gravityParams.dutyCycle))).toFixed(1)} years effective, accumulating impulse gradually.`);
      }
    } else {
      if (deliveredDeltaVms < requiredDeltaVms) {
        feedback.push(`Mission Failed: Delivered Δv ${(deliveredDeltaVms * 100).toFixed(3)} cm/s fell short of the required ${(requiredDeltaVms * 100).toFixed(3)} cm/s to achieve a safe miss distance.`);
      } else {
        feedback.push(`Mission Failed: Although delivered Δv ${(deliveredDeltaVms * 100).toFixed(3)} cm/s met or exceeded the ${(requiredDeltaVms * 100).toFixed(3)} cm/s requirement, the estimated success probability was ${(successProbability * 100).toFixed(0)}% due to scenario difficulty and operational constraints.`);
      }

      // Specific failure reasons
      if (selectedYears < 5 && (selectedMethod === 'gravity_tractor' || selectedMethod === 'ion_beam')) {
        feedback.push(`Reason: Low-thrust methods typically need 10+ years to accumulate sufficient Δv. With only ${selectedYears} years, thrust levels (10^-4 to 10^-2 N) were insufficient to meet the momentum requirement.`);
      } else if (selectedMethod === 'kinetic' && asteroid.massKg > 5e12) {
        feedback.push(`Reason: Kinetic impactor momentum was insufficient for ${(asteroid.massKg / 1e12).toFixed(1)} trillion kg target. Mass ratio favored higher-impulse methods.`);
      } else if (selectedYears < 2) {
        feedback.push(`Reason: Insufficient warning time. At ${selectedYears} year(s), design and travel time (~${travelTime.toFixed(1)} years) left minimal deflection window. With <2 years warning, most methods have very low success probability.`);
      } else {
        const momentumNeeded = asteroid.massKg * requiredDeltaVms;
        if (deliveredDeltaVms < requiredDeltaVms) {
          feedback.push(`Deflection physics: For a ${asteroid.diameterM.toFixed(0)} m asteroid at ${asteroid.velocityKmps.toFixed(1)} km/s, required momentum change was ${momentumNeeded.toExponential(2)} kg·m/s. The method could not provide sufficient impulse.`);
        } else {
          feedback.push(`Deflection assessment: Required momentum change was ${momentumNeeded.toExponential(2)} kg·m/s. While the Δv threshold was met, modeled risk factors (e.g., short lead time, operational complexity, or high scenario difficulty) lowered success probability below 50%.`);
        }
      }
    }

    // Timing feedback with orbital mechanics
    const leadTimeDays = selectedYears * 365.25;
    feedback.push(`Lead Time: ${selectedYears} years (${leadTimeDays.toFixed(0)} days) until potential impact. Position uncertainty typically decreases ~sqrt(time); with ${selectedYears} years of tracking, uncertainty reduced to ±${asteroid.uncertaintyKm.toFixed(0)} km.`);

    // Method-specific technical feedback
    if (selectedMethod === recommendedMethod) {
      feedback.push(`Method selection matched scenario parameters: mass ${(asteroid.massKg / 1e12).toFixed(2)} × 10^12 kg, velocity ${asteroid.velocityKmps.toFixed(1)} km/s, and a ${selectedYears}-year timeline.`);
    } else {
      feedback.push(`Another method (${METHOD_INFO[recommendedMethod].name}) likely offered higher probability for this scenario. ${getMethodExplanation(recommendedMethod)}`);
    }

    // Impact energy context
    feedback.push(`Impact Energy: If undeflected, ${asteroid.name} would deliver ${energyMegatons.toFixed(2)} megatons TNT equivalent (1 MT = 4.184 × 10^15 J). For comparison: Tunguska ~5–15 MT, Chelyabinsk ~0.5 MT, Hiroshima ~0.015 MT. Torino Scale: ${getTorinoScale(asteroid)}/10.`);

    // Cost analysis
    if (costEfficient) {
      feedback.push(`Cost: $${actualCost.toFixed(1)}B, within 20% of optimal $${optimalCost.toFixed(1)}B. Balanced decision considering technical risk and budget.`);
    } else {
      feedback.push(`Cost: $${actualCost.toFixed(1)}B exceeded optimal ($${optimalCost.toFixed(1)}B) by ${((actualCost / optimalCost - 1) * 100).toFixed(0)}%. Reference: DART ~$0.33B; nuclear concept ~$2–5B; gravity tractor ~$1–3B over 10–15 years.`);
    }

    // Compute recommended method numbers to show explicitly
    const recParams = getRecommendedParams(recommendedMethod, difficulty);
    const recDelivered = computeDeliveredDeltaV(
      recommendedMethod,
      asteroid,
      recommendedTimeframe,
      recParams
    );
    const recRequired = requiredDeltaVAlongTrack(Math.max(recommendedTimeframe, 1), safetyRadii);
    const recProb = calculateSuccessProbability(
      recommendedMethod,
      difficulty,
      recommendedTimeframe,
      asteroid,
      recDelivered,
      recRequired
    );

    setResult({
      success,
      successProbability,
      costEfficient,
      feedback,
      details: {
        deflectionDifficulty: difficulty,
        recommendedMethod,
        recommendedTimeframe,
        actualCost,
        optimalCost,
        requiredDeltaVms: requiredDeltaVms,
        deliveredDeltaVms: deliveredDeltaVms,
        recommendedRequiredDeltaVms: recRequired,
        recommendedDeliveredDeltaVms: recDelivered,
        recommendedSuccessProbability: recProb,
        travelTimeYears: travelTime,
        deflectionWindowYears,
        cruiseDistanceKm,
        alongTrackSeparationKm,
        cruiseDistanceAU,
        alongTrackSeparationAU,
      },
    });

    setPhase('result');
  };

  const handleRestart = () => {
    setPhase('onboarding');
    setAsteroid(null);
    setSelectedYears(10);
    setSelectedMethod(null);
    setResult(null);
  };

  if (!mounted) {
    return null;
  }

  // Onboarding Screen
  if (phase === 'onboarding') {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-black text-white overflow-y-auto pt-24">
        <div className="min-h-screen flex flex-col p-6">
          <div className="max-w-3xl w-full mx-auto space-y-8 flex-1">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-blue-700 rounded-full flex items-center justify-center mx-auto">
                <div className="w-10 h-10 bg-white rounded-sm"></div>
              </div>
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                Planetary Defense Command
              </h1>
              <p className="text-xl text-slate-300">NASA Near-Earth Object Studies</p>
            </div>

            <div id="mission-briefing" className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-semibold text-blue-300">Mission Briefing</h2>

              <div className="space-y-4 text-slate-300 leading-relaxed">
                <p>
                  Welcome to the Planetary Defense Coordination Office. You have been appointed as the lead decision-maker
                  for a critical asteroid deflection scenario.
                </p>

                <p>
                  We have detected a Near-Earth Object (NEO) on a potential collision course with Earth. Your mission is to
                  assess the threat and select an appropriate mitigation strategy.
                </p>

                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-blue-200 mb-2">Your Responsibilities:</h3>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-start">
                      <span className="text-blue-400 mr-2">1.</span>
                      <span>Review the asteroid&apos;s physical characteristics and trajectory data</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-400 mr-2">2.</span>
                      <span>Select a timeframe for mission deployment (1-25 years)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-400 mr-2">3.</span>
                      <span>Choose the most effective deflection method</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-blue-400 mr-2">4.</span>
                      <span>Balance mission success probability with cost efficiency</span>
                    </li>
                  </ul>
                </div>

                <p className="text-sm text-slate-400">
                  This simulation uses real NASA data and scientifically accurate deflection techniques. Your decisions
                  will be evaluated based on mission success probability, cost-effectiveness, and adherence to best practices
                  in planetary defense.
                </p>
              </div>
            </div>
          </div>

          {/* Begin Mission Button at Bottom */}
          <div className="max-w-3xl w-full mx-auto mt-8 pb-32">
            <div className="flex justify-center">
              <button
                onClick={() => setPhase('briefing')}
                className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-4 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg text-lg"
              >
                Begin Mission
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Briefing Screen - Asteroid Information
  if (phase === 'briefing') {
    if (!asteroid) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <div className="text-xl">Loading asteroid data from NASA...</div>
          </div>
        </div>
      );
    }

    // Handle small asteroids with a special scenario (no deflection needed)
    if (asteroid.size === 'tiny' || asteroid.size === 'small') {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-6">
          <div className="max-w-3xl w-full space-y-6">
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <span className="text-4xl">✓</span>
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Low Threat Assessment
              </h1>
            </div>

            <div className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-8 space-y-6">
              <h2 className="text-2xl font-semibold text-green-300">Asteroid: {asteroid.name}</h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <div className="text-slate-400 text-sm mb-1">Size</div>
                  <div className="text-white font-bold capitalize">{asteroid.size}</div>
                  <div className="text-slate-300 text-sm">{asteroid.diameterM.toFixed(1)}m diameter</div>
                </div>
                <div className="bg-slate-700/50 p-4 rounded-lg">
                  <div className="text-slate-400 text-sm mb-1">Velocity</div>
                  <div className="text-white font-bold">{asteroid.velocityKmps.toFixed(1)} km/s</div>
                </div>
              </div>

              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold text-green-200">Assessment Summary</h3>
                <div className="text-slate-300 leading-relaxed space-y-3">
                  <p>
                    <strong className="text-green-300">Good news!</strong> This {asteroid.size} asteroid ({asteroid.diameterM.toFixed(0)}m diameter) does not require
                    expensive deflection missions. Objects of this size typically burn up in Earth&apos;s atmosphere or cause minimal localized damage.
                  </p>

                  {asteroid.size === 'small' ? (
                    <p>
                      <strong className="text-yellow-300">Recommended Actions:</strong>
                      <br />
                      • Issue public alert to affected region
                      <br />
                      • Evacuate immediate impact zone if trajectory is certain
                      <br />
                      • Expect airburst effects similar to the Chelyabinsk meteor (2013)
                    </p>
                  ) : (
                    <p>
                      <strong className="text-blue-300">No Action Required:</strong>
                      <br />
                      This object is too small to survive atmospheric entry intact. It will create a brief fireball but pose no threat to ground structures.
                    </p>
                  )}

                  <p className="text-sm text-slate-400">
                    <strong>Educational Note:</strong> NASA&apos;s planetary defense efforts focus on Near-Earth Objects (NEOs)
                    larger than 140 meters, which could cause regional or global damage. Smaller objects like this one,
                    while interesting to track, don&apos;t require the same level of intervention.
                  </p>
                </div>
              </div>

              {asteroid.educationalBlurb && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-xs text-blue-300 mb-2">NASA Database Information</div>
                  <div className="text-sm text-slate-300">{asteroid.educationalBlurb}</div>
                </div>
              )}

              <div className="flex gap-4">
                <button
                  onClick={handleRestart}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-4 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg"
                >
                  Try Another Scenario
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const torinoScale = getTorinoScale(asteroid);
    const palermo = getPalermoScale(asteroid);

    return (
      <div className="min-h-screen h-screen bg-slate-900 text-white flex flex-col overflow-hidden pt-20 md:pt-24">
        <header className="bg-gradient-to-r from-slate-800 via-slate-850 to-slate-900 border-b border-slate-700/50 p-3 md:p-6 flex-shrink-0 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="relative w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg border border-blue-400/30">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
                <div className="w-5 h-5 md:w-7 md:h-7 bg-white rounded-sm shadow-md"></div>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Threat Assessment</h1>
                <div className="text-xs md:text-sm text-slate-400 font-medium hidden sm:block">Planetary Defense Coordination Office</div>
              </div>
            </div>
            <div className="text-xs md:text-sm px-2 md:px-4 py-1 md:py-2 bg-slate-900/50 rounded-lg border border-slate-700/50 backdrop-blur-sm">
              <span className="text-blue-300 font-semibold">NASA JPL</span>
              <span className="text-slate-500 mx-1 md:mx-2 hidden sm:inline">•</span>
              <span className="text-slate-400 hidden sm:inline">Near-Earth Object Studies</span>
            </div>
          </div>
        </header>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left side - Earth Visualization (hidden on mobile) */}
          <div className="hidden md:flex flex-1 bg-black relative">
            <EarthVisualization
              asteroids={[asteroid]}
              selectedAsteroid={asteroid.id}
              gameTime={new Date()}
              onSelectAsteroid={() => { }}
            />
          </div>

          {/* Right side - Asteroid Details */}
          <div className="w-full md:w-1/2 max-w-full md:max-w-2xl bg-slate-800 p-4 md:p-8 overflow-y-auto flex-1 md:flex-shrink-0">
            <div className="space-y-4 md:space-y-6 pb-32">
              <div>
                <div className="text-xs uppercase text-slate-400 mb-2">Object Designation</div>
                <h2 className="text-2xl md:text-3xl font-bold text-white">{asteroid.name}</h2>
                {asteroid.isPotentiallyHazardous && (
                  <div className="mt-2 inline-block bg-red-900/30 border border-red-500/50 px-3 py-1 rounded text-red-300 text-sm">
                    Potentially Hazardous Asteroid (PHA)
                  </div>
                )}
                {asteroid.nasaJplUrl && (
                  <div className="mt-3">
                    <a
                      href={asteroid.nasaJplUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/50 text-blue-300 hover:text-blue-200 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      View on NASA JPL Database
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 md:gap-3">
                <div className="bg-gradient-to-br from-slate-700/70 to-slate-800/70 rounded-xl p-3 md:p-4 border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                  <div className="text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wider">Estimated Diameter</div>
                  <div className="text-xl md:text-2xl font-bold text-white">{asteroid.diameterM.toFixed(0)}m</div>
                  {asteroid.nasaJplUrl ? (
                    <div className="text-xs text-slate-500 mt-1">Mean of NASA range</div>
                  ) : (
                    <div className="text-xs text-slate-500 mt-1">Estimated from brightness</div>
                  )}
                </div>
                <div className="bg-gradient-to-br from-slate-700/70 to-slate-800/70 rounded-xl p-3 md:p-4 border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                  <div className="text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wider">Mass</div>
                  <div className="text-xl md:text-2xl font-bold text-white break-words">{formatMass(asteroid.massKg)}</div>
                </div>
                <div className="bg-gradient-to-br from-slate-700/70 to-slate-800/70 rounded-xl p-3 md:p-4 border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                  <div className="text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wider">Velocity</div>
                  <div className="text-xl md:text-2xl font-bold text-white">{asteroid.velocityKmps.toFixed(1)} km/s</div>
                </div>
                <div className="bg-gradient-to-br from-slate-700/70 to-slate-800/70 rounded-xl p-3 md:p-4 border border-slate-600/50 hover:border-red-500/40 transition-all duration-200 shadow-lg">
                  <div className="text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wider">Torino Scale</div>
                  <div className={`text-xl md:text-2xl font-bold ${torinoScale >= 8 ? 'text-red-400' :
                      torinoScale >= 5 ? 'text-orange-400' :
                        torinoScale >= 2 ? 'text-yellow-400' :
                          'text-green-400'
                    }`}>{torinoScale}</div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-700/70 to-slate-800/70 rounded-xl p-3 md:p-5 border border-slate-600/50 hover:border-purple-500/40 transition-all duration-200 shadow-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-400 mb-1 md:mb-2 uppercase tracking-wider">Palermo Scale</div>
                    <div className={`text-xl md:text-2xl font-bold ${palermo < 0 ? 'text-slate-300' : palermo < 1 ? 'text-yellow-300' : 'text-red-300'}`}>{palermo.toFixed(2)}</div>
                  </div>
                  <button
                    onClick={() => setShowRiskScales(!showRiskScales)}
                    className="text-xs px-3 py-2 rounded bg-slate-700 hover:bg-slate-600 border border-slate-600 min-h-[44px]"
                  >{showRiskScales ? 'Hide' : 'Explain'}</button>
                </div>
                {showRiskScales && (
                  <div className="text-xs text-slate-300 mt-2 space-y-2">
                    <div>
                      <span className="font-semibold">Torino</span>: 0 benign, 1 routine, 2–4 meriting attention, 5–7 threatening, 8–10 certain impacts. Values often drop as tracking improves.
                    </div>
                    <div>
                      <span className="font-semibold">Palermo</span>: log risk relative to background. &lt;0 below background, 0 comparable, &gt;0 above background (merits attention).
                      {palermo < 0 && (
                        <span className="ml-1 text-slate-400">(Below background risk; monitoring continues, action is generally not warranted.)</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {asteroid.material && (
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-xs text-slate-400 mb-1">Composition</div>
                  <div className="text-white">{asteroid.material}</div>
                  {asteroid.density && (
                    <div className="text-sm text-slate-300 mt-1">Density: {asteroid.density} g/cm³</div>
                  )}
                </div>
              )}

              {asteroid.educationalBlurb && (
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                  <div className="text-xs text-blue-300 mb-2">NASA Database Information</div>
                  <div className="text-sm text-slate-300">{asteroid.educationalBlurb}</div>
                </div>
              )}

              {/* Scientific Metrics */}
              <div className="bg-slate-700/30 rounded-lg p-3 md:p-4 space-y-2 md:space-y-3">
                <div className="text-sm font-semibold text-slate-200 mb-2">Impact Threat Assessment</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3 text-xs">
                  <div>
                    <span className="text-slate-400">Kinetic Energy:</span>
                    <span className="text-white font-mono ml-2">
                      {((0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2)) / 4.184e15).toFixed(2)} MT of TNT
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Momentum:</span>
                    <span className="text-white ml-2">
                      <InlineMath math={`${(asteroid.massKg * asteroid.velocityKmps).toPrecision(3)} \\text{ kg}\\cdot\\text{m/s}`} />
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400">Impact Zone Radius:</span>
                    <span className="text-white font-mono ml-2">
                      {asteroid.impactZoneRadiusKm ? `~${asteroid.impactZoneRadiusKm} km` : 'Minimal'}
                    </span>
                    <div className="text-slate-500 mt-0.5">Area of direct damage</div>
                  </div>
                  <div>
                    <span className="text-slate-400">Position Uncertainty:</span>
                    <span className="text-white font-mono ml-2">±{asteroid.uncertaintyKm.toFixed(0)} km</span>
                    <div className="text-slate-500 mt-0.5">Error in predicted impact location</div>
                  </div>
                </div>
                <div className="text-xs text-slate-400 mt-2">
                  Reference: <InlineMath math="1\text{ MT} = 4.184 \times 10^{15}\text{ J}" /> | Tunguska <InlineMath math="\approx 10\text{ MT}" /> | Chelyabinsk <InlineMath math="\approx 0.5\text{ MT}" />
                </div>
              </div>

              {/* Size Estimate Details */}
              {asteroid.nasaJplUrl && (
                <div className="bg-slate-700/30 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-slate-200">Size Estimate Details</div>
                    <div className="text-xs text-slate-400">From NASA NEO data</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400">Range:</span>
                      <span className="text-white font-mono ml-2">
                        {asteroid.nasaDiameterMinM?.toFixed(0)}–{asteroid.nasaDiameterMaxM?.toFixed(0)} m
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Mean used:</span>
                      <span className="text-white font-mono ml-2">{asteroid.diameterM.toFixed(0)} m</span>
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    NASA derives diameter from brightness (absolute magnitude H) using assumed reflectivity (albedo). Radar or spacecraft measurements refine these estimates.
                  </div>
                </div>
              )}

              {/* See the math (Δv educational toggle) */}
              <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-blue-200">See the Math</div>
                  <button
                    onClick={() => setShowMath(!showMath)}
                    className="text-xs px-3 py-1 rounded bg-blue-900/40 hover:bg-blue-900/60 border border-blue-700 text-blue-200"
                  >{showMath ? 'Hide' : 'Show'}</button>
                </div>
                {showMath && (
                  <div className="text-xs text-slate-300 mt-3 space-y-3">
                    <div><span className="font-semibold">What is <InlineMath math="\Delta v" />?</span> <InlineMath math="\Delta v" /> is a change in velocity. Here it is the small average along-track speed change applied early so the asteroid arrives a bit earlier or later, missing Earth.</div>
                    <div><span className="font-semibold">Model assumption.</span> Require an along-track miss distance <InlineMath math={`s \\approx ${safetyRadii.toFixed(1)} \\times R_E`} /> (Earth radius) at encounter.</div>
                    <div className="bg-slate-800/50 p-3 rounded">
                      <div className="text-slate-400 mb-2">Formula:</div>
                      <BlockMath math="\Delta v_{\text{required}} \approx \frac{s}{t}" />
                    </div>
                    <div>
                      <InlineMath math={`R_E = 6{,}371{,}000\\text{ m}`} />
                      <br />
                      <InlineMath math={`s = ${safetyRadii.toFixed(1)} \\times R_E \\approx ${(safetyRadii * 6371000).toLocaleString()}\\text{ m}`} />
                    </div>
                    <div>
                      <InlineMath math={`t = ${Math.max(1, selectedYears)}\\text{ y} \\approx ${(Math.max(1, selectedYears) * 365.25 * 24 * 3600).toLocaleString()}\\text{ s}`} />
                    </div>
                    <div className="bg-slate-800/50 p-3 rounded">
                      <InlineMath math={`\\Delta v_{\\text{needed}} \\approx \\frac{s}{t} \\approx ${(requiredDeltaVAlongTrack(selectedYears, safetyRadii)).toPrecision(3)}\\text{ m/s} \\approx ${(requiredDeltaVAlongTrack(selectedYears, safetyRadii) * 100).toPrecision(3)}\\text{ cm/s}`} />
                    </div>
                    <div className="text-slate-400">
                      <span className="font-semibold">Example:</span> For <InlineMath math="t = 10\text{ y}" /> and <InlineMath math="s = 2.5 \times R_E" />:
                      <br />
                      <InlineMath math={`\\Delta v \\approx ${(requiredDeltaVAlongTrack(10, 2.5)).toFixed(4)}\\text{ m/s} \\approx ${(requiredDeltaVAlongTrack(10, 2.5) * 100).toFixed(2)}\\text{ cm/s}`} />
                    </div>
                    <div className="text-slate-400">
                      <span className="font-semibold">Units:</span> <InlineMath math="\text{m = meters, s = seconds, 1 m/s = 100 cm/s}" />
                    </div>
                    <div className="text-slate-400">
                      <span className="font-semibold">Why this works:</span> Sustaining a tiny average <InlineMath math="\Delta v" /> over time <InlineMath math="t" /> accumulates an along-track displacement <InlineMath math="s \approx \Delta v \cdot t" />.
                    </div>
                  </div>
                )}
              </div>

              {/* Orbital Parameters if available */}
              {asteroid.orbitalData && Object.keys(asteroid.orbitalData).length > 0 && (
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-sm font-semibold text-slate-200 mb-2">Orbital Elements</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {asteroid.orbitalData.eccentricity && (
                      <div>
                        <span className="text-slate-400">Eccentricity:</span>
                        <span className="text-white font-mono ml-2">{parseFloat(asteroid.orbitalData.eccentricity).toFixed(4)}</span>
                      </div>
                    )}
                    {asteroid.orbitalData.semi_major_axis && (
                      <div>
                        <span className="text-slate-400">Semi-major Axis:</span>
                        <span className="text-white font-mono ml-2">{parseFloat(asteroid.orbitalData.semi_major_axis).toFixed(3)} AU</span>
                      </div>
                    )}
                    {asteroid.orbitalData.inclination && (
                      <div>
                        <span className="text-slate-400">Inclination:</span>
                        <span className="text-white font-mono ml-2">{parseFloat(asteroid.orbitalData.inclination).toFixed(2)}°</span>
                      </div>
                    )}
                    {asteroid.orbitalData.orbital_period && (
                      <div>
                        <span className="text-slate-400">Period:</span>
                        <span className="text-white font-mono ml-2">{parseFloat(asteroid.orbitalData.orbital_period).toFixed(1)} days</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
                <div className="text-yellow-200 font-semibold mb-2">Scientist Briefing:</div>
                <div className="text-sm text-slate-300 leading-relaxed">
                  &ldquo;Based on our tracking data, this {asteroid.size} asteroid (mass: <InlineMath math={`${(asteroid.massKg / 1e3).toFixed(2)} \\text{ metric tons}`} />) has been classified as a potential threat.
                  The object&apos;s trajectory at <InlineMath math={`${asteroid.velocityKmps.toFixed(1)}\\text{ km/s}`} /> brings it dangerously close to Earth&apos;s orbit.
                  If undeflected, impact would release <InlineMath math={`${((0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2)) / 4.184e15).toFixed(2)}\\text{ MT}`} /> of energy.
                  We recommend immediate consideration of deflection strategies. Time is of the essence - with early action, we only need to alter the velocity by a few <InlineMath math="\text{cm/s}" /> to ensure a safe miss distance.&rdquo;
                </div>
              </div>

              <button
                onClick={() => setPhase('selection')}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl hover:shadow-blue-500/30 border border-blue-500/30 hover:scale-[1.02]"
              >
                <span className="flex items-center justify-center gap-2">
                  <span>Proceed to Mission Planning</span>
                  <span>→</span>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Selection Screen - Choose timeframe and method
  if (phase === 'selection') {
    if (!asteroid) return null;

    const requiredDeltaVms = requiredDeltaVAlongTrack(selectedYears);
    const deliveredDeltaVms = selectedMethod
      ? computeDeliveredDeltaV(
        selectedMethod,
        asteroid,
        selectedYears,
        selectedMethod === 'kinetic' ? kineticParams
          : selectedMethod === 'nuclear' ? nuclearParams
          : selectedMethod === 'gravity_tractor' ? gravityParams
          : selectedMethod === 'ion_beam' ? ionParams
          : laserParams
      )
      : 0;
    const ratio = requiredDeltaVms > 0 ? deliveredDeltaVms / requiredDeltaVms : 0;

    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col pt-20 md:pt-24">
        <header className="bg-gradient-to-r from-slate-800 via-slate-850 to-slate-900 border-b border-slate-700/50 p-3 md:p-6 flex-shrink-0 shadow-lg">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 md:space-x-4">
              <div className="relative w-10 h-10 md:w-14 md:h-14 bg-gradient-to-br from-blue-500 to-blue-700 rounded-xl flex items-center justify-center shadow-lg border border-blue-400/30">
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-xl" />
                <div className="w-5 h-5 md:w-7 md:h-7 bg-white rounded-sm shadow-md"></div>
              </div>
              <div>
                <h1 className="text-lg md:text-2xl font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Mission Planning</h1>
                <div className="text-xs md:text-sm text-slate-400 font-medium">Target: {asteroid.name}</div>
              </div>
            </div>
            <button
              onClick={() => setPhase('briefing')}
              className="text-slate-300 hover:text-white text-sm px-5 py-3 rounded-lg hover:bg-slate-700 transition-all duration-200 border border-slate-700 hover:border-slate-600 font-medium min-h-[44px]"
            >
              ← Back to Assessment
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto pt-4 md:pt-8">
          <div className="max-w-5xl mx-auto px-4 md:px-8 pb-40 space-y-6 md:space-y-8">
            {/* Scenario Data & Recommendations */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Scenario Data & Recommendations</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Asteroid Size</div>
                  <div className="text-white font-semibold capitalize">{asteroid.size}</div>
                  <div className="text-slate-300 text-xs mt-1">Diameter {asteroid.diameterM.toFixed(0)} m</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Mass & Velocity</div>
                  <div className="text-white font-semibold">{formatMass(asteroid.massKg)}</div>
                  <div className="text-slate-300 text-xs mt-1">{asteroid.velocityKmps.toFixed(1)} km/s</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Risk Scales</div>
                  <div className="text-white font-semibold">Torino: {getTorinoScale(asteroid)}/10</div>
                  <div className="text-slate-300 text-xs mt-1">Lead time: {selectedYears} years</div>
                </div>
              </div>
              {(() => {
                const diff = assessDeflectionDifficulty(asteroid, selectedYears);
                const best = findBestRecommendation(asteroid, safetyRadii);
                const recMethod = best?.method ?? getRecommendedMethod(diff, selectedYears, asteroid.size);
                const suggested = best?.years ?? findSuggestedTimeframe(recMethod, asteroid, safetyRadii);
                return (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 text-sm">
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-blue-200 text-xs mb-1">Difficulty</div>
                      <div className="text-white font-semibold">{diff.toUpperCase()}</div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-blue-200 text-xs mb-1">Recommended Method</div>
                      <div className="text-white font-semibold">{METHOD_INFO[recMethod].name}</div>
                    </div>
                    <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                      <div className="text-blue-200 text-xs mb-1">Suggested Timeframe</div>
                      {(() => {
                        const buffered = findBufferedRecommendation(recMethod, asteroid, safetyRadii);
                        const sug = buffered ?? findSuggestedTimeframe(recMethod, asteroid, safetyRadii);
                        return (
                          <div className="text-white font-semibold">{sug ? `${sug}+ years` : '—'}</div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Step 1: Select Mission Timeframe</h2>
              <div className="text-sm text-slate-400 mb-4">
                Choose how many years before potential impact to deploy the deflection mission.
                Earlier deployment increases success probability but may have logistical challenges.
              </div>
              {/* Timeframe Guidance */}
              <div className="mb-4 bg-slate-900/40 border border-slate-700 rounded-lg p-3 md:p-4 text-xs text-slate-300">
                <div className="font-semibold text-slate-200 mb-2">Timeframe Guidance</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <div className="text-slate-400">Required <InlineMath math="\Delta v" /></div>
                    <div className="text-white font-mono">{(requiredDeltaVms * 100).toFixed(3)} cm/s</div>
                    <div className="text-slate-400">Shorter time ⇒ larger required <InlineMath math="\Delta v" /></div>
                  </div>
                  <div>
                    {(() => {
                      const diff = assessDeflectionDifficulty(asteroid, selectedYears);
                      const recMethod = selectedMethod ?? getRecommendedMethod(diff, selectedYears, asteroid.size);
                      const suggested = findSuggestedTimeframe(recMethod, asteroid, safetyRadii);
                      return (
                        <div>
                          <div className="text-slate-400">Suggested timeframe</div>
                          <div className="text-white font-semibold">{suggested ? `${suggested}+ years` : '—'}</div>
                          <div className="text-slate-400">Method: {METHOD_INFO[recMethod].name}</div>
                        </div>
                      );
                    })()}
                  </div>
                  <div>
                    {(() => {
                      const currentDelivered = selectedMethod ? computeDeliveredDeltaV(
                        selectedMethod,
                        asteroid,
                        selectedYears,
                        selectedMethod === 'kinetic' ? kineticParams
                          : selectedMethod === 'nuclear' ? nuclearParams
                            : selectedMethod === 'gravity_tractor' ? gravityParams
                              : selectedMethod === 'ion_beam' ? ionParams
                                : laserParams
                      ) : 0;
                      const coverage = requiredDeltaVms > 0 ? Math.min(1, Math.max(0, currentDelivered / requiredDeltaVms)) : 0;
                      return (
                        <div>
                          <div className="text-slate-400">Coverage at this timeframe</div>
                          <div className={`font-semibold ${coverage >= 1 ? 'text-green-300' : 'text-yellow-300'}`}>{(coverage * 100).toFixed(0)}%</div>
                          <div className="w-full h-1.5 bg-slate-700 rounded overflow-hidden mt-1">
                            <div className={`${coverage >= 1 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${coverage * 100}%`, height: '100%' }}></div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
                {(() => {
                  const diff = assessDeflectionDifficulty(asteroid, selectedYears);
                  const recMethod = selectedMethod ?? getRecommendedMethod(diff, selectedYears, asteroid.size);
                  const suggested = findSuggestedTimeframe(recMethod, asteroid, safetyRadii);
                  if (!suggested || suggested <= selectedYears) return null;
                  return (
                    <div className="mt-3">
                      <button
                        onClick={() => setSelectedYears(suggested)}
                        className="text-xs px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white border border-blue-500/50 min-h-[44px]"
                      >Set to suggested timeframe</button>
                      <span className="ml-2 text-slate-400">Adjusts to when {METHOD_INFO[recMethod].name} typically meets the requirement.</span>
                    </div>
                  );
                })()}
              </div>
              <div className="text-xs text-slate-400 mb-4">
                <button onClick={() => setShowTimeframeInfo(!showTimeframeInfo)} className="underline hover:text-slate-300">What does timeframe mean?</button>
                {showTimeframeInfo && (
                  <div className="mt-2 text-slate-300">
                    It is the lead time from now until potential impact that is available for mission planning, launch, cruise, and performing the deflection. More time allows smaller <InlineMath math="\Delta v" /> to accumulate and increases mission options.
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <input
                  type="range"
                  min="1"
                  max="25"
                  value={selectedYears}
                  onChange={(e) => setSelectedYears(Number(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
                <div className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-blue-400">{selectedYears} Years</div>
                  <div className="text-xs md:text-sm text-slate-400">before potential impact</div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 md:p-6">
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Step 2: Select Deflection Method</h2>
              <div className="text-sm text-slate-400 mb-4">
                Choose the deflection technique for this mission. Consider cost, effectiveness, and time constraints.
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                {(Object.keys(METHOD_INFO) as MitigationMethod[]).map((method) => {
                  const info = METHOD_INFO[method];
                  const cost = getMethodCost(method);
                  const isSelected = selectedMethod === method;

                  return (
                    <button
                      key={method}
                      onClick={() => setSelectedMethod(method)}
                      className={`text-left p-5 rounded-lg border-2 transition-all ${isSelected
                          ? 'border-blue-500 bg-blue-900/30'
                          : 'border-slate-600 bg-slate-700/30 hover:border-slate-500'
                        }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded bg-slate-700 border border-slate-500 flex items-center justify-center text-xs font-semibold text-slate-200">{METHOD_BADGE[method]}</div>
                          <div>
                            <div className="font-semibold text-white">{info.name}</div>
                            <div className="text-xs text-slate-400">Cost: ${cost.toFixed(1)}B</div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-white rounded-full"></div>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-slate-300 mb-2">{info.description}</div>
                      <div className="text-xs text-slate-400 mb-2">{info.realWorld}</div>
                      <div className="text-xs text-blue-300">Best for: {info.bestFor}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Method parameters and Δv gauge */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h2 className="text-xl font-semibold mb-4">Step 3: Tune Method Parameters</h2>
              <div className="mb-4">
                <div className="text-xs text-slate-400">Safety margin for miss distance: <InlineMath math={`${safetyRadii.toFixed(1)} \\times R_E`} /></div>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="text-sm text-slate-400">Required <InlineMath math="\Delta v" /> (along-track)</div>
                  <div className="text-3xl font-bold"><InlineMath math={`${(requiredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="text-xs text-slate-400">Assumes miss distance <InlineMath math={`\\approx ${safetyRadii.toFixed(1)} \\times R_E`} />.</div>
                </div>
                <div className="space-y-3">
                  <div className="text-sm text-slate-400">Delivered <InlineMath math="\Delta v" /> (current settings)</div>
                  <div className={`text-3xl font-bold ${ratio >= 1 ? 'text-green-300' : 'text-yellow-300'}`}><InlineMath math={`${(deliveredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="w-full h-2 bg-slate-700 rounded overflow-hidden">
                    <div className={`h-2 ${ratio >= 1 ? 'bg-green-500' : 'bg-yellow-500'}`} style={{ width: `${Math.min(100, Math.max(0, ratio * 100))}%` }}></div>
                  </div>
                  <div className="text-xs text-slate-400">Coverage: {(Math.min(1, Math.max(0, ratio)) * 100).toFixed(0)}% of requirement</div>
                  <div className="text-xs text-slate-400">
                    Difficulty reflects asteroid mass/size and available years. Operational constraints reflect how well the chosen method fits the lead time (low-thrust methods need long durations; complex missions add risk). Meeting <InlineMath math="\Delta v" /> is necessary but not always sufficient if these factors lower overall probability.
                  </div>
                </div>
              </div>

              {/* Suggest a timeframe that meets the requirement, if possible */}
              <div className="mt-4 text-xs text-slate-300">
                {selectedMethod ? (() => {
                  const suggested = findSuggestedTimeframe(selectedMethod, asteroid, safetyRadii);
                  if (suggested && suggested > selectedYears) {
                    return <div>Tip: With {suggested} years of lead time, {METHOD_INFO[selectedMethod].name} meets the <InlineMath math="\Delta v" /> requirement at recommended settings.</div>;
                  }
                  if (!suggested) {
                    return <div>Tip: Even at 25 years, this method at recommended settings may not meet the <InlineMath math="\Delta v" /> requirement for this scenario. Consider another method.</div>;
                  }
                  return null;
                })() : null}
              </div>

              {/* Method formula guidance */}
              <div className="mt-6 bg-slate-900/40 border border-slate-700 rounded-lg p-4 text-xs text-slate-300">
                <div className="font-semibold text-slate-200 mb-2">How tuning affects <InlineMath math="\Delta v" /></div>
                {!selectedMethod && (
                  <div>Select a deflection method to see specific guidance.</div>
                )}
                {selectedMethod === 'kinetic' && (
                  <div className="space-y-2">
                    <div><InlineMath math={"\\Delta v \\approx \\dfrac{\\beta \\cdot m_i \\cdot v_i}{m_a}"} /></div>
                    <div className="text-slate-400">Where:</div>
                    <ul className="space-y-1 ml-4">
                      <li><InlineMath math={"m_i"} /> = impactor mass (kg) - the mass of your spacecraft hitting the asteroid</li>
                      <li><InlineMath math={"v_i"} /> = impact velocity (m/s) - how fast the impactor hits</li>
                      <li><InlineMath math={"\\beta"} /> = ejecta momentum factor - multiplier from material ejected off the asteroid (typically 2-5)</li>
                      <li><InlineMath math={"m_a"} /> = asteroid mass (kg) - heavier asteroids need more momentum transfer</li>
                    </ul>
                  </div>
                )}
                {selectedMethod === 'nuclear' && (
                  <div className="space-y-2">
                    <div><InlineMath math={"\\Delta v \\approx \\dfrac{2 \\cdot k \\cdot E}{v_e \\cdot m_a}"} /></div>
                    <div className="text-slate-400">Where:</div>
                    <ul className="space-y-1 ml-4">
                      <li><InlineMath math={"E"} /> = yield (Joules) - total energy released by the nuclear device</li>
                      <li><InlineMath math={"k"} /> = coupling coefficient - fraction of energy that vaporizes asteroid material (typically 0.5-2%)</li>
                      <li><InlineMath math={"v_e"} /> = exhaust velocity (m/s) - speed at which vaporized material is ejected</li>
                      <li><InlineMath math={"m_a"} /> = asteroid mass (kg)</li>
                    </ul>
                  </div>
                )}
                {selectedMethod === 'gravity_tractor' && (
                  <div className="space-y-2">
                    <div><InlineMath math={"a \\approx \\dfrac{G \\cdot m_{sc}}{r^2},\\quad \\Delta v \\approx a \\cdot t_{eff}"} /></div>
                    <div className="text-slate-400">Where:</div>
                    <ul className="space-y-1 ml-4">
                      <li><InlineMath math={"G"} /> = gravitational constant (6.674×10⁻¹¹ m³/kg·s²)</li>
                      <li><InlineMath math={"m_{sc}"} /> = spacecraft mass (kg) - heavier spacecraft exerts stronger gravitational pull</li>
                      <li><InlineMath math={"r"} /> = standoff distance (m) - how far the spacecraft hovers from the asteroid (closer = stronger pull but riskier)</li>
                      <li><InlineMath math={"a"} /> = acceleration (m/s²) produced by gravity</li>
                      <li><InlineMath math={"t_{eff}"} /> = effective operation time (s) = lead time × operation fraction × duty cycle</li>
                      <li>Duty cycle = % of time actively tugging (e.g., 0.8 = 80% of time, allowing breaks for station-keeping)</li>
                      <li>Operation fraction = what fraction of lead time is spent deflecting (remainder is travel/setup time)</li>
                    </ul>
                  </div>
                )}
                {selectedMethod === 'ion_beam' && (
                  <div className="space-y-2">
                    <div><InlineMath math={"\\Delta v \\approx \\dfrac{T}{m_a} \\cdot t_{eff}"} /></div>
                    <div className="text-slate-400">Where:</div>
                    <ul className="space-y-1 ml-4">
                      <li><InlineMath math={"T"} /> = thrust (Newtons) - continuous force applied by the ion beam</li>
                      <li><InlineMath math={"m_a"} /> = asteroid mass (kg)</li>
                      <li><InlineMath math={"t_{eff}"} /> = effective operation time (s) = lead time × operation fraction</li>
                      <li>Operation fraction = what fraction of lead time is spent actively beaming (remainder is travel/setup time)</li>
                    </ul>
                  </div>
                )}
                {selectedMethod === 'laser' && (
                  <div className="space-y-2">
                    <div><InlineMath math={"\\Delta v \\approx \\dfrac{T}{m_a} \\cdot t_{eff}"} /></div>
                    <div className="text-slate-400">Where:</div>
                    <ul className="space-y-1 ml-4">
                      <li><InlineMath math={"T"} /> = effective thrust (Newtons) - force from vaporized surface material (ablation)</li>
                      <li><InlineMath math={"m_a"} /> = asteroid mass (kg)</li>
                      <li><InlineMath math={"t_{eff}"} /> = effective operation time (s) = lead time × operation fraction</li>
                      <li>Operation fraction = what fraction of lead time is spent actively ablating (remainder is travel/setup time)</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Parameter controls by method (with short tooltips) */}
              {selectedMethod && (
                <div className="mt-6 grid md:grid-cols-2 gap-6">
                  {selectedMethod === 'kinetic' && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Impactor mass (kg)
                          <span className="ml-2 text-slate-500">More mass → more momentum transfer</span>
                        </div>
                        <input type="range" min={100} max={5000} value={kineticParams.impactorMassKg} onChange={(e) => setKineticParams({ ...kineticParams, impactorMassKg: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{kineticParams.impactorMassKg.toFixed(0)} kg</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Impact velocity (km/s)
                          <span className="ml-2 text-slate-500">Faster impact → more momentum</span>
                        </div>
                        <input type="range" min={3} max={20} step={0.1} value={kineticParams.impactVelocityKmps} onChange={(e) => setKineticParams({ ...kineticParams, impactVelocityKmps: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{kineticParams.impactVelocityKmps.toFixed(1)} km/s</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Ejecta momentum factor <InlineMath math="\beta" />
                          <span className="ml-2 text-slate-500">Higher <InlineMath math="\beta" /> → more impulse from ejecta</span>
                        </div>
                        <input type="range" min={1} max={6} step={0.1} value={kineticParams.ejectaBeta} onChange={(e) => setKineticParams({ ...kineticParams, ejectaBeta: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm"><InlineMath math={`\\beta = ${kineticParams.ejectaBeta.toFixed(1)}`} /></div>
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'nuclear' && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Yield (MT)
                          <span className="ml-2 text-slate-500">Higher yield → more energy available</span>
                        </div>
                        <input type="range" min={0.1} max={10} step={0.1} value={nuclearParams.yieldMt} onChange={(e) => setNuclearParams({ ...nuclearParams, yieldMt: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{nuclearParams.yieldMt.toFixed(1)} MT</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Coupling coefficient
                          <span className="ml-2 text-slate-500">Portion of energy that accelerates material</span>
                        </div>
                        <input type="range" min={0} max={0.05} step={0.001} value={nuclearParams.coupling} onChange={(e) => setNuclearParams({ ...nuclearParams, coupling: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{nuclearParams.coupling.toFixed(3)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Exhaust velocity (km/s)
                          <span className="ml-2 text-slate-500">Faster ejecta → greater <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={1} max={10} step={0.1} value={nuclearParams.exhaustVelocityKms} onChange={(e) => setNuclearParams({ ...nuclearParams, exhaustVelocityKms: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{nuclearParams.exhaustVelocityKms.toFixed(1)} km/s</div>
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'gravity_tractor' && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Spacecraft mass (kg)
                          <span className="ml-2 text-slate-500">Heavier craft → stronger tug</span>
                        </div>
                        <input type="range" min={500} max={10000} step={100} value={gravityParams.spacecraftMassKg} onChange={(e) => setGravityParams({ ...gravityParams, spacecraftMassKg: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{gravityParams.spacecraftMassKg.toFixed(0)} kg</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Standoff altitude above surface (m)
                          <span className="ml-2 text-slate-500">Closer → stronger gravity, but higher risk</span>
                        </div>
                        <input type="range" min={20} max={500} step={5} value={gravityParams.standoffDistanceM} onChange={(e) => setGravityParams({ ...gravityParams, standoffDistanceM: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{gravityParams.standoffDistanceM.toFixed(0)} m above surface</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Duty cycle
                          <span className="ml-2 text-slate-500">Fraction of time actively tugging</span>
                        </div>
                        <input type="range" min={0.2} max={1} step={0.05} value={gravityParams.dutyCycle} onChange={(e) => setGravityParams({ ...gravityParams, dutyCycle: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{(gravityParams.dutyCycle * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Operation fraction of lead time
                          <span className="ml-2 text-slate-500">Longer operation → more <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={0.3} max={1} step={0.05} value={gravityParams.operationYearsFraction} onChange={(e) => setGravityParams({ ...gravityParams, operationYearsFraction: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{(gravityParams.operationYearsFraction * 100).toFixed(0)}% of lead time</div>
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'ion_beam' && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Thrust (N)
                          <span className="ml-2 text-slate-500">Higher thrust → more <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={0.01} max={1} step={0.01} value={ionParams.thrustN} onChange={(e) => setIonParams({ ...ionParams, thrustN: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{ionParams.thrustN.toFixed(2)} N</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Operation fraction of lead time
                          <span className="ml-2 text-slate-500">Longer operation → more <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={0.3} max={1} step={0.05} value={ionParams.operationYearsFraction} onChange={(e) => setIonParams({ ...ionParams, operationYearsFraction: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{(ionParams.operationYearsFraction * 100).toFixed(0)}% of lead time</div>
                      </div>
                    </div>
                  )}

                  {selectedMethod === 'laser' && (
                    <div className="space-y-4">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Effective thrust (N)
                          <span className="ml-2 text-slate-500">Higher thrust → more <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={0.01} max={0.5} step={0.01} value={laserParams.thrustN} onChange={(e) => setLaserParams({ ...laserParams, thrustN: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{laserParams.thrustN.toFixed(2)} N</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400 mb-1">Operation fraction of lead time
                          <span className="ml-2 text-slate-500">Longer operation → more <InlineMath math="\Delta v" /></span>
                        </div>
                        <input type="range" min={0.3} max={1} step={0.05} value={laserParams.operationYearsFraction} onChange={(e) => setLaserParams({ ...laserParams, operationYearsFraction: Number(e.target.value) })} className="w-full" />
                        <div className="text-sm">{(laserParams.operationYearsFraction * 100).toFixed(0)}% of lead time</div>
                      </div>
                    </div>
                  )}

                </div>
              )}
              <div className="mt-6 flex items-center justify-between">
                <div className="text-xs text-slate-400">Not sure where to start? We can prefill recommended settings and timeframe for this scenario.</div>
                <button
                  onClick={() => {
                    const best = findBestRecommendation(asteroid!, safetyRadii);
                    const diff = assessDeflectionDifficulty(asteroid!, selectedYears);
                    const rec = best?.method ?? getRecommendedMethod(diff, selectedYears, asteroid!.size);
                    setSelectedMethod(rec);
                    const recParams = getRecommendedParams(rec, diff);
                    if (rec === 'kinetic') setKineticParams(recParams as KineticParams);
                    if (rec === 'nuclear') setNuclearParams(recParams as NuclearParams);
                    if (rec === 'gravity_tractor') setGravityParams(recParams as GravityTractorParams);
                    if (rec === 'ion_beam') setIonParams(recParams as IonBeamParams);
                    if (rec === 'laser') setLaserParams(recParams as LaserParams);
                    const suggested = best?.years ?? findSuggestedTimeframe(rec, asteroid!, safetyRadii);
                    if (suggested && suggested > selectedYears) setSelectedYears(suggested);
                  }}
                  className="px-4 py-3 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold min-h-[44px]"
                >Use recommended settings</button>
              </div>
            </div>

            <button
              onClick={handleSubmitPlan}
              disabled={!selectedMethod}
              className={`w-full font-semibold py-4 px-8 rounded-xl transition-all shadow-lg ${selectedMethod
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white transform hover:scale-105'
                  : 'bg-slate-700 text-slate-400 cursor-not-allowed'
                }`}
            >
              {selectedMethod ? 'Submit Deflection Plan' : 'Please select a deflection method'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Result Screen
  if (phase === 'result' && result && asteroid) {
    return (
      <div className="fixed inset-0 bg-slate-900 text-white flex flex-col pt-24">
        <header className="bg-slate-800 border-b border-slate-700 p-6 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-white rounded-sm"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold">Mission Results</h1>
                <div className="text-sm text-slate-400">Asteroid {asteroid.name}</div>
              </div>
            </div>
          </div>
        </header>

        <div ref={resultScrollRef} className="flex-1 overflow-y-auto pt-8">
          <div className="max-w-4xl mx-auto px-8 pb-32 space-y-8">
            {/* Success/Failure Banner */
            }
            <div className={`rounded-xl p-8 text-center ${result.success
                ? 'bg-gradient-to-r from-green-900/40 to-emerald-900/40 border border-green-500/50'
                : 'bg-gradient-to-r from-red-900/40 to-rose-900/40 border border-red-500/50'
              }`}>
              <div className="text-6xl mb-4">{result.success ? 'Success' : 'Fail'}</div>
              <h2 className="text-3xl font-bold mb-2">
                {result.success ? 'Mission Successful!' : 'Mission Failed'}
              </h2>
              <div className="text-lg opacity-90">
                {result.success
                  ? `The deflection mission successfully altered ${asteroid.name}'s trajectory.`
                  : `The deflection attempt was insufficient to prevent impact.`
                }
              </div>
              <div className="mt-4">
                <div className="text-sm text-slate-300">Estimated probability of success</div>
                <div className="w-full h-2 bg-slate-800 rounded overflow-hidden mt-2">
                  <div className="h-2 bg-blue-500" style={{ width: `${Math.round(result.successProbability * 100)}%` }}></div>
                </div>
                <div className="text-sm mt-1 text-slate-300">{(result.successProbability * 100).toFixed(0)}%</div>
                <div className="text-xs text-slate-400 mt-2">
                  How this is calculated: We compare delivered <InlineMath math="\Delta v" /> to required <InlineMath math="\Delta v" />. Meeting the requirement pushes probability up; falling short pulls it down. We then adjust for scenario difficulty (asteroid size/mass, available years) and operational constraints (method fit to lead time and complexity). Values ≥ 50% are considered success.
                </div>
              </div>
            </div>

            {/* Detailed Feedback */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-xl font-semibold mb-4">Detailed Analysis</h3>
              <div className="space-y-4">
                {result.feedback.map((item, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-4 border-l-4 border-blue-500">
                    <p className="text-slate-200">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Your Decisions</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Timeframe</span>
                    <span className="text-white font-semibold">{selectedYears} years ({(selectedYears * 365.25).toFixed(0)} days)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Method</span>
                    <span className="text-white font-semibold">{METHOD_INFO[selectedMethod!].name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cost</span>
                    <span className="text-white font-semibold">${result.details.actualCost.toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cost Efficient</span>
                    <span className={`font-semibold ${result.costEfficient ? 'text-green-400' : 'text-yellow-400'}`}>
                      {result.costEfficient ? 'Yes' : 'Could be improved'}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 text-xs space-y-1">
                  <div className="text-slate-400">Asteroid Parameters:</div>
                  <div className="text-slate-300">Mass: <InlineMath math={`${(asteroid.massKg / 1e12).toFixed(2)} \\times 10^{12}\\text{ kg}`} /></div>
                  <div className="text-slate-300">Velocity: <InlineMath math={`${asteroid.velocityKmps.toFixed(2)}\\text{ km/s}`} /></div>
                  <div className="text-slate-300">Diameter: <InlineMath math={`${asteroid.diameterM.toFixed(0)}\\text{ m}`} /></div>
                  <div className="text-slate-300">Torino Scale: {getTorinoScale(asteroid)}/10</div>
                </div>
              </div>

              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                <h3 className="text-lg font-semibold mb-4">Optimal Strategy</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recommended Timeframe</span>
                    <span className="text-white font-semibold">{result.details.recommendedTimeframe}+ years</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recommended Method</span>
                    <span className="text-white font-semibold">{METHOD_INFO[result.details.recommendedMethod].name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Optimal Cost</span>
                    <span className="text-white font-semibold">${result.details.optimalCost.toFixed(1)}B</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Difficulty</span>
                    <span className={`font-semibold ${result.details.deflectionDifficulty === 'extreme' ? 'text-red-400' :
                        result.details.deflectionDifficulty === 'difficult' ? 'text-orange-400' :
                          result.details.deflectionDifficulty === 'moderate' ? 'text-yellow-400' :
                            'text-green-400'
                      }`}>
                      {result.details.deflectionDifficulty.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 text-xs space-y-1">
                  <div className="text-slate-400">Required Physics:</div>
                  <div className="text-slate-300"><InlineMath math="\Delta v" /> needed: <InlineMath math={`${(result.details.requiredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="text-slate-300">Impact energy: <InlineMath math={`${((0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2)) / 4.184e15).toFixed(2)}\\text{ MT}`} /></div>
                  <div className="text-slate-300">Lead time: {(selectedYears * 365.25).toFixed(0)} days</div>
                  <div className="text-slate-300">Position uncertainty: <InlineMath math={`\\pm ${asteroid.uncertaintyKm.toFixed(0)}\\text{ km}`} /></div>
                  <div className="text-slate-300"><InlineMath math="\Delta v" /> delivered: <InlineMath math={`${(result.details.deliveredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="text-slate-300">Coverage: {(Math.min(1, Math.max(0, result.details.deliveredDeltaVms / Math.max(1e-12, result.details.requiredDeltaVms))) * 100).toFixed(0)}% of requirement</div>
                  <div className="text-slate-400 mt-3">Recommended Strategy Numbers:</div>
                  <div className="text-slate-300"><InlineMath math="\Delta v" /> needed (rec): <InlineMath math={`${(result.details.recommendedRequiredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="text-slate-300"><InlineMath math="\Delta v" /> delivered (rec): <InlineMath math={`${(result.details.recommendedDeliveredDeltaVms * 100).toFixed(3)}\\text{ cm/s}`} /></div>
                  <div className="text-slate-300">Estimated success (rec): {(result.details.recommendedSuccessProbability * 100).toFixed(0)}%</div>
                </div>
              </div>
            </div>

            {/* Mission Geometry & Timeline */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Mission Geometry & Timeline</h3>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Launch to Intercept (Cruise)</div>
                  <div className="text-white font-semibold">{(result.details.travelTimeYears ?? Math.min(selectedYears * 0.3, 2)).toFixed(1)} years</div>
                  <div className="text-slate-300 text-xs mt-1">Distance ≈ {(result.details.cruiseDistanceAU ?? 0).toFixed(2)} AU ({((result.details.cruiseDistanceKm ?? 0) / 1e6).toFixed(2)} million km)</div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Deflection Window</div>
                  <div className="text-white font-semibold">{(result.details.deflectionWindowYears ?? Math.max(0, selectedYears - Math.min(selectedYears * 0.3, 2))).toFixed(1)} years</div>
                  <div className="text-slate-300 text-xs mt-1">Time available to accumulate <InlineMath math="\Delta v" /></div>
                </div>
                <div className="bg-slate-700/30 rounded-lg p-4">
                  <div className="text-slate-400 text-xs mb-1">Along-Track Separation at Intercept</div>
                  <div className="text-white font-semibold">{(result.details.alongTrackSeparationAU ?? 0).toFixed(2)} AU</div>
                  <div className="text-slate-300 text-xs mt-1">({((result.details.alongTrackSeparationKm ?? 0) / 1e6).toFixed(2)} million km)</div>
                </div>
              </div>
              <div className="text-xs text-slate-400 mt-3">
                Notes: Distances are approximate and represent along-track separations in this educational model, not precise Earth–asteroid ranges. 1 AU ≈ 149.6 million km.
              </div>
            </div>

            {/* Educational Resources */}
            <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-blue-300 mb-4">Learn More About Planetary Defense</h3>
              <div className="grid md:grid-cols-2 gap-4 text-sm mb-4">
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="font-semibold text-blue-200 mb-2">NASA DART Mission</div>
                  <div className="text-slate-300 mb-2">In September 2022, NASA successfully demonstrated kinetic impact technology by altering the orbit of asteroid Dimorphos by 33 minutes (32 times greater than minimum success threshold).</div>
                  <a
                    href="https://www.nasa.gov/dart"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs underline"
                  >
                    Read more →
                  </a>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <div className="font-semibold text-green-200 mb-2">Early Detection</div>
                  <div className="text-slate-300 mb-2">NASA tracks over 34,000 near-Earth objects. Early detection provides more deflection options and higher success rates. Current survey completeness: ~95% for NEOs &gt;1km.</div>
                  <a
                    href="https://cneos.jpl.nasa.gov/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-xs underline"
                  >
                    NASA CNEOS →
                  </a>
                </div>
              </div>
              <div className="border-t border-blue-500/30 pt-4 space-y-2">
                <div className="text-xs font-semibold text-blue-200 mb-2">Additional NASA Resources:</div>
                <div className="grid md:grid-cols-3 gap-2 text-xs">
                  <a
                    href="https://www.nasa.gov/planetarydefense/overview"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Planetary Defense Overview
                  </a>
                  <a
                    href="https://cneos.jpl.nasa.gov/sentry/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Sentry Impact Monitoring
                  </a>
                  <a
                    href="https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Small-Body Database
                  </a>
                </div>
              </div>
            </div>

            {asteroid.nasaJplUrl && (
              <div className="bg-gradient-to-r from-blue-900/40 to-indigo-900/40 border border-blue-500/50 rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <div>
                    <div className="text-lg font-semibold text-blue-200">Official NASA Data</div>
                    <div className="text-sm text-slate-300">View complete orbital elements for {asteroid.name}</div>
                  </div>
                </div>
                <a
                  href={asteroid.nasaJplUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors shadow-lg min-h-[44px]"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  Open NASA JPL Small-Body Database
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            )}

            <button
              onClick={handleRestart}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-semibold py-4 px-8 rounded-xl transition-all transform hover:scale-105 shadow-lg"
            >
              Try Another Scenario
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

