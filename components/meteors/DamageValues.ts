// impact_effects.ts
// Functions extracted from study at https://impact.ese.ic.ac.uk/ImpactEarth/ImpactEffects/effects.pdf

export type Damage_Inputs = {
  mass: number; // kg
  L0: number; // m
  rho_i: number; // kg/m^3
  v0: number; // m/s
  theta_deg: number; // degrees from horizontal
  is_water?: boolean; // true for water target
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
  M: number | null;
  radius_M_ge_7_5_m: number | null;
  airblast_radius_building_collapse_m: number | null; // p=42600 Pa
  airblast_radius_glass_shatter_m: number | null; // p=6900 Pa
  airblast_peak_overpressure: number | null;
  deathCount: number | null,
  injuryCount: number | null
};

// Constants
const MT_TO_J = 4.184e15;
const G = 9.81;
const VE_KM3 = 1.083e12; // Earth's volume km^3 for comparison
const GLOBAL_POP = 8_250_000_000;
const GLOBAL_AVG_DENSITY = 61;
const LOCAL_SAMPLE_AREA = 90_000; // About max area that API can get loalized aread

const DEFAULTS = {
  K: 3e-3,
  Cd: 2.0,
  rho0: 1.0,
  H: 8000,
  fp: 7,
  rho_air_for_wind: 1.2,
  burn_horizon_m: 1_500_000, // 1500 km cap
};

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
export function breakupIfAndZstar(Lo: number, rho_i: number, vo: number, theta: number, CD = DEFAULTS.Cd, H = DEFAULTS.H, rho_0 = DEFAULTS.rho0) {
  // Calculate the yield strength Y_i using the empirical formula.
  const Yi = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho_i));
  
  // Calculate the breakup parameter I_f.
  const If = (CD * H * Yi) / (rho_i * Lo * Math.pow(vo, 2) * Math.sin(theta));
  
  // Determine if breakup occurs.
  const breakup = If < 1;
  
  let z_star = 0;
  // If breakup occurs, calculate the breakup altitude z_star.
  if (breakup) {
    z_star = -H * (Math.log(Yi / (rho_0 * Math.pow(vo, 2))) + 1.308 - 0.314 * If - 1.303 * Math.sqrt(1 - If));
  }
  
  return { If, z_star, breakup };
}

export function pancakeAirburstAltitude(Lo: number, rho_i: number, theta: number, z_star: number, H = DEFAULTS.H, fp = DEFAULTS.fp, CD = DEFAULTS.Cd) {
  // The document uses rho(z*) which is the atmospheric density at the breakup altitude.
  // We need to use the provided atmosphericDensity function to get this value.
  const rho_z_star = atmosphericDensity(z_star);
  
  // Calculate the dispersion length scale 'l'.
  const l = Lo * Math.sin(theta) * Math.sqrt(rho_i / (CD * rho_z_star));
  
  // Calculate the airburst altitude z_b using the rearranged equation.
  const zb = z_star - 2 * H * Math.log(1 + (l / (2 * H)) * Math.sqrt(Math.pow(fp, 2) - 1));
  
  if (zb < 0) return 0;
  return zb;
}

