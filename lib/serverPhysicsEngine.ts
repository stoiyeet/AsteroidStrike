/**
 * Server-side physics engine for asteroid impact calculations
 * Duplicate of client-side DamageValuesOptimized.ts
 */

import { fromUrl, GeoTIFF, GeoTIFFImage } from 'geotiff';

export type DamageInputs = {
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
  latitude?: number;
  longitude?: number;
};

export type DamageResults = {
  E_J: number;
  E_Mt: number;
  Tre_years: number;
  m_kg: number;
  zb_breakup: number;
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
  airblast_radius_building_collapse_m: number | null;
  airblast_radius_glass_shatter_m: number | null;
  overpressure_at_50_km: number | null;
  wind_speed_at_50_km: number | null;
  ionization_radius: number;
};

// Constants
const MT_TO_J = 4.184e15;
const G = 9.81;
const VE_KM3 = 1.083e12;
const EARTH_R_M = 6.371e6;
const HALF_CIRCUMFERENCE_M = 20037508.34;
const EARTH_DIAMETER = 12756e3;

const DEFAULTS = {
  K: 3e-3,
  Cd: 2.0,
  rho0: 1.0,
  H: 8000,
  fp: 7,
  rho_air_for_wind: 1.2,
  burn_horizon_m: 1_500_000,
  water_depth_m: 3682,
  density_water: 1000,
  water_drag_coeff: 0.877,
};

// Energy calculations
function energyFromDiameter(m: number, v0: number) {
  const E_J = 0.5 * m * v0 * v0;
  const E_Mt = E_J / MT_TO_J;
  return { m, E_J, E_Mt };
}

// Intact surface velocity from drag
function intactSurfaceVelocity(
  v0: number,
  L0: number,
  rho_i: number,
  theta_rad: number,
  Cd = DEFAULTS.Cd,
  rho0 = DEFAULTS.rho0,
  H = DEFAULTS.H
) {
  const sinT = Math.sin(theta_rad);
  const denom = 4 * rho_i * L0 * sinT;
  const factor = (3 * Cd * rho0 * H) / denom;
  const v_surface = v0 * Math.exp(-factor);
  return v_surface;
}

function atmosphericDensity(z: number, rho0 = DEFAULTS.rho0, H = DEFAULTS.H): number {
  return rho0 * Math.exp(-z / H);
}

// Breakup calculation
function breakupIfAndZstar(
  Lo: number,
  rho_i: number,
  vo: number,
  theta_rad: number,
  CD = DEFAULTS.Cd,
  H = DEFAULTS.H,
  rho_0 = DEFAULTS.rho0
) {
  const Yi = Math.pow(10, 2.107 + 0.0624 * Math.sqrt(rho_i));
  const If = (CD * H * Yi) / (rho_i * Lo * Math.pow(vo, 2) * Math.sin(theta_rad));
  const breakup = If < 1;

  let z_star = 0;
  if (breakup) {
    z_star =
      -H *
      (Math.log(Yi / (rho_0 * Math.pow(vo, 2))) +
        1.308 -
        0.314 * If -
        1.303 * Math.sqrt(1 - If));
  }

  return { If, z_star, breakup };
}

// Airburst altitude
function pancakeAirburstAltitude(
  Lo: number,
  rho_i: number,
  theta_rad: number,
  z_star: number,
  H = DEFAULTS.H,
  fp = DEFAULTS.fp,
  CD = DEFAULTS.Cd
) {
  const rho_z_star = atmosphericDensity(z_star);
  const l = Lo * Math.sin(theta_rad) * Math.sqrt(rho_i / (CD * rho_z_star));
  const zb = z_star - 2 * H * Math.log(1 + (l / (2 * H)) * Math.sqrt(Math.pow(fp, 2) - 1));

  if (zb < 0) return 0;
  return zb;
}

// Fireball radius
function fireballRadius(E_J: number) {
  return Math.min(EARTH_R_M, 0.002 * Math.pow(E_J, 1 / 3));
}

// Burn radii
function burnRadii(E_Mt: number, E_J: number, K = DEFAULTS.K) {
  const thresholds_1Mt_MJ = {
    clothing: 1.0,
    second: 0.25,
    third: 0.42,
  } as const;

  const results: { clothing: number; second: number; third: number } = {
    clothing: 0,
    second: 0,
    third: 0,
  };

  for (const key of Object.keys(thresholds_1Mt_MJ) as (keyof typeof thresholds_1Mt_MJ)[]) {
    const thr_MJ = thresholds_1Mt_MJ[key];
    const thr_J = thr_MJ * 1e6;
    const thr_scaled = thr_J * Math.pow(Math.max(E_Mt, 1e-12), 1 / 6);
    const r = Math.sqrt((K * E_J) / (2 * Math.PI * thr_scaled));
    results[key] = Math.min(r, DEFAULTS.burn_horizon_m);
  }

  return results;
}

