export const ASTEROID_SIZE_CONFIGS = {
  tiny: {
    diameterRange: [1, 5],
    densityKgM3: 2500,
    detectionChance: 0.3, // Lower detection chance for balance
    timeToImpactRange: [24, 168], // 1-7 days (increased from 1-72 hours for better gameplay)
    initialImpactProb: 0.08, // Increased from 0.01 to 0.08 for better gameplay
    impactZoneKm: 0, // Burns up in atmosphere
    dangerLevel: 0,
  },
  small: {
    diameterRange: [5, 20], 
    densityKgM3: 2700,
    detectionChance: 0.6, // Improved detection for better gameplay
    timeToImpactRange: [168, 720], // 1-4 weeks (better gameplay timing)
    initialImpactProb: 0.3, // Increased from 0.15 to 0.3 for meaningful choices
    impactZoneKm: 10, // Small airburst damage
    dangerLevel: 1,
  },
  medium: {
    diameterRange: [20, 140],
    densityKgM3: 3000,
    detectionChance: 0.8, // Improved detection for better gameplay
    timeToImpactRange: [720, 4380], // 1-6 months (more time for planning)
    initialImpactProb: 0.45, // Increased from 0.25 to 0.45 for higher stakes
    impactZoneKm: 100, // Regional destruction
    dangerLevel: 5,
  },
  large: {
    diameterRange: [140, 1000],
    densityKgM3: 3200,
    detectionChance: 0.95, // Almost always detected early
    timeToImpactRange: [4380, 17520], // 6 months - 2 years (strategic planning)
    initialImpactProb: 0.65, // Increased from 0.4 to 0.65 for serious threats
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
