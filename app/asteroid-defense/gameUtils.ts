import { Asteroid, AsteroidSize } from './types';
import { ASTEROID_SIZE_CONFIGS } from './constants';
import asteroidInfo from '../../data/asteroidInfo.json';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function massFromDiameter(diameterM: number, densityKgM3: number): number {
  const radius = diameterM / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  return volume * densityKgM3;
}

export function generateAsteroid(currentTime: Date): Asteroid {
  // Get real asteroid data for educational purposes
  const realAsteroidKeys = Object.keys(asteroidInfo);
  const useRealData = Math.random() < 0.7; // 70% chance to use real asteroid data
  
  let realAsteroidKey: string | undefined;
  let realAsteroidData: any;
  let size: AsteroidSize;
  
  if (useRealData && realAsteroidKeys.length > 0) {
    realAsteroidKey = realAsteroidKeys[Math.floor(Math.random() * realAsteroidKeys.length)];
    realAsteroidData = asteroidInfo[realAsteroidKey as keyof typeof asteroidInfo];
    
    // Determine size from real asteroid dimensions
    const sizeString = realAsteroidData.size;
    const diameterMatch = sizeString.match(/(\d+\.?\d*)\s*km/);
    const diameterKm = diameterMatch ? parseFloat(diameterMatch[1]) : 1;
    
    if (diameterKm < 0.02) size = 'tiny';
    else if (diameterKm < 0.14) size = 'small';
    else if (diameterKm < 140) size = 'medium';
    else size = 'large';
  } else {
    // Randomly select size category (better distribution for gameplay)
    const sizeRoll = Math.random();
    if (sizeRoll < 0.35) size = 'tiny';        // 35% tiny (reduced from 60%)
    else if (sizeRoll < 0.70) size = 'small';  // 35% small (increased from 25%)
    else if (sizeRoll < 0.92) size = 'medium'; // 22% medium (increased from 13%)
    else size = 'large';                       // 8% large (increased from 2%)
  }
  
  const config = ASTEROID_SIZE_CONFIGS[size];
  
  let diameterM, massKg, density, material, educationalBlurb;
  
  if (realAsteroidData) {
    // Use real asteroid data
    const sizeString = realAsteroidData.size;
    const diameterMatch = sizeString.match(/(\d+\.?\d*)\s*km/);
    diameterM = diameterMatch ? parseFloat(diameterMatch[1]) * 1000 : randomBetween(config.diameterRange[0], config.diameterRange[1]);
    
    // Extract mass if available
    if (realAsteroidData.weight && realAsteroidData.weight !== 'unknown') {
      const massMatch = realAsteroidData.weight.match(/(\d+\.?\d*)×10\^(\d+)/);
      massKg = massMatch ? parseFloat(massMatch[1]) * Math.pow(10, parseInt(massMatch[2])) : massFromDiameter(diameterM, config.densityKgM3);
    } else {
      massKg = massFromDiameter(diameterM, config.densityKgM3);
    }
    
    material = realAsteroidData.material;
    educationalBlurb = realAsteroidData.blurb;
    
    // Use real density if available
    if (realAsteroidData.density && realAsteroidData.density !== 'unknown') {
      const densityMatch = realAsteroidData.density.match(/(\d+\.?\d*)/);
      density = densityMatch ? parseFloat(densityMatch[1]) : config.densityKgM3 / 1000;
    } else {
      density = config.densityKgM3 / 1000; // Convert to g/cm3
    }
  } else {
    // Use generated values
    diameterM = randomBetween(config.diameterRange[0], config.diameterRange[1]);
    massKg = massFromDiameter(diameterM, config.densityKgM3);
    density = config.densityKgM3 / 1000; // Convert to g/cm3
    material = size === 'large' ? 'Stony (S-type)' : size === 'medium' ? 'Carbonaceous (C-type)' : 'Metallic (M-type)';
  }
  
  const velocityKmps = randomBetween(11, 70); // Typical Earth encounter velocities
  
  const timeToImpactHours = randomBetween(config.timeToImpactRange[0], config.timeToImpactRange[1]);
  
  // Detection chance decreases with smaller size and less time
  const detectionChance = config.detectionChance * (timeToImpactHours / config.timeToImpactRange[1]);
  const isDetected = Math.random() < detectionChance;
  
  // Generate random impact location
  const impactLatitude = randomBetween(-60, 60); // Most impacts in populated zones
  const impactLongitude = randomBetween(-180, 180);
  
  // Initial uncertainty is high, decreases with observation time
  const uncertaintyKm = Math.max(50, config.impactZoneKm * 10 / Math.sqrt(timeToImpactHours / 24));
  
  const asteroid: Asteroid = {
    id: `AST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: realAsteroidKey ? formatRealAsteroidName(realAsteroidKey) : generateAsteroidName(),
    size,
    diameterM,
    massKg,
    velocityKmps,
    
    // Educational data
    realAsteroidKey,
    material,
    density,
    educationalBlurb,
    
    detectionDate: new Date(currentTime.getTime() - (isDetected ? Math.random() * 24 * 60 * 60 * 1000 : 0)),
    detectionChance,
    isDetected,
    
    timeToImpactHours,
    initialTimeToImpact: timeToImpactHours,
    
    impactProbability: config.initialImpactProb,
    initialImpactProbability: config.initialImpactProb,
    uncertaintyKm,
    
    impactLatitude,
    impactLongitude,
    impactZoneRadiusKm: config.impactZoneKm,
    
    isTracked: false,
    publicAlerted: false,
    evacuationOrdered: false,
    deflectionMissions: [],
  };
  
  return asteroid;
}

export function generateAsteroidName(): string {
  const prefixes = ['2024', '2025', '2026'];
  const suffixes = ['AA', 'AB', 'AC', 'BA', 'BB', 'BC', 'CA', 'CB', 'CC', 'DA', 'DB', 'DC'];
  const numbers = [Math.floor(Math.random() * 999) + 1];
  
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}${numbers[0]}`;
}

// Convert real asteroid keys to readable names
export function formatRealAsteroidName(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .replace(/^(\d+)\s/, '$1 ')
    .replace(/\bp\b/gi, 'P/')
    .replace('Schwassman Wachmann', 'Schwassmann-Wachmann');
}

export function updateAsteroid(asteroid: Asteroid, deltaTimeHours: number, isTracked: boolean): Asteroid {
  const updated = { ...asteroid };
  
  // Update time to impact (allow negative values for cleanup)
  updated.timeToImpactHours = asteroid.timeToImpactHours - deltaTimeHours;
  
  // Improve accuracy over time if being tracked
  if (isTracked && updated.timeToImpactHours > 0) {
    const observationTime = asteroid.initialTimeToImpact - updated.timeToImpactHours;
    const improvementFactor = Math.sqrt(observationTime / 24); // Improve with sqrt of observation days
    updated.uncertaintyKm = Math.max(1, asteroid.uncertaintyKm / (1 + improvementFactor * 0.1));
    
    // Refine impact probability (move towards true value)
    const trueImpactProb = Math.random() < 0.1 ? 0.9 : 0.05; // 10% are actually dangerous
    const refinementRate = 0.02 * improvementFactor;
    updated.impactProbability = updated.impactProbability + 
      (trueImpactProb - updated.impactProbability) * refinementRate;
    updated.impactProbability = Math.max(0, Math.min(1, updated.impactProbability));
  }
  
  return updated;
}

export function calculateCasualties(asteroid: Asteroid): number {
  const sizeMultiplier = {
    tiny: 0,
    small: Math.random() < 0.1 ? 100 : 0, // 10% chance of airburst casualties
    medium: Math.floor(Math.random() * 100000) + 10000, // 10K-100K+
    large: Math.floor(Math.random() * 10000000) + 1000000, // 1M-10M+
  };
  
  const baseCasualties = sizeMultiplier[asteroid.size];
  const evacuationReduction = asteroid.evacuationOrdered ? 0.1 : 1.0;
  const alertReduction = asteroid.publicAlerted ? 0.5 : 1.0;
  
  return Math.floor(baseCasualties * evacuationReduction * alertReduction);
}

// Calculate Torino Scale level
export function getTorinoScale(asteroid: Asteroid): number {
  const energy = 0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2) / (4.184e15); // Convert to MT TNT
  const impactProb = asteroid.impactProbability;
  
  if (impactProb < 0.00001) return 0;
  if (energy < 0.01) return Math.min(1, Math.floor(impactProb * 10));
  if (energy < 1) return Math.min(4, 2 + Math.floor(impactProb * 3));
  if (energy < 1000) return Math.min(7, 5 + Math.floor(impactProb * 3));
  return Math.min(10, 8 + Math.floor(impactProb * 3));
}
