// NASA Near-Earth Object Web Service API integration
// Educational simulation using real NASA data
// 
// API Key Setup:
// 1. Get a free API key at: https://api.nasa.gov/
// 2. Create .env.local file in project root
// 3. Add: NEXT_PUBLIC_NASA_API_KEY=your_key_here
// 4. Current default "DEMO_KEY" has limited requests

export interface NASAAsteroidData {
  id: string;
  name: string;
  neo_reference_id: string;
  nasa_jpl_url: string;
  absolute_magnitude_h: number;
  estimated_diameter: {
    kilometers: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
    meters: {
      estimated_diameter_min: number;
      estimated_diameter_max: number;
    };
  };
  is_potentially_hazardous_asteroid: boolean;
  close_approach_data: Array<{
    close_approach_date: string;
    close_approach_date_full: string;
    epoch_date_close_approach: number;
    relative_velocity: {
      kilometers_per_second: string;
      kilometers_per_hour: string;
      miles_per_hour: string;
    };
    miss_distance: {
      astronomical: string;
      lunar: string;
      kilometers: string;
      miles: string;
    };
    orbiting_body: string;
  }>;
  orbital_data?: {
    orbit_id: string;
    orbit_determination_date: string;
    first_observation_date: string;
    last_observation_date: string;
    data_arc_in_days: number;
    observations_used: number;
    orbit_uncertainty: string;
    minimum_orbit_intersection: string;
    jupiter_tisserand_invariant: string;
    epoch_osculation: string;
    eccentricity: string;
    semi_major_axis: string;
    inclination: string;
    ascending_node_longitude: string;
    orbital_period: string;
    perihelion_distance: string;
    perihelion_argument: string;
    aphelion_distance: string;
    perihelion_time: string;
    mean_anomaly: string;
    mean_motion: string;
  };
}

export interface NASANeoFeedResponse {
  links: {
    next?: string;
    prev?: string;
    self: string;
  };
  element_count: number;
  near_earth_objects: Record<string, NASAAsteroidData[]>;
}

class NASAApiService {
  private readonly baseUrl = 'https://api.nasa.gov/neo/rest/v1';
  private readonly apiKey = process.env.NEXT_PUBLIC_NASA_API_KEY || 'DEMO_KEY';
  private NEOcache: Map<string, { data: NASANeoFeedResponse; timestamp: number }> = new Map();
  private Asteroidcache: Map<string, { data: NASAAsteroidData[]; timestamp: number }> = new Map();

  private readonly cacheTimeout = 300000; // 5 minutes

  // Get current Near-Earth Objects feed
  async getCurrentNeoFeed(startDate?: string, endDate?: string): Promise<NASANeoFeedResponse | null> {
    try {
      const today = new Date();
      const start = startDate || today.toISOString().split('T')[0];
      const end = endDate || new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const cacheKey = `neo-feed-${start}-${end}`;
      const cached = this.NEOcache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data;
      }

      const url = `${this.baseUrl}/feed?start_date=${start}&end_date=${end}&api_key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('NASA API request failed:', response.status, response.statusText);
        return null;
      }
      
      const data: NASANeoFeedResponse = await response.json();
      this.NEOcache.set(cacheKey, { data, timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.warn('Failed to fetch NASA NEO data:', error);
      return null;
    }
  }

  // Get detailed asteroid information
  async getAsteroidDetails(asteroidId: string): Promise<NASAAsteroidData | null> {
    try {
      const cacheKey = `asteroid-${asteroidId}`;
      const cached = this.Asteroidcache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return cached.data[0];
      }

      const url = `${this.baseUrl}/neo/${asteroidId}?api_key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Failed to fetch asteroid details:', response.status);
        return null;
      }
      
      const data: NASAAsteroidData = await response.json();
      const listdata = [data]
      this.Asteroidcache.set(cacheKey, { data: [data], timestamp: Date.now() });
      
