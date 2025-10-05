// Optimized version of DamageValues.ts with performance improvements
// impact_effects.ts
// Functions extracted from study at https://impact.ese.ic.ac.uk/ImpactEarth/ImpactEffects/effects.pdf
import { number } from "framer-motion";
import { fromUrl, GeoTIFF, GeoTIFFImage } from "geotiff";
import { EARTH_R_M } from "./EarthImpact";

export type Damage_Inputs = {
  mass: number; // kg
  L0: number; // m
  rho_i: number; // kg/m^3
  v0: number; // m/s
  theta_deg: number; // degrees from horizontal
  is_water: boolean; // true for water target
  K?: number; // luminous efficiency
  Cd?: number; // drag coefficient
  rho0?: number; // atmosphere surface density for breakup (kg/m^3)
  H?: number; // scale height (m)
  latitude?: number; // for population check
  longitude?: number; // 
};

export type Damage_Results = {
  E_J: number;
  E_Mt: number;
  Tre_years: number;
  m_kg: number;
  zb_breakup: number; // m
  airburst: boolean;
  v_impact_for_crater: number;
  Rf_m: number | null;
  r_clothing_m: number;
  r_2nd_burn_m: number;
  r_3rd_burn_m: number;
  Dtc_m: number | null;
  dtc_m: number | null;
  Dfr_m: number | null;
  dfr_m: number | null;
  Vtc_km3: number | null;
  Vtc_over_Ve: number | null;
  earth_effect: 'destroyed' | 'strongly_disturbed' | 'negligible_disturbed';
  Magnitude: number | null;
  radius_M_ge_7_5_m: number | null;
  earthquake_description: string | undefined;
  airblast_radius_building_collapse_m: number | null; // p=42600 Pa
  airblast_radius_glass_shatter_m: number | null; // p=6900 Pa
  overpressure_at_50_km: number | null;
  wind_speed_at_50_km: number | null;
  ionization_radius: number;
};

// Constants
const MT_TO_J = 4.184e15;
const G = 9.81;
const VE_KM3 = 1.083e12; // Earth's volume km^3 for comparison
const GLOBAL_POP = 8_250_000_000;
const GLOBAL_AVERAGE_DENSITY = 50;
const HALF_CIRCUMFERENCE_M = 20037508.34;
const EARTH_DIAMETER = 12756e3; // in meters


const DEFAULTS = {
  K: 3e-3,
  Cd: 2.0,
  rho0: 1.0,
  H: 8000,
  fp: 7,
  rho_air_for_wind: 1.2,
  burn_horizon_m: 1_500_000, // 1500 km cap
  water_depth_m: 3682,
  density_water: 1000,
  water_drag_coeff: 0.877
};

// Add caching for API results
const populationCache = new Map<string, { density: number; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes


// energy and mass
export function energyFromDiameter(m: number, v0: number) {
  const E_J = 0.5 * m * v0 * v0;
  const E_Mt = E_J / MT_TO_J;
  return { m, E_J, E_Mt };
}

// intact surface velocity from drag eq (eq.8* simplified)
export function intactSurfaceVelocity(v0: number, L0: number, rho_i: number, theta_rad: number, Cd = DEFAULTS.Cd, rho0 = DEFAULTS.rho0, H = DEFAULTS.H) {
  // v_surface = v0 * exp(-3*Cd*rho0*FH/(4*rho_i*L0*sin(theta)))
  const sinT = Math.sin(theta_rad);
  const denom = 4 * rho_i * L0 * sinT;
  const factor = (3 * Cd * rho0 * H) / denom;
  const v_surface = v0 * Math.exp(-factor);
  return v_surface;
}

function strengthFromDensity(rho_i: number): number {
  return Math.pow(10, 2.107 + 0.0624 * rho_i);
}

// Atmospheric density at altitude z
function atmosphericDensity(z: number, rho0 = DEFAULTS.rho0, H = DEFAULTS.H): number {
  return rho0 * Math.exp(-z / H);
}


// breakup If and altitude z* (analytic approx)
export function breakupIfAndZstar(Lo: number, rho_i: number, vo: number, theta_rad: number, CD = DEFAULTS.Cd, H = DEFAULTS.H, rho_0 = DEFAULTS.rho0) {
  // Calculate the yield strength Y_i using the empirical formula.
  const Yi = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho_i));
  
  // Calculate the breakup parameter I_f.
  const If = (CD * H * Yi) / (rho_i * Lo * Math.pow(vo, 2) * Math.sin(theta_rad));
  
  // Determine if breakup occurs.
  const breakup = If < 1;
  
  let z_star = 0;
  // If breakup occurs, calculate the breakup altitude z_star.
  if (breakup) {
    z_star = -H * (Math.log(Yi / (rho_0 * Math.pow(vo, 2))) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If));
  }
  
  return { If, z_star, breakup };
}