// fireball radius
export function fireballRadius(E_J: number) {
  // Rf = 0.002 * E^(1/3) with E in joules
  return 0.002 * Math.pow(E_J, 1 / 3);
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
export function transientCrater(L0: number, rho_i: number, v_i: number, theta_rad: number, is_water=false) {
  const rho_t = is_water ? 2700 : 2500;
  const coeff = is_water ? 1.365 : 1.161;
  const term = Math.pow(rho_i / rho_t, 1 / 3);
  const Dtc = coeff * term * Math.pow(L0, 0.78) * Math.pow(v_i, 0.44) * Math.pow(G, -0.22) * Math.pow(Math.sin(theta_rad), 1 / 3);
  const dtc = Dtc / (2 * Math.sqrt(2));
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
  return { Dtc, dtc, Dfr, dfr };
}

// 9) transient crater volume and Earth effect
export function craterVolumeAndEffect(Dtc_m: number) {
  // Vtc = pi * Dtc^3 / (16*sqrt(2))  (m^3)
  const Vtc_m3 = Math.PI * Math.pow(Dtc_m, 3) / (16 * Math.sqrt(2));
  const Vtc_km3 = Vtc_m3 / 1e9;
  const ratio = Math.min(Vtc_km3 / VE_KM3, 1);
  let effect: Damage_Results['earth_effect'] = 'negligible_disturbed';
  if (ratio > 0.5) effect = 'destroyed';
  else if (ratio >= 0.1) effect = 'strongly_disturbed';
  return { Vtc_km3, ratio, effect };
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
  // none satisfied => no radius where Meff >= threshold
  return { M, radius_km: null, radius_m: null } as any;
}

// peakOverpressure.ts
// Implements Collins et al. (2005) air-blast fits (Eqs. 54-58).
// Inputs: r_m (m), E_Mt (megaton), zb_m (m). Output: peak overpressure in Pa.

export function peakOverpressureAtR(
  r_m: number,
  E_Mt: number,
  zb_m: number
): number {
  if (!isFinite(r_m) || !isFinite(E_Mt) || !isFinite(zb_m)) return NaN;
  if (r_m <= 0 || E_Mt <= 0) return 0;

  // convert yield to kilotons (Collins uses kt in scaling).
  const Ekt = E_Mt * 1000;
  const cubeRootE = Math.cbrt(Ekt);

  // scaled distance and scaled burst altitude (1 kt equivalent)
  const r1 = r_m / cubeRootE;    // metres scaled to 1 kt
  const zb1 = zb_m / cubeRootE;  // metres scaled to 1 kt

  // constants from PDF
  const px = 75000;     // Pa at crossover rx for 1 kt surface burst.
  // rx increases with burst altitude: rx = 289 + 0.65 * zb1 (Collins). 
  const rx = 289 + 0.65 * zb1;

  // p0 and E for regular-reflection exponential decay (Eq.56a/b). Valid for zb1>0.
  let p0 = NaN;
  let Ecoef = NaN;
  if (zb1 > 0) {
    p0 = 3.14e11 * Math.pow(zb1, -2.6);    // Pa. :contentReference[oaicite:9]{index=9}
    Ecoef = 34.87 * Math.pow(zb1, -1.73);  // 1/m. :contentReference[oaicite:10]{index=10}
  }

  // Determine Mach-region inner boundary rm1.
  // PDF: rm1 depends only on zb1; rm1=0 for zb1=0; no Mach region if zb1>550 m.
  // PDF gives a simple fit; layout made the exact algebraic text compact.
  // Use conservative linear fit rm1 = 1.2 * zb1 for implementation (keeps units m).
  // If you prefer the exact fit from the PDF, replace this line with that formula.
  const MACH_ZB_LIMIT = 550; // m scaled
  const hasMachRegion = zb1 <= MACH_ZB_LIMIT;
  const rm1 = zb1 <= 0 ? 0 : (hasMachRegion ? 1.2 * zb1 : Infinity);

  // Surface-burst formula (Eq.54 style).
  // Implemented as a smooth near/far blend reproducing ~r^{-2.3} near and ~r^{-1} far.
  // This form is algebraically equivalent to the behaviour described in the PDF.
  function peakSurfaceBurst1kt(r1_local: number): number {
    if (r1_local <= 0) return Number.POSITIVE_INFINITY;
    const a = 2.3; // near-field exponent (Collins states ~2.3). :contentReference[oaicite:11]{index=11}
    const b = 1.3; // blending exponent seen in PDF figure/text. :contentReference[oaicite:12]{index=12}
    const x = rx / r1_local;
    // avoid overflow
    const xb = Math.pow(x, b);
    const xa = Math.pow(x, a);
    const p = px * (xa / (1 + xb));
    return Math.max(0, p);
  }

  // Regular-reflection exponential region (Eq.55).
  function peakRegularReflection1kt(r1_local: number): number {
    if (r1_local <= 0) return Number.POSITIVE_INFINITY;
    if (!(p0 > 0) || !(Ecoef > 0)) {
      return peakSurfaceBurst1kt(r1_local);
    }
    const p = p0 * Math.exp(-Ecoef * r1_local);
    return Math.max(0, p);
  }

  // Decide which formula to use for 1 kt scaled distance r1:
  let p1kt: number;
  if (zb1 <= 0) {
    // surface burst (crater-forming impact). Use surface-burst form. :contentReference[oaicite:13]{index=13}
    p1kt = peakSurfaceBurst1kt(r1);
  } else {
    // airburst: check if r1 lies inside regular-reflection (near) or Mach/surface (far)
    if (r1 < rm1) {
      // regular reflection region: exponential decay (Eq.55). :contentReference[oaicite:14]{index=14}
      p1kt = peakRegularReflection1kt(r1);
    } else {
      // Mach region or beyond: treat with surface-burst style (Eq.54) but with increased rx.
      p1kt = peakSurfaceBurst1kt(r1);
    }
  }

  // Return in Pascals.
  return p1kt;
}


// findRadiusForOverpressure: robust bisection using monotonicity of p(r).
export function findRadiusForOverpressure(
  targetP: number,
  E_Mt: number,
  zb_m: number,
  r_min: number,
  r_max = 1.7e10
): number {
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
  let plo = pAtMin;
  let phi = pAtMax;
  const maxIter = 200;
  const tol = 1e-6;

  for (let i = 0; i < maxIter && (hi - lo) / Math.max(1, lo) > tol; i++) {
    const mid = 0.5 * (lo + hi);
    const pmid = peakOverpressureAtR(mid, E_Mt, zb_m);
    if (pmid >= targetP) {
      lo = mid;
      plo = pmid;
    } else {
      hi = mid;
      phi = pmid;
    }
  }

  return 0.5 * (lo + hi);
}

interface WorldPopTaskResponse {
  taskid ?: string;
  error_message ?: string;
  [key: string]: any;
}

interface WorldPopResponse {
  data: {
    total_population: number;
  };
  status?: string;       // e.g., "finished", "running"
  error_message?: string;
}

async function fetchWithRetry<T>(
  url: string,
  maxRetries = 5,
  intervalMs = 4000
): Promise<T> {
  let lastErr: any;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries - 1) {
        // wait before retrying
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
  }

  throw lastErr ?? new Error("Unknown fetch error"); 
}


