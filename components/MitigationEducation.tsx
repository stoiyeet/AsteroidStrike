"use client";
import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Shield,
  Zap,
  Target,
  Rocket,
  Atom,
  Satellite,
  Filter,
  Info,
  BookOpen,
  Scale,
  Timer,
  Link as LinkIcon,
  Table2,
} from "lucide-react";

/** Types */
type Effectiveness = "High" | "Medium" | "Low";
type Cost = "High" | "Medium" | "Low";
type Category = "all" | "detection" | "kinetic" | "nuclear" | "slow";

interface SourceLink {
  label: string;
  url: string;
}

interface DataPoint {
  label: string;
  value: string;
  hint?: string;
}

interface MitigationMethod {
  id: string;
  name: string;
  category: Exclude<Category, "all">;
  icon: React.ReactNode;
  description: string;
  advantages: string[];
  disadvantages: string[];
  timeline: string; // human readable
  leadTimeCategory: "short" | "medium" | "long"; // for scenario filter
  effectiveness: Effectiveness;
  cost: Cost;
  bestFor?: string;
  dataPoints?: DataPoint[];
  sources: SourceLink[];
}

/** Helpers */
const badgeColor = (level: string) => {
  switch (level) {
    case "High":
      return "text-green-400 bg-green-400/15 ring-1 ring-green-500/30";
    case "Medium":
      return "text-yellow-400 bg-yellow-400/15 ring-1 ring-yellow-500/30";
    case "Low":
      return "text-red-400 bg-red-400/15 ring-1 ring-red-500/30";
    default:
      return "text-gray-300 bg-gray-500/10 ring-1 ring-gray-500/20";
  }
};

const pill = "px-2 py-0.5 rounded-md text-xs font-medium inline-flex items-center gap-1";