export function pancakeAirburstAltitude(Lo: number, rho_i: number, theta_rad: number, z_star: number, H = DEFAULTS.H, fp = DEFAULTS.fp, CD = DEFAULTS.Cd) {
  // The document uses rho(z*) which is the atmospheric density at the breakup altitude.
  // We need to use the provided atmosphericDensity function to get this value.
  const rho_z_star = atmosphericDensity(z_star);
  
  // Calculate the dispersion length scale 'l'.
  const l = Lo * Math.sin(theta_rad) * Math.sqrt(rho_i / (CD * rho_z_star));
  
  // Calculate the airburst altitude z_b using the rearranged equation.
  const zb = z_star - 2 * H * Math.log(1 + (l / (2 * H)) * Math.sqrt(Math.pow(fp, 2) - 1));
  
  if (zb < 0) return 0;
  return zb;
}

// fireball radius
export function fireballRadius(E_J: number) {
  // Rf = 0.002 * E^(1/3) with E in joules
  return Math.min(EARTH_R_M, 0.002 * Math.pow(E_J, 1 / 3));
}

// 7) burn radii (clothing, 2nd, 3rd) with horizon cap
export function burnRadii(E_Mt: number, E_J: number, K = DEFAULTS.K) {
  const thresholds_1Mt_MJ = {
    clothing: 1.0,
    second: 0.25,
    third: 0.42,
  } as const;

  const results: { clothing: number; second: number; third: number } = { clothing: 0, second: 0, third: 0 };
  for (const key of Object.keys(thresholds_1Mt_MJ) as (keyof typeof thresholds_1Mt_MJ)[]) {
    const thr_MJ = thresholds_1Mt_MJ[key];
    const thr_J = thr_MJ * 1e6;
    const thr_scaled = thr_J * Math.pow(Math.max(E_Mt, 1e-12), 1 / 6);
    const r = Math.sqrt((K * E_J) / (2 * Math.PI * thr_scaled));
    results[key] = Math.min(r, DEFAULTS.burn_horizon_m);
  }
  return results;
}

// 8) crater scaling
export function transientCrater(L0: number, rho_i: number, v_i: number, theta_rad: number, is_water: boolean) {
  const rho_t = is_water ? 2700 : 2500;
  v_i = is_water ? v_i*Math.exp(-3*DEFAULTS.density_water*DEFAULTS.water_drag_coeff*DEFAULTS.water_depth_m/(2*L0*Math.sin(theta_rad)*rho_i)) : v_i;
  const coeff  = 1.161;
  const term = Math.pow(rho_i / rho_t, 1 / 3);
  let Dtc = coeff * term * Math.pow(L0, 0.78) * Math.pow(v_i, 0.44) * Math.pow(G, -0.22) * Math.pow(Math.sin(theta_rad), 1 / 3);
  let dtc = Dtc / (2 * Math.sqrt(2));
  // final diameter
  let Dfr: number;
  let dfr: number;
  if (Dtc < 3200) {
    Dfr = 1.25 * Dtc;
    dfr = dtc;
  } else {
    Dfr = 1.17 * Math.pow(Dtc, 1.13) / Math.pow(3200, 0.13);
    dfr = 1000*(0.294 * Math.pow(Dfr/1000, 0.301));
  }
  [Dtc, dtc, Dfr, dfr] = [Dtc, dtc, Dfr, dfr].map(x  => Math.min(x, EARTH_DIAMETER));
  return { Dtc, dtc, Dfr, dfr };
}


