export type Strike_Overview = {
    Impact_Energy: number,
    Impact_Energy_Megatons_TNT: number,
    Recurrence_Period: number,
    Impact_Velocity: number,
    Breakup_Altitude: number,
    Airburst_Altitude: number,
}

export type Thermal_Effects = {
    Fireball_Radius: number | null,
    Clothes_Burn_Radius: number,
    Second_Degree_Burn_Radius: number,
    Third_Degree_Burn_Radius: number,
}

export type Crater_Results = {
    Transient_Diameter: number | null,
    Transient_Depth: number | null,
    Final_Diameter: number | null,
    Final_Depth: number | null,
    Crater_Volume: number | null,
    Earth_Volume_Ratio: number | null,
    Earth_Effect: Earth_Effect,
    airburst: boolean,
}

export type Seismic_Results = {
    Magnitude: number | null,
    Radius_M_ge_7_5: number | null,
    Description: string | undefined,
}

export type Waveblast_Results = {
    Radius_Building_Collapse_m: number | null, //p=42600 Pa
    Radius_Glass_Shatter_m: number | null, //p=6900 Pa
    Overpressure_50_km: number | null,
    Wind_Speed_50_km: number | null,
    Ionization_Radius: number


}

export type Damage_Results = {
    Strike_Overview: Strike_Overview,
    Thermal_Effects: Thermal_Effects,
    Crater_Results: Crater_Results,
    Seismic_Results: Seismic_Results,
    Waveblast_Results: Waveblast_Results
};

export type Earth_Effect = "destroyed" | "negligible_disturbed" | "strongly_disturbed"
