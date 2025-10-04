import { Asteroid, AsteroidSize } from './types';
import { ASTEROID_SIZE_CONFIGS } from './constants';
import asteroidInfo from '../../data/asteroidInfo.json';
import { nasaApi, NASAAsteroidData } from './services/nasaApi';

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function massFromDiameter(diameterM: number, densityKgM3: number): number {
  const radius = diameterM / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  return volume * densityKgM3;
}

// Cache for NASA asteroid data
let nasaAsteroidsCache: NASAAsteroidData[] = [];
let lastNASAFetch = 0;
const NASA_CACHE_TIMEOUT = 300000; // 5 minutes

export async function fetchNASAAsteroids(): Promise<NASAAsteroidData[]> {
  const now = Date.now();
  if (nasaAsteroidsCache.length > 0 && (now - lastNASAFetch) < NASA_CACHE_TIMEOUT) {
    return nasaAsteroidsCache;
  }

  try {
    // Try to fetch current NEO feed first
    const neoFeed = await nasaApi.getCurrentNeoFeed();
    if (neoFeed && neoFeed.near_earth_objects) {
      const asteroids: NASAAsteroidData[] = [];
      Object.values(neoFeed.near_earth_objects).forEach(dayAsteroids => {
        asteroids.push(...dayAsteroids);
      });
      
      if (asteroids.length > 0) {
        nasaAsteroidsCache = asteroids;
        lastNASAFetch = now;
        return asteroids;
      }
    }

    // Fallback to browse API if feed is empty
    const browseResult = await nasaApi.browseAsteroids(0, 50);
    if (browseResult && browseResult.asteroids.length > 0) {
      nasaAsteroidsCache = browseResult.asteroids;
      lastNASAFetch = now;
      return browseResult.asteroids;
    }
  } catch (error) {
    console.warn('Failed to fetch NASA asteroids, using fallback data');
  }

  return [];
}