      return data;
    } catch (error) {
      console.warn('Failed to fetch asteroid details:', error);
      return null;
    }
  }

  // Get browse list of asteroids
  async browseAsteroids(page = 0, size = 20): Promise<{ asteroids: NASAAsteroidData[]; totalElements: number } | null> {
    try {
      const cacheKey = `browse-${page}-${size}`;
      const cached = this.Asteroidcache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
        return {asteroids: cached.data, totalElements: size};
      }

      const url = `${this.baseUrl}/neo/browse?page=${page}&size=${size}&api_key=${this.apiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn('Failed to browse asteroids:', response.status);
        return null;
      }
      
      const data = await response.json();
      const result: { asteroids: NASAAsteroidData[]; totalElements: number } = {
        asteroids: data.near_earth_objects || [],
        totalElements: data.page?.total_elements || 0
      };
      
      this.Asteroidcache.set(cacheKey, { data: result.asteroids, timestamp: Date.now() });
      return result;
    } catch (error) {
      console.warn('Failed to browse asteroids:', error);
      return null;
    }
  }

  // Convert NASA data to game asteroid format
  convertNASADataToGameAsteroid(nasaAsteroid: NASAAsteroidData, gameTime: Date, requireMinSize: boolean = true) {
    const closeApproach = nasaAsteroid.close_approach_data?.[0];
    if (!closeApproach) return null;

    const approachDate = new Date(closeApproach.close_approach_date);
    const timeToImpactHours = (approachDate.getTime() - gameTime.getTime()) / (1000 * 60 * 60);
    
    // Skip asteroids that have already passed or are too far in the future
    if (timeToImpactHours < 0 || timeToImpactHours > 8760) { // 1 year max
      return null;
    }

    // Use the mean of NASA's diameter range for better central estimate
    const dMin = nasaAsteroid.estimated_diameter.meters.estimated_diameter_min;
    const dMax = nasaAsteroid.estimated_diameter.meters.estimated_diameter_max;
    const diameter = (dMin + dMax) / 2;
    const velocity = parseFloat(closeApproach.relative_velocity.kilometers_per_second);
    const missDistanceKm = parseFloat(closeApproach.miss_distance.kilometers);
    
    // Convert NASA data to our game format
    let size: 'tiny' | 'small' | 'medium' | 'large';
    if (diameter < 5) size = 'tiny';
    else if (diameter < 20) size = 'small';
    else if (diameter < 140) size = 'medium';
    else size = 'large';

    // Skip tiny and small asteroids if minimum size is required (for deflection scenarios)
    if (requireMinSize && (size === 'tiny' || size === 'small')) {
      return null;
    }

    // Calculate impact probability based on miss distance and uncertainty
    // This is for educational purposes - real impact probabilities are much more complex
    const earthRadiusKm = 6371;
    const impactProbability = nasaAsteroid.is_potentially_hazardous_asteroid 
      ? Math.min(0.15, 1 / (1 + missDistanceKm / (earthRadiusKm * 10)))
      : Math.min(0.05, 1 / (1 + missDistanceKm / (earthRadiusKm * 100)));
      
    // Calculate true impact probability with some variation for gameplay
    const variationFactor = 0.5 + Math.random() * 1.5; // 50% to 200% of calculated probability
    const trueImpactProbability = Math.min(0.95, Math.max(0.001, impactProbability * variationFactor));

    return {
      id: nasaAsteroid.neo_reference_id,
      name: nasaAsteroid.name.replace(/[()]/g, ''), // Clean up name
      size,
      diameterM: diameter,
      nasaDiameterMinM: dMin,
      nasaDiameterMaxM: dMax,
      massKg: this.estimateMass(diameter),
      velocityKmps: velocity,
      
      // NASA educational data
      realAsteroidKey: nasaAsteroid.neo_reference_id,
      material: this.estimateMaterial(nasaAsteroid.absolute_magnitude_h, diameter),
      density: this.estimateDensity(size),
      educationalBlurb: this.createEducationalBlurb(nasaAsteroid),
      
      detectionDate: new Date(gameTime.getTime() - Math.random() * 24 * 60 * 60 * 1000),
      detectionChance: 0.95, // NASA data is already detected
      isDetected: true,
      
      timeToImpactHours,
      initialTimeToImpact: timeToImpactHours,
      
      impactProbability,
      initialImpactProbability: impactProbability,
      trueImpactProbability,
      uncertaintyKm: this.estimateUncertainty(nasaAsteroid),
      
      impactLatitude: (Math.random() - 0.5) * 120, // Random but plausible
      impactLongitude: (Math.random() - 0.5) * 360,
      impactZoneRadiusKm: this.getImpactZoneRadius(size),
      
      isTracked: false,
      publicAlerted: false,
      evacuationOrdered: false,
      outcomeProcessed: false,
      deflectionMissions: [],
      
      // NASA specific data for education
      nasaJplUrl: nasaAsteroid.nasa_jpl_url,
      isPotentiallyHazardous: nasaAsteroid.is_potentially_hazardous_asteroid,
      absoluteMagnitude: nasaAsteroid.absolute_magnitude_h,
      orbitalData: nasaAsteroid.orbital_data,
    };
  }

  private estimateMass(diameterM: number): number {
    // Estimate mass using a density-by-size heuristic and a shape/porosity factor
    // 1) Classify size to pick a plausible density (in g/cm³), then convert to kg/m³
    let size: 'tiny' | 'small' | 'medium' | 'large';
    if (diameterM < 5) size = 'tiny';
    else if (diameterM < 20) size = 'small';
    else if (diameterM < 140) size = 'medium';
    else size = 'large';

    const densityGcm3 = this.estimateDensity(size); // g/cm³
    const densityKgm3 = densityGcm3 * 1000; // kg/m³

    // 2) Assume slightly irregular (voids/porosity): apply shape factor ~0.9
    const shapeFactor = 0.9;
    const radius = diameterM / 2;
    const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
    return volume * densityKgm3 * shapeFactor;
  }

  private estimateMaterial(absoluteMagnitude: number, diameterM: number): string {
    // Rough classification based on size and brightness
    if (diameterM > 100) return 'Stony (S-type)';
    if (absoluteMagnitude < 18) return 'Metallic (M-type)';
    return 'Carbonaceous (C-type)';
  }

  private estimateDensity(size: 'tiny' | 'small' | 'medium' | 'large'): number {
    const densities = { tiny: 2.0, small: 2.3, medium: 2.5, large: 2.8 };
    return densities[size];
  }

  private estimateUncertainty(nasaAsteroid: NASAAsteroidData): number {
    const orbitalData = nasaAsteroid.orbital_data;
    if (orbitalData?.orbit_uncertainty) {
      const uncertainty = parseInt(orbitalData.orbit_uncertainty);
      return Math.max(50, uncertainty * 1000); // Convert to rough km uncertainty
    }
    return 5000; // Default uncertainty
  }

  private getImpactZoneRadius(size: 'tiny' | 'small' | 'medium' | 'large'): number {
    const radii = { tiny: 0, small: 10, medium: 100, large: 1000 };
    return radii[size];
  }

  private createEducationalBlurb(nasaAsteroid: NASAAsteroidData): string {
    const hazardous = nasaAsteroid.is_potentially_hazardous_asteroid ? 'classified as potentially hazardous' : 'not considered hazardous';
    const dMin = nasaAsteroid.estimated_diameter.meters.estimated_diameter_min;
    const dMax = nasaAsteroid.estimated_diameter.meters.estimated_diameter_max;
    const dMean = (dMin + dMax) / 2;
    return `This Near-Earth Object is ${hazardous} by NASA. Estimated diameter: ${dMin.toFixed(0)}–${dMax.toFixed(0)} m (mean ${dMean.toFixed(0)} m). Simulation note: this app explores hypothetical Earth-impact scenarios for education and may differ from NASA's current hazard classification. Data from NASA's Center for Near Earth Object Studies (CNEOS).`;
  }
}

export const nasaApi = new NASAApiService();
