'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import styles from './formulas.module.css';
import 'katex/dist/katex.min.css';
import { BlockMath } from 'react-katex';

export default function FormulasPageInner() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const category = searchParams.get('category') || 'overview';

    const formulas = {
        overview: {
            title: "IMPACT ENERGY CALCULATIONS",
            subtitle: "Fundamental equations for asteroid impact assessment",
            debrief: "This section provides the core mathematical models used to estimate the energy released during an asteroid impact event. These equations form the basis for future calculations which depend on the energy output.",
            equations: [
                {
                    title: "Meteoroid  Parameters",
                    equation: "\\text{Min Asteroid Speed} \\approx 11.2\\text{ km/s} \\\\ \\text{Max Asteroid Speed} \\approx 72\\text{ km/s} \\\\ \\text{Typical Asteroid Speed} \\approx 20\\text{ km/s} \\\\ \\text{Average Asteroid Angle} \\approx 45^\\circ",
                    image: "",
                    description: "Meteroid speeds are almost always between 11.2 km/s (Earth's escape velocity) and 72 km/s (sum of Earth's orbital velocity and solar escape velocity). A slower object would accelerate as it entered earth gravitational field. A faster speed is virtually impossible as it could only come from interstellar space directly pointing at Earth. Meteroid angles can range from 0-90°, but 45° is the most probable angle of impact.",
                    priority: "PRIMARY"
                },
                {
                    title: "Kinetic Energy",
                    equation: "E = \\frac{1}{2}mv^2 = \\frac{\\pi}{12} \\, \\rho_i \\, L^3 \\, v^2 ",
                    image: "",
                    description: "Total impact energy in Joules. Mass (m) in kilograms, velocity (v) in meters per second. Alternative measurements using density (rho_i) in (kg / m^3) and diameter (L) in meters, can appoximate mass as a sphere to avoid direct mass input.",
                    priority: "PRIMARY"
                },
                {
                    title: "Recurrence Period",
                    equation: "T_{re} = 109 \\cdot E_{Mt}^{0.78}",
                    image: "",
                    description: "Statistical frequency of impacts of magnitude E_Mt (Megatons of TNT). Measured in years between occurrences.",
                    priority: "SECONDARY"
                },
                {
                    title: "Impact Velocity",
                    equation: "v(z) = v_{0} \\exp\\left( -\\frac{3\\rho(z) C_{D} H}{4 \\rho_{l} L_{0} \\sin \\theta} \\right)",
                    image: "",
                    description: "Velocity at altitude z accounting for atmospheric drag, density variation, drag coefficient, and entry angle.",
                    priority: "PRIMARY"
                }
            ]
        },
        thermal: {
            title: "THERMAL RADIATION EFFECTS",
            subtitle: "Heat transfer and thermal damage assessment",
            debrief: "This section covers the equations used to model the thermal radiation effects resulting from an asteroid impact. Understanding these effects is crucial for assessing potential fire hazards and burn injuries in the affected areas.",
            equations: [
                {
                    title: "Fireball Radius",
                    equation: "R_{f} = 0.002 \\cdot E^{1/3}",
                    image: "",
                    description: "If the impact velocity exceeds 15 km/s, the fireball radius R_f* is estimated at the time the transparency temperature (2000–3000 K) is reached, which corresponds to maximum thermal radiation output. Initially the fireball will be so hot that the air is ionized, causing it to be opaque to the emitted radiation.",
                    priority: "PRIMARY"
                },
                {
                    title: "Fireball Duration",
                    equation: "T_{f} = \\frac{R_{f}}{v_{i}}",
                    image: "",
                    description: "The time for maximum thermal radiation T_f is estimated by assuming the fireball expands initially at approximately the impact velocity v_i.",
                    priority: "SECONDARY"
                },

                {
                    title: "Thermal Flux",
                    equation: "\\Phi = \\frac{\\eta\\cdot E}{2\\pi r^2}",
                    image: "",
                    description: "The thermal exposure Φ measures the heat per unit area at a distance r away from fireball it depends on the blast Energy and constant η approximated at 0.003  ",
                    priority: "SECONDARY"
                },
                {
                    title: "Ignition Thermal Exposure",
                    equation: "\\Phi_{\\text{ignition}} \\approx T_{\\text{ignition}} \\rho c_{p} \\sqrt{\\kappa \\tau_{t}}",
                    image: "",
                    description: "Thermal exposure required to ignite a material (J m^{-2}). It equates the radiant energy received per unit area with the heat needed to raise the surface to the ignition temperature T_{ignition}. Here, ρ is density, c_p is heat capacity, κ is thermal diffusivity, and τ_t is the irradiation time.",
                    priority: "PRIMARY"
                }

            ]
        },
        blast: {
            title: "OVERPRESSURE & SHOCK WAVES",
            subtitle: "Atmospheric pressure wave propagation",
            debrief: "This section details the equations and physical models governing shock wave behavior, overpressure decay, and dynamic wind effects following an asteroid impact. Depending on burst altitude and distance, the shock front can either reflect off the ground to form a Mach stem or propagate freely through the atmosphere. These equations determine structural damage thresholds and survivability zones.",

            equations: [
                {
                    title: "Peak Overpressure (Mach Region – Primary Model)",
                    equation: `
                        r_1 = \\frac{r}{E_{kt}^{1/3}} \\\\
                        p = \\frac{P_X r_x}{4 r_1} (1 + 3 (r_x / r_1)^{1.3})
                        `,
                    image: "",
                    description: "Within the Mach reflection region (low-altitude airbursts or surface bursts), with P_X = 75,000 Pa (0.75 bar) as the crossover pressure from 1/r^2.3 behaviour to 1/r decay. The model is defined for a 1 kt reference yield and scaled to other energies using the cube-root yield scaling. Here r is horizontal range from ground zero and r_1 is the scaled distance used in the formula. This regime captures the constructive interference caused by ground-reflected shocks and yields the highest ground-level overpressures.",
                    priority: "PRIMARY"
                },
                {
                    title: "Peak Overpressure (Outside Mach Region – Secondary Model)",
                    equation: `
            p_0 = 3.14 \\times 10^{11} z_b^{-2.6} \\\\
            \\beta = 34.87 z_b^{-1.73} \\\\
            p = p_0 e^{-\\beta r_1}
            `,
                    description: "For airbursts occurring above the Mach reflection zone (z_b > z_critical), the overpressure decays exponentially with scaled distance. Here, z_b is burst altitude (m) and r₁ is scaled horizontal range. This model applies when the shock wave does not significantly reflect off the ground and the wavefront expands spherically.",
                    priority: "SECONDARY"
                },
                {
                    title: "Mach Reflection and Amplification",
                    description: "When a shock wave intersects the ground at shallow angles, it reflects and merges with the incident wave, forming a Mach stem. This process amplifies local overpressure—often up to twice the direct blast pressure. The transition from regular to Mach reflection defines the boundary between the exponential decay and the enhanced overpressure regimes.",
                    priority: "SECONDARY"
                },
                {
                    title: "Peak Wind Velocity",
                    equation: `
            u = \\frac{5p}{7P_0} \\frac{c_0}{\\sqrt{1 + 6p/7P_0}}
            `,
                    description: "Post-shock wind velocity is derived from Rankine–Hugoniot relations, where p is the overpressure, P₀ is ambient atmospheric pressure, and c₀ is the local speed of sound. These velocities represent the transient airflow immediately following the shock front and are used to estimate aerodynamic loading on structures and human bodies.",
                    priority: "SECONDARY"
                },
                {
                    title: "Wind Velocity Physical Limit",
                    description: "At extreme overpressures, computed wind speeds may exceed physical limits of air as a gas. A threshold of roughly 7 km/s is adopted as a generous upper bound. Above this velocity, air cannot remain in a gaseous state; molecular dissociation and ionization dominate, forming a plasma. Beyond this point, the concept of 'wind' ceases to apply, as energy transfer occurs through radiative and plasma flow rather than conventional fluid motion.",
                    priority: "REFERENCE"
                }
            ]
        },
        crater: {
            title: "CRATER FORMATION MECHANICS",
            subtitle: "Impact crater scaling and morphology",
            debrief: "This section explores the equations governing the formation and characteristics of impact craters. Both land and ocean impacts are considered, including surface-water cavities and seafloor cratering after velocity reduction by water drag.",
            equations: [
                {
                    title: "Transient Crater Diameter (Land/Seafloor)",
                    equation: "D_{tc} = 1.161\\left(\\frac{\\rho_i}{\\rho_t}\\right)^{1/3} L^{0.78} v_i^{0.44} g^{-0.22} \\sin^{1/3}\\theta",
                    image: "",
                    description: "Baseline excavation diameter in rock or seafloor targets. ρᵢ = impactor density, ρₜ = target density (≈2700 kg/m³ for ocean bedrock or ≈2500 for land strike), L = impactor diameter, vᵢ = impact velocity (accounting for water drag adjustment), θ = impact angle.",
                    priority: "PRIMARY"
                },
                {
                    title: "Transient Water Cavity Diameter",
                    equation: "D_{tc,w} = 1.365\\left(\\frac{\\rho_i}{\\rho_w}\\right)^{1/3} L^{0.78} v_i^{0.44} g^{-0.22} \\sin^{1/3}\\theta",
                    image: "",
                    description: "Cavity formed at the ocean surface. Uses water density ρ_w = 1000 kg/m³ and coefficient 1.365.",
                    priority: "PRIMARY"
                },
                {
                    title: "Velocity Attenuation in Water",
                    equation: "v_{sf} = v_i \\exp\\left(-\\tfrac{3\\,\\rho_w C_D d_w}{2 \\rho_i L \\sin\\theta\\,}\\right)",
                    image: "",
                    description: "Impactor velocity upon reaching the seafloor. ρ_w = water density, C_D = drag coefficient, d_w = water depth, L = impactor diameter, ρᵢ = impactor density, θ = impact angle.",
                    priority: "SECONDARY"
                },
                {
                    title: "Final Crater Diameter",
                    equation: "D_{fr} = \\begin{cases} 1.25D_{tc} & D_{tc} < 3.2\\,\\text{km} \\\\ 1.17 D_{tc}^{1.13} / 3200^{0.13} & D_{tc} \\geq 3.2\\,\\text{km} \\end{cases}",
                    image: "",
                    description: "Post-collapse crater size accounting for rim slumping and gravitational modification. Past a diameter of 3.2km, we transition from a simple to complex crater as collapse processes become less understood due to complex relationships between gravitational forces and rock strength",
                    priority: "PRIMARY"
                },
                {
                    title: "Excavated Volume",
                    equation: "V = \\tfrac{\\pi}{16\\sqrt{2}} D_{tc}^3",
                    image: "",
                    description: "Total displaced material. Assumes a parabolic crater profile.",
                    priority: "SECONDARY"
                }
            ]
        },
        seismic: {
            title: "SEISMIC WAVE PROPAGATION",
            subtitle: "Global seismic response modeling",
            debrief: "This section presents the equations used to model the generation and propagation of seismic waves resulting from an asteroid impact. These models are essential for predicting ground shaking intensity and potential damage over large areas.",
            equations: [
                {
                    title: "Richter Magnitude",
                    equation: "M = 0.67 \\log_{10}(E) - 5.87",
                    image: "",
                    description: "Seismic magnitude scale. E = impact energy in Joules. Each unit increase = 32× more energy.",
                    priority: "PRIMARY"
                },
                {
                    title: "Effective Seismic Magnitude",
                    equation: "M_{eff} = \\begin{cases} M - 0.0238r_{km} & \\text{for } r_{km} < 60 \\text{ km} \\\\ M - 0.0048r_{km} - 1.1644 & \\text{for } 60 \\leq r_{km} < 700 \\text{ km} \\\\ M - 1.66\\log_{10}\\Delta - 6.399 & \\text{for } r_{km} \\geq 700 \\text{ km} \\end{cases}",
                    image: "",
                    description: "Effective seismic magnitude as a function of distance from impact site. M = actual seismic magnitude, r_km = distance in km, Δ = distance away from impact site.",
                    priority: "PRIMARY"
                }
            ]
        },
        mortality: {
            title: "Effect on Life",
            subtitle: "Global and Localised human impact predictions",
            debrief: "This section presents the heuristics and reasoning being estimating loss of life and injury from sever asteroid impact",
            equations: [
                {
                    title: "Population Via tif extraction",
                    equation: "",
                    image: "/images/populationDensity.png",
                    description: "Population density is derived directly from a georeferenced tif file taken from the NASA Socioeconomic Data and Applications Center (SEDAC). The impact latitude and longitude define the center point, and eight additional points are sampled at equal offsets around the chosen population radius. Values from these nine points are averaged to obtain a more robust local density estimate. This approach captures variations in the surrounding area and reduces sensitivity to anomalies at a single coordinate.",
                    priority: "PRIMARY"
                },
                {
                    title: "Population within Bounding Square",
                    equation: "density = \\frac{population_{square}}{s^2}, \\quad population_{outside} = 50 \\text{ people/km}^2",
                    image: "",
                    description: "The bounding square is defined with center at the impact latitude and longitude, and side length s. The square's corners are latitude ± s/2 and longitude ± s/2. Population is simpled via 8 local points in impact location via .tif file, and density is computed as total population divided by s². For effects outside the bounding square, we approximate a global average density of 50 people/km² to account for water and sparsely populated regions.",
                    priority: "PRIMARY"
                },
                {
                    title: "Mortality and Injury Heuristic",
                    equation: "mortality = \\max(R_{clothes}, R_{crater}) \\cdot density + 0.8 \\cdot R_{2nd\\ degree} - 0.8 \\cdot R_{certain}, \\quad injury = \\mathbf{1}_{M \\ge 7.5} \\cdot density",
                    image: "",
                    description: "Mortality is estimated using the maximum radius of the clothes ignition area and transient crater area, plus 0.8 times the area affected by second-degree burns, minus 0.8 times the certain death area to avoid double counting. Injury is approximated as density multiplied by an indicator for earthquakes with magnitude ≥ 7.5.",
                    priority: "PRIMARY"
                }
            ]
        },
        waterLayer: {
            "title": "Tsunami Calculations",
            "subtitle": "Predicting Wave Height, Speed, and Arrival Time",
            "debrief": "This section provides the formulas and underlying principles for calculating key tsunami characteristics following a severe asteroid impact, including wave amplitude, propagation speed, and arrival time. A constant water depth of 3682 meters is assumed for all calculations.",
            "equations": [
                {
                    "title": "Maximum Rim-Wave Amplitude",
                    "equation": "A_{rw}^{max} = \\min\\left(\\frac{D_{tc}}{14.1}, H\\right)",
                    "image": "",
                    "description": "This formula, derived from oceanic impact simulations, estimates the maximum amplitude of the initial rim wave (Arw_max). It is the minimum of two values: the transient crater diameter (Dtc) divided by 14.1, and the water depth (H). This ensures the wave amplitude does not exceed the water depth itself.",
                    "priority": "PRIMARY"
                },
                {
                    "title": "Rim-Wave Amplitude at a Given Distance",
                    "equation": "A_{rw} = A_{rw}^{max} \\left(\\frac{R_{rw}}{r}\\right)",
                    "image": "",
                    "description": "This equation calculates the rim-wave amplitude (Arw) at a specific radial distance (r) from the impact point, for r > Rrw, where Rrw is the radius of the rim-wave generation zone. The formula incorporates a 1/r decay, which is a common heuristic for wave attenuation with radial distance.",
                    "priority": "PRIMARY"
                },
                {
                    "title": "Tsunami Propagation Speed (Long-Wave Limit)",
                    "equation": "c \\approx \\sqrt{gH}\\left(1 + \\frac{A}{2H}\\right)",
                    "image": "",
                    "description": "The propagation speed of the tsunami (c) is determined by the long-wave limit, which applies when the wavelength is much greater than the water depth. With an assumed water depth of 3682 meters, this formula is highly applicable. Here, g is the acceleration due to gravity, and A is the maximum amplitude of the wave.",
                    "priority": "PRIMARY"
                },
                {
                    "title": "Tsunami Propagation Speed (Short-Wave Limit)",
                    "equation": "c \\approx \\sqrt{\\frac{g\\lambda}{2\\pi}}\\left(1 + \\frac{2\\pi^2 A^2}{\\lambda^2}\\right)",
                    "image": "",
                    "description": "This formula provides the propagation speed (c) for the short-wave limit, which applies when the wavelength is much less than the water depth. Here, lambda is the wavelength, g is the acceleration due to gravity, and A is the maximum amplitude of the wave. This formula is included as an alternative for different wave conditions.",
                    "priority": "SECONDARY"
                },
                {
                    "title": "Maximum Estimated Arrival Time",
                    "equation": "T_w^{max} = \\frac{r}{\\sqrt{1.56D_{tc} \\tanh\\left(\\frac{6.28H}{D_{tc}}\\right)}}",
                    "image": "",
                    "description": "This equation provides the maximum estimated arrival time (Tw_max) of the rim wave or collapse wave at a distance (r). This formula uses a conservative speed estimate based on factors of the transient crater diameter (Dtc) and water depth (H) to provide an upper bound for the arrival time, which is useful for risk assessment and warning systems.",
                    "priority": "PRIMARY"
                }
            ]
        }
    };

    

    const categoryData = formulas[category as keyof typeof formulas];

    const handleBack = () => {
        if (window.history.length > 1) router.back();
        else router.push('/meteors');
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <button onClick={handleBack} className={styles.backButton}>
                    ← RETURN
                </button>
                <div className={styles.nasaInfo}>
                    <span className={styles.nasaLabel}>NASA PLANETARY DEFENSE</span>
                    <span className={styles.nasaLevel}>RESEARCH</span>
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.titleSection}>
                    <h1 className={styles.title}>{categoryData.title}</h1>
                    <p className={styles.subtitle}>{categoryData.subtitle}</p>
                    <div className={styles.warning}>
                        🚀 NOTICE: Scientific models for planetary impact assessment
                    </div>
                    <div className={styles.debrief}>{categoryData.debrief}</div>
                </div>

                <div className={styles.equationsContainer}>
                    {categoryData.equations.map((eq, index) => (
                        <div key={index} className={styles.equation}>
                            <div className={styles.equationHeader}>
                                <h2 className={styles.equationTitle}>{eq.title}</h2>
                                <span
                                    className={`${styles.priority} ${styles[eq.priority.toLowerCase()]}`}
                                >
                                    {eq.priority}
                                </span>
                            </div>

                            {/* Only render equation if provided */}
                            {eq.equation && eq.equation.trim() !== "" && (
                                <div className={styles.math}>
                                    <BlockMath math={eq.equation} />
                                </div>
                            )}

                            {/* Only render image if provided */}
                            {eq.image && eq.image.trim() !== "" && (
                                <div className={styles.imageWrapper}>
                                    <img
                                        src={eq.image}
                                        alt={eq.title}
                                        className={styles.equationImage}
                                    />
                                </div>
                            )}

                            <p className={styles.description}>{eq.description}</p>
                        </div>
                    ))}
                </div>

            </div>
        </div>
    );
}
