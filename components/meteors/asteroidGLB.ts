// components/meteors/asteroidGlb.ts

// Map special asteroid ids to numbered GLBs
export const specialMap: Record<string, string> = {
  '5535_annefrank': '3.glb',
  '9969_braille': '2.glb',
  '152830_dinkinesh': '3.glb',
  '52246_donaldjohanson': '2.glb',
  '3548_eurybates': '3.glb',
  '243_ida': '2.glb',
  '11351_leucus': '3.glb',
  '21_lutetia': '2.glb',
  'menoetius': '3.glb',
  '21900_orus': '2.glb',
  '617_patroclus': '1.glb',
  '15094_polymele': '1.glb',
  '73p_schwassman_wachmann_3': '3.glb',
  '81p_wild_2': '3.glb',
};

// Build the GLB path used by both the list and impact pages
export function getGlbFile(selectionName: string): string {
  if (selectionName.toLowerCase().includes("custom") || !selectionName) return '/meteors/psyche.glb'; // safe fallback
  if (specialMap[selectionName]) return `/meteors/${specialMap[selectionName]}`;
  const afterUnderscore = selectionName.substring(selectionName.indexOf('_') + 1);
  return `/meteors/${afterUnderscore}.glb`;
}

// Nicely format an asteroid id for display ("101955_bennu" -> "101955 Bennu")
export function formatAsteroidName(id: string) {
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
