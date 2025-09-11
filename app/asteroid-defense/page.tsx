'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';

// ============================================================================
// ASTEROID MODEL & GAME TYPES
// ============================================================================

export type AsteroidSize = 'tiny' | 'small' | 'medium' | 'large';

export interface Asteroid {
  id: string;
  name: string;
  size: AsteroidSize;
  diameterM: number;
  massKg: number;
  velocityKmps: number;
  
  // Detection properties
  detectionDate: Date;
  detectionChance: number;
  isDetected: boolean;
  
  // Time properties
  timeToImpactHours: number;
  initialTimeToImpact: number;
  
  // Trajectory properties
  impactProbability: number;
  initialImpactProbability: number;
  uncertaintyKm: number; // Position uncertainty
  
  // Impact properties
  impactLatitude?: number;
  impactLongitude?: number;
  impactZoneRadiusKm?: number;
  
  // Status
  isTracked: boolean;
  publicAlerted: boolean;
  evacuationOrdered: boolean;
  deflectionMissions: DeflectionMission[];
}

export interface DeflectionMission {
  id: string;
  type: 'kinetic' | 'nuclear' | 'gravity_tractor';
  name: string;
  launchDate: Date;
  arrivalDate: Date;
  cost: number;
  effectivenessPercent: number;
  status: 'planned' | 'launched' | 'en_route' | 'deployed' | 'failed';
}

export interface GameState {
  currentTime: Date;
  gameSpeed: number; // Speed multiplier (1 = real time, 3600 = 1 hour per second)
  isPlaying: boolean;
  
  // Resources
  budget: number; // In billions USD
  trustPoints: number; // Public trust (0-100)
  
  // Tracking capabilities
  trackingCapacity: number; // Max asteroids we can actively track
  
  // Score
  livesAtRisk: number;
  livesSaved: number;
  falseAlarms: number;
}

export interface EventLogEntry {
  id: string;
  timestamp: Date;
  type: 'detection' | 'tracking' | 'alert' | 'mission' | 'impact' | 'miss' | 'system';
  message: string;
  asteroidId?: string;
  severity: 'info' | 'warning' | 'critical' | 'success';
}

// ============================================================================
// ASTEROID GENERATION & PHYSICS
// ============================================================================

