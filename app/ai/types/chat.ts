// types/chat.ts

// Project NEO chat / effects types

export type EffectKey =
  | "kineticImpactor"
  | "nuclearDetonation" 
  | "gravityTractor"
  | "laserAblation"
  | "ionBeamShepherd"
  | "asteroidApproach"
  | "impact"
  | "explosion"
  | "deflection"
  | "laserDefense"
  | "shockwave"
  | "craterFormation";

export interface ChatMessage {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  effects?: EffectKey[];
}

export interface EffectConfig {
  icon: string;
  label: string;
  description?: string;
}

export interface AIResponse {
  answer: string;
  effects?: EffectKey[];
}