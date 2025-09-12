import { AsteroidSize } from './types';

export const ASTEROID_SIZE_CONFIGS = {
  tiny: {
    diameterRange: [1, 5],
    densityKgM3: 2500,
    detectionChance: 0.4, // Improved detection for better gameplay
    timeToImpactRange: [1, 72], // 1-72 hours
    initialImpactProb: 0.01, // Usually burn up in atmosphere - very low impact chance
    impactZoneKm: 0, // Burns up in atmosphere
    dangerLevel: 0,
  },
  small: {
    diameterRange: [5, 20], 
    densityKgM3: 2700,
    detectionChance: 0.6, // Improved detection for better gameplay
    timeToImpactRange: [24, 168], // 1-7 days
    initialImpactProb: 0.05, // Mostly harmless airbursts - low impact chance
    impactZoneKm: 10, // Small airburst damage
    dangerLevel: 1,
  },
  medium: {
    diameterRange: [20, 140],
    densityKgM3: 3000,
    detectionChance: 0.8, // Improved detection for better gameplay
    timeToImpactRange: [168, 8760], // 1 week - 1 year
    initialImpactProb: 0.15, // Regional danger - moderate impact chance
    impactZoneKm: 100, // Regional destruction
    dangerLevel: 5,
  },
  large: {
    diameterRange: [140, 1000],
    densityKgM3: 3200,
    detectionChance: 0.95, // Almost always detected early
    timeToImpactRange: [8760, 87600], // 1-10 years
    initialImpactProb: 0.3, // Global threat - higher impact chance
    impactZoneKm: 1000, // Global effects
    dangerLevel: 10,
  }
} as const;

export const ACTION_COSTS = {
  trackAsteroid: 0.1, // $100M to track one asteroid
  alertPublic: 0.05, // $50M for alert systems
  launchKineticMission: 2.0, // $2B for kinetic interceptor
  launchNuclearMission: 5.0, // $5B for nuclear option
  launchGravityTractor: 3.0, // $3B for gravity tractor
  evacuateArea: 1.0, // $1B for evacuation
} as const;

export const TRUST_IMPACTS = {
  correctAlert: 10,
  falseAlarm: -20,
  missedThreat: -50,
  successfulDeflection: 30,
  failedMission: -15,
} as const;

// Deterministic star positions to prevent hydration errors
export const STARS = Array.from({ length: 100 }, (_, i) => {
  // Use deterministic values based on index for consistent server/client rendering
  const seed = i * 9.7; // Use a multiplier to spread values
  return {
    left: ((seed * 7.3) % 100),
    top: ((seed * 11.7) % 100),
    animationDelay: ((seed * 0.031) % 3),
    animationDuration: (2 + ((seed * 0.041) % 4)),
  };
});