export async function generateAsteroid(currentTime: Date): Promise<Asteroid> {
  // Try to use real NASA data first (80% chance for demo)
  const useNASAData = Math.random() < 0.8;
  
  if (useNASAData) {
    const nasaAsteroids = await fetchNASAAsteroids();
    if (nasaAsteroids.length > 0) {
      // Try multiple times to find a medium or large asteroid suitable for deflection scenarios
      const maxAttempts = Math.min(10, nasaAsteroids.length);
      const shuffled = [...nasaAsteroids].sort(() => Math.random() - 0.5);
      
      for (let i = 0; i < maxAttempts; i++) {
        const randomNASA = shuffled[i];
        // requireMinSize = true filters out tiny/small asteroids
        const convertedAsteroid = nasaApi.convertNASADataToGameAsteroid(randomNASA, currentTime, true);
        
        if (convertedAsteroid) {
          return convertedAsteroid as Asteroid;
        }
      }
      
      // If all attempts failed to find a suitable NASA asteroid, log it
      console.log('No suitable medium/large NASA asteroids found, using generated asteroid');
    }
  }

  type CelestialBody = {
    size: string;
    weight: string;
    material: string;
    density: string;
    blurb: string;
  };


  // Fallback to original generation logic
  // Get real asteroid data for educational purposes
  const realAsteroidKeys = Object.keys(asteroidInfo);
  const useRealData = Math.random() < 0.7; // 70% chance to use real asteroid data
  
  let realAsteroidKey: string | undefined;
  let realAsteroidData: CelestialBody | undefined;
  let size: AsteroidSize;
  
  if (useRealData && realAsteroidKeys.length > 0) {
    realAsteroidKey = realAsteroidKeys[Math.floor(Math.random() * realAsteroidKeys.length)];
    realAsteroidData = asteroidInfo[realAsteroidKey as keyof typeof asteroidInfo];
    
    // Determine size from real asteroid dimensions (thresholds in meters)
    const sizeString = realAsteroidData.size;
    const diameterMatch = sizeString.match(/(\d+\.?\d*)\s*km/);
    const diameterKm = diameterMatch ? parseFloat(diameterMatch[1]) : 1;
    const diameterMForSizing = diameterKm * 1000;
    
    // Match thresholds used elsewhere: tiny <5 m, small <20 m, medium <140 m, else large
    if (diameterMForSizing < 5) size = 'tiny';
    else if (diameterMForSizing < 20) size = 'small';
    else if (diameterMForSizing < 140) size = 'medium';
    else size = 'large';
  } else {
    // Randomly select size category (favor medium/large for better deflection scenarios)
    const sizeRoll = Math.random();
    if (sizeRoll < 0.10) size = 'tiny';        // 10% tiny (reduced for better gameplay)
    else if (sizeRoll < 0.25) size = 'small';  // 15% small
    else if (sizeRoll < 0.70) size = 'medium'; // 45% medium (increased for more interesting scenarios)
    else size = 'large';                       // 30% large (increased for challenging scenarios)
  }
  
  const config = ASTEROID_SIZE_CONFIGS[size];
  
  let diameterM, massKg, density, material, educationalBlurb;
  
  if (realAsteroidData) {
    // Use real asteroid data
    const sizeString = realAsteroidData.size;
    const diameterMatch = sizeString.match(/(\d+\.?\d*)\s*km/);
    diameterM = diameterMatch ? parseFloat(diameterMatch[1]) * 1000 : randomBetween(config.diameterRange[0], config.diameterRange[1]);
    
    // Extract mass if available, otherwise compute from density if provided
    if (realAsteroidData.weight && realAsteroidData.weight !== 'unknown') {
      const massMatch = realAsteroidData.weight.match(/(\d+\.?\d*)×10\^(\d+)/);
      massKg = massMatch ? parseFloat(massMatch[1]) * Math.pow(10, parseInt(massMatch[2])) : undefined as unknown as number;
    }
    
    material = realAsteroidData.material;
    educationalBlurb = realAsteroidData.blurb;
    
    // Use real density if available (g/cm³), else fallback
    if (realAsteroidData.density && realAsteroidData.density !== 'unknown') {
      const densityMatch = realAsteroidData.density.match(/(\d+\.?\d*)/);
      density = densityMatch ? parseFloat(densityMatch[1]) : config.densityKgM3 / 1000;
    } else {
      density = config.densityKgM3 / 1000; // Convert to g/cm3
    }

    // If mass not parsed, compute using parsed density (converted to kg/m³) and shape factor
    if (massKg === undefined || Number.isNaN(massKg)) {
      const densityKgm3 = (density ?? config.densityKgM3 / 1000) * 1000;
      const shapeFactor = 0.9;
      const radius = diameterM / 2;
      const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
      massKg = volume * densityKgm3 * shapeFactor;
    }
  } else {
    // Use generated values
    diameterM = randomBetween(config.diameterRange[0], config.diameterRange[1]);
    // Compute mass using size-based density with shape factor for irregularity
    const shapeFactor = 0.9;
    massKg = massFromDiameter(diameterM, config.densityKgM3) * shapeFactor;
    density = config.densityKgM3 / 1000; // Convert to g/cm3
    material = size === 'large' ? 'Stony (S-type)' : size === 'medium' ? 'Carbonaceous (C-type)' : 'Metallic (M-type)';
  }
  
  const velocityKmps = randomBetween(11, 70); // Typical Earth encounter velocities
  
  const timeToImpactHours = randomBetween(config.timeToImpactRange[0], config.timeToImpactRange[1]);
  
  // Detection chance decreases with smaller size and less time
  const detectionChance = config.detectionChance * (timeToImpactHours / config.timeToImpactRange[1]);
  const isDetected = Math.random() < detectionChance;
  
  // Calculate a more realistic true impact probability
  // Base it on the initial probability with some variation
  const baseProb = config.initialImpactProb;
  const variationFactor = randomBetween(0.3, 2.0); // 30% to 200% of base
  const trueImpactProbability = Math.min(0.95, Math.max(0.001, baseProb * variationFactor));
  
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
    trueImpactProbability,
    uncertaintyKm,
    
    impactLatitude,
    impactLongitude,
    impactZoneRadiusKm: config.impactZoneKm,
    
    isTracked: false,
    publicAlerted: false,
    evacuationOrdered: false,
    outcomeProcessed: false,
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
    const refinementRate = 0.05 * improvementFactor; // Increased rate for better gameplay
    updated.impactProbability = updated.impactProbability + 
      (asteroid.trueImpactProbability - updated.impactProbability) * refinementRate;
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

// =========================
// Risk & Observation Utils
// =========================

// Convert kinetic energy to MT TNT equivalent for Palermo scale and education
export function computeImpactEnergyMT(asteroid: Asteroid): number {
  const kineticEnergyJ = 0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2);
  return kineticEnergyJ / 4.184e15;
}