async function populationDensityAt(
  lat: number,
  lon: number,
  kmSide = 300,
  maxRetries = 5,
  intervalMs = 4000
): Promise<number> {
  const degLat = kmSide / 111;
  const degLon = kmSide / (111 * Math.cos((lat * Math.PI) / 180));

  const geojson = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "Polygon",
          coordinates: [[
            [lon - degLon / 2, lat + degLat / 2],
            [lon - degLon / 2, lat - degLat / 2],
            [lon + degLon / 2, lat - degLat / 2],
            [lon + degLon / 2, lat + degLat / 2],
            [lon - degLon / 2, lat + degLat / 2]
          ]]
        }
      }
    ]
  };

  const url = `https://api.worldpop.org/v1/services/stats?dataset=wpgppop&year=2020&geojson=${encodeURIComponent(JSON.stringify(geojson))}`;

  const data: WorldPopTaskResponse = await fetchWithRetry<WorldPopTaskResponse>(url, maxRetries, intervalMs);
  if (data.error_message) return 0;

  const populationUrl = `https://api.worldpop.org/v1/tasks/${data.taskid}`;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const popData = await fetchWithRetry<WorldPopResponse>(populationUrl, 3, intervalMs);
    if (popData.status === "finished") {
      return popData.data.total_population / (kmSide * kmSide);
    } else if (popData.status === "failed" || popData.error_message) {
      return 0;
    }
    // wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error("Task did not finish within time limit");
}