// Crater scaling
function transientCrater(L0: number, rho_i: number, v_i: number, theta_rad: number, is_water: boolean) {
  const rho_t = is_water ? 2700 : 2500;
  let adjusted_v_i = v_i;

  if (is_water) {
    adjusted_v_i =
      v_i *
      Math.exp(
        -(3 * DEFAULTS.density_water * DEFAULTS.water_drag_coeff * DEFAULTS.water_depth_m) /
          (2 * L0 * Math.sin(theta_rad) * rho_i)
      );
  }

  const coeff = 1.161;
  const term = Math.pow(rho_i / rho_t, 1 / 3);
  let Dtc =
    coeff *
    term *
    Math.pow(L0, 0.78) *
    Math.pow(adjusted_v_i, 0.44) *
    Math.pow(G, -0.22) *
    Math.pow(Math.sin(theta_rad), 1 / 3);

  let dtc = Dtc / (2 * Math.sqrt(2));

  let Dfr: number;
  let dfr: number;

  if (Dtc < 3200) {
    Dfr = 1.25 * Dtc;
    dfr = dtc;
  } else {
    Dfr = (1.17 * Math.pow(Dtc, 1.13)) / Math.pow(3200, 0.13);
    dfr = 1000 * (0.294 * Math.pow(Dfr / 1000, 0.301));
  }

  [Dtc, dtc, Dfr, dfr] = [Dtc, dtc, Dfr, dfr].map((x) => Math.min(x, EARTH_DIAMETER));

  return { Dtc, dtc, Dfr, dfr };
}

// Ocean water crater
function oceanWaterCrater(L0: number, rho_i: number, v_i: number, theta_rad: number) {
  const coeff = 1.365;
  const rho_t = 1000;
  const term = Math.pow(rho_i / rho_t, 1 / 3);
  const Dtc =
    coeff *
    term *
    Math.pow(L0, 0.78) *
    Math.pow(v_i, 0.44) *
    Math.pow(G, -0.22) *
    Math.pow(Math.sin(theta_rad), 1 / 3);

  return Dtc;
}

// Crater volume and Earth effect
function craterVolumeAndEffect(Dtc_m: number) {
  if (Dtc_m >= EARTH_DIAMETER) {
    return { Vtc_km3: VE_KM3, ratio: 1, effect: 'destroyed' as const };
  }

  const Vtc_m3 = (Math.PI * Math.pow(Dtc_m, 3)) / (16 * Math.sqrt(2));
  const Vtc_km3 = Vtc_m3 / 1e9;
  const ratio = Math.min(Vtc_km3 / VE_KM3, 1);

  let effect: 'destroyed' | 'strongly_disturbed' | 'negligible_disturbed' = 'negligible_disturbed';
  if (ratio > 0.5) effect = 'destroyed';
  else if (ratio >= 0.1) effect = 'strongly_disturbed';

  return { Vtc_km3, ratio, effect };
}

// Seismic magnitude and radius
function seismicMagnitudeAndRadius(E_J: number, threshold = 7.5) {
  const M = 0.67 * Math.log10(E_J) - 5.87;

  const r1 = (M - threshold) / 0.0238;
  if (r1 >= 0 && r1 <= 60) return { M, radius_km: r1, radius_m: r1 * 1000 };

  const r2 = (M - 1.1644 - threshold) / 0.0048;
  if (r2 >= 60 && r2 <= 700) return { M, radius_km: r2, radius_m: r2 * 1000 };

  const exp3 = Math.pow(10, (M - 6.399 - threshold) / 1.66);
  if (exp3 > 700) return { M, radius_km: exp3, radius_m: exp3 * 1000 };

  const massive_Earthquake_milestones: Record<number, string> = {
    12: 'Very large regional catastrophe. Cities destroyed across hundreds of kilometers.',
    12.8: 'Over 1 yottajoule of energy. Continental-scale disruption.',
    13.5: 'Extreme continental catastrophe.',
    14.2: 'Global mechanical crisis.',
    15: 'Over 64% of energy needed to vaporize all oceans.',
    15.13: 'Beyond threshold to vaporize Earth\'s oceans',
    16.2: 'Planet-scale resurfacing and mantle upheaval.',
  };

  const floor = Object.keys(massive_Earthquake_milestones)
    .map(Number)
    .reduce((prev, curr) => (curr - M <= 0 ? curr : prev));

  const description = massive_Earthquake_milestones[floor] || '';

  return { M, radius_km: null, radius_m: null, description };
}

// Peak overpressure at distance
function peakOverpressureAtR(r_m: number, E_Mt: number, zb_m: number): number {
  const P_X = 75000;
  const E_kt = E_Mt * 1000;
  const yield_factor = Math.pow(E_kt, 1 / 3);
  const r_1 = r_m / yield_factor;

  const calculateOverpressureEq54 = (r_x: number, r_1: number): number => {
    const ratio_term = Math.pow(r_x / r_1, 1.3);
    const p = (P_X * r_x) / (4 * r_1) * (1 + 3 * ratio_term);
    return p;
  };

  let peak_overpressure: number;

  if (zb_m <= 0) {
    const r_x_surface = 290;
    peak_overpressure = calculateOverpressureEq54(r_x_surface, r_1);
  } else if (zb_m > 10000) {
    const p_0 = 3.14e11 * Math.pow(zb_m, -2.6);
    const beta = 34.87 * Math.pow(zb_m, -1.73);
    peak_overpressure = p_0 * Math.exp(-beta * r_1);
  } else {
    const r_x_airburst = 289 + (0.65 * zb_m) / 50;
    peak_overpressure = calculateOverpressureEq54(r_x_airburst, r_1);
  }

  return peak_overpressure;
}

