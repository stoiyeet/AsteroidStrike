'use client';

import React, { useState } from 'react';
import { Asteroid, GameState, DeflectionMission } from '../types';
import { ACTION_COSTS } from '../constants';
import { getTorinoScale } from '../gameUtils';

interface AsteroidActionPanelProps {
  asteroid: Asteroid;
  gameState: GameState;
  onTrack: () => void;
  onAlert: () => void;
  onLaunchMission: (missionType: DeflectionMission['type']) => void;
  onEvacuate: () => void;
}

export default function AsteroidActionPanel({ 
  asteroid, 
  gameState, 
  onTrack, 
  onAlert, 
  onLaunchMission, 
  onEvacuate 
}: AsteroidActionPanelProps) {
  const timeToImpactDays = asteroid.timeToImpactHours / 24;
  const canTrack = !asteroid.isTracked && gameState.budget >= ACTION_COSTS.trackAsteroid;
  const canAlert = !asteroid.publicAlerted && gameState.budget >= ACTION_COSTS.alertPublic;
  const canLaunchMission = timeToImpactDays > 30 && asteroid.impactProbability > 0.1;
  const canEvacuate = !asteroid.evacuationOrdered && asteroid.size !== 'tiny' && asteroid.size !== 'small' && gameState.budget >= ACTION_COSTS.evacuateArea;
  
  const [showMissionOptions, setShowMissionOptions] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  
  const torinoScale = getTorinoScale(asteroid);
  const torinoColors = ['bg-gray-600', 'bg-green-600', 'bg-green-600', 'bg-yellow-600', 'bg-yellow-600', 'bg-orange-600', 'bg-orange-600', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900'];
  
  return (
    <div className="relative">
      <h3 className="font-semibold mb-3">{asteroid.name} - Action Options</h3>
      
      {/* Educational Information Section */}
      {asteroid.realAsteroidKey && (
        <div className="mb-4 p-3 bg-blue-900/30 border border-blue-600/30 rounded">
          <h4 className="font-semibold text-blue-300 mb-2">🔬 Scientific Data</h4>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {asteroid.material && (
              <div className="text-sm">
                <div className="text-gray-400">Composition</div>
                <div className="font-semibold text-blue-200">{asteroid.material}</div>
              </div>
            )}
            {asteroid.density && (
              <div className="text-sm">
                <div className="text-gray-400">Density</div>
                <div className="font-semibold text-blue-200">{asteroid.density} g/cm³</div>
              </div>
            )}
            <div className="text-sm">
              <div className="text-gray-400">Mass (Estimated)</div>
              <div className="font-semibold text-blue-200">{(asteroid.massKg / 1e12).toExponential(2)} × 10¹² kg</div>
            </div>
            <div className="text-sm">
              <div className="text-gray-400">Velocity</div>
              <div className="font-semibold text-blue-200">{asteroid.velocityKmps.toFixed(1)} km/s</div>
            </div>
          </div>
          {asteroid.educationalBlurb && (
            <div className="text-sm text-blue-100 leading-relaxed border-t border-blue-600/30 pt-2">
              <div className="text-gray-300 mb-1">📖 Educational Info:</div>
              <div>{asteroid.educationalBlurb}</div>
            </div>
          )}
        </div>
      )}
      
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
              <div className="space-y-1">
                <div><strong>Kinetic Impactor:</strong> Direct collision to change momentum (like NASA's DART mission at Dimorphos)</div>
                <div><strong>Nuclear Standoff:</strong> Detonation at distance using X-ray vaporization to push asteroid</div>
                <div><strong>Gravity Tractor:</strong> Spacecraft flies alongside asteroid, using gravity to slowly nudge trajectory</div>
              </div>
              <div className="text-gray-400 mt-2 text-xs">
                💡 NASA's DART successfully changed Dimorphos' orbit in 2022, proving kinetic deflection works!
              </div>
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