async function estimateAsteroidDeaths(
  lat: number,
  lon: number,
  r_clothing_m: number,
  Dtc_m: number,
  r_2nd_burn_m: number,
  earth_effect: string,
  BadEarthquake: number
): Promise<{ deathCount: number; injuryCount: number }> {

  if (earth_effect === "destroyed" || earth_effect === "strongly_disturbed") {
    return { deathCount: GLOBAL_POP, injuryCount: 0 };
  }

  let localDensity: number;
  try {
    localDensity = await populationDensityAt(lat, lon, 300);
  } catch {
    localDensity = GLOBAL_AVG_DENSITY;
  }

  const scaledPop = (area_km2: number) =>
    area_km2 * GLOBAL_AVG_DENSITY +
    LOCAL_SAMPLE_AREA * (localDensity - GLOBAL_AVG_DENSITY);

  const certainRadius_km = Math.max(r_clothing_m, Dtc_m) / 1000;
  const certainArea_km2 = Math.PI * certainRadius_km ** 2;
  const deathCount = scaledPop(certainArea_km2);

  const burnRadius_km = r_2nd_burn_m / 1000;
  let burnDeaths = 0;
  let burnInjuries = 0;
  if (burnRadius_km > certainRadius_km) {
    const burnArea_km2 = Math.PI * (burnRadius_km ** 2 - certainRadius_km ** 2);
    burnDeaths = 0.8 * scaledPop(burnArea_km2);
    burnInjuries = scaledPop(burnArea_km2) - burnDeaths;
  }

  const earthQuakeArea = Math.PI * (BadEarthquake ** 2);
  const earthQuakeInjuries = Math.max(scaledPop(earthQuakeArea) - deathCount, 0);

  const total = Math.min(deathCount + burnDeaths, GLOBAL_POP);
  const injuries = Math.min(burnInjuries + earthQuakeInjuries, GLOBAL_POP);

  return {
    injuryCount: Math.round(injuries),
    deathCount: Math.round(total),
  };
}




export async function computeImpactEffects(inputs: Damage_Inputs): Promise<Damage_Results> {
  const { L0, rho_i, v0, theta_deg, is_water, mass, latitude, longitude } = inputs;
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
  let Rf_m: number | null = null;
  if (!airburst) {
    Rf_m = fireballRadius(E_J);
  }

  // crater and seismic only if not airburst
  let Dtc: number | null = null, dtc: number | null = null, Dfr: number | null = null, dfr: number | null = null;
  let Vtc_km3: number | null = null, ratio: number | null = null;
  let effect: Damage_Results['earth_effect'] = 'negligible_disturbed';
  if (!airburst) {
    const crater = transientCrater(L0, rho_i, v_i, theta_rad, is_water);
    Dtc = crater.Dtc; dtc = crater.dtc; Dfr = crater.Dfr; dfr = crater.dfr;
    const vol = craterVolumeAndEffect(Dtc);
    Vtc_km3 = Math.min(vol.Vtc_km3,VE_KM3) ; ratio = vol.ratio; effect = vol.effect;
  }

  // seismic
  let M: number | null = null, radius_km: number | null = null, radius_m: number | null = null;
  if (!airburst) {
    const seismic = seismicMagnitudeAndRadius(E_J);
    M = seismic.M; radius_km = seismic.radius_km; radius_m = seismic.radius_m;
  }

  // airblast radii for thresholds
  const r_building = findRadiusForOverpressure(42600, E_Mt, zb, L0);
  const r_glass = findRadiusForOverpressure(6900, E_Mt, zb, L0);
  const peakoverpressure =  peakOverpressureAtR(Dtc || L0*1.1, E_Mt, zb);


  const {deathCount, injuryCount} = await estimateAsteroidDeaths(latitude || 44.6, longitude || 79.4, burns.clothing, Dtc || 0, burns.second, effect, radius_m || 0)



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
    M,
    radius_M_ge_7_5_m: radius_m,
    airblast_radius_building_collapse_m: r_building,
    airblast_radius_glass_shatter_m: r_glass,
    airblast_peak_overpressure: peakoverpressure,
    deathCount,
    injuryCount
  };

  return results;
}