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
            debrief:
                "This section provides the core mathematical models used to estimate the energy released during an asteroid impact event. These equations form the basis for future calculations which depend on the energy output.",
            equations: [
                {
                    title: "Meteoroid Parameters",
                    equation:
                        "\\text{Min Asteroid Speed} \\approx 11.2\\text{ km/s} \\\\ \\text{Max Asteroid Speed} \\approx 72\\text{ km/s} \\\\ \\text{Typical Asteroid Speed} \\approx 20\\text{ km/s} \\\\ \\text{Average Asteroid Angle} \\approx 45^\\circ",
                    description:
                        "Meteroid speeds are almost always between 11.2 km/s (Earth's escape velocity) and 72 km/s (sum of Earth's orbital velocity and solar escape velocity). A slower object would accelerate as it entered earth gravitational field. A faster speed is virtually impossible as it could only come from interstellar space directly pointing at Earth. Meteroid angles can range from 0-90°, but 45° is the most probable angle of impact.",
                    priority: "PRIMARY",
                },
                {
                    title: "Kinetic Energy",
                    equation: "E = \\frac{1}{2}mv^2 = \\frac{\\pi}{12} \\, \\rho_i \\, L^3 \\, v^2 ",
                    description:
                        "Total impact energy in Joules. Mass (m) in kilograms, velocity (v) in meters per second. Alternative measurements using density (rho_i) in (kg / m^3) and diameter (L) in meters, can approximate mass as a sphere to avoid direct mass input.",
                    priority: "PRIMARY",
                },
                {
                    title: "Recurrence Period",
                    equation: "T_{re} = 109 \\cdot E_{Mt}^{0.78}",
                    description:
                        "Statistical frequency of impacts of magnitude E_Mt (Megatons of TNT). Measured in years between occurrences.",
                    priority: "SECONDARY",
                },
                {
                    title: "Impact Velocity",
                    equation: "v_{impact} = \\sqrt{v_{\\infty}^2 + v_{escape}^2}",
                    description:
                        "Final velocity at impact accounting for gravitational acceleration. Earth's escape velocity: 11.2 km/s.",
                    priority: "PRIMARY",
                },
            ],
        },
        // ...include thermal, blast, crater, seismic, mortality sections here as in your original code
    };

    const categoryData = formulas[category as keyof typeof formulas];

    const handleBack = () => {
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/meteors');
        }
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
                                <span className={`${styles.priority} ${styles[eq.priority.toLowerCase()]}`}>
                                    {eq.priority}
                                </span>
                            </div>
                            <div className={styles.math}>
                                <BlockMath math={eq.equation} />
                            </div>
                            <p className={styles.description}>{eq.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