export function oceanWaterCrater(L0: number, rho_i: number, v_i: number, theta_rad: number) {
  const coeff = 1.365 
  const rho_t = 1000 // ocean water density
  const term = Math.pow(rho_i / rho_t, 1 / 3);
  const Dtc = coeff * term * Math.pow(L0, 0.78) * Math.pow(v_i, 0.44) * Math.pow(G, -0.22) * Math.pow(Math.sin(theta_rad), 1 / 3);
  return Dtc
}


// 9) transient crater volume and Earth effect
export function craterVolumeAndEffect(Dtc_m: number) {
  if (Dtc_m >= EARTH_DIAMETER) {
    return { Vtc_km3: VE_KM3, ratio: 1, effect: 'destroyed'as Damage_Results['earth_effect'] };
  }
  // Vtc = pi * Dtc^3 / (16*sqrt(2))  (m^3)
  const Vtc_m3 = Math.PI * Math.pow(Dtc_m, 3) / (16 * Math.sqrt(2));
  const Vtc_km3 = Vtc_m3 / 1e9;
  const ratio = Math.min(Vtc_km3 / VE_KM3, 1);
  let effect: Damage_Results['earth_effect'] = 'negligible_disturbed';
  if (ratio > 0.5) effect = 'destroyed';
  else if (ratio >= 0.1) effect = 'strongly_disturbed';
  return { Vtc_km3, ratio, effect };
}

const massive_Earthquake_milestones = {
  12: "Very large regional catastrophe. Cities destroyed across hundreds of kilometers. Surface ruptures tens of meters deep. Major tsunamis if offshore.",
  12.8: "Over 1 yottajoule (1 septillion joules) of energy. Continental-scale disruption. Massive atmospheric dust/aerosol injection. Years-scale crop failures and global transport breakdown.",
  13.5: "Extreme continental catastrophe. Ruptures propagate across multiple major faults. Multi-kilometre vertical offsets and regional collapse of mountain belts. Widespread permanent changes to coastlines and drainage. Very large tsunamis for offshore events.",
  14.2: "Global mechanical crisis. Cascading ruptures trigger major volcanic systems and widespread crustal failure. Kilometer-scale fissuring in multiple regions. Prolonged, planet-wide seismic shaking.",
  15: "Over 64% of the energy needed to vaporize all oceans. Global ocean surface superheating and massive steam injection to the atmosphere.",
  15.13: "Beyond the theoretical threshold to vaporize Earth’s oceans. Energy deposited globally would boil oceans completely",
  16.2: "Planet-scale resurfacing and mantle upheaval. Global crustal meltdown. Planet effectively sterilized"
}

// 10) seismic magnitude and radius for Meff >= 7.5
export function seismicMagnitudeAndRadius(E_J: number, threshold = 7.5) {
  const M = 0.67 * Math.log10(E_J) - 5.87;
  // piecewise radii. solve each piece for r_km bounds
  // piece1 (<60): Meff = M - 0.0238*r => r = (M - threshold)/0.0238
  const r1 = (M - threshold) / 0.0238; // km
  if (r1 >= 0 && r1 <= 60) return { M, radius_km: r1, radius_m: r1 * 1000 };
  // piece2 (60..700): Meff = M - 0.0048*r -1.1644 => r = (M -1.1644 - threshold)/0.0048
  const r2 = (M - 1.1644 - threshold) / 0.0048;
  if (r2 >= 60 && r2 <= 700) return { M, radius_km: r2, radius_m: r2 * 1000 };
  // piece3 (>700): Meff = M -1.66*log10(r) -6.399 => solve for r
  // rearrange: log10(r) = (M -6.399 - threshold)/1.66
  const exp3 = Math.pow(10, (M - 6.399 - threshold) / 1.66);
  if (exp3 > 700) return { M, radius_km: exp3, radius_m: exp3 * 1000 };

  const milestones = [12.0, 12.8, 13.5, 14.2, 15.0, 15.13, 16.2]

  const floor = milestones.reduce((prev, curr) => curr - M <= 0  ? curr : prev);
  const description = massive_Earthquake_milestones[floor as keyof typeof massive_Earthquake_milestones] || "";


  // none satisfied => no radius where Meff >= threshold
  return { M, radius_km: null, radius_m: null, description: description };
}


