export type AsteroidSize = 'tiny' | 'small' | 'medium' | 'large';

export interface Asteroid {
  id: string;
  name: string;
  size: AsteroidSize;
  diameterM: number;
  massKg: number;
  velocityKmps: number;
  
  // Real asteroid data for education
  realAsteroidKey?: string; // Key to asteroidInfo.json or NASA NEO reference ID
  material?: string; // e.g., "Carbonaceous (C-type)"
  density?: number; // g/cm3
  educationalBlurb?: string; // Educational description
  
  // NASA-specific data for enhanced realism
  nasaJplUrl?: string; // Link to NASA JPL database
  isPotentiallyHazardous?: boolean; // NASA PHA classification
  absoluteMagnitude?: number; // H parameter for brightness
  orbitalData?: {
    orbit_id?: string;
    eccentricity?: string;
    semi_major_axis?: string;
    inclination?: string;
    orbital_period?: string;
    perihelion_distance?: string;
    aphelion_distance?: string;
    [key: string]: string | undefined;
  };
  
  // Detection properties
  detectionDate: Date;
  detectionChance: number;
  isDetected: boolean;
  
  // Time properties
  timeToImpactHours: number;
  initialTimeToImpact: number;
  
  // Trajectory properties
  impactProbability: number;
  initialImpactProbability: number;
  trueImpactProbability: number; // The actual probability, determined at creation
  uncertaintyKm: number; // Position uncertainty
  
  // Observation state (for risk & corridor updates)
  observationArcDays?: number; // Total days of observations accumulated
  numOpticalObs?: number; // Count of optical follow-up campaigns
  numRadarObs?: number; // Count of radar campaigns
  
  // Impact properties
  impactLatitude?: number;
  impactLongitude?: number;
  impactZoneRadiusKm?: number;
  
  // Status
  isTracked: boolean;
  publicAlerted: boolean;
  evacuationOrdered: boolean;
  outcomeProcessed: boolean; // Prevents duplicate impact/miss events
  deflectionMissions: DeflectionMission[];
}

export interface DeflectionMission {
  id: string;
  type: 'kinetic' | 'nuclear' | 'gravity_tractor';
  name: string;
  launchDate: Date;
  arrivalDate: Date;
  cost: number;
  effectivenessPercent: number;
  status: 'planned' | 'launched' | 'en_route' | 'deployed' | 'failed';
}

export interface GameState {
  currentTime: Date;
  gameSpeed: number; // Speed multiplier (1 = real time, 3600 = 1 hour per second)
  isPlaying: boolean;
  
  // Resources
  budget: number; // In billions USD
  trustPoints: number; // Public trust (0-100)
  
  // Tracking capabilities
  trackingCapacity: number; // Max asteroids we can actively track
  
  // Statistics tracking
  livesAtRisk: number;
  livesSaved: number;
  falseAlarms: number;
  correctAlerts: number; // New: track correct alerts
  asteroidsTracked: number; // New: total asteroids tracked
  successfulDeflections: number; // New: successful missions
}

export interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: 'detection' | 'tracking' | 'alert' | 'mission' | 'impact' | 'miss' | 'system';
  message: string;
  asteroidId?: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}
