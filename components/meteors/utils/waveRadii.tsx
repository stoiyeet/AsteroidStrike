// components/meteors/utils/waveRadii.ts
'use client';

import { Damage_Results } from '@/lib/impactTypes';

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
  const Thermal_Effects = damage.Thermal_Effects
  const Seismic_Effects = damage.Seismic_Results
  const Waveblast_Results = damage.Waveblast_Results

  const second_degree_burn = Thermal_Effects.Second_Degree_Burn_Radius || 0;
  const third_degree_burn = Thermal_Effects.Third_Degree_Burn_Radius || 0;
  const fireball_radius = Thermal_Effects.Fireball_Radius || 0;
  const buildingCollapseEarthquake = Seismic_Effects.Radius_M_ge_7_5 || 0;
  const glassShatter = Waveblast_Results.Radius_Glass_Shatter_m || 0;
  const buildingCollapseShockwave = Waveblast_Results.Radius_Building_Collapse_m || 0;
  const clothingIgnition = Thermal_Effects.Clothes_Burn_Radius || 0;



  return {second_degree_burn, third_degree_burn, fireball_radius, buildingCollapseEarthquake, glassShatter, buildingCollapseShockwave, clothingIgnition};
}