export function peakOverpressureAtR(
  r_m: number,
  E_Mt: number,
  zb_m: number
): number {
  const P_X = 75000; // Crossover pressure (Pa)

  // 1. Convert Energy and Apply Yield Scaling
  const E_kt = E_Mt * 1000; // Energy in kilotons (kt)
  const yield_factor = Math.pow(E_kt, 1 / 3);
  const r_1 = r_m / yield_factor; // Equivalent 1kt distance (m)

  // Helper function for Overpressure Formula 54
  const calculateOverpressureEq54 = (r_x: number, r_1: number): number => {
    const ratio_term = Math.pow(r_x / r_1, 1.3);
    const p = (P_X * r_x / (4 * r_1)) * (1 + 3 * ratio_term);
    return p;
  };

  let peak_overpressure: number;

  // 2. Determine Burst Type (Surface vs. Airburst)

  // A. Surface Burst (zb_m <= 0)
  if (zb_m <= 0) {
    const r_x_surface = 290; // Standard crossover distance for 1kt surface burst (m)
    peak_overpressure = calculateOverpressureEq54(r_x_surface, r_1);
  }
  // B. Airburst (zb_m > 0)
  else {
    // Crossover altitude for mach region determination
    const Z_CRITICAL = 550; // m

    // Determine if Mach Reflection Region applies
    const r_m1 = (Z_CRITICAL * zb_m) / (1.2 * (Z_CRITICAL - zb_m));

    // Check if within Mach Region (or if zb_m is high)
    if (zb_m >= Z_CRITICAL || r_1 > r_m1) {
      // ii. Outside Mach Reflection Region -> Use Exponential Decay (Eq 55)
      // p = p_0 * e^(-beta * r_1)

      // p_0 = 3.14 * 10^11 * zb_m^(-2.6)
      const p_0 = 3.14e11 * Math.pow(zb_m, -2.6);

      // beta = 34.87 * zb_m
      const beta = 34.87 * Math.pow(zb_m, -1.73);

      peak_overpressure = p_0 * Math.exp(-beta * r_1);
    } else {
      // i. Within Mach Reflection Region (or High Altitude) -> Use Eq 54 with modified r_x
      const r_x_airburst = 289 + 0.65 * zb_m;
      peak_overpressure = calculateOverpressureEq54(r_x_airburst, r_1);
    }
  }

  return peak_overpressure;
}