// Find radius for target overpressure
function findRadiusForOverpressure(
  targetP: number,
  E_Mt: number,
  zb_m: number,
  r_min: number,
  r_max = HALF_CIRCUMFERENCE_M
): number {
  if (zb_m > 0) r_min = 0;
  if (!isFinite(targetP) || targetP <= 0) return NaN;
  if (r_min <= 0) r_min = 1e-6;

  const pAtMin = peakOverpressureAtR(r_min, E_Mt, zb_m);
  const pAtMax = peakOverpressureAtR(r_max, E_Mt, zb_m);

  if (targetP >= pAtMin) return r_min;
  if (targetP <= pAtMax) return r_max;

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

// Peak wind speed
function peakWindSpeed(overpressure_Pa: number, P_0 = 1e5, c_0 = 330): number {
  return (
    ((5 * overpressure_Pa) / (7 * P_0)) *
    (c_0 / Math.sqrt(1 + (6 * overpressure_Pa) / (7 * P_0)))
  );
}

// Main computation function
export function computeImpactEffectsServer(inputs: DamageInputs): DamageResults {
  const { L0, rho_i, v0, theta_deg, is_water, mass } = inputs;
  const K = inputs.K ?? DEFAULTS.K;
  const Cd = inputs.Cd ?? DEFAULTS.Cd;
  const rho0 = inputs.rho0 ?? DEFAULTS.rho0;
  const H = DEFAULTS.H;

  const theta_rad = (theta_deg * Math.PI) / 180.0;
  const { m, E_J, E_Mt } = energyFromDiameter(mass, v0);
  const Tre_years = 109 * Math.pow(Math.max(E_Mt, 1e-12), 0.78);

  // Intact surface velocity
  const v_surface_intact = intactSurfaceVelocity(v0, L0, rho_i, theta_rad, Cd, rho0, H);

  // Breakup and airburst
  const { If, z_star, breakup } = breakupIfAndZstar(L0, rho_i, v0, theta_rad, Cd, H, rho0);
  const zb = breakup ? pancakeAirburstAltitude(L0, rho_i, theta_rad, z_star) : 0;
  const airburst = breakup && zb > 0;

  const v_i = v_surface_intact;

  // Fireball and burns
  const burns = burnRadii(E_Mt, E_J, K);
  const Rf_m = fireballRadius(E_J);

  // Crater and seismic (only if not airburst)
  let Dtc: number | null = null,
    dtc: number | null = null,
    Dfr: number | null = null,
    dfr: number | null = null;
  let Vtc_km3: number | null = null,
    ratio: number | null = null;
  let effect: DamageResults['earth_effect'] = 'negligible_disturbed';

  if (!airburst) {
    const crater = transientCrater(L0, rho_i, v_i, theta_rad, is_water);
    Dtc = crater.Dtc;
    dtc = crater.dtc;
    Dfr = crater.Dfr;
    dfr = crater.dfr;

    const vol = craterVolumeAndEffect(Dtc);
    Vtc_km3 = Math.min(vol.Vtc_km3, VE_KM3);
    ratio = vol.ratio;
    effect = vol.effect;
  }

  // Seismic
  let Magnitude: number | null = null,
    radius_km: number | null = null,
    radius_m: number | null = null,
    earthquake_description: string | undefined;

  if (!airburst) {
    const seismic = seismicMagnitudeAndRadius(E_J);
    Magnitude = seismic.M;
    radius_km = seismic.radius_km;
    radius_m = seismic.radius_m;
    earthquake_description = seismic.description;
  }

  // Airblast radii
  const r_building = findRadiusForOverpressure(273000, E_Mt, zb, Rf_m);
  const r_glass = findRadiusForOverpressure(6900, E_Mt, zb, Rf_m);
  const overpressureAt50_km = peakOverpressureAtR(50000, E_Mt, zb);
  const windspeedAt50_km = peakWindSpeed(overpressureAt50_km);
  const r_ionization = findRadiusForOverpressure(75750000, E_Mt, zb, 50000);

  const results: DamageResults = {
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
    earthquake_description,
    airblast_radius_building_collapse_m: r_building,
    airblast_radius_glass_shatter_m: r_glass,
    overpressure_at_50_km: overpressureAt50_km,
    wind_speed_at_50_km: windspeedAt50_km,
    ionization_radius: r_ionization,
  };

  return results;
}

// Export for backward compatibility
export { oceanWaterCrater };
