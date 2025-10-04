// Impact modeling using USGS earthquake correlation
// Educational simulation correlating asteroid impacts with seismic effects

import { Asteroid } from '../types';

export interface ImpactAssessment {
  equivalentMagnitude: number;
  energyMegatonsTNT: number;
  seismicRadius: number; // km radius for significant shaking
  tsunamiRisk: boolean;
  craterDiameter?: number; // km
  atmosphericEffects: 'none' | 'local' | 'regional' | 'global';
  casualtyEstimate: {
    min: number;
    max: number;
    evacuationReduction: number;
  };
  economicImpact: {
    localDamage: number; // billions USD
    globalImpact: number; // billions USD
  };
}

export interface EarthquakeReference {
  magnitude: number;
  location: string;
  year: number;
  casualties: number;
  description: string;
}

// Historical earthquake references for educational comparison
const EARTHQUAKE_REFERENCES: EarthquakeReference[] = [
  {
    magnitude: 6.0,
    location: "Napa Valley, California",
    year: 2014,
    casualties: 1,
    description: "Moderate damage to buildings, felt widely"
  },
  {
    magnitude: 7.0,
    location: "Haiti",
    year: 2010,
    casualties: 158000,
    description: "Devastating urban impact in populated area"
  },
  {
    magnitude: 8.0,
    location: "Sichuan, China",
    year: 2008,
    casualties: 87000,
    description: "Major earthquake affecting large region"
  },
  {
    magnitude: 9.0,
    location: "Tohoku, Japan",
    year: 2011,
    casualties: 20000,
    description: "Massive earthquake with devastating tsunami"
  },
  {
    magnitude: 9.5,
    location: "Valdivia, Chile",
    year: 1960,
    casualties: 1655,
    description: "Most powerful earthquake ever recorded"
  }
];

class ImpactModelingService {
  
  // Calculate kinetic energy of asteroid impact
  private calculateKineticEnergy(asteroid: Asteroid): number {
    // E = 0.5 * m * v^2, convert to megatons TNT (1 MT = 4.184e15 J)
    const velocityMs = asteroid.velocityKmps * 1000;
    const energyJoules = 0.5 * asteroid.massKg * Math.pow(velocityMs, 2);
    const energyMegatons = energyJoules / 4.184e15;
    return energyMegatons;
  }

  // Convert impact energy to earthquake magnitude equivalent
  private energyToMagnitude(energyMegatons: number): number {
    // Richter scale: log10(E) = 11.8 + 1.5 * M (E in ergs)
    // Converting from megatons TNT: 1 MT = 4.184e15 J = 4.184e22 ergs
    const energyErgs = energyMegatons * 4.184e22;
    const magnitude = (Math.log10(energyErgs) - 11.8) / 1.5;
    return Math.max(0, magnitude);
  }

  // Estimate crater diameter using empirical scaling
  private calculateCraterDiameter(asteroid: Asteroid, energyMegatons: number): number {
    // Empirical scaling: D = 1.8 * (E^0.31) for land impacts
    // Where D is diameter in km and E is energy in megatons
    const diameter = 1.8 * Math.pow(energyMegatons, 0.31);
    return Math.max(0.01, diameter); // Minimum 10m crater
  }

  // Assess atmospheric effects based on size and energy
  private assessAtmosphericEffects(asteroid: Asteroid, energyMegatons: number): ImpactAssessment['atmosphericEffects'] {
    if (asteroid.size === 'tiny') return 'none';
    if (asteroid.size === 'small' || energyMegatons < 1) return 'local';
    if (asteroid.size === 'medium' || energyMegatons < 1000) return 'regional';
    return 'global';
  }

  // Estimate casualties with various factors
  private estimateCasualties(asteroid: Asteroid, energyMegatons: number, seismicRadius: number) {
    let baseCasualties = 0;
    
    // Base casualties by size category (assuming populated area impact)
    switch (asteroid.size) {
      case 'tiny':
        baseCasualties = 0;
        break;
      case 'small':
        baseCasualties = Math.random() < 0.1 ? 100 : 0; // 10% chance of airburst casualties
        break;
      case 'medium':
        baseCasualties = 10000 + Math.random() * 90000; // 10K-100K
        break;
      case 'large':
        baseCasualties = 1000000 + Math.random() * 9000000; // 1M-10M
        break;
    }

    // Apply population density factor (random for simulation)
    const populationFactor = 0.1 + Math.random() * 1.9; // 0.1x to 2x multiplier
    
    const adjustedMin = Math.floor(baseCasualties * populationFactor * 0.5);
    const adjustedMax = Math.floor(baseCasualties * populationFactor * 1.5);
    
    return {
      min: adjustedMin,
      max: adjustedMax,
      evacuationReduction: 0.9 // 90% reduction with successful evacuation
    };
  }