/** Component */
const MitigationEducation: React.FC = () => {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category>("all");
  const [leadTimeFilter, setLeadTimeFilter] = useState<"any" | "short" | "medium" | "long">("any");
  const [showCompare, setShowCompare] = useState(false);

  /** Data-backed methods (with links to NASA/ESA/Nature/treaties) */
  const methods: MitigationMethod[] = useMemo(
    () => [
      // Detection & Early Warning (not strictly a "deflection" but mission-critical)
      {
        id: "neo-surveyor",
        name: "Detection: NEO Surveyor",
        category: "detection",
        icon: <Satellite className="w-5 h-5" />,
        description:
          "Infrared space telescope designed to find the majority of potentially hazardous near-Earth objects (NEOs), especially dark asteroids that are hard to see from the ground.",
        advantages: [
          "Dramatically improves early warning (infrared excels at dark objects)",
          "Enables slower, safer deflection methods",
          "Targets U.S. goal to find 90% of ≥140 m NEOs",
        ],
        disadvantages: [
          "Does not deflect—only detects and characterizes",
          "Schedule/budget risks delay benefits",
          "Follow-on deflection missions still required",
        ],
        timeline: "Launch no earlier than Sep 2027 (NET), multi-year survey to ramp coverage",
        leadTimeCategory: "long",
        effectiveness: "High",
        cost: "High",
        bestFor:
          "Global early warning and characterization to unlock slow-push deflection options decades in advance",
        dataPoints: [
          { label: "Mission", value: "Space IR surveyor (JPL/NASA)" },
          { label: "Launch", value: "NET Sep 2027" },
          { label: "Policy goal", value: "Detect 90% of ≥140 m NEOs" },
          { label: "Cataloged so far", value: "~44% (May 2025 hearing)", hint: "Estimate; improving" },
        ],
        sources: [
          { label: "NASA/JPL – NEO Surveyor", url: "https://www.jpl.nasa.gov/missions/near-earth-object-surveyor/" },
          { label: "NASA – NEO Surveyor (science)", url: "https://science.nasa.gov/mission/neo-surveyor/" },
          { label: "U.S. House Hearing (2025)", url: "https://www.spacefoundation.org/reports/u-s-house-committee-on-science-space-and-technology-space-and-aeronautics-subcommittee-hearing-from-detection-to-deflection-evaluating-nasas-planetary-defense-strategy/" },
          { label: "NASA OIG (2025) PDCO overview", url: "https://oig.nasa.gov/news/assessing-nasas-strategy-to-protect-earth-from-hazardous-asteroids-and-comets/" },
        ],
      },

      // Kinetic Impactor
      {
        id: "kinetic-impactor",
        name: "Kinetic Impactor",
        category: "kinetic",
        icon: <Rocket className="w-5 h-5" />,
        description:
          "A spacecraft hits the asteroid at high speed to change its trajectory via momentum transfer. Validated by NASA’s DART mission (2022).",
        advantages: [
          "Demonstrated at full scale (DART)",
          "No nuclear material; simpler policy path",
          "Fast impulse; can stack with follow-ups",
        ],
        disadvantages: [
          "Requires years of warning & precise targeting",
          "Outcome depends on asteroid structure (rubble-pile vs monolith)",
          "Potential to shed debris and change spin state",
        ],
        timeline: "Typically 5–10+ years warning (mission design, launch, intercept)",
        leadTimeCategory: "medium",
        effectiveness: "High",
        cost: "Medium",
        bestFor:
          "Small–medium NEOs with sufficient warning; first-line option when object properties are reasonably constrained",
        dataPoints: [
          { label: "DART ΔPeriod", value: "−33.0 ± 1.0 min" },
          { label: "DART Δv (along-track)", value: "≈ 2.70 ± 0.10 mm/s" },
          { label: "Momentum boost β", value: "≈ 3.61 (range ~2.2–4.9)" },
          { label: "Target", value: "Dimorphos (moon of Didymos)" },
        ],
        sources: [
          { label: "NASA – DART overview", url: "https://science.nasa.gov/mission/dart/" },
          { label: "NASA News – 32 min confirmation", url: "https://www.nasa.gov/news-release/nasa-confirms-dart-mission-impact-changed-asteroids-motion-in-space/" },
          { label: "Nature (2023) – β & Δv", url: "https://www.nature.com/articles/s41586-023-05878-z" },
          { label: "Nature (2023) – 33±1 min", url: "https://www.nature.com/articles/s41586-023-05805-2" },
        ],
      },

      // Nuclear Standoff/Surface Detonation
      {
        id: "nuclear-detonation",
        name: "Nuclear Standoff Detonation",
        category: "nuclear",
        icon: <Atom className="w-5 h-5" />,
        description:
          "A nuclear device detonated near the asteroid’s surface ablates material and imparts a large impulse; the most energetic option for late notice or large objects.",
        advantages: [
          "Highest impulse per launch",
          "Potentially viable for very large NEOs or short warning",
          "Stand-off bursts can reduce fragmentation vs contact",
        ],
        disadvantages: [
          "Significant legal/political constraints (treaties)",
          "Risk of fragment creation & uncertain outcomes",
          "Complex international coordination & liability",
        ],
        timeline: "Sometimes considered for 1–5 year warning or large objects",
        leadTimeCategory: "short",
        effectiveness: "High",
        cost: "High",
        bestFor:
          "Last-resort scenarios when warning time is short and/or object is very large; requires global approval",
        dataPoints: [
          { label: "Treaties", value: "PTBT (1963), OST (1967), CTBT (1996*)" , hint: "*CTBT not yet in force globally" },
          { label: "Use Mode", value: "Stand-off preferred (minimize shattering)" },
        ],
        sources: [
          { label: "UNOOSA – Outer Space Treaty (Art. IV)", url: "https://www.unoosa.org/oosa/en/ourwork/spacelaw/treaties/outerspacetreaty.html" },
          { label: "U.S. Archives – Limited/Partial Test Ban (1963)", url: "https://www.archives.gov/milestone-documents/test-ban-treaty" },
          { label: "CTBTO – CTBT Overview", url: "https://www.ctbto.org/our-mission/the-treaty" },
          { label: "NASA – Planetary Defense strategy (lead-time context)", url: "https://www.nasa.gov/wp-content/uploads/2023/06/nasa_-_planetary_defense_strategy_-_final-508.pdf" },
        ],
      },

      // Gravity Tractor
      {
        id: "gravity-tractor",
        name: "Gravity Tractor",
        category: "slow",
        icon: <Target className="w-5 h-5" />,
        description:
          "A spacecraft hovers near the asteroid; mutual gravity plus steady thrust slowly tugs the asteroid’s path over years/decades.",
        advantages: [
          "Ultra-precise, continuous control",
          "No physical contact; avoids shattering",
          "Works regardless of surface properties",
        ],
        disadvantages: [
          "Very slow; needs decades of warning for substantial deflection",
          "High station-keeping & power requirements",
          "Limited practicality for very large/fast-approaching objects",
        ],
        timeline: "20+ years warning preferred",
        leadTimeCategory: "long",
        effectiveness: "Medium",
        cost: "Medium",
        bestFor: "Well-characterized targets with long warning and small required Δv",
        dataPoints: [
          { label: "Mode", value: "Non-contact tug via gravity" },
          { label: "Power scale", value: "Tens–hundreds of kW concepts studied" },
        ],
        sources: [
          { label: "NASA NTRS – Gravity Tractor Ops", url: "https://ntrs.nasa.gov/api/citations/20120013195/downloads/20120013195.pdf" },
          { label: "NASA NTRS – Enhanced Tractor (ARM heritage)", url: "https://ntrs.nasa.gov/citations/20170005468" },
        ],
      },

      // Laser Ablation
      {
        id: "laser-ablation",
        name: "Laser Ablation",
        category: "slow",
        icon: <Zap className="w-5 h-5" />,
        description:
          "High-power lasers vaporize surface material, producing a jet of ejecta that gently pushes the asteroid over long periods.",
        advantages: [
          "No physical contact; precise thrusting",
          "Potential for continuous operation",
          "Minimal debris if done correctly",
        ],
        disadvantages: [
          "Requires enormous power & thermal control",
          "Long engagement times; tech maturity is low",
          "Beam scatter from dust/plume can reduce efficiency",
        ],
        timeline: "10–20+ years warning",
        leadTimeCategory: "long",
        effectiveness: "Low",
        cost: "High",
        bestFor: "Small–moderate Δv over long timelines with robust power systems",
        dataPoints: [
          { label: "Thrust source", value: "Vaporized ejecta plume" },
          { label: "Temp regime", value: "≈ 2,700–3,000 K for many rocks" },
        ],
        sources: [
          { label: "NASA NTRS – Campbell (2002)", url: "https://ntrs.nasa.gov/citations/20020092012" },
          { label: "Background – Laser ablation summary", url: "https://en.wikipedia.org/wiki/Asteroid_laser_ablation" },
        ],
      },

      // Ion Beam Shepherd
      {
        id: "ion-beam-shepherd",
        name: "Ion Beam Shepherd",
        category: "slow",
        icon: <Shield className="w-5 h-5" />,
        description:
          "A spacecraft fires a quasi-neutral ion beam at the asteroid, transferring momentum without touching it; a ‘slow-push’ cousin of the gravity tractor.",
        advantages: [
          "High-efficiency propulsion; continuous thrust",
          "Non-contact and precise",
          "Leverages mature ion engines (at small scales)",
        ],
        disadvantages: [
          "Slow; requires long durations & careful plume control",
          "Beam-asteroid coupling depends on surface/charging",
          "Missions likely complex and power-hungry",
        ],
        timeline: "15+ years warning",
        leadTimeCategory: "long",
        effectiveness: "Medium",
        cost: "Medium",
        bestFor: "Long-lead gradual deflection when precise control is required",
        dataPoints: [
          { label: "Concept", value: "Quasi-neutral ion plume momentum transfer" },
          { label: "Heritage", value: "Academic/ESA studies (TRL growing)" },
        ],
        sources: [
          { label: "Bombardelli & Peláez (2011/2013)", url: "https://ui.adsabs.harvard.edu/abs/2011JGCD...34.1270B/abstract" },
          { label: "Journal PDF (2013)", url: "https://ep2.uc3m.es/assets/docs/pubs/journal_publications/bomb13.pdf" },
        ],
      },
    ],
    []
  );

  /** Filters */
  const visibleMethods = useMemo(() => {
    return methods.filter((m) => {
      const catOk = selectedCategory === "all" ? true : m.category === selectedCategory;
      const leadOk = leadTimeFilter === "any" ? true : m.leadTimeCategory === leadTimeFilter;
      return catOk && leadOk;
    });
  }, [methods, selectedCategory, leadTimeFilter]);

  /** UI */
  return (
    <div className="bg-gray-900/90 backdrop-blur-sm border border-gray-800 rounded-xl p-6 text-white">
      {/* Header */}
      <div className="mb-6 space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-400" />
          Planetary Defense: Detection & Mitigation Methods
        </h2>
        <p className="text-gray-300 text-sm">
          Learn how we detect and deflect hazardous near-Earth objects (NEOs). Real data from NASA/ESA missions,
          Nature-published results, and current policy constraints are summarized below.
        </p>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          {([
            { id: "all", label: "All", icon: "🛡️" },
            { id: "detection", label: "Detection", icon: "🔭" },
            { id: "kinetic", label: "Kinetic", icon: "🚀" },
            { id: "nuclear", label: "Nuclear", icon: "☢️" },
            { id: "slow", label: "Slow-push", icon: "🔄" },
          ] as { id: Category; label: string; icon: string }[]).map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors border ${
                selectedCategory === c.id
                  ? "bg-blue-600 text-white border-blue-500"
                  : "bg-gray-800/70 text-gray-300 border-gray-700 hover:bg-gray-700"
              }`}
            >
              {c.icon} {c.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="text-sm text-gray-300 flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Lead time:
          </div>
          {(["any", "short", "medium", "long"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setLeadTimeFilter(k)}
              className={`px-3 py-1 rounded-lg text-sm transition-colors border ${
                leadTimeFilter === k
                  ? "bg-indigo-600 text-white border-indigo-500"
                  : "bg-gray-800/70 text-gray-300 border-gray-700 hover:bg-gray-700"
              }`}
              title={
                k === "short"
                  ? "≈ 1–5 years"
                  : k === "medium"
                  ? "≈ 5–10+ years"
                  : k === "long"
                  ? "≈ 15–20+ years"
                  : "Any"
              }
            >
              {k === "any" ? "Any" : k}
            </button>
          ))}

          <button
            onClick={() => setShowCompare((s) => !s)}
            className="px-3 py-1 rounded-lg text-sm transition-colors border bg-gray-800/70 text-gray-300 border-gray-700 hover:bg-gray-700 inline-flex items-center gap-2"
          >
            <Table2 className="w-4 h-4" />
            {selectedCategory.includes("all") && (
              showCompare ? "Hide compare" : "Compare"
            )}

          </button>
        </div>
      </div>

      {/* Compare View */}
      {showCompare && selectedCategory.includes("all") && (
        <div className="mb-6 overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-gray-800/60">
              <tr className="text-left text-gray-300">
                <th className="px-3 py-2">Method</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Lead Time</th>
                <th className="px-3 py-2">Effectiveness</th>
                <th className="px-3 py-2">Cost</th>
                <th className="px-3 py-2">Best for</th>
              </tr>
            </thead>
            <tbody>
              {visibleMethods.map((m) => (
                <tr key={m.id} className="border-t border-gray-700">
                  <td className="px-3 py-2 font-medium">{m.name}</td>
                  <td className="px-3 py-2 capitalize">{m.category}</td>
                  <td className="px-3 py-2">
                    {m.leadTimeCategory === "short"
                      ? "≈ 1–5y"
                      : m.leadTimeCategory === "medium"
                      ? "≈ 5–10+y"
                      : "≈ 15–20+y"}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`${pill} ${badgeColor(m.effectiveness)}`}>{m.effectiveness}</span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`${pill} ${badgeColor(m.cost)}`}>${m.cost}</span>
                  </td>
                  <td className="px-3 py-2 text-gray-300">{m.bestFor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Methods List */}
      <div className="space-y-3">
        {visibleMethods.map((m) => {
          const isOpen = expanded === m.id;
          return (
            <div key={m.id} className="border border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : m.id)}
                className="w-full p-4 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400">{m.icon}</div>
                    <div>
                      <h3 className="font-semibold text-lg">{m.name}</h3>
                      <p className="text-gray-400 text-sm mt-1">{m.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="hidden sm:flex gap-2">
                      <span className={`${pill} ${badgeColor(m.effectiveness)}`}>{m.effectiveness}</span>
                      <span className={`${pill} ${badgeColor(m.cost)}`}>${m.cost}</span>
                    </div>
                    {isOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-gray-700 p-4 bg-gray-800/30">
                  {/* Advantages / Disadvantages */}
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-green-400 mb-2">✅ Advantages</h4>
                      <ul className="space-y-1">
                        {m.advantages.map((t, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-green-400 mt-1">•</span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-red-400 mb-2">❌ Limitations</h4>
                      <ul className="space-y-1">
                        {m.disadvantages.map((t, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-red-400 mt-1">•</span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Data strip */}
                  {(m.dataPoints?.length || m.bestFor) && (
                    <div className="mt-4 grid md:grid-cols-2 gap-4">
                      <div className="p-3 bg-gray-700/40 border border-gray-600/60 rounded-lg">
                        <div className="flex items-center gap-2 text-sm text-gray-300">
                          <Timer className="w-4 h-4" />
                          <span className="text-gray-400">Timeline:</span>
                          <span className="ml-1 text-white">{m.timeline}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-sm">
                          <span className={`${pill} ${badgeColor(m.effectiveness)}`}>Effectiveness: {m.effectiveness}</span>
                          <span className={`${pill} ${badgeColor(m.cost)}`}>Cost: ${m.cost}</span>
                        </div>
                        {m.bestFor && (
                          <div className="mt-2 text-sm text-gray-300 flex items-start gap-2">
                            <Info className="w-4 h-4 mt-0.5 text-blue-300" />
                            <span>
                              <span className="text-gray-400">Best for:</span> {m.bestFor}
                            </span>
                          </div>
                        )}
                      </div>

                      {m.dataPoints && m.dataPoints.length > 0 && (
                        <div className="p-3 bg-gray-700/40 border border-gray-600/60 rounded-lg">
                          <div className="font-semibold text-blue-300 text-sm mb-2 flex items-center gap-2">
                            <BookOpen className="w-4 h-4" />
                            Data highlights
                          </div>
                          <div className="grid sm:grid-cols-2 gap-3 text-sm">
                            {m.dataPoints.map((d, idx) => (
                              <div key={idx} className="flex flex-col">
                                <span className="text-gray-400">{d.label}</span>
                                <div className="flex flex-wrap gap-1">
                                  <span className="text-gray-100">{d.value}</span>
                                  {d.hint && <span className="text-gray-400/80">({d.hint})</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  )}

                  {/* Sources */}
                  <div className="mt-4 p-3 bg-gray-700/30 border border-gray-600/50 rounded-lg">
                    <h5 className="font-semibold text-blue-300 text-sm mb-2 flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" /> Sources
                    </h5>
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
                      {m.sources.map((s, i) => (
                        <li key={i}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
                          >
                            {s.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-700/40 rounded-lg">
        <h3 className="font-semibold text-blue-300 mb-2">💡 Key Takeaways</h3>
        <ul className="space-y-1 text-sm text-gray-300">
          <li>• <strong>Early detection multiplies options:</strong> with decades of warning, slow-push methods become practical.</li>
          <li>• <strong>Validated tech:</strong> DART proved kinetic impact works at full scale and can exceed 1:1 momentum transfer via ejecta (β&gt;1).</li>
          <li>• <strong>Policy matters:</strong> nuclear options face treaty and political hurdles and are treated as last-resort.</li>
          <li>• <strong>Know your target:</strong> composition, structure, and spin state critically affect deflection outcomes.</li>
        </ul>
      </div>
    </div>
  );
};

export default MitigationEducation;