// findRadiusForOverpressure: robust bisection using monotonicity of p(r).
export function findRadiusForOverpressure(
  targetP: number,
  E_Mt: number,
  zb_m: number,
  r_min: number,
  r_max = HALF_CIRCUMFERENCE_M // 12,756 km
): number {
  if (zb_m > 0) r_min = 0;
  if (!isFinite(targetP) || targetP <= 0) return NaN;
  if (r_min <= 0) r_min = 1e-6;

  const pAtMin = peakOverpressureAtR(r_min, E_Mt, zb_m);
  const pAtMax = peakOverpressureAtR(r_max, E_Mt, zb_m);

  // If target is >= pressure at r_min, return r_min (very close).
  if (targetP >= pAtMin) return r_min;
  // If target is <= pressure at r_max, return r_max (beyond range).
  if (targetP <= pAtMax) return r_max;

  // Bisection on [lo, hi] such that p(lo) >= target >= p(hi).
  let lo = r_min;
  let hi = r_max;
  const maxIter = 200;
  const tol = 1e-6;

  for (let i = 0; i < maxIter && (hi - lo) / Math.max(1, lo) > tol; i++) {
    const mid = 0.5 * (lo + hi);
    const pmid = peakOverpressureAtR(mid, E_Mt, zb_m);
    if (pmid >= targetP) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return 0.5 * (lo + hi);
}

let gpwTiff: GeoTIFF | null = null;
let gpwImage: GeoTIFFImage | null = null;

async function initGPW() {
  if (!gpwTiff) {
    gpwTiff = await fromUrl("/populationData/gpw_v4_population_density_2020_30_min.tif");
    gpwImage = await gpwTiff.getImage();
  }
}

// Improved population density function with caching and max sampling over neighborhood
async function populationDensityAt(
  lat: number,
  lon: number,
  kmRadius = 30  // 30 km radius
): Promise<number> {
  await initGPW();

  const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)},${kmRadius}`;
  const cached = populationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.density;
  }

  const degLat = kmRadius / 111; // ~1 deg ≈ 111 km
  const degLon = kmRadius / (111 * Math.cos((lat * Math.PI) / 180));

  const tiepoint = gpwImage?.getTiePoints()[0]; // top-left corner
  const pixelScale = gpwImage?.getFileDirectory().ModelPixelScale; // [scaleX, scaleY, scaleZ]
  const lonOrigin = tiepoint.x;
  const latOrigin = tiepoint.y;
  const scaleX = pixelScale[0];
  const scaleY = pixelScale[1]; // usually positive, Y decreases downward

  function latLonToPixel(lon: number, lat: number): [number, number] {
    const x = (lon - lonOrigin) / scaleX;
    const y = (latOrigin - lat) / scaleY; // flip Y
    return [x, y];
  }

  // Sample points: center + 8 points around the radius (like a compass)
  const sampleOffsets: [number, number][] = [
    [0, 0],             // center
    [degLat, 0],        // north
    [-degLat, 0],       // south
    [0, degLon],        // east
    [0, -degLon],       // west
    [degLat / 1.414, degLon / 1.414],    // northeast
    [degLat / 1.414, -degLon / 1.414],   // northwest
    [-degLat / 1.414, degLon / 1.414],   // southeast
    [-degLat / 1.414, -degLon / 1.414],  // southwest
  ];

  let maxDensity = 0;

  for (const [dLat, dLon] of sampleOffsets) {
    const sampleLat = lat + dLat;
    const sampleLon = lon + dLon;

    const [px, py] = latLonToPixel(sampleLon, sampleLat);
    const ix = Math.floor(px);
    const iy = Math.floor(py);

    // read a small 3x3 pixel window around this point
    const window = [
      ix - 1, iy - 1,
      ix + 2, iy + 2
    ];

    const data = await gpwImage?.readRasters({ window });
    const rasterValues = data?.[0] as number[] | Float32Array | Uint16Array;
    const values: number[] = Array.from(rasterValues).filter(v => v > 0);

    if (values.length > 0) {
      const localMax = Math.max(...values);
      if (localMax > maxDensity) maxDensity = localMax;
    }
  }

  populationCache.set(cacheKey, { density: maxDensity, timestamp: Date.now() });
  return maxDensity;
}


// Get size-based scaling factor
function getSizeScalingFactor(diameter_m: number): number {
  return diameter_m**2/1e7
}


// Calculate population density with more realistic scaling
function calculateEffectiveDensity(
  area_km2: number,
  localDensity: number,
  diameter_m: number,
  isAirburst: boolean
): number {
  // Base density adjustment - smaller asteroids affect smaller areas more precisely
  const precisionFactor = diameter_m < 500 ? 2.0 : diameter_m < 1000 ? 1.5 : 1.0;
  let adjustedDensity = localDensity * precisionFactor;

  // For very small asteroids in low-density areas, cap the effect
  if (diameter_m < 500 && localDensity < 10) {
    adjustedDensity = Math.min(adjustedDensity, 50); // Very conservative for small asteroids in sparse areas
  }

  // Global averaging for larger areas (same logic as before but adjusted)
  const threshold = diameter_m < 1000 ? 50000 : 150000; // Smaller threshold for smaller asteroids

  if (area_km2 <= threshold) {
    return adjustedDensity;
  }

  const weightLocal = threshold / area_km2;
  const weightedDensity = weightLocal * adjustedDensity + (1 - weightLocal) * GLOBAL_AVERAGE_DENSITY;

  // Less aggressive power scaling for more realistic results
  const powerFactor = isAirburst ? 0.3 : 0.5;
  return Math.pow(weightedDensity, powerFactor) * (diameter_m < 1000 ? 2 : 6);
}

// Add AbortController support for cancelling requests
export async function estimateAsteroidDeaths(
  lat: number,
  lon: number,
  r_clothing_m: number,
  Dtc_m: number,
  r_2nd_burn_m: number,
  earth_effect: string,
  BadEarthquake: number,
  diameter_m: number, // New parameter: asteroid mass
  isAirburst: boolean, // New parameter: whether it's an airburst
  airburstHeight_m: number, // New parameter: height of airburst (<=0 if no airburst)
  signal?: AbortSignal
): Promise<{ deathCount: number; injuryCount: number }> {

  // Early return for global catastrophes - no API call needed
  if (earth_effect === "destroyed" || earth_effect === "strongly_disturbed") {
    return { deathCount: GLOBAL_POP, injuryCount: 0 };
  }

  // Check if request was cancelled
  if (signal?.aborted) {
    throw new Error('Request cancelled');
  }


  // Get size-based scaling
  let sizeScaling = getSizeScalingFactor(diameter_m);

  if (airburstHeight_m > 0) {
    sizeScaling/=(2**(airburstHeight_m/2000))
    
  }


  let localDensity: number;
  try {
    // Adjust sampling radius based on asteroid size
    const samplingRadius = Math.min(300, Math.max(30, diameter_m / 10));
    localDensity = await populationDensityAt(lat, lon, samplingRadius);

    // Check again if request was cancelled after API call
    if (signal?.aborted) {
      throw new Error('Request cancelled');
    }
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    localDensity = 0;
  }

  // Early return for very small asteroids in unpopulated areas
  if (diameter_m < 50 && localDensity < 1) {
    return { deathCount: 0, injuryCount: Math.round(Math.random() * 3) }; // 0-2 injuries max
  }

  const scaledPop = (area_km2: number) =>
    area_km2 * calculateEffectiveDensity(area_km2, localDensity, diameter_m, isAirburst) * sizeScaling;

  // Calculate death zones
  const certainRadius_km = Math.max(r_clothing_m, Dtc_m) / 1000;
  const certainArea_km2 = Math.PI * certainRadius_km ** 2;
  let deathCount = scaledPop(certainArea_km2);

  // Apply conservative caps based on asteroid size
  if (diameter_m < 500) {
    const maxDeaths = localDensity > 1000 ? 1000000 : localDensity > 100 ? 100000 : localDensity > 10 ? 10000 : 100;
    deathCount = Math.min(deathCount, maxDeaths);
  } else if (diameter_m < 1000) {
    deathCount = Math.min(deathCount, 10000000); // 10M max for 0.5-1km asteroids
  }

  // Calculate burn effects
  const burnRadius_km = r_2nd_burn_m / 1000;
  let burnDeaths = 0;
  let burnInjuries = 0;

  if (burnRadius_km > certainRadius_km) {
    const burnArea_km2 = Math.PI * (burnRadius_km ** 2 - certainRadius_km ** 2);
    const burnPopulation = scaledPop(burnArea_km2);

    // Burn survival rates depend on distance and asteroid size
    const burnMortality = isAirburst ? 0.3 : (diameter_m > 1000 ? 0.8 : 0.6);
    burnDeaths = burnMortality * burnPopulation;
    burnInjuries = burnPopulation - burnDeaths;
  }

  // Calculate earthquake effects (more conservative for smaller asteroids)
  const earthquakeArea = Math.PI * (BadEarthquake ** 2);
  const earthquakePopulation = scaledPop(earthquakeArea);
  const earthquakeInjuryRate = diameter_m < 1000 ? 0.01 : 0.05; // Much lower injury rates
  const earthquakeInjuries = Math.max(earthquakePopulation * earthquakeInjuryRate - deathCount, 0);

  // Final calculations with more conservative scaling
  const totalDeaths = Math.min(deathCount + burnDeaths, GLOBAL_POP);
  let totalInjuries = Math.min(burnInjuries + earthquakeInjuries, GLOBAL_POP - totalDeaths, totalDeaths*3); // Max 3:1 injury:death ratio
  if (totalDeaths<0.9*GLOBAL_POP && 0.1*totalDeaths > totalInjuries){
    totalInjuries = 0.1*totalDeaths
  }


  // Apply final reality check for small asteroids
  if (diameter_m < 100 && totalDeaths > 10000) {
    const reductionFactor = 10000 / totalDeaths;
    return {
      deathCount: Math.round(totalDeaths * reductionFactor),
      injuryCount: Math.round(totalInjuries * reductionFactor)
    };
  }

  return {
    deathCount: Math.round(totalDeaths),
    injuryCount: Math.round(totalInjuries)
  };
}

export function tsunamiInfo(is_water: boolean, Dtc: number | null, airburst: boolean){
  if (!is_water || airburst || !Dtc){
    return {
      rim_wave_height: 0,
      tsunami_radius: 0,
      max_tsunami_speed: 0,
      time_to_reach_1_km: 0,
      time_to_reach_100_km: 0
    }

  }
  const rim_wave_height = Math.min(Dtc/14.1, DEFAULTS.water_depth_m)
  const tsunami_entry_radius = 3 * Dtc / 4;
  const tsunami_radius = 0.01*rim_wave_height**0.5 * tsunami_entry_radius / 0.5 // assume tsunami ends when water is less than 0.5 meters depth, and land coefficient of 0.001
  const tsunami_wavelength = rim_wave_height > 80 ? rim_wave_height/0.07 : rim_wave_height / 0.4 // treat 80m as threshold from conceivable tsunami to crazy asteroi tsunami
  const max_tsunami_speed = tsunami_wavelength < 0.9 * DEFAULTS.water_depth_m
    ? eq_20_tsunami_speed(rim_wave_height, tsunami_wavelength)
    : eq_19_tsunami_speed(rim_wave_height);

  function eq_19_tsunami_speed(A: number): number{
    return Math.sqrt(G*DEFAULTS.water_depth_m)*(1 + A/(2*DEFAULTS.water_depth_m))
  }

  function eq_20_tsunami_speed(A: number, lambda: number): number{
    return Math.sqrt(G*lambda/(2*Math.PI)*(1+(2*Math.PI**2*A**2)/lambda**2))
  }

  function max_time(Dtc: number, r: number){
    return r/Math.sqrt(1.56*Dtc*Math.tanh(6.28*DEFAULTS.water_depth_m/Dtc))
  }

  const time_to_reach_1_km = max_time(Dtc, 1000)

  const time_to_reach_100_km = max_time(Dtc, 100000)

  return {
    rim_wave_height: rim_wave_height,
    tsunami_radius: tsunami_radius,
    max_tsunami_speed: max_tsunami_speed,
    time_to_reach_1_km: time_to_reach_1_km,
    time_to_reach_100_km: time_to_reach_100_km
  }
}

function peakWindSpeed(overpressure_Pa: number, P_0 = 1e5, c_0 = 330): number {
  return (5 * overpressure_Pa / (7 * P_0)) * (c_0 / (Math.sqrt(1 + (6 * overpressure_Pa) / (7 * P_0))));
}

export function computeImpactEffects(inputs: Damage_Inputs): Damage_Results {
  const { L0, rho_i, v0, theta_deg, is_water, mass} = inputs;
  const K = inputs.K ?? DEFAULTS.K;
  const Cd = inputs.Cd ?? DEFAULTS.Cd;
  const rho0 = inputs.rho0 ?? DEFAULTS.rho0;
  const H = DEFAULTS.H;

  const theta_rad = (theta_deg * Math.PI) / 180.0;
  const { m, E_J, E_Mt } = energyFromDiameter(mass, v0);
  const Tre_years = 109 * Math.pow(Math.max(E_Mt, 1e-12), 0.78);

  // intact surface velocity
  const v_surface_intact = intactSurfaceVelocity(v0, L0, rho_i, theta_rad, Cd, rho0, H);

  // breakup and airburst
  const { If, z_star, breakup } = breakupIfAndZstar(L0, rho_i, v0, theta_rad, Cd, H, rho0);
  const zb = breakup ? pancakeAirburstAltitude(L0, rho_i, theta_rad, z_star) : 0;
  const airburst = breakup && zb > 0;

  // choose impact velocity for cratering
  const v_i = v_surface_intact; // assume intact terminal value if not broken to ground

  // fireball and burns
  const burns = burnRadii(E_Mt, E_J, K);
  const Rf_m = fireballRadius(E_J);

  // crater and seismic only if not airburst
  let Dtc: number | null = null, dtc: number | null = null, Dfr: number | null = null, dfr: number | null = null;
  let Vtc_km3: number | null = null, ratio: number | null = null;
  let effect: Damage_Results['earth_effect'] = 'negligible_disturbed';
  if (!airburst) {
    const crater = transientCrater(L0, rho_i, v_i, theta_rad, is_water);
    Dtc = crater.Dtc; dtc = crater.dtc; Dfr = crater.Dfr; dfr = crater.dfr;
  const vol = craterVolumeAndEffect(Dtc);
    Vtc_km3 = Math.min(vol.Vtc_km3,VE_KM3) ; 
    ratio = vol.ratio; effect = vol.effect;
  }

  // seismic
  let Magnitude: number | null = null, radius_km: number | null = null, radius_m: number | null = null, earthquake_description: string | undefined;
  if (!airburst) {
    const seismic = seismicMagnitudeAndRadius(E_J);
    Magnitude = seismic.M; radius_km = seismic.radius_km; radius_m = seismic.radius_m; earthquake_description = seismic.description;
  }

  // airblast radii for thresholds
  const r_building = findRadiusForOverpressure(273000, E_Mt, zb, Rf_m);
  const r_glass = findRadiusForOverpressure(6900, E_Mt, zb, Rf_m);
  const overpressureAt50_km =  peakOverpressureAtR(50000, E_Mt, zb);
  const windspeedAt50_km = peakWindSpeed(overpressureAt50_km)
  const r_ionization = findRadiusForOverpressure(75750000, E_Mt, zb, 50000);


  const results: Damage_Results = {
    E_J,
    E_Mt,
    Tre_years,
    m_kg: m,
    zb_breakup: zb,
    airburst,
    v_impact_for_crater: v_i,
    Rf_m,
    r_clothing_m: burns.clothing,
    r_2nd_burn_m: burns.second,
    r_3rd_burn_m: burns.third,
    Dtc_m: Dtc,
    dtc_m: dtc,
    Dfr_m: Dfr,
    dfr_m: dfr,
    Vtc_km3,
    Vtc_over_Ve: ratio,
    earth_effect: effect,
    Magnitude,
    radius_M_ge_7_5_m: radius_m,
    earthquake_description: earthquake_description,
    airblast_radius_building_collapse_m: r_building,
    airblast_radius_glass_shatter_m: r_glass,
    overpressure_at_50_km: overpressureAt50_km,
    wind_speed_at_50_km: windspeedAt50_km,
    ionization_radius: r_ionization
  };

  return results;
}
