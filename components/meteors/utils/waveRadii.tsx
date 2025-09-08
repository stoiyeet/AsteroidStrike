// components/meteors/utils/waveRadii.ts
'use client';

import { Damage_Results } from '../DamageValuesOptimized';

export interface WaveRadii {
  second_degree_burn: number;
  third_degree_burn: number;
  fireball_radius: number;
  buildingCollapseEarthquake: number;
  glassShatter: number;
  buildingCollapseShockwave: number;
  clothingIgnition?: number;
}

export function computeWaveRadii(
  damage: Damage_Results,
): WaveRadii {

  const second_degree_burn = damage.r_2nd_burn_m || 0;
  const third_degree_burn = damage.r_3rd_burn_m || 0;
  const fireball_radius = damage.Rf_m || 0;
  const buildingCollapseEarthquake = damage.radius_M_ge_7_5_m || 0;
  const glassShatter = damage.airblast_radius_glass_shatter_m || 0;
  const buildingCollapseShockwave = damage.airblast_radius_building_collapse_m || 0;
  const clothingIgnition = damage.r_clothing_m || 0;



  return {second_degree_burn, third_degree_burn, fireball_radius, buildingCollapseEarthquake, glassShatter, buildingCollapseShockwave, clothingIgnition};
}