const ASTEROID_SIZE_CONFIGS = {
  tiny: {
    diameterRange: [1, 5],
    densityKgM3: 2500,
    detectionChance: 0.4, // Improved detection for better gameplay
    timeToImpactRange: [1, 72], // 1-72 hours
    initialImpactProb: 0.01, // Usually burn up in atmosphere - very low impact chance
    impactZoneKm: 0, // Burns up in atmosphere
    dangerLevel: 0,
  },
  small: {
    diameterRange: [5, 20], 
    densityKgM3: 2700,
    detectionChance: 0.6, // Improved detection for better gameplay
    timeToImpactRange: [24, 168], // 1-7 days
    initialImpactProb: 0.05, // Mostly harmless airbursts - low impact chance
    impactZoneKm: 10, // Small airburst damage
    dangerLevel: 1,
  },
  medium: {
    diameterRange: [20, 140],
    densityKgM3: 3000,
    detectionChance: 0.8, // Improved detection for better gameplay
    timeToImpactRange: [168, 8760], // 1 week - 1 year
    initialImpactProb: 0.15, // Regional danger - moderate impact chance
    impactZoneKm: 100, // Regional destruction
    dangerLevel: 5,
  },
  large: {
    diameterRange: [140, 1000],
    densityKgM3: 3200,
    detectionChance: 0.95, // Almost always detected early
    timeToImpactRange: [8760, 87600], // 1-10 years
    initialImpactProb: 0.3, // Global threat - higher impact chance
    impactZoneKm: 1000, // Global effects
    dangerLevel: 10,
  }
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function massFromDiameter(diameterM: number, densityKgM3: number): number {
  const radius = diameterM / 2;
  const volume = (4 / 3) * Math.PI * Math.pow(radius, 3);
  return volume * densityKgM3;
}

function generateAsteroid(currentTime: Date): Asteroid {
  // Randomly select size category (weighted towards smaller objects)
  const sizeRoll = Math.random();
  let size: AsteroidSize;
  if (sizeRoll < 0.6) size = 'tiny';
  else if (sizeRoll < 0.85) size = 'small';
  else if (sizeRoll < 0.98) size = 'medium';
  else size = 'large';
  
  const config = ASTEROID_SIZE_CONFIGS[size];
  
  const diameterM = randomBetween(config.diameterRange[0], config.diameterRange[1]);
  const massKg = massFromDiameter(diameterM, config.densityKgM3);
  const velocityKmps = randomBetween(11, 70); // Typical Earth encounter velocities
  
  const timeToImpactHours = randomBetween(config.timeToImpactRange[0], config.timeToImpactRange[1]);
  
  // Detection chance decreases with smaller size and less time
  const detectionChance = config.detectionChance * (timeToImpactHours / config.timeToImpactRange[1]);
  const isDetected = Math.random() < detectionChance;
  
  // Generate random impact location
  const impactLatitude = randomBetween(-60, 60); // Most impacts in populated zones
  const impactLongitude = randomBetween(-180, 180);
  
  // Initial uncertainty is high, decreases with observation time
  const uncertaintyKm = Math.max(50, config.impactZoneKm * 10 / Math.sqrt(timeToImpactHours / 24));
  
  const asteroid: Asteroid = {
    id: `AST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    name: generateAsteroidName(),
    size,
    diameterM,
    massKg,
    velocityKmps,
    
    detectionDate: new Date(currentTime.getTime() - (isDetected ? Math.random() * 24 * 60 * 60 * 1000 : 0)),
    detectionChance,
    isDetected,
    
    timeToImpactHours,
    initialTimeToImpact: timeToImpactHours,
    
    impactProbability: config.initialImpactProb,
    initialImpactProbability: config.initialImpactProb,
    uncertaintyKm,
    
    impactLatitude,
    impactLongitude,
    impactZoneRadiusKm: config.impactZoneKm,
    
    isTracked: false,
    publicAlerted: false,
    evacuationOrdered: false,
    deflectionMissions: [],
  };
  
  return asteroid;
}

function generateAsteroidName(): string {
  const prefixes = ['2024', '2025', '2026'];
  const suffixes = ['AA', 'AB', 'AC', 'BA', 'BB', 'BC', 'CA', 'CB', 'CC', 'DA', 'DB', 'DC'];
  const numbers = [Math.floor(Math.random() * 999) + 1];
  
  return `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]}${numbers[0]}`;
}

// ============================================================================
// GAME MECHANICS
// ============================================================================

function updateAsteroid(asteroid: Asteroid, deltaTimeHours: number, isTracked: boolean): Asteroid {
  const updated = { ...asteroid };
  
  // Update time to impact
  updated.timeToImpactHours = Math.max(0, asteroid.timeToImpactHours - deltaTimeHours);
  
  // Improve accuracy over time if being tracked
  if (isTracked && updated.timeToImpactHours > 0) {
    const observationTime = asteroid.initialTimeToImpact - updated.timeToImpactHours;
    const improvementFactor = Math.sqrt(observationTime / 24); // Improve with sqrt of observation days
    updated.uncertaintyKm = Math.max(1, asteroid.uncertaintyKm / (1 + improvementFactor * 0.1));
    
    // Refine impact probability (move towards true value)
    const trueImpactProb = Math.random() < 0.1 ? 0.9 : 0.05; // 10% are actually dangerous
    const refinementRate = 0.02 * improvementFactor;
    updated.impactProbability = updated.impactProbability + 
      (trueImpactProb - updated.impactProbability) * refinementRate;
    updated.impactProbability = Math.max(0, Math.min(1, updated.impactProbability));
  }
  
  return updated;
}

const ACTION_COSTS = {
  trackAsteroid: 0.1, // $100M to track one asteroid
  alertPublic: 0.05, // $50M for alert systems
  launchKineticMission: 2.0, // $2B for kinetic interceptor
  launchNuclearMission: 5.0, // $5B for nuclear option
  launchGravityTractor: 3.0, // $3B for gravity tractor
  evacuateArea: 1.0, // $1B for evacuation
};

const TRUST_IMPACTS = {
  correctAlert: 10,
  falseAlarm: -20,
  missedThreat: -50,
  successfulDeflection: 30,
  failedMission: -15,
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AsteroidDefensePage() {
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    currentTime: new Date('2025-01-01T00:00:00Z'),
    gameSpeed: 86400, // 1 day per second (faster default)
    isPlaying: true,
    budget: 50, // $50B starting budget
    trustPoints: 75, // Start with decent public trust
    trackingCapacity: 5, // Can track 5 asteroids simultaneously
    livesAtRisk: 0,
    livesSaved: 0,
    falseAlarms: 0,
  });
  
  // Asteroids state - Initialize empty to avoid hydration issues, populate client-side
  const [asteroids, setAsteroids] = useState<Asteroid[]>([]);
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [selectedAsteroid, setSelectedAsteroid] = useState<string | null>(null);
  const [showQuickMissionOptions, setShowQuickMissionOptions] = useState(false);
  
  // UI state
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([]);
  
  // Add event to log
  const addEvent = useCallback((type: EventLogEntry['type'], message: string, severity: EventLogEntry['severity'] = 'info', asteroidId?: string) => {
    const event: EventLogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(gameState.currentTime),
      type,
      message,
      asteroidId,
      severity,
    };
    
    setEventLog(prev => [event, ...prev].slice(0, 100)); // Keep last 100 events
  }, [gameState.currentTime]);

  // Initialize asteroids client-side only to avoid hydration issues
  useEffect(() => {
    if (!isClientInitialized) {
      // Generate initial asteroids for immediate gameplay
      const initialAsteroids: Asteroid[] = [];
      const startTime = new Date('2025-01-01T00:00:00Z');
      for (let i = 0; i < 3; i++) {
        const asteroid = generateAsteroid(startTime);
        // Ensure at least one is detected for immediate visibility
        if (i === 0) {
          asteroid.isDetected = true;
        }
        initialAsteroids.push(asteroid);
      }
      setAsteroids(initialAsteroids);
      setIsClientInitialized(true);
    }
  }, [isClientInitialized]);
  
  // Generate new asteroids periodically
  useEffect(() => {
    if (!gameState.isPlaying || !isClientInitialized) return;
    
    const interval = setInterval(() => {
      // Generate asteroid roughly every 3-8 seconds of game time
      // Increased probability from 0.1 to 0.4 for more frequent spawning
      if (Math.random() < 0.4) {
        const newAsteroid = generateAsteroid(gameState.currentTime);
        setAsteroids(prev => [...prev, newAsteroid]);
        
        if (newAsteroid.isDetected) {
          addEvent('detection', `New asteroid ${newAsteroid.name} detected! Diameter: ${newAsteroid.diameterM.toFixed(0)}m, Time to impact: ${(newAsteroid.timeToImpactHours / 24).toFixed(1)} days`, 
            newAsteroid.size === 'large' ? 'critical' : newAsteroid.size === 'medium' ? 'warning' : 'info', 
            newAsteroid.id);
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [gameState.isPlaying, gameState.currentTime, addEvent, isClientInitialized]);

  // Budget replenishment (simulate annual budget allocation)
  useEffect(() => {
    if (!gameState.isPlaying) return;
    
    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        budget: Math.min(prev.budget + 5, 100), // Add $5B annually, cap at $100B
      }));
      addEvent('system', 'Annual budget allocation received: +$5B', 'info');
    }, 30000); // Every 30 seconds = 1 year in game time
    
    return () => clearInterval(interval);
  }, [gameState.isPlaying, addEvent]);
  
  // Game time advancement
  useEffect(() => {
    if (!gameState.isPlaying) return;
    
    const interval = setInterval(() => {
      setGameState(prev => ({
        ...prev,
        currentTime: new Date(prev.currentTime.getTime() + (gameState.gameSpeed * 1000))
      }));
      
      // Update all asteroids
      setAsteroids(prev => prev.map(asteroid => {
        const updated = updateAsteroid(asteroid, gameState.gameSpeed / 3600, asteroid.isTracked);
        
        // Check for impacts
        if (updated.timeToImpactHours <= 0 && asteroid.timeToImpactHours > 0) {
          const actuallyHits = Math.random() < updated.impactProbability;
          
          if (actuallyHits) {
            addEvent('impact', `${asteroid.name} has impacted Earth! Impact zone: ${asteroid.impactZoneRadiusKm}km radius`, 'critical', asteroid.id);
            // Calculate casualties based on size and preparation
            const casualties = calculateCasualties(asteroid);
            setGameState(prev => ({ 
              ...prev, 
              livesAtRisk: prev.livesAtRisk + casualties,
              trustPoints: Math.max(0, prev.trustPoints + (asteroid.publicAlerted ? TRUST_IMPACTS.correctAlert : TRUST_IMPACTS.missedThreat))
            }));
            
            if (asteroid.publicAlerted) {
              addEvent('system', `Public alert was correct. Trust increased.`, 'success');
            } else {
              addEvent('system', `No warning was issued. Public trust severely damaged.`, 'critical');
            }
          } else {
            addEvent('miss', `${asteroid.name} safely passed by Earth`, 'success', asteroid.id);
            
            // Handle trust impacts for false alarms or correct non-action
            if (asteroid.publicAlerted) {
              addEvent('system', `False alarm issued. Public trust damaged.`, 'warning');
              setGameState(prev => ({ 
                ...prev, 
                trustPoints: Math.max(0, prev.trustPoints + TRUST_IMPACTS.falseAlarm),
                falseAlarms: prev.falseAlarms + 1
              }));
            }
            
            // Handle successful deflection missions
            if (asteroid.deflectionMissions.length > 0) {
              const successfulMissions = asteroid.deflectionMissions.filter(m => m.status === 'deployed');
              if (successfulMissions.length > 0) {
                addEvent('mission', `Deflection missions successful! ${asteroid.name} trajectory altered.`, 'success', asteroid.id);
                setGameState(prev => ({ 
                  ...prev, 
                  trustPoints: Math.min(100, prev.trustPoints + TRUST_IMPACTS.successfulDeflection),
                  livesSaved: prev.livesSaved + calculateCasualties(asteroid)
                }));
              }
            }
          }
        }
        
        return updated;
      }).filter(asteroid => asteroid.timeToImpactHours > -24)); // Remove old asteroids after 24 hours
      
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameState.isPlaying, gameState.gameSpeed, addEvent]);

  // Reset quick mission menu when selection changes
  useEffect(() => {
    setShowQuickMissionOptions(false);
  }, [selectedAsteroid]);
  
  // Player actions
  const trackAsteroid = useCallback((asteroidId: string) => {
    const asteroid = asteroids.find(a => a.id === asteroidId);
    if (!asteroid || asteroid.isTracked) return;
    
    const trackedCount = asteroids.filter(a => a.isTracked).length;
    if (trackedCount >= gameState.trackingCapacity) {
      addEvent('system', 'Maximum tracking capacity reached. Upgrade facilities or stop tracking other asteroids.', 'warning');
      return;
    }
    
    if (gameState.budget < ACTION_COSTS.trackAsteroid) {
      addEvent('system', 'Insufficient budget to track asteroid', 'warning');
      return;
    }
    
    setAsteroids(prev => prev.map(a => 
      a.id === asteroidId ? { ...a, isTracked: true } : a
    ));
    
    setGameState(prev => ({
      ...prev,
      budget: prev.budget - ACTION_COSTS.trackAsteroid
    }));
    
    addEvent('tracking', `Started precision tracking of ${asteroid.name}`, 'info', asteroidId);
  }, [asteroids, gameState.trackingCapacity, gameState.budget, addEvent]);
  
  const alertPublic = useCallback((asteroidId: string) => {
    const asteroid = asteroids.find(a => a.id === asteroidId);
    if (!asteroid || asteroid.publicAlerted) return;
    
    if (gameState.budget < ACTION_COSTS.alertPublic) {
      addEvent('system', 'Insufficient budget for public alert', 'warning');
      return;
    }
    
    setAsteroids(prev => prev.map(a => 
      a.id === asteroidId ? { ...a, publicAlerted: true } : a
    ));
    
    setGameState(prev => ({
      ...prev,
      budget: prev.budget - ACTION_COSTS.alertPublic
    }));
    
    addEvent('alert', `Public alert issued for ${asteroid.name}`, 'warning', asteroidId);
    
    // Trust impact will be calculated later based on whether this was correct
  }, [asteroids, gameState.budget, addEvent]);

  const evacuateArea = useCallback((asteroidId: string) => {
    const asteroid = asteroids.find(a => a.id === asteroidId);
    if (!asteroid || asteroid.evacuationOrdered) return;
    
    if (gameState.budget < ACTION_COSTS.evacuateArea) {
      addEvent('system', 'Insufficient budget for evacuation', 'warning');
      return;
    }
    
    setAsteroids(prev => prev.map(a => 
      a.id === asteroidId ? { ...a, evacuationOrdered: true } : a
    ));
    
    setGameState(prev => ({
      ...prev,
      budget: prev.budget - ACTION_COSTS.evacuateArea
    }));
    
    addEvent('system', `Evacuation ordered for ${asteroid.name} impact zone`, 'warning', asteroidId);
  }, [asteroids, gameState.budget, addEvent]);

  const launchDeflectionMission = useCallback((asteroidId: string, missionType: DeflectionMission['type']) => {
    const asteroid = asteroids.find(a => a.id === asteroidId);
    if (!asteroid) return;
    
    const costs = {
      kinetic: ACTION_COSTS.launchKineticMission,
      nuclear: ACTION_COSTS.launchNuclearMission,
      gravity_tractor: ACTION_COSTS.launchGravityTractor,
    };
    
    const cost = costs[missionType];
    if (gameState.budget < cost) {
      addEvent('system', `Insufficient budget for ${missionType} mission`, 'warning');
      return;
    }
    
    // Mission effectiveness decreases with less lead time
    const leadTimeDays = asteroid.timeToImpactHours / 24;
    let effectiveness = Math.min(0.9, leadTimeDays / 365); // Max 90% effectiveness with 1 year lead time
    
    // Mission type effectiveness
    if (missionType === 'nuclear') effectiveness *= 1.3;
    if (missionType === 'gravity_tractor') effectiveness *= 0.7;
    
    const mission: DeflectionMission = {
      id: `${missionType}-${Date.now()}`,
      type: missionType,
      name: `${missionType.replace('_', ' ')} Mission to ${asteroid.name}`,
      launchDate: new Date(gameState.currentTime),
      arrivalDate: new Date(gameState.currentTime.getTime() + Math.min(leadTimeDays * 0.8, 90) * 24 * 60 * 60 * 1000),
      cost,
      effectivenessPercent: effectiveness * 100,
      status: 'launched',
    };
    
    setAsteroids(prev => prev.map(a => 
      a.id === asteroidId 
        ? { ...a, deflectionMissions: [...a.deflectionMissions, mission] }
        : a
    ));
    
    setGameState(prev => ({
      ...prev,
      budget: prev.budget - cost
    }));
    
    addEvent('mission', `${mission.name} launched! Effectiveness: ${effectiveness.toFixed(1)}%`, 'info', asteroidId);
  }, [asteroids, gameState.budget, gameState.currentTime, addEvent]);
  
  const calculateCasualties = (asteroid: Asteroid): number => {
    const sizeMultiplier = {
      tiny: 0,
      small: Math.random() < 0.1 ? 100 : 0, // 10% chance of airburst casualties
      medium: Math.floor(Math.random() * 100000) + 10000, // 10K-100K+
      large: Math.floor(Math.random() * 10000000) + 1000000, // 1M-10M+
    };
    
    const baseCasualties = sizeMultiplier[asteroid.size];
    const evacuationReduction = asteroid.evacuationOrdered ? 0.1 : 1.0;
    const alertReduction = asteroid.publicAlerted ? 0.5 : 1.0;
    
    return Math.floor(baseCasualties * evacuationReduction * alertReduction);
  };
  
  // Computed values
  const detectedAsteroids = useMemo(() => 
    asteroids.filter(a => a.isDetected).sort((a, b) => a.timeToImpactHours - b.timeToImpactHours)
  , [asteroids]);
  
  const currentlyTracked = useMemo(() => 
    asteroids.filter(a => a.isTracked).length
  , [asteroids]);
  
  const immediateThreat = useMemo(() =>
    detectedAsteroids.find(a => a.timeToImpactHours < 72 && a.impactProbability > 0.1)
  , [detectedAsteroids]);

  // Game over conditions
  const isGameOver = useMemo(() => {
    return gameState.trustPoints <= 0 || gameState.budget <= 0;
  }, [gameState.trustPoints, gameState.budget]);

  // Calculate score
  const gameScore = useMemo(() => {
    const baseScore = gameState.livesSaved * 10;
    const trustBonus = gameState.trustPoints * 5;
    const budgetEfficiency = (50 - gameState.budget) * 2; // Lower remaining budget = more efficient
    const falseAlarmPenalty = gameState.falseAlarms * 100;
    
    return Math.max(0, baseScore + trustBonus + budgetEfficiency - falseAlarmPenalty);
  }, [gameState.livesSaved, gameState.trustPoints, gameState.budget, gameState.falseAlarms]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">🛡️ Asteroid Defense Command</h1>
            <div className="text-sm text-gray-300">
              {gameState.currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            <div className="text-sm">
              <span className={`${gameState.budget < 10 ? 'text-red-400' : 'text-green-400'}`}>
                Budget: ${gameState.budget.toFixed(1)}B
              </span>
            </div>
            <div className="text-sm">
              <span className={`${
                gameState.trustPoints < 25 ? 'text-red-400' : 
                gameState.trustPoints < 50 ? 'text-yellow-400' : 
                'text-blue-400'
              }`}>
                Trust: {gameState.trustPoints}%
              </span>
            </div>
            <div className="text-sm">
              <span className="text-yellow-400">Tracking: {currentlyTracked}/{gameState.trackingCapacity}</span>
            </div>
            <div className="text-sm">
              <span className="text-purple-400">Score: {gameScore.toLocaleString()}</span>
            </div>
            <div className="text-sm">
              <span className="text-green-400">Lives Saved: {gameState.livesSaved.toLocaleString()}</span>
            </div>
            <div className="text-sm flex items-center gap-2">
              <span className="text-gray-300">Speed:</span>
              <select
                value={gameState.gameSpeed}
                onChange={(e) => setGameState(prev => ({ ...prev, gameSpeed: Number(e.target.value) }))}
                className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm hover:border-gray-500"
                disabled={isGameOver}
                title="Game time advanced per real second"
              >
                <option value={1}>1x (real-time)</option>
                <option value={3600}>1h/s</option>
                <option value={21600}>6h/s</option>
                <option value={86400}>1d/s</option>
                <option value={604800}>7d/s</option>
                <option value={2592000}>30d/s</option>
              </select>
            </div>
            {selectedAsteroid && (
              <div className="text-sm">
                <span className="text-yellow-400">Selected: {asteroids.find(a => a.id === selectedAsteroid)?.name || 'Unknown'}</span>
              </div>
            )}
            <button 
              onClick={() => setGameState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              disabled={isGameOver}
            >
              {gameState.isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            {isGameOver && (
              <div className="text-red-400 font-semibold">GAME OVER</div>
            )}
          </div>
        </div>
        
        {immediateThreat && (
          <div className="mt-2 p-2 bg-red-800/50 border border-red-600 rounded">
            <div className="text-red-300 text-sm font-semibold">
              🚨 IMMEDIATE THREAT: {immediateThreat.name} - {(immediateThreat.timeToImpactHours / 24).toFixed(1)} days to impact!
            </div>
          </div>
        )}
      </header>

      <div className="flex min-h-screen">
        {/* Sidebar - Asteroid List */}
        <div className="w-80 bg-gray-800 border-r border-gray-700 flex flex-col max-h-screen">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="font-semibold mb-2">Detected Asteroids</h2>
            <div className="text-xs text-gray-400">
              {detectedAsteroids.length} detected • {asteroids.length - detectedAsteroids.length} undetected
            </div>
          </div>
          
          <div className="space-y-2 p-2 overflow-y-auto flex-1">
            {detectedAsteroids.map(asteroid => (
              <div
                key={asteroid.id}
                className={`p-3 rounded border cursor-pointer transition-colors ${
                  selectedAsteroid === asteroid.id 
                    ? 'bg-blue-800/50 border-blue-500' 
                    : 'bg-gray-700/50 border-gray-600 hover:bg-gray-700'
                }`}
                onClick={() => setSelectedAsteroid(asteroid.id)}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="font-semibold text-sm">{asteroid.name}</div>
                  <div className={`px-1 py-0.5 rounded text-xs ${
                    asteroid.size === 'large' ? 'bg-red-600' :
                    asteroid.size === 'medium' ? 'bg-orange-600' :
                    asteroid.size === 'small' ? 'bg-yellow-600' :
                    'bg-gray-600'
                  }`}>
                    {asteroid.size.toUpperCase()}
                  </div>
                </div>
                
                <div className="text-xs space-y-1">
                  <div>⏱️ {(asteroid.timeToImpactHours / 24).toFixed(1)} days</div>
                  <div>📏 {asteroid.diameterM.toFixed(0)}m diameter</div>
                  <div>🎯 {(asteroid.impactProbability * 100).toFixed(1)}% impact chance</div>
                  {asteroid.isTracked && <div className="text-green-400">📡 Tracking</div>}
                  {asteroid.publicAlerted && <div className="text-red-400">🚨 Alert Issued</div>}
                </div>
              </div>
            ))}
            
            {detectedAsteroids.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div className="text-4xl mb-2">🌌</div>
                <div>No asteroids detected</div>
                <div className="text-xs">Scanning continues...</div>
              </div>
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col max-h-screen">
          {/* Quick Action Bar */}
          {selectedAsteroid && (() => {
            const asteroid = asteroids.find(a => a.id === selectedAsteroid);
            if (!asteroid) return null;
            const timeToImpactDays = asteroid.timeToImpactHours / 24;
            const canTrack = !asteroid.isTracked && gameState.budget >= ACTION_COSTS.trackAsteroid;
            const canAlert = !asteroid.publicAlerted && gameState.budget >= ACTION_COSTS.alertPublic;
            const canLaunchMission = timeToImpactDays > 30 && asteroid.impactProbability > 0.1;
            const canEvacuate = !asteroid.evacuationOrdered && asteroid.size !== 'tiny' && asteroid.size !== 'small' && gameState.budget >= ACTION_COSTS.evacuateArea;

            return (
              <div className="bg-gray-800 border-b border-gray-700 p-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="text-sm text-gray-300 mr-2">Actions for {asteroid.name}:</div>
                  <button
                    onClick={() => trackAsteroid(selectedAsteroid)}
                    disabled={!canTrack}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${
                      canTrack ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Start precision tracking"
                  >
                    📡 Track
                  </button>
                  <button
                    onClick={() => alertPublic(selectedAsteroid)}
                    disabled={!canAlert}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${
                      canAlert ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Issue public alert"
                  >
                    🚨 Alert
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => canLaunchMission && setShowQuickMissionOptions(v => !v)}
                      disabled={!canLaunchMission}
                      className={`px-3 py-1.5 rounded text-sm font-medium ${
                        canLaunchMission ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      }`}
                      title="Plan deflection mission"
                    >
                      🚀 Mission
                    </button>
                    {showQuickMissionOptions && canLaunchMission && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { launchDeflectionMission(selectedAsteroid, 'kinetic'); setShowQuickMissionOptions(false); }}
                          className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          title={`Kinetic Impactor ($${ACTION_COSTS.launchKineticMission}B)`}
                        >
                          Kinetic
                        </button>
                        <button
                          onClick={() => { launchDeflectionMission(selectedAsteroid, 'nuclear'); setShowQuickMissionOptions(false); }}
                          className="px-2 py-1 bg-red-700 hover:bg-red-800 rounded text-xs"
                          title={`Nuclear Detonation ($${ACTION_COSTS.launchNuclearMission}B)`}
                        >
                          Nuclear
                        </button>
                        <button
                          onClick={() => { launchDeflectionMission(selectedAsteroid, 'gravity_tractor'); setShowQuickMissionOptions(false); }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
                          title={`Gravity Tractor ($${ACTION_COSTS.launchGravityTractor}B)`}
                        >
                          Gravity
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => evacuateArea(selectedAsteroid)}
                    disabled={!canEvacuate}
                    className={`px-3 py-1.5 rounded text-sm font-medium ${
                      canEvacuate ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Order evacuation"
                  >
                    🏃 Evacuate
                  </button>
                  <button
                    onClick={() => setSelectedAsteroid(null)}
                    className="ml-auto px-2 py-1 text-xs text-gray-300 hover:text-white hover:bg-gray-700 rounded"
                    title="Deselect asteroid"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })()}

          {/* 2D Map/Visualization Area */}
          <div className="flex-1 bg-black relative overflow-hidden min-h-0">
            <EarthVisualization 
              asteroids={detectedAsteroids}
              selectedAsteroid={selectedAsteroid}
              gameTime={gameState.currentTime}
              onSelectAsteroid={(id) => setSelectedAsteroid(id)}
            />
          </div>
          
          {/* Action Panel */}
          {selectedAsteroid && (() => {
            const asteroid = asteroids.find(a => a.id === selectedAsteroid);
            if (!asteroid) {
              console.log('Selected asteroid not found:', selectedAsteroid);
              return (
                <div className="bg-red-800 border-t border-red-600 p-4 text-white">
                  <div>Error: Selected asteroid not found</div>
                  <div className="text-sm">Selected ID: {selectedAsteroid}</div>
                  <div className="text-sm">Available asteroids: {asteroids.length}</div>
                  <button onClick={() => setSelectedAsteroid(null)} className="mt-2 px-3 py-1 bg-red-600 rounded">
                    Close
                  </button>
                </div>
              );
            }
            return (
              <div className="bg-gray-800 border-t border-gray-700 p-4 overflow-y-auto max-h-64">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-white">Action Panel - {asteroid.name}</h3>
                  <button
                    onClick={() => setSelectedAsteroid(null)}
                    className="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors"
                    title="Close action panel"
                  >
                    ✕
                  </button>
                </div>
                <AsteroidActionPanel
                  asteroid={asteroid}
                  gameState={gameState}
                  onTrack={() => trackAsteroid(selectedAsteroid)}
                  onAlert={() => alertPublic(selectedAsteroid)}
                  onLaunchMission={(missionType) => launchDeflectionMission(selectedAsteroid, missionType)}
                  onEvacuate={() => evacuateArea(selectedAsteroid)}
                />
              </div>
            );
          })()}
        </div>

        {/* Event Log */}
        <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col max-h-screen">
          <div className="p-4 border-b border-gray-700 flex-shrink-0">
            <h2 className="font-semibold">Event Log</h2>
          </div>
          
          <div className="space-y-1 p-2 overflow-y-auto flex-1">
            {eventLog.map(event => (
              <div
                key={event.id}
                className={`p-2 rounded text-sm border-l-2 ${
                  event.severity === 'critical' ? 'bg-red-900/30 border-red-500' :
                  event.severity === 'warning' ? 'bg-yellow-900/30 border-yellow-500' :
                  event.severity === 'success' ? 'bg-green-900/30 border-green-500' :
                  'bg-gray-700/30 border-gray-500'
                }`}
              >
                <div className="text-xs text-gray-400 mb-1">
                  {event.timestamp.toISOString().slice(11, 19)} UTC
                </div>
                <div>{event.message}</div>
              </div>
            ))}
            
            {eventLog.length === 0 && (
              <div className="text-center py-8 text-gray-400">
                <div>No events yet</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Game Over Modal */}
      {isGameOver && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-red-400 mb-4 text-center">
              🛡️ Mission Terminated
            </h2>
            
            <div className="space-y-4 mb-6">
              {gameState.trustPoints <= 0 && (
                <div className="text-red-300">
                  <div className="font-semibold">Public Trust Lost</div>
                  <div className="text-sm text-gray-400">
                    Too many false alarms or missed threats have destroyed public confidence in your agency.
                  </div>
                </div>
              )}
              
              {gameState.budget <= 0 && (
                <div className="text-red-300">
                  <div className="font-semibold">Budget Depleted</div>
                  <div className="text-sm text-gray-400">
                    Insufficient funds to continue planetary defense operations.
                  </div>
                </div>
              )}
              
              <div className="bg-gray-700/50 rounded p-4">
                <h3 className="font-semibold mb-2">Final Statistics</h3>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Lives Saved:</span>
                    <span className="text-green-400">{gameState.livesSaved.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lives Lost:</span>
                    <span className="text-red-400">{gameState.livesAtRisk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>False Alarms:</span>
                    <span className="text-yellow-400">{gameState.falseAlarms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Final Trust:</span>
                    <span className="text-blue-400">{gameState.trustPoints}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Budget Remaining:</span>
                    <span className="text-green-400">${gameState.budget.toFixed(1)}B</span>
                  </div>
                  <div className="border-t border-gray-600 pt-2 mt-2">
                    <div className="flex justify-between font-semibold">
                      <span>Final Score:</span>
                      <span className="text-purple-400">{gameScore.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => {
                // Reset game state
                setGameState({
                  currentTime: new Date('2025-01-01T00:00:00Z'),
                  gameSpeed: 3600,
                  isPlaying: true,
                  budget: 50,
                  trustPoints: 75,
                  trackingCapacity: 5,
                  livesAtRisk: 0,
                  livesSaved: 0,
                  falseAlarms: 0,
                });
                // Reset client state and let useEffect regenerate asteroids
                setAsteroids([]);
                setSelectedAsteroid(null);
                setEventLog([]);
                setIsClientInitialized(false); // This will trigger asteroid regeneration
                addEvent('system', 'Planetary Defense Command reactivated', 'info');
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white font-semibold"
            >
              🔄 Restart Mission
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUPPORTING COMPONENTS
// ============================================================================

// Deterministic star positions to prevent hydration errors
const STARS = Array.from({ length: 100 }, (_, i) => {
  // Use deterministic values based on index for consistent server/client rendering
  const seed = i * 9.7; // Use a multiplier to spread values
  return {
    left: ((seed * 7.3) % 100),
    top: ((seed * 11.7) % 100),
    animationDelay: ((seed * 0.031) % 3),
    animationDuration: (2 + ((seed * 0.041) % 4)),
  };
});

function EarthVisualization({ asteroids, selectedAsteroid, gameTime, onSelectAsteroid }: {
  asteroids: Asteroid[];
  selectedAsteroid: string | null;
  gameTime: Date;
  onSelectAsteroid: (id: string) => void;
}) {
  const [showOrbits, setShowOrbits] = useState(true);
  const [showImpactZones, setShowImpactZones] = useState(true);
  
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-b from-indigo-900 via-blue-900 to-black">
      {/* Stars background */}
      <div className="absolute inset-0 opacity-30">
        {STARS.map((star, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full animate-pulse"
            style={{
              left: `${star.left}%`,
              top: `${star.top}%`,
              animationDelay: `${star.animationDelay}s`,
              animationDuration: `${star.animationDuration}s`,
            }}
          />
        ))}
      </div>
      
      {/* Earth system */}
      <div className="relative">
        {/* Earth's gravitational influence sphere */}
        <div className="absolute inset-0 rounded-full border border-blue-300/20" style={{
          width: '400px',
          height: '400px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }} />
        
        {/* Earth */}
        <div className="relative">
          <div className="w-64 h-64 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-green-500 border-4 border-blue-300 shadow-2xl relative overflow-hidden">
            {/* Earth atmosphere glow */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-300/30 via-transparent to-blue-300/30" />
            
            {/* Earth surface details */}
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-green-400 to-blue-600 opacity-80">
              {/* Continents (simplified) */}
              <div className="absolute top-6 left-10 w-20 h-16 bg-green-700 rounded-lg opacity-90 transform rotate-12" />
              <div className="absolute top-16 right-6 w-16 h-12 bg-green-700 rounded-full opacity-90" />
              <div className="absolute bottom-8 left-12 w-24 h-8 bg-green-700 rounded-lg opacity-90 transform -rotate-6" />
              <div className="absolute top-32 left-20 w-12 h-20 bg-green-700 rounded-lg opacity-90 transform rotate-45" />
              
              {/* Clouds */}
              <div className="absolute top-12 left-16 w-12 h-6 bg-white/40 rounded-full" />
              <div className="absolute top-28 right-12 w-16 h-4 bg-white/40 rounded-full" />
              <div className="absolute bottom-16 left-6 w-10 h-4 bg-white/40 rounded-full" />
            </div>
            
            {/* Day/night terminator */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/20 to-black/40 rounded-full opacity-60" />
          </div>
        </div>
        
        {/* Asteroid trajectories and positions */}
        {asteroids.map(asteroid => {
          const isSelected = asteroid.id === selectedAsteroid;
          const angle = (asteroid.id.charCodeAt(0) * 17) % 360; // Pseudo-random angle based on ID
          const baseDistance = 180;
          const distanceMultiplier = Math.max(0.2, asteroid.timeToImpactHours / (24 * 7)); // Closer as impact approaches
          const distance = baseDistance + (distanceMultiplier * 120);
          
          const x = Math.cos(angle * Math.PI / 180) * distance;
          const y = Math.sin(angle * Math.PI / 180) * distance;
          
          // Size based on asteroid size category
          const dotSize = {
            tiny: 4,
            small: 6,
            medium: 8,
            large: 12
          }[asteroid.size];
          
          return (
            <div key={asteroid.id} className="absolute cursor-pointer" style={{ 
              left: '50%', 
              top: '50%', 
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` 
            }} onClick={() => onSelectAsteroid(asteroid.id)} title={`Select ${asteroid.name}`}>
              {/* Orbital path */}
              {showOrbits && (
                <svg className="absolute pointer-events-none" style={{
                  left: -x - 200, 
                  top: -y - 200,
                  width: '400px',
                  height: '400px'
                }}>
                  <ellipse
                    cx={200 + x}
                    cy={200 + y}
                    rx={distance * 0.8}
                    ry={distance * 0.4}
                    fill="none"
                    stroke={isSelected ? '#fbbf24' : '#6b7280'}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    opacity={0.3}
                    transform={`rotate(${angle} ${200 + x} ${200 + y})`}
                  />
                </svg>
              )}
              
              {/* Asteroid */}
              <div 
                className={`rounded-full border-2 ${
                  isSelected ? 'bg-yellow-400 border-yellow-300 ring-4 ring-yellow-300/50' :
                  asteroid.size === 'large' ? 'bg-red-500 border-red-300' :
                  asteroid.size === 'medium' ? 'bg-orange-500 border-orange-300' :
                  asteroid.size === 'small' ? 'bg-yellow-500 border-yellow-300' :
                  'bg-gray-400 border-gray-300'
                } shadow-lg`}
                style={{
                  width: `${dotSize}px`,
                  height: `${dotSize}px`,
                }}
              />
              
              {/* Velocity vector */}
              <svg className="absolute pointer-events-none" style={{
                left: -10, 
                top: -10,
                width: '20px',
                height: '20px'
              }}>
                <line
                  x1={10}
                  y1={10}
                  x2={10 + Math.cos((angle + 90) * Math.PI / 180) * 8}
                  y2={10 + Math.sin((angle + 90) * Math.PI / 180) * 8}
                  stroke={isSelected ? '#fbbf24' : '#6b7280'}
                  strokeWidth={2}
                  opacity={0.7}
                />
                <polygon
                  points={`${10 + Math.cos((angle + 90) * Math.PI / 180) * 8},${10 + Math.sin((angle + 90) * Math.PI / 180) * 8} ${10 + Math.cos((angle + 75) * Math.PI / 180) * 6},${10 + Math.sin((angle + 75) * Math.PI / 180) * 6} ${10 + Math.cos((angle + 105) * Math.PI / 180) * 6},${10 + Math.sin((angle + 105) * Math.PI / 180) * 6}`}
                  fill={isSelected ? '#fbbf24' : '#6b7280'}
                  opacity={0.7}
                />
              </svg>
              
              {/* Asteroid label */}
              <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap px-2 py-1 rounded bg-black/70 border ${
                isSelected ? 'text-yellow-300 font-semibold border-yellow-500/50' : 'text-gray-300 border-gray-500/50'
              }`}>
                <div>{asteroid.name}</div>
                <div className="text-xs opacity-75">
                  {(asteroid.timeToImpactHours / 24).toFixed(1)}d • {(asteroid.impactProbability * 100).toFixed(0)}%
                </div>
              </div>
              
              {/* Impact zone preview on Earth's surface */}
              {showImpactZones && asteroid.impactProbability > 0.1 && asteroid.impactZoneRadiusKm && asteroid.impactZoneRadiusKm > 0 && (
                <div
                  className="absolute rounded-full border-2 border-red-500 bg-red-500/10 animate-pulse"
                  style={{
                    width: `${Math.min(asteroid.impactZoneRadiusKm / 5, 80)}px`,
                    height: `${Math.min(asteroid.impactZoneRadiusKm / 5, 80)}px`,
                    left: '50%',
                    top: '50%',
                    transform: `translate(calc(-50% + ${-x}px), calc(-50% + ${-y}px))`,
                  }}
                />
              )}
              
              {/* Mission indicators */}
              {asteroid.deflectionMissions.length > 0 && (
                <div className="absolute -top-2 -right-2">
                  {asteroid.deflectionMissions.map(mission => (
                    <div key={mission.id} className={`w-2 h-2 rounded-full ml-1 ${
                      mission.status === 'deployed' ? 'bg-green-400' :
                      mission.status === 'en_route' ? 'bg-blue-400' :
                      mission.status === 'launched' ? 'bg-yellow-400' :
                      'bg-gray-400'
                    } animate-pulse`} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 space-y-2">
        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`px-3 py-1 rounded text-xs ${showOrbits ? 'bg-blue-600' : 'bg-gray-600'} hover:bg-opacity-80`}
        >
          Orbits {showOrbits ? '✓' : '✗'}
        </button>
        <button
          onClick={() => setShowImpactZones(!showImpactZones)}
          className={`px-3 py-1 rounded text-xs ${showImpactZones ? 'bg-red-600' : 'bg-gray-600'} hover:bg-opacity-80`}
        >
          Impact Zones {showImpactZones ? '✓' : '✗'}
        </button>
      </div>
      
      {/* Enhanced Legend */}
      <div className="absolute bottom-4 left-4 bg-black/80 rounded p-4 text-xs border border-gray-600">
        <div className="font-semibold mb-3">Command Center Legend</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Large (140m+) - Global threat</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span>Medium (20-140m) - Regional danger</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <span>Small (5-20m) - Airburst risk</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-400" />
            <span>Tiny (&lt;5m) - Burns up</span>
          </div>
          
          <div className="border-t border-gray-600 pt-2 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span>Mission active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <span>Mission en route</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Time display */}
      <div className="absolute top-4 left-4 bg-black/80 rounded p-3 text-sm border border-gray-600">
        <div className="font-semibold text-green-400">Mission Time</div>
        <div className="font-mono">{gameTime.toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
        <div className="text-xs text-gray-400 mt-1">
          {asteroids.length} objects tracked
        </div>
      </div>
    </div>
  );
}

function AsteroidActionPanel({ asteroid, gameState, onTrack, onAlert, onLaunchMission, onEvacuate }: {
  asteroid: Asteroid;
  gameState: GameState;
  onTrack: () => void;
  onAlert: () => void;
  onLaunchMission: (missionType: DeflectionMission['type']) => void;
  onEvacuate: () => void;
}) {
  const timeToImpactDays = asteroid.timeToImpactHours / 24;
  const canTrack = !asteroid.isTracked && gameState.budget >= ACTION_COSTS.trackAsteroid;
  const canAlert = !asteroid.publicAlerted && gameState.budget >= ACTION_COSTS.alertPublic;
  const canLaunchMission = timeToImpactDays > 30 && asteroid.impactProbability > 0.1;
  const canEvacuate = !asteroid.evacuationOrdered && asteroid.size !== 'tiny' && asteroid.size !== 'small' && gameState.budget >= ACTION_COSTS.evacuateArea;
  
  const [showMissionOptions, setShowMissionOptions] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  
  // Calculate Torino Scale level
  const getTorinoScale = (asteroid: Asteroid): number => {
    const energy = 0.5 * asteroid.massKg * Math.pow(asteroid.velocityKmps * 1000, 2) / (4.184e15); // Convert to MT TNT
    const impactProb = asteroid.impactProbability;
    
    if (impactProb < 0.00001) return 0;
    if (energy < 0.01) return Math.min(1, Math.floor(impactProb * 10));
    if (energy < 1) return Math.min(4, 2 + Math.floor(impactProb * 3));
    if (energy < 1000) return Math.min(7, 5 + Math.floor(impactProb * 3));
    return Math.min(10, 8 + Math.floor(impactProb * 3));
  };
  
  const torinoScale = getTorinoScale(asteroid);
  const torinoColors = ['bg-gray-600', 'bg-green-600', 'bg-green-600', 'bg-yellow-600', 'bg-yellow-600', 'bg-orange-600', 'bg-orange-600', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900'];
  
  return (
    <div className="h-full relative">
      <h3 className="font-semibold mb-3">{asteroid.name} - Action Options</h3>
      
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="space-y-2">
          <div className="text-sm">
            <div className="text-gray-400">Size Category</div>
            <div className={`font-semibold ${
              asteroid.size === 'large' ? 'text-red-400' :
              asteroid.size === 'medium' ? 'text-orange-400' :
              asteroid.size === 'small' ? 'text-yellow-400' :
              'text-gray-400'
            }`}>
              {asteroid.size.toUpperCase()} ({asteroid.diameterM.toFixed(0)}m)
            </div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-400">Time to Impact</div>
            <div className="font-semibold">{timeToImpactDays.toFixed(1)} days</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm">
            <div className="text-gray-400">Impact Probability</div>
            <div className="font-semibold">{(asteroid.impactProbability * 100).toFixed(1)}%</div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-400">Position Uncertainty</div>
            <div className="font-semibold">±{asteroid.uncertaintyKm.toFixed(0)}km</div>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="text-sm">
            <div className="text-gray-400">Torino Scale</div>
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold text-white ${torinoColors[torinoScale]}`}>
              {torinoScale}
            </div>
          </div>
          
          <div className="text-sm">
            <div className="text-gray-400">Active Missions</div>
            <div className="font-semibold">{asteroid.deflectionMissions.length}</div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-4 gap-2 mb-3">
        <button
          onClick={onTrack}
          disabled={!canTrack}
          className={`px-3 py-2 rounded text-sm font-medium relative ${
            canTrack 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          onMouseEnter={() => setShowTooltip('track')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          📡 Track
        </button>
        
        <button
          onClick={onAlert}
          disabled={!canAlert}
          className={`px-3 py-2 rounded text-sm font-medium ${
            canAlert 
              ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          onMouseEnter={() => setShowTooltip('alert')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          🚨 Alert
        </button>
        
        <button
          onClick={() => setShowMissionOptions(!showMissionOptions)}
          disabled={!canLaunchMission}
          className={`px-3 py-2 rounded text-sm font-medium ${
            canLaunchMission 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          onMouseEnter={() => setShowTooltip('mission')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          🚀 Mission
        </button>
        
        <button
          onClick={onEvacuate}
          disabled={!canEvacuate}
          className={`px-3 py-2 rounded text-sm font-medium ${
            canEvacuate
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
          onMouseEnter={() => setShowTooltip('evacuate')}
          onMouseLeave={() => setShowTooltip(null)}
        >
          🏃 Evacuate
        </button>
      </div>
      
      {/* Mission Options */}
      {showMissionOptions && canLaunchMission && (
        <div className="mb-3 p-3 bg-gray-700 rounded border">
          <h4 className="font-semibold mb-2 text-sm">Mission Options</h4>
          <div className="grid grid-cols-3 gap-1">
            <button
              onClick={() => {
                onLaunchMission('kinetic');
                setShowMissionOptions(false);
              }}
              className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
              title={`Kinetic Impactor - Direct collision ($${ACTION_COSTS.launchKineticMission}B)`}
            >
              Kinetic
            </button>
            <button
              onClick={() => {
                onLaunchMission('nuclear');
                setShowMissionOptions(false);
              }}
              className="px-2 py-1 bg-red-700 hover:bg-red-800 rounded text-xs"
              title={`Nuclear Detonation - Standoff explosion ($${ACTION_COSTS.launchNuclearMission}B)`}
            >
              Nuclear
            </button>
            <button
              onClick={() => {
                onLaunchMission('gravity_tractor');
                setShowMissionOptions(false);
              }}
              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs"
              title={`Gravity Tractor - Slow gravitational tug ($${ACTION_COSTS.launchGravityTractor}B)`}
            >
              Gravity
            </button>
          </div>
        </div>
      )}
      
      {/* Educational Tooltips */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-black border border-gray-600 rounded max-w-sm text-sm z-50">
          {showTooltip === 'track' && (
            <div>
              <div className="font-semibold mb-1">Precision Tracking</div>
              <div>Deploy additional telescopes and radar systems to improve orbital determination. Reduces position uncertainty over time through repeated observations.</div>
              <div className="text-gray-400 mt-1">Cost: ${ACTION_COSTS.trackAsteroid}B</div>
            </div>
          )}
          {showTooltip === 'alert' && (
            <div>
              <div className="font-semibold mb-1">Public Warning System</div>
              <div>Activate emergency broadcasting and mobile alert systems. Reduces casualties but affects public trust if false alarm.</div>
              <div className="text-gray-400 mt-1">Cost: ${ACTION_COSTS.alertPublic}B</div>
            </div>
          )}
          {showTooltip === 'mission' && (
            <div>
              <div className="font-semibold mb-1">Deflection Missions</div>
              <div><strong>Kinetic:</strong> Direct collision to change asteroid's momentum<br/>
              <strong>Nuclear:</strong> Standoff detonation using X-ray vaporization<br/>
              <strong>Gravity Tractor:</strong> Long-term gravitational nudging</div>
              <div className="text-gray-400 mt-1">Requires 30+ days lead time for effectiveness</div>
            </div>
          )}
          {showTooltip === 'evacuate' && (
            <div>
              <div className="font-semibold mb-1">Emergency Evacuation</div>
              <div>Coordinate mass evacuation of predicted impact zone. Most effective for reducing casualties from medium+ asteroids.</div>
              <div className="text-gray-400 mt-1">Cost: ${ACTION_COSTS.evacuateArea}B</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
