import React from 'react';
import Link from 'next/link';
import styles from './ImpactEffects.module.css';

// Helper function to format distances
function formatDistance(meters: number | null): string {
  if (meters === null) return 'N/A';
  if (meters >= 1000) return `${(meters / 1000).toFixed(2)} km`;
  return `${meters.toFixed(0)} m`;
}

// Helper function to format energy
function formatEnergy(joules: number): string {
  if (joules > 1.368e30) return `${(joules / 1.368e30).toFixed(2)} Hours of Sun Output`;
  if (joules > 1e24) return `${(joules / 1e24).toFixed(2)} Yottajoules`;
  const mt = joules / 4.184e15; // Convert to megatons
  if (mt >= 1000) return `${(mt / 1000).toFixed(1)} Gigatons of TNT`;
  if (mt >= 1) return `${mt.toFixed(1)} Megatons of TNT`;
  return `${(mt * 1000).toFixed(1)} Kilotons of TNT`;
}

function formatOverPressure(pascals: number | null): string {
    if (pascals === null) return 'N/A';
    if (pascals >= 100000) return `${(pascals / 100000).toFixed(2)} Bars`;
    if (pascals >= 1000) return `${(pascals / 1000).toFixed(2)} kPa`;
    return `${pascals.toFixed(1)} Pa`;
}

function formatPopulation(pop: number | undefined): string {
  if (pop === undefined) return 'Pending';
  if (pop > 1e9) return `${(pop / 1e9).toFixed(2)} Billion`;
  if (pop > 1e6) return `${(pop / 1e6).toFixed(2)} Million`;
  if (pop > 1000) return `${(pop / 1000).toFixed(2)} Thousand`;
  return `${(pop)}`;
}

function formatTime(time_s: number): string {
  if (time_s > 3600) return `${(time_s / 3600).toFixed(2)} Hours`;
  if (time_s > 60) return `${(time_s / 60).toFixed(1)} Minutes`;
  return `${(time_s).toFixed(1)} Seconds`;
}

function formatYears(years: number): string {
  if (years >= 1e9) return `${(years / 1e9).toFixed(2)} Billion Years`;
  if (years >= 1e6) return `${(years / 1e6).toFixed(2)} Million Years`;
  if (years >= 1e3) return `${(years / 1e3).toFixed(2)} Thousand Years`;
  if (years >= 1e2) return `${(years / 1e2).toFixed(2)} Centuries`;
  return `${years.toFixed(1)} Years`;
}

function formatSpeed(speed: number | null): string {
  if (speed === null) return 'N/A';
  if (speed >= 1000) return `${(speed / 1000).toFixed(2)} km/s`;
  return `${speed.toFixed(2)} m/s`;
}

interface ImpactEffectsProps {
  effects: {
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
    earthquake_description?: string | undefined;
    airblast_radius_building_collapse_m: number | null;
    airblast_radius_glass_shatter_m: number | null;
    overpressure_at_50_km: number | null;
    wind_speed_at_50_km: number | null;
    ionization_radius: number;
  };
  mortality: {
    deathCount: number | undefined;
    injuryCount: number | undefined;
  } | null;
  impactLat: number;
  impactLon: number;
  name: string;
  TsunamiResults: {
    rim_wave_height: number;
    tsunami_radius: number;
    max_tsunami_speed: number;
    time_to_reach_1_km: number;
    time_to_reach_100_km: number;
  }
}

