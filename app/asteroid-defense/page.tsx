'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Asteroid, GameState, EventLogEntry, DeflectionMission } from './types';
import { ACTION_COSTS, TRUST_IMPACTS, SCORE_REWARDS } from './constants';
import { generateAsteroid, updateAsteroid, calculateCasualties } from './gameUtils';
import EarthVisualization from './components/EarthVisualization';
import AsteroidActionPanel from './components/AsteroidActionPanel';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Helper function to format time to impact
function formatTimeToImpact(timeToImpactHours: number): string {
  const days = timeToImpactHours / 24;
  if (days <= 0) {
    const hoursAgo = Math.abs(timeToImpactHours);
    if (hoursAgo < 1) {
      return "Just passed";
    } else {
      return `Passed ${hoursAgo.toFixed(0)}h ago`;
    }
  }
  return `${days.toFixed(1)} days`;
}

export default function AsteroidDefensePage() {
  // Game state
  const [gameState, setGameState] = useState<GameState>({
    currentTime: new Date('2025-01-01T00:00:00Z'),
    gameSpeed: 3600, // 1 hour per second (better pacing)
    isPlaying: true,
    budget: 50, // $50B starting budget
    trustPoints: 75, // Start with decent public trust
    trackingCapacity: 5, // Can track 5 asteroids simultaneously
    livesAtRisk: 0,
    livesSaved: 0,
    falseAlarms: 0,
    correctAlerts: 0,
    asteroidsTracked: 0,
    successfulDeflections: 0,
    totalScore: 0,
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
      const generateInitialAsteroids = async () => {
        const initialAsteroids: Asteroid[] = [];
        const startTime = new Date('2025-01-01T00:00:00Z');
        
        for (let i = 0; i < 3; i++) {
          try {
            const asteroid = await generateAsteroid(startTime);
            // Ensure at least one is detected for immediate visibility
            if (i === 0) {
              asteroid.isDetected = true;
            }
            initialAsteroids.push(asteroid);
          } catch (error) {
            console.warn('Failed to generate asteroid:', error);
          }
        }
        
        setAsteroids(initialAsteroids);
        setIsClientInitialized(true);
      };
      
      generateInitialAsteroids();
    }
  }, [isClientInitialized]);
  
  // Generate new asteroids periodically
  useEffect(() => {
    if (!gameState.isPlaying || !isClientInitialized) return;
    
    const interval = setInterval(() => {
      // Generate asteroid roughly every 5-10 seconds of real time
      // Higher probability since asteroids now last much longer
      // Boost generation if we have very few asteroids
      
      setAsteroids(prev => {
        const currentAsteroidCount = prev.length;
        let spawnChance = 0.6;
        if (currentAsteroidCount < 2) spawnChance = 0.9; // High chance if very few
        else if (currentAsteroidCount < 5) spawnChance = 0.7; // Higher chance if few
        
        if (Math.random() < spawnChance) {
          // Create asteroid with approximate current time (will be close enough)
          const approximateCurrentTime = new Date(Date.now() + (gameState.gameSpeed * 1000));
          
          generateAsteroid(approximateCurrentTime).then(newAsteroid => {
            if (newAsteroid.isDetected) {
              addEvent('detection', `New asteroid ${newAsteroid.name} detected! Diameter: ${newAsteroid.diameterM.toFixed(0)}m, Time to impact: ${formatTimeToImpact(newAsteroid.timeToImpactHours)}`, 
                newAsteroid.size === 'large' ? 'critical' : newAsteroid.size === 'medium' ? 'warning' : 'info', 
                newAsteroid.id);
            }
            
            setAsteroids(currentAsteroids => [...currentAsteroids, newAsteroid]);
          }).catch(error => {
            console.warn('Failed to generate new asteroid:', error);
          });
          
          return prev; // Don't modify state here since we're doing it async
        }
        
        return prev; // No change if no spawn
      });
    }, 5000); // Check every 5 seconds instead of 2
    
    return () => clearInterval(interval);
  }, [gameState.isPlaying, gameState.gameSpeed, addEvent, isClientInitialized]);

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
      setAsteroids(prev => {
        const updatedAsteroids = prev.map(asteroid => {
        const updated = updateAsteroid(asteroid, gameState.gameSpeed / 3600, asteroid.isTracked);
        
        // Award continuous tracking bonus (once per day)
        if (updated.isTracked && updated.timeToImpactHours > 0) {
          const daysPassed = Math.floor((asteroid.initialTimeToImpact - updated.timeToImpactHours) / 24);
          const previousDaysPassed = Math.floor((asteroid.initialTimeToImpact - asteroid.timeToImpactHours) / 24);
          
          if (daysPassed > previousDaysPassed) {
            setGameState(prev => ({ 
              ...prev, 
              totalScore: prev.totalScore + SCORE_REWARDS.asteroidTracked
            }));
          }
        }
        
        // Check for impacts (only process once per asteroid)
        if (updated.timeToImpactHours <= 0 && asteroid.timeToImpactHours > 0 && !asteroid.outcomeProcessed) {
          const actuallyHits = Math.random() < updated.impactProbability;
          
          // Mark outcome as processed to prevent duplicate events
          updated.outcomeProcessed = true;
          
          // Clear selection if this asteroid was selected (since its fate is now determined)
          if (selectedAsteroid === asteroid.id) {
            setSelectedAsteroid(null);
          }
          
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
              setGameState(prev => ({ 
                ...prev, 
                correctAlerts: prev.correctAlerts + 1,
                totalScore: prev.totalScore + SCORE_REWARDS.correctAlert
              }));
              addEvent('system', `Public alert was correct. Trust increased. (+${SCORE_REWARDS.correctAlert} points)`, 'success');
            } else {
              addEvent('system', `No warning was issued. Public trust severely damaged.`, 'critical');
            }
          } else {
            addEvent('miss', `${asteroid.name} safely passed by Earth`, 'success', asteroid.id);
            
            // Handle trust impacts for false alarms or correct non-action
            if (asteroid.publicAlerted) {
              addEvent('system', `False alarm issued. Public trust damaged. (${SCORE_REWARDS.falseAlarm} points)`, 'warning');
              setGameState(prev => ({ 
                ...prev, 
                trustPoints: Math.max(0, prev.trustPoints + TRUST_IMPACTS.falseAlarm),
                falseAlarms: prev.falseAlarms + 1,
                totalScore: prev.totalScore + SCORE_REWARDS.falseAlarm
              }));
            } else {
              // Reward for not issuing false alarm on a miss
              setGameState(prev => ({ 
                ...prev, 
                totalScore: prev.totalScore + SCORE_REWARDS.goodDecision
              }));
              addEvent('system', `Good decision: No false alarm issued. (+${SCORE_REWARDS.goodDecision} points)`, 'success');
            }
            
            // Handle successful deflection missions
            if (asteroid.deflectionMissions.length > 0) {
              const successfulMissions = asteroid.deflectionMissions.filter(m => m.status === 'deployed');
              if (successfulMissions.length > 0) {
                const preventedCasualties = calculateCasualties(asteroid);
                const deflectionBonus = SCORE_REWARDS.successfulDeflection + (asteroid.impactProbability > 0.3 ? SCORE_REWARDS.preventedImpact : 0);
                addEvent('mission', `Deflection missions successful! ${asteroid.name} trajectory altered. (+${deflectionBonus} points)`, 'success', asteroid.id);
                setGameState(prev => ({ 
                  ...prev, 
                  trustPoints: Math.min(100, prev.trustPoints + TRUST_IMPACTS.successfulDeflection),
                  livesSaved: prev.livesSaved + preventedCasualties,
                  successfulDeflections: prev.successfulDeflections + 1,
                  totalScore: prev.totalScore + deflectionBonus
                }));
              }
            }
          }
        }
        
          return updated;
        });
        
        // Filter out old asteroids and clear selection if selected asteroid was removed
        // Remove asteroids shortly after their outcome is processed (1 hour buffer for cleanup)
        const filteredAsteroids = updatedAsteroids.filter(asteroid => asteroid.timeToImpactHours > -1);
        const removedAsteroidIds = updatedAsteroids.filter(asteroid => asteroid.timeToImpactHours <= -1).map(a => a.id);
        
        if (selectedAsteroid && removedAsteroidIds.includes(selectedAsteroid)) {
          setSelectedAsteroid(null);
        }
        
        return filteredAsteroids;
      });
      
    }, 1000);
    
    return () => clearInterval(interval);
  }, [gameState.isPlaying, gameState.gameSpeed, addEvent, selectedAsteroid]);

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
      budget: prev.budget - ACTION_COSTS.trackAsteroid,
      asteroidsTracked: prev.asteroidsTracked + 1,
      totalScore: prev.totalScore + SCORE_REWARDS.trackAsteroid
    }));
    
    addEvent('tracking', `Started precision tracking of ${asteroid.name} (+${SCORE_REWARDS.trackAsteroid} points)`, 'info', asteroidId);
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
  
  // Computed values
  const detectedAsteroids = useMemo(() => 
    asteroids.filter(a => a.isDetected).sort((a, b) => a.timeToImpactHours - b.timeToImpactHours)
  , [asteroids]);
  
  const currentlyTracked = useMemo(() => 
    asteroids.filter(a => a.isTracked).length
  , [asteroids]);
  
  const immediateThreat = useMemo(() =>
    detectedAsteroids.find(a => a.timeToImpactHours > 0 && a.timeToImpactHours < 72 && a.impactProbability > 0.1)
  , [detectedAsteroids]);

  // Game over conditions
  const isGameOver = useMemo(() => {
    return gameState.trustPoints <= 0 || gameState.budget <= 0;
  }, [gameState.trustPoints, gameState.budget]);

  // Calculate final score (use accumulated totalScore plus bonuses)
  const gameScore = useMemo(() => {
    const trustBonus = gameState.trustPoints * 5;
    const budgetEfficiencyBonus = (50 - gameState.budget) * 2; // Efficiency bonus
    
    return Math.max(0, gameState.totalScore + trustBonus + budgetEfficiencyBonus);
  }, [gameState.totalScore, gameState.trustPoints, gameState.budget]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-700">
        <div className="px-6 py-4">
          {/* Top row - Title and status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg flex items-center justify-center border border-slate-600">
                <div className="w-6 h-6 bg-blue-500 rounded-sm"></div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Planetary Defense Command</h1>
                <div className="text-sm text-slate-400">NASA Near Earth Object Studies • JPL/Caltech</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 bg-slate-800 px-3 py-2 rounded-lg border border-slate-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-300">LIVE</span>
                <span className="text-sm text-slate-400 font-mono">
                  {gameState.currentTime.toISOString().replace('T', ' ').slice(0, 19)} UTC
                </span>
              </div>
              
              <div className="flex items-center space-x-2">
                <button 
                  onClick={() => setGameState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    gameState.isPlaying 
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-300' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                  disabled={isGameOver}
                >
                  {gameState.isPlaying ? 'Pause' : 'Resume'}
                </button>
                
                <select
                  value={gameState.gameSpeed}
                  onChange={(e) => setGameState(prev => ({ ...prev, gameSpeed: Number(e.target.value) }))}
                  className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-300 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isGameOver}
                  title="Simulation speed"
                >
                  <option value={1}>1x Real-time</option>
                  <option value={3600}>1h/s</option>
                  <option value={21600}>6h/s</option>
                  <option value={86400}>1d/s</option>
                  <option value={604800}>7d/s</option>
                  <option value={2592000}>30d/s</option>
                </select>
              </div>
            </div>
          </div>
          
          {/* Bottom row - Key metrics */}
          <div className="grid grid-cols-6 gap-4">
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Budget</div>
                <div className={`text-lg font-bold ${gameState.budget < 10 ? 'text-red-400' : 'text-green-400'}`}>
                  ${gameState.budget.toFixed(1)}B
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Trust</div>
                <div className={`text-lg font-bold ${
                  gameState.trustPoints < 25 ? 'text-red-400' : 
                  gameState.trustPoints < 50 ? 'text-yellow-400' : 
                  'text-blue-400'
                }`}>
                  {gameState.trustPoints}%
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Tracking</div>
                <div className="text-lg font-bold text-slate-300">
                  {currentlyTracked}/{gameState.trackingCapacity}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Lives Saved</div>
                <div className="text-lg font-bold text-green-400">
                  {gameState.livesSaved.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Score</div>
                <div className="text-lg font-bold text-blue-400">
                  {gameScore.toLocaleString()}
                </div>
              </div>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400 uppercase tracking-wide">Status</div>
                <div className="text-lg font-bold">
                  {isGameOver ? (
                    <span className="text-red-400">GAME OVER</span>
                  ) : selectedAsteroid ? (
                    <span className="text-yellow-400">Active</span>
                  ) : (
                    <span className="text-slate-400">Monitoring</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {immediateThreat && (
          <div className="mx-6 mb-4 p-4 bg-red-900/20 border border-red-500/50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
              </div>
              <div>
                <div className="text-red-300 text-lg font-bold">
                  IMMEDIATE THREAT DETECTED
                </div>
                <div className="text-red-200 text-sm">
                  {immediateThreat.name} • {formatTimeToImpact(immediateThreat.timeToImpactHours)} to impact
                </div>
                <div className="text-red-300/80 text-xs mt-1">
                  Initiate planetary defense protocols • Alert international partners
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Mission Briefing */}
        {gameState.currentTime.getTime() - new Date('2025-01-01T00:00:00Z').getTime() < 300000 && (
          <div className="mx-6 mb-4 p-4 bg-blue-900/20 border border-blue-500/50 rounded-lg">
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <div className="w-4 h-4 bg-white rounded-sm"></div>
              </div>
              <div className="text-blue-300 text-lg font-bold">
                Mission Briefing
              </div>
            </div>
            <div className="text-slate-300 text-sm leading-relaxed">
              You are leading NASA&apos;s Planetary Defense Coordination Office. Your mission: detect, track, and deflect potentially hazardous asteroids using real scientific methods and technologies.
              <div className="text-blue-200 mt-2 font-medium">
                Early detection is key to successful deflection!
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="flex h-[calc(100vh-200px)] min-h-0">
        {/* Sidebar - Asteroid List */}
        <div className="w-80 bg-slate-900 border-r border-slate-700 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-lg font-bold text-white mb-2">Detected Objects</h2>
            <div className="text-sm text-slate-400">
              {detectedAsteroids.length} detected • {asteroids.length - detectedAsteroids.length} undetected
            </div>
          </div>
          
          <div className="p-4 space-y-3 overflow-y-auto flex-1">
            {detectedAsteroids.map(asteroid => (
              <div
                key={asteroid.id}
                className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 ${
                  selectedAsteroid === asteroid.id 
                    ? 'bg-blue-900/30 border-blue-500 shadow-lg shadow-blue-500/20' 
                    : 'bg-slate-800/50 border-slate-600 hover:bg-slate-800 hover:border-slate-500'
                }`}
                onClick={() => setSelectedAsteroid(asteroid.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-white">{asteroid.name}</div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    asteroid.size === 'large' ? 'bg-red-500/20 text-red-300 border border-red-500/30' :
                    asteroid.size === 'medium' ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' :
                    asteroid.size === 'small' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                    'bg-slate-500/20 text-slate-300 border border-slate-500/30'
                  }`}>
                    {asteroid.size.toUpperCase()}
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Time to Impact</span>
                    <span className="text-white font-medium">{formatTimeToImpact(asteroid.timeToImpactHours)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Diameter</span>
                    <span className="text-white font-medium">{asteroid.diameterM.toFixed(0)}m</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Impact Probability</span>
                    <span className={`font-medium ${
                      asteroid.impactProbability > 0.5 ? 'text-red-400' :
                      asteroid.impactProbability > 0.2 ? 'text-orange-400' :
                      'text-yellow-400'
                    }`}>
                      {(asteroid.impactProbability * 100).toFixed(1)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-4 pt-2 border-t border-slate-600">
                    {asteroid.isTracked && (
                      <div className="flex items-center space-x-1 text-green-400">
                        <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-xs">Tracking</span>
                      </div>
                    )}
                    {asteroid.publicAlerted && (
                      <div className="flex items-center space-x-1 text-red-400">
                        <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                        <span className="text-xs">Alerted</span>
                      </div>
                    )}
                    {asteroid.deflectionMissions.length > 0 && (
                      <div className="flex items-center space-x-1 text-blue-400">
                        <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                        <span className="text-xs">{asteroid.deflectionMissions.length} Mission{asteroid.deflectionMissions.length > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {detectedAsteroids.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <div className="w-8 h-8 bg-slate-600 rounded-full"></div>
                </div>
                <div className="text-lg font-medium mb-1">No objects detected</div>
                <div className="text-sm">Scanning continues...</div>
              </div>
            )}
          </div>
        </div>

        {/* Main Panel */}
        <div className="flex-1 flex flex-col min-h-0">
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
              <div className="bg-slate-800 border-b border-slate-700 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{asteroid.name}</h3>
                      <div className="text-sm text-slate-400">Selected for action</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => trackAsteroid(selectedAsteroid)}
                      disabled={!canTrack}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        canTrack 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Start precision tracking"
                    >
                      Track
                    </button>
                    <button
                      onClick={() => alertPublic(selectedAsteroid)}
                      disabled={!canAlert}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        canAlert 
                          ? 'bg-yellow-600 hover:bg-yellow-700 text-white' 
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Issue public alert"
                    >
                      Alert
                    </button>
                    <div className="relative">
                      <button
                        onClick={() => canLaunchMission && setShowQuickMissionOptions(v => !v)}
                        disabled={!canLaunchMission}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          canLaunchMission 
                            ? 'bg-red-600 hover:bg-red-700 text-white' 
                            : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                        }`}
                        title="Plan deflection mission"
                      >
                        Mission
                      </button>
                      {showQuickMissionOptions && canLaunchMission && (
                        <div className="absolute top-full right-0 mt-2 bg-slate-700 border border-slate-600 rounded-lg shadow-lg z-10">
                          <div className="p-2 space-y-1">
                            <button
                              onClick={() => { launchDeflectionMission(selectedAsteroid, 'kinetic'); setShowQuickMissionOptions(false); }}
                              className="w-full px-3 py-2 text-left text-sm bg-red-600 hover:bg-red-700 rounded text-white"
                              title={`Kinetic Impactor ($${ACTION_COSTS.launchKineticMission}B)`}
                            >
                              Kinetic Impactor
                            </button>
                            <button
                              onClick={() => { launchDeflectionMission(selectedAsteroid, 'nuclear'); setShowQuickMissionOptions(false); }}
                              className="w-full px-3 py-2 text-left text-sm bg-red-700 hover:bg-red-800 rounded text-white"
                              title={`Nuclear Detonation ($${ACTION_COSTS.launchNuclearMission}B)`}
                            >
                              Nuclear Detonation
                            </button>
                            <button
                              onClick={() => { launchDeflectionMission(selectedAsteroid, 'gravity_tractor'); setShowQuickMissionOptions(false); }}
                              className="w-full px-3 py-2 text-left text-sm bg-blue-600 hover:bg-blue-700 rounded text-white"
                              title={`Gravity Tractor ($${ACTION_COSTS.launchGravityTractor}B)`}
                            >
                              Gravity Tractor
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => evacuateArea(selectedAsteroid)}
                      disabled={!canEvacuate}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        canEvacuate 
                          ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                          : 'bg-slate-600 text-slate-400 cursor-not-allowed'
                      }`}
                      title="Order evacuation"
                    >
                      Evacuate
                    </button>
                    <button
                      onClick={() => setSelectedAsteroid(null)}
                      className="ml-2 px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                      title="Deselect asteroid"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Main Content Area - Side by Side Layout */}
          <div className="flex-1 flex min-h-0">
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
                  <div className="w-80 bg-red-900/20 border-l border-red-500 p-6 text-white">
                    <div className="text-lg font-semibold mb-2">Error: Selected asteroid not found</div>
                    <div className="text-sm text-red-200 mb-4">
                      Selected ID: {selectedAsteroid}<br/>
                      Available asteroids: {asteroids.length}
                    </div>
                    <button 
                      onClick={() => setSelectedAsteroid(null)} 
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                    >
                      Close
                    </button>
                  </div>
                );
              }
              return (
                <div className="w-96 bg-slate-800 border-l border-slate-700 flex flex-col min-h-0 animate-slide-in-right">
                  <div className="flex items-center justify-between p-4 border-b border-slate-700 flex-shrink-0">
                    <h3 className="text-lg font-semibold text-white">Analysis Panel</h3>
                    <button
                      onClick={() => setSelectedAsteroid(null)}
                      className="text-slate-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-slate-700 transition-colors"
                      title="Close analysis panel"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-6">
                    <AsteroidActionPanel
                      asteroid={asteroid}
                      gameState={gameState}
                      onTrack={() => trackAsteroid(selectedAsteroid)}
                      onAlert={() => alertPublic(selectedAsteroid)}
                      onLaunchMission={(missionType) => launchDeflectionMission(selectedAsteroid, missionType)}
                      onEvacuate={() => evacuateArea(selectedAsteroid)}
                    />
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Mission Control & Event Log */}
        <div className="w-80 bg-slate-900 border-l border-slate-700 flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-700 flex-shrink-0">
            <h2 className="text-lg font-bold text-white">Mission Control</h2>
          </div>
          
          {/* Event Log */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="p-4 border-b border-slate-700">
              <h3 className="font-semibold text-white">Event Log</h3>
            </div>
            
            <div className="p-4 space-y-2 overflow-y-auto flex-1">
              {eventLog.map(event => (
                <div
                  key={event.id}
                  className={`p-3 rounded-lg border-l-4 ${
                    event.severity === 'critical' ? 'bg-red-900/20 border-red-500' :
                    event.severity === 'warning' ? 'bg-yellow-900/20 border-yellow-500' :
                    event.severity === 'success' ? 'bg-green-900/20 border-green-500' :
                    'bg-slate-800/30 border-slate-500'
                  }`}
                >
                  <div className="text-xs text-slate-400 mb-1 font-mono">
                    {event.timestamp.toISOString().slice(11, 19)} UTC
                  </div>
                  <div className="text-sm text-slate-200">{event.message}</div>
                </div>
              ))}
              
              {eventLog.length === 0 && (
                <div className="text-center py-12 text-slate-400">
                  <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center mx-auto mb-3">
                    <div className="w-6 h-6 bg-slate-600 rounded"></div>
                  </div>
                  <div className="text-sm">No events yet</div>
                </div>
              )}
            </div>
          </div>
          
          {/* Educational Resources Section */}
          <div className="p-4 border-t border-slate-700 bg-slate-800/30">
            <h3 className="font-semibold text-blue-300 mb-3">NASA Resources</h3>
            <div className="space-y-3 text-sm">
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                <div className="text-blue-200 font-medium mb-1">Real NASA Data</div>
                <div className="text-slate-300 text-xs">Live data from NASA&apos;s Near-Earth Object Web Service API with real orbital parameters.</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                <div className="text-green-200 font-medium mb-1">DART Mission Success</div>
                <div className="text-slate-300 text-xs">September 2022: NASA changed Dimorphos&apos; orbit by 32 minutes using kinetic impact.</div>
              </div>
              <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-600">
                <div className="text-yellow-200 font-medium mb-1">Current Statistics</div>
                <div className="text-slate-300 text-xs">34,000+ NEOs discovered • 2,300+ potentially hazardous • 158 asteroid moons</div>
              </div>
              
              <div className="pt-3 border-t border-slate-600">
                <div className="text-slate-300 font-medium text-sm mb-2">Torino Scale</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-green-300">0-1: No hazard</div>
                  <div className="text-yellow-300">2-4: Merits attention</div>
                  <div className="text-orange-300">5-7: Threatening</div>
                  <div className="text-red-300">8-10: Certain collision</div>
                </div>
              </div>
            </div>
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
                    <span>Asteroids Tracked:</span>
                    <span className="text-blue-400">{gameState.asteroidsTracked}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Correct Alerts:</span>
                    <span className="text-cyan-400">{gameState.correctAlerts}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>False Alarms:</span>
                    <span className="text-yellow-400">{gameState.falseAlarms}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Successful Deflections:</span>
                    <span className="text-green-400">{gameState.successfulDeflections}</span>
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
                  gameSpeed: 3600, // 1 hour per second (better pacing)
                  isPlaying: true,
                  budget: 50,
                  trustPoints: 75,
                  trackingCapacity: 5,
                  livesAtRisk: 0,
                  livesSaved: 0,
                  falseAlarms: 0,
                  correctAlerts: 0,
                  asteroidsTracked: 0,
                  successfulDeflections: 0,
                  totalScore: 0,
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