  // Calculate economic impact
  private calculateEconomicImpact(asteroid: Asteroid, energyMegatons: number, seismicRadius: number) {
    let localDamage = 0;
    let globalImpact = 0;

    switch (asteroid.size) {
      case 'tiny':
        localDamage = 0;
        globalImpact = 0;
        break;
      case 'small':
        localDamage = 0.1 + Math.random() * 0.9; // $0.1-1B
        globalImpact = localDamage * 0.1;
        break;
      case 'medium':
        localDamage = 10 + Math.random() * 90; // $10-100B
        globalImpact = localDamage * 0.5;
        break;
      case 'large':
        localDamage = 500 + Math.random() * 1500; // $500B-2T
        globalImpact = 1000 + Math.random() * 9000; // $1-10T global impact
        break;
    }

    return { localDamage, globalImpact };
  }

  // Main assessment function
  assessImpact(asteroid: Asteroid): ImpactAssessment {
    const energyMegatons = this.calculateKineticEnergy(asteroid);
    const equivalentMagnitude = this.energyToMagnitude(energyMegatons);
    const craterDiameter = asteroid.size !== 'tiny' ? this.calculateCraterDiameter(asteroid, energyMegatons) : undefined;
    
    // Seismic radius scales with magnitude (rough approximation)
    const seismicRadius = Math.pow(10, (equivalentMagnitude - 3) * 0.5) * 10; // km
    
    // Tsunami risk for oceanic impacts of sufficient size
    const tsunamiRisk = asteroid.size !== 'tiny' && asteroid.size !== 'small' && 
                       asteroid.impactLatitude !== undefined && 
                       Math.abs(asteroid.impactLatitude) < 60; // Rough ocean probability

    const casualtyEstimate = this.estimateCasualties(asteroid, energyMegatons, seismicRadius);
    const economicImpact = this.calculateEconomicImpact(asteroid, energyMegatons, seismicRadius);
    const atmosphericEffects = this.assessAtmosphericEffects(asteroid, energyMegatons);

    return {
      equivalentMagnitude: Math.round(equivalentMagnitude * 10) / 10,
      energyMegatonsTNT: energyMegatons,
      seismicRadius: Math.round(seismicRadius),
      tsunamiRisk,
      craterDiameter,
      atmosphericEffects,
      casualtyEstimate,
      economicImpact
    };
  }

  // Find comparable historical earthquake
  findComparableEarthquake(magnitude: number): EarthquakeReference | null {
    // Find closest magnitude match
    let closest = EARTHQUAKE_REFERENCES[0];
    let minDiff = Math.abs(magnitude - closest.magnitude);

    for (const ref of EARTHQUAKE_REFERENCES) {
      const diff = Math.abs(magnitude - ref.magnitude);
      if (diff < minDiff) {
        minDiff = diff;
        closest = ref;
      }
    }

    return minDiff < 2.0 ? closest : null; // Only return if within 2 magnitude units
  }

  // Generate impact scenario description
  generateImpactScenario(asteroid: Asteroid, assessment: ImpactAssessment): string {
    const comparable = this.findComparableEarthquake(assessment.equivalentMagnitude);
    let scenario = `Impact energy equivalent to magnitude ${assessment.equivalentMagnitude} earthquake (${assessment.energyMegatonsTNT.toExponential(2)} MT TNT).`;

    if (comparable) {
      scenario += ` Similar to the ${comparable.year} ${comparable.location} earthquake (M${comparable.magnitude}): ${comparable.description}.`;
    }

    if (assessment.craterDiameter) {
      scenario += ` Expected crater diameter: ${assessment.craterDiameter.toFixed(1)}km.`;
    }

    if (assessment.seismicRadius > 0) {
      scenario += ` Significant ground shaking within ${assessment.seismicRadius}km radius.`;
    }

    if (assessment.tsunamiRisk) {
      scenario += ` TSUNAMI WARNING: Oceanic impact may generate destructive waves.`;
    }

    switch (assessment.atmosphericEffects) {
      case 'local':
        scenario += ` Local atmospheric heating and debris.`;
        break;
      case 'regional':
        scenario += ` Regional climate effects from dust injection.`;
        break;
      case 'global':
        scenario += ` GLOBAL CATASTROPHE: Worldwide climate disruption expected.`;
        break;
    }

    return scenario;
  }
}

export const impactModeling = new ImpactModelingService();