// Very rough background frequency model by impact energy (educational)
export function approximateBackgroundImpactFrequencyPerYear(energyMT: number): number {
  // Refined approximation based on bolide frequency scaling (Brown et al.)
  // Roughly: N(>E) ~ k * E^{-0.9..1.0}; convert to differential annual frequency for given MT
  // Here we use a smoothed curve anchored near Chelyabinsk (~0.5 Mt every few decades)
  const E = Math.max(energyMT, 0.01);
  const k = 0.03; // anchor constant
  const alpha = 0.95; // slope in MT domain
  const f = k * Math.pow(E, -alpha);
  return Math.max(1e-8, Math.min(50, f));
}

// Palermo Scale (log10 of risk vs background)
export function getPalermoScale(asteroid: Asteroid): number {
  const energyMT = computeImpactEnergyMT(asteroid);
  const fBackground = approximateBackgroundImpactFrequencyPerYear(energyMT);
  const years = Math.max(asteroid.timeToImpactHours / (365.25 * 24), 0.01);
  const annualizedRisk = asteroid.impactProbability / years;
  const ratio = Math.max(1e-12, annualizedRisk / fBackground);
  return Math.log10(ratio);
}

// Estimate a simple impact corridor band across Earth for visualization
export function estimateImpactCorridorParams(asteroid: Asteroid): { angleDeg: number; widthKm: number; lengthKm: number } {
  const baseAngle = (asteroid.id.charCodeAt(0) * 17) % 360; // pseudo-stable orientation
  const widthKm = Math.max(10, Math.min(5000, asteroid.uncertaintyKm * 1.5));
  const earthDiameterKm = 2 * 6371;
  const lengthKm = earthDiameterKm * 1.1; // extend slightly beyond disk
  return { angleDeg: baseAngle, widthKm, lengthKm };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Apply effects of an optical follow-up campaign (educational approximation)
export function applyOpticalFollowUp(asteroid: Asteroid): Asteroid {
  const updated: Asteroid = { ...asteroid };
  updated.isTracked = true;
  updated.uncertaintyKm = Math.max(1, asteroid.uncertaintyKm * 0.7);
  updated.impactProbability = clamp01(
    asteroid.impactProbability + (asteroid.trueImpactProbability - asteroid.impactProbability) * 0.3
  );
  // Track observation arc length if present
  updated.observationArcDays = (updated.observationArcDays ?? 0) + 3;
  updated.numOpticalObs = (updated.numOpticalObs ?? 0) + 1;
  return updated;
}

// Apply effects of a radar campaign (educational approximation)
export function applyRadarCampaign(asteroid: Asteroid): Asteroid {
  const updated: Asteroid = { ...asteroid };
  updated.isTracked = true;
  updated.uncertaintyKm = Math.max(1, asteroid.uncertaintyKm * 0.4);
  updated.impactProbability = clamp01(
    asteroid.impactProbability + (asteroid.trueImpactProbability - asteroid.impactProbability) * 0.6
  );
  updated.numRadarObs = (updated.numRadarObs ?? 0) + 1;
  return updated;
}