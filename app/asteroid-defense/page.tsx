'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Asteroid, GameState, EventLogEntry, DeflectionMission } from './types';
import { ACTION_COSTS, TRUST_IMPACTS } from './constants';
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
    return "Passed";
  }
  return `${days.toFixed(1)} days`;
}

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
              🚨 IMMEDIATE THREAT: {immediateThreat.name} - {formatTimeToImpact(immediateThreat.timeToImpactHours)} to impact!
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
                  <div>⏱️ {formatTimeToImpact(asteroid.timeToImpactHours)}</div>
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