export default function ImpactEffects({ effects, mortality, impactLat, impactLon, name, TsunamiResults }: ImpactEffectsProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('overview');
  
  // Get descriptive text for earth effect
  const earthEffectText = {
    destroyed: 'Earth Forms a new asteroid belt orbiting the sun',
    strongly_disturbed: 'Earth\'s orbit is shifted substantially. Life as we know it is wiped out.',
    negligible_disturbed: 'Earth Loses Negligible Mass'
  }[effects.earth_effect];

  const earthEffectClass = {
    destroyed: styles.destroyed,
    strongly_disturbed: styles.disturbed,
    negligible_disturbed: styles.negligible
  }[effects.earth_effect];

  return (
    <div className={`${styles.effectsPanel} ${isCollapsed ? styles.collapsed : ''}`}>
      <button 
        className={styles.toggleButton} 
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Show Impact Details" : "Hide Impact Details"}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>
      <div className={styles.tabList}>
        <button 
          className={`${styles.tab} ${activeTab === 'overview' ? styles.active : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'thermal' ? styles.active : ''}`}
          onClick={() => setActiveTab('thermal')}
        >
          Thermal
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'blast' ? styles.active : ''}`}
          onClick={() => setActiveTab('blast')}
        >
          Wave Blast
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'crater' ? styles.active : ''}`}
          onClick={() => setActiveTab('crater')}
        >
          Crater
        </button>
        <button 
          className={`${styles.tab} ${activeTab === 'seismic' ? styles.active : ''}`}
          onClick={() => setActiveTab('seismic')}
        >
          Seismic
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'effects_on_life' ? styles.active : ''}`}
          onClick={() => setActiveTab('effects_on_life')}
        >
          Effects on Life
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'tsunami' ? styles.active : ''}`}
          onClick={() => setActiveTab('tsunami')}
        >
          Tsunami
        </button>
      </div>

      <div className={styles.scrollContent}>
        {activeTab === 'overview' && (
          <div className={styles.section}>
            <div className={styles.dataRow}>
              <span className={styles.label}>Name</span>
              <span className={styles.value}>{name}</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Location</span>
              <span className={styles.value}>{impactLat.toFixed(1)}°N, {impactLon.toFixed(1)}°E</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Energy</span>
              <span className={styles.value}>{formatEnergy(effects.E_J)}</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Recurrence Period</span>
              <span className={styles.value}>{formatYears(effects.Tre_years)}</span>
            </div>
            <div className={styles.impactType + ' ' + (effects.airburst ? styles.airburst : styles.surface)}>
              {effects.airburst ? '☁️ Airburst' : '🌋 Surface Impact'}
              {effects.airburst && (
                <span> at {formatDistance(effects.zb_breakup)} altitude</span>
              )}
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Impact Velocity</span>
              <span className={styles.value}>{(effects.v_impact_for_crater/1000).toFixed(1)} km/s</span>
            </div>
            <Link href="/meteors/formulas?category=overview" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'thermal' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              Thermal effects are caused by the intense heat generated during impact or airburst.
            </div>
            {effects.Rf_m && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Fireball Radius</span>
                <span className={styles.value}>{formatDistance(effects.Rf_m)}</span>
              </div>
            )}
            <div className={styles.distanceGrid}>
              {effects.r_3rd_burn_m && (
                <div className={styles.distanceCard}>
                  <div className={styles.distanceValue}>{formatDistance(effects.r_3rd_burn_m)}</div>
                  <div className={styles.distanceLabel}>Third Degree Burns</div>
                  <div className={styles.distanceDesc}>100% thickness burns, requiring immediate medical attention</div>
                </div>
              )}
              {effects.r_2nd_burn_m && (
                <div className={styles.distanceCard}>
                  <div className={styles.distanceValue}>{formatDistance(effects.r_2nd_burn_m)}</div>
                  <div className={styles.distanceLabel}>Second Degree Burns</div>
                  <div className={styles.distanceDesc}>Partial thickness burns with blistering</div>
                </div>
              )}
            </div>
            {effects.r_clothing_m && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Clothing Ignition</span>
                <span className={styles.value}>{formatDistance(effects.r_clothing_m)}</span>
              </div>
            )}
            {effects.Rf_m && effects.r_2nd_burn_m >= 1500000 && (
              <div className={styles.dataRow}>
                <span className={styles.label} style={{ color: '#d34646ff' }}>Due to the curvature of the earth, the heat effects cannot exceed a max of about 1500km in radius at sea level*</span>
              </div>
            )}
            <Link href="/meteors/formulas?category=thermal" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'blast' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              The wave blast creates a sudden pressure increase that can damage structures and cause injuries.
            </div>
            {effects.wind_speed_at_50_km && effects.wind_speed_at_50_km < 5000 && (
                <div className={styles.dataRow}>
                    <span className={styles.label}>Overpressure At 50km away</span>
                    <span className={styles.value}>{formatOverPressure(effects.overpressure_at_50_km)}</span>
              </div>
             )}

            {effects.wind_speed_at_50_km && effects.wind_speed_at_50_km < 5000 && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Top Wind Speed at 50km away</span>
                <span className={styles.value}>{formatSpeed(effects.wind_speed_at_50_km)}</span>
              </div>
            )}

            {effects.wind_speed_at_50_km && effects.wind_speed_at_50_km > 5000 && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Approx distance at which air is shock-heated into plasma</span>
                <span className={styles.value}>{formatDistance(effects.ionization_radius)}</span>
              </div>
            )}

   
            <div className={styles.distanceGrid}>
              {effects.airblast_radius_building_collapse_m && (
                <div className={styles.distanceCard}>
                  <div className={styles.distanceValue}>
                    {formatDistance(effects.airblast_radius_building_collapse_m)}
                  </div>
                  <div className={styles.distanceLabel}>Building Collapse</div>
                  <div className={styles.distanceDesc}>Complete destruction of steel-reinforced skyscrapers</div>
                </div>
              )}
              {effects.airblast_radius_glass_shatter_m && (
                <div className={styles.distanceCard}>
                  <div className={styles.distanceValue}>
                    {formatDistance(effects.airblast_radius_glass_shatter_m)}
                  </div>
                  <div className={styles.distanceLabel}>Window Breakage</div>
                  <div className={styles.distanceDesc}>Glass windows shatter due to pressure wave</div>
                </div>
                
              )}
            </div>
            <div className={styles.sectionInfo}>
                {effects.airblast_radius_building_collapse_m && effects.airblast_radius_building_collapse_m > 10000000 && (
                <span style={{ color: "#d34646ff" }}>The proposed meteor is too large for conventional wind blast calculations.Though the theoretical ranges are provided, with impacts of this size, global catastrophe is imminent and metrics like &quot;flattened buildings&quot; become irrelevant and calculations break</span>
                )
                }
            </div>
            <Link href="/meteors/formulas?category=blast" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'crater' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              Crater formation occurs in two phases: initial transient crater followed by final crater.
            </div>
            {effects.Dtc_m && TsunamiResults.rim_wave_height == 0 && (
              <>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Transient Diameter</span>
                  <span className={styles.value}>{formatDistance(effects.Dtc_m)}</span>
                </div>
                {effects.dtc_m && (
                  <div className={styles.dataRow}>
                    <span className={styles.label}>Transient Depth</span>
                    <span className={styles.value}>{formatDistance(effects.dtc_m)}</span>
                  </div>
                )}
              </>
            )}
            {effects.Dtc_m && TsunamiResults.rim_wave_height > 0 && (
              <>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Ocean Floor Crater</span>
                  <span className={styles.value}>{formatDistance(effects.Dtc_m)}</span>
                </div>
              </>
            )}
            {effects.Dfr_m && TsunamiResults.rim_wave_height == 0 && (
              <>
                <div className={styles.dataRow}>
                  <span className={styles.label}>Final Diameter</span>
                  <span className={styles.value}>{formatDistance(effects.Dfr_m)}</span>
                </div>
                {effects.dfr_m && (
                  <div className={styles.dataRow}>
                    <span className={styles.label}>Final Depth</span>
                    <span className={styles.value}>{formatDistance(effects.dfr_m)}</span>
                  </div>
                )}
              </>
            )}
            {effects.Vtc_km3 && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Excavated Volume</span>
                <span className={styles.value}>{effects.Vtc_km3.toFixed(2)} km³</span>
              </div>
            )}
            {effects.Vtc_over_Ve && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Earth Volume Ratio</span>
                <span className={styles.value}>{(effects.Vtc_over_Ve * 100).toFixed(6)}%</span>
              </div>
            )}
            <Link href="/meteors/formulas?category=crater" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'seismic' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              The impact generates seismic waves which create an earthquake.
            </div>
            {effects.Magnitude && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Immediate Richter Magnitude</span>
                <span className={styles.value}>{effects.Magnitude.toFixed(1)}</span>
              </div>
            )}
            {effects.radius_M_ge_7_5_m && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Range for widespread building collapse</span>
                <span className={styles.value}>{formatDistance(effects.radius_M_ge_7_5_m)}</span>
              </div>
            )}
            {effects.earthquake_description && (
              <div className={styles.dataRow}>
                <span className={styles.label}>Mega-Earthquake impacts</span>
                <span className={styles.description_value}>{effects.earthquake_description}</span>
              </div>
            )}
            <Link href="/meteors/formulas?category=seismic" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'effects_on_life' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              The ultimate highest concern
            </div>
            {(
              <div className={styles.dataRow}>
                <span className={styles.label}>Mortality Estimate</span>
                <span className={styles.value}>{formatPopulation(mortality?.deathCount)} 💀</span>
              </div>
            )}
            {(
              <div className={styles.dataRow}>
                <span className={styles.label}>Injury Estimate</span>
                <span className={styles.value}>{formatPopulation(mortality?.injuryCount)} 🤕</span>
              </div>
            )}
            <div className={styles.sectionInfo}>
              {(
                <span>This Approximation is based on regional population density and the hazardous effects of meteroid strike</span>
              )
              }
            </div>
            <div className={styles.sectionInfo}>
              {(
                <span style={{ color: "#d34646ff" }}>This is a heuristic based approximation and can&apos;t consider effects like ejecta, airborne debris, or supply chain crash</span>
              )
              }
            </div>
            <Link href="/meteors/formulas?category=mortality" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {activeTab === 'tsunami' && (
          <div className={styles.section}>
            <div className={styles.sectionInfo}>
              Tsunami Effects
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Wave Height</span>
              <span className={styles.value}>{TsunamiResults.rim_wave_height.toFixed(1)} m</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Max Speed</span>
              <span className={styles.value}>{TsunamiResults.max_tsunami_speed.toFixed(1)} m/s</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Time to Reach 1 km</span>
              <span className={styles.value}>{formatTime(TsunamiResults.time_to_reach_1_km)}</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Time to 100 km</span>
              <span className={styles.value}>{formatTime(TsunamiResults.time_to_reach_100_km)}</span>
            </div>
            {TsunamiResults.rim_wave_height >= 3682 && (
              <div className={styles.dataRow}>
                <span style={{ color: "#d34646ff" }}>Tsunami height is limited by ocean depth. Assume average ocean depth of ~3682m</span>
              </div>
            )}
            <Link href="/meteors/formulas?category=waterLayer" className={styles.scienceButton}>
              🧪 Check the Science
            </Link>
          </div>
        )}

        {/* Global Effect - shown on all tabs */}
        <div className={`${styles.earthEffect} ${earthEffectClass}`}>
          {earthEffectText}
        </div>
      </div>
    </div>
    );
}
