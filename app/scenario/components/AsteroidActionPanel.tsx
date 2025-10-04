'use client';

import React, { useState, useMemo } from 'react';
import { Asteroid, GameState, DeflectionMission } from '../types';
import { ACTION_COSTS } from '../constants';
import { getTorinoScale, getPalermoScale, applyOpticalFollowUp, applyRadarCampaign } from '../gameUtils';
import { impactModeling } from '../services/impactModeling';

interface AsteroidActionPanelProps {
  asteroid: Asteroid;
  gameState: GameState;
  onTrack: () => void;
  onAlert: () => void;
  onLaunchMission: (missionType: DeflectionMission['type']) => void;
  onEvacuate: () => void;
  onAsteroidUpdate?: (updated: Asteroid) => void;
}

export default function AsteroidActionPanel({ 
  asteroid, 
  gameState, 
  onTrack, 
  onAlert, 
  onLaunchMission, 
  onEvacuate,
  onAsteroidUpdate
}: AsteroidActionPanelProps) {
  const timeToImpactDays = asteroid.timeToImpactHours / 24;
  const canTrack = !asteroid.isTracked && gameState.budget >= ACTION_COSTS.trackAsteroid;
  const canAlert = !asteroid.publicAlerted && gameState.budget >= ACTION_COSTS.alertPublic;
  const canLaunchMission = timeToImpactDays > 30 && asteroid.impactProbability > 0.1;
  const canEvacuate = !asteroid.evacuationOrdered && asteroid.size !== 'tiny' && asteroid.size !== 'small' && gameState.budget >= ACTION_COSTS.evacuateArea;
  
  const [showMissionOptions, setShowMissionOptions] = useState(false);
  const [showTooltip, setShowTooltip] = useState<string | null>(null);
  const [showImpactDetails, setShowImpactDetails] = useState(false);
  
  const torinoScale = getTorinoScale(asteroid);
  const palermoScale = getPalermoScale(asteroid);
  const torinoColors = ['bg-gray-600', 'bg-green-600', 'bg-green-600', 'bg-yellow-600', 'bg-yellow-600', 'bg-orange-600', 'bg-orange-600', 'bg-red-600', 'bg-red-700', 'bg-red-800', 'bg-red-900'];
  
  // Calculate impact assessment
  const impactAssessment = useMemo(() => {
    if (asteroid.impactProbability > 0.05) {
      return impactModeling.assessImpact(asteroid);
    }
    return null;
  }, [asteroid]);
  
  const impactScenario = useMemo(() => {
    if (impactAssessment) {
      return impactModeling.generateImpactScenario(asteroid, impactAssessment);
    }
    return null;
  }, [asteroid, impactAssessment]);
  
  return (
    <div className="relative">
      {/* Header with gradient background */}
      <div className="mb-6 relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 border border-slate-700/50 p-6 shadow-2xl">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-3 h-3 rounded-full animate-pulse ${
              asteroid.size === 'large' ? 'bg-red-500' :
              asteroid.size === 'medium' ? 'bg-orange-500' :
              asteroid.size === 'small' ? 'bg-yellow-500' :
              'bg-slate-400'
            }`} />
            <h3 className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
              {asteroid.name}
            </h3>
          </div>
          <div className="text-sm text-slate-400">Detailed threat analysis and response options</div>
        </div>
      </div>
      
      {/* Enhanced NASA Data Section */}
      {asteroid.realAsteroidKey && (
        <div className="mb-6 p-6 bg-gradient-to-br from-blue-950/40 via-blue-900/20 to-indigo-950/40 border border-blue-500/30 rounded-xl shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-400/30">
                <span className="text-blue-300 text-sm font-bold">NASA</span>
              </div>
              <h4 className="font-semibold text-blue-200 text-lg">JPL Database Record</h4>
            </div>
            {asteroid.isPotentiallyHazardous && (
              <div className="px-3 py-1.5 bg-gradient-to-r from-red-500/20 to-orange-500/20 text-red-200 border border-red-400/40 rounded-lg text-xs font-semibold shadow-lg shadow-red-500/10">
                ⚠️ PHA - Potentially Hazardous
              </div>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
            {asteroid.material && (
              <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Composition</div>
                <div className="font-semibold text-blue-100 text-lg">{asteroid.material}</div>
              </div>
            )}
            {asteroid.density && (
              <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Density</div>
                <div className="font-semibold text-blue-100 text-lg">{asteroid.density} g/cm³</div>
              </div>
            )}
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
              <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Mass (Estimated)</div>
              <div className="font-semibold text-blue-100 text-lg">{(asteroid.massKg / 1e12).toExponential(2)} × 10¹² kg</div>
            </div>
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
              <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Velocity</div>
              <div className="font-semibold text-blue-100 text-lg">{asteroid.velocityKmps.toFixed(1)} km/s</div>
            </div>
            {asteroid.absoluteMagnitude && (
              <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-blue-500/40 transition-all duration-200 shadow-lg">
                <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Abs. Magnitude (H)</div>
                <div className="font-semibold text-blue-100 text-lg">{asteroid.absoluteMagnitude.toFixed(1)}</div>
              </div>
            )}
          </div>
          
          {/* Orbital Elements */}
          {asteroid.orbitalData && (
            <div className="border-t border-blue-600/30 pt-2 mb-3">
              <div className="text-xs text-blue-300 font-semibold mb-1">Orbital Elements</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                {asteroid.orbitalData.eccentricity && (
                  <div>
                    <div className="text-gray-400">Eccentricity</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.eccentricity).toFixed(3)}</div>
                  </div>
                )}
                {asteroid.orbitalData.semi_major_axis && (
                  <div>
                    <div className="text-gray-400">Semi-major Axis</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.semi_major_axis).toFixed(2)} AU</div>
                  </div>
                )}
                {asteroid.orbitalData.inclination && (
                  <div>
                    <div className="text-gray-400">Inclination</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.inclination).toFixed(1)}°</div>
                  </div>
                )}
                {asteroid.orbitalData.orbital_period && (
                  <div>
                    <div className="text-gray-400">Period</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.orbital_period).toFixed(1)} days</div>
                  </div>
                )}
                {asteroid.orbitalData.perihelion_distance && (
                  <div>
                    <div className="text-gray-400">Perihelion</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.perihelion_distance).toFixed(2)} AU</div>
                  </div>
                )}
                {asteroid.orbitalData.aphelion_distance && (
                  <div>
                    <div className="text-gray-400">Aphelion</div>
                    <div className="text-blue-200">{parseFloat(asteroid.orbitalData.aphelion_distance).toFixed(2)} AU</div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {asteroid.educationalBlurb && (
            <div className="text-sm text-blue-100 leading-relaxed border-t border-blue-600/30 pt-2">
              <div className="text-gray-300 mb-1">📖 Educational Info:</div>
              <div>{asteroid.educationalBlurb}</div>
            </div>
          )}
          
          {asteroid.nasaJplUrl && (
            <div className="text-xs text-blue-300 mt-2">
              <a 
                href={asteroid.nasaJplUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-200 underline"
              >
                🔗 View in NASA JPL Database
              </a>
            </div>
          )}
        </div>
      )}

      {/* Impact Assessment Section */}
      {impactAssessment && (
        <div className="mb-6 p-6 bg-gradient-to-br from-red-950/40 via-red-900/20 to-orange-950/40 border border-red-500/30 rounded-xl shadow-lg backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-400/30">
                <span className="text-red-300 text-xl">⚠</span>
              </div>
              <h4 className="font-semibold text-red-200 text-lg">Impact Assessment (USGS Model)</h4>
            </div>
            <button
              onClick={() => setShowImpactDetails(!showImpactDetails)}
              className="px-4 py-2 text-sm bg-gradient-to-r from-red-600/60 to-red-700/60 hover:from-red-600/80 hover:to-red-700/80 rounded-lg transition-all duration-200 font-medium text-white shadow-lg border border-red-500/30"
            >
              {showImpactDetails ? '▲ Hide' : '▼ Show'} Details
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-red-500/40 transition-all duration-200 shadow-lg">
              <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Equivalent Earthquake</div>
              <div className="font-semibold text-red-200 text-lg">Magnitude {impactAssessment.equivalentMagnitude}</div>
            </div>
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-red-500/40 transition-all duration-200 shadow-lg">
              <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Impact Energy</div>
              <div className="font-semibold text-red-200 text-lg">{impactAssessment.energyMegatonsTNT.toExponential(1)} MT TNT</div>
            </div>
            {impactAssessment.craterDiameter && (
              <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-red-500/40 transition-all duration-200 shadow-lg">
                <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Crater Diameter</div>
                <div className="font-semibold text-red-200 text-lg">{impactAssessment.craterDiameter.toFixed(1)} km</div>
              </div>
            )}
            <div className="bg-gradient-to-br from-slate-800/70 to-slate-900/70 p-4 rounded-lg border border-slate-600/50 hover:border-red-500/40 transition-all duration-200 shadow-lg">
              <div className="text-slate-400 text-xs mb-1.5 uppercase tracking-wider">Seismic Radius</div>
              <div className="font-semibold text-red-200 text-lg">{impactAssessment.seismicRadius} km</div>
            </div>
          </div>

          {showImpactDetails && (
            <div className="border-t border-red-600/30 pt-3 space-y-3">
              {/* Casualty estimates */}
              <div className="bg-red-900/30 p-2 rounded">
                <div className="text-xs text-red-300 font-semibold mb-1">Casualty Estimates (Populated Area)</div>
                <div className="text-sm text-red-200">
                  Without evacuation: {impactAssessment.casualtyEstimate.min.toLocaleString()} - {impactAssessment.casualtyEstimate.max.toLocaleString()}
                </div>
                <div className="text-sm text-green-200">
                  With evacuation: ~{Math.floor(impactAssessment.casualtyEstimate.max * (1 - impactAssessment.casualtyEstimate.evacuationReduction)).toLocaleString()} (90% reduction)
                </div>
              </div>

              {/* Economic impact */}
              <div className="bg-orange-900/30 p-2 rounded">
                <div className="text-xs text-orange-300 font-semibold mb-1">Economic Impact Estimates</div>
                <div className="text-sm">
                  <div className="text-orange-200">Local damage: ${impactAssessment.economicImpact.localDamage.toFixed(0)}B</div>
                  <div className="text-orange-200">Global impact: ${impactAssessment.economicImpact.globalImpact.toFixed(0)}B</div>
                </div>
              </div>

              {/* Additional effects */}
              <div className="space-y-1 text-sm">
                {impactAssessment.tsunamiRisk && (
                  <div className="text-blue-300">🌊 TSUNAMI RISK: Oceanic impact location</div>
                )}
                <div className="text-gray-300">
                  Atmospheric effects: {impactAssessment.atmosphericEffects.charAt(0).toUpperCase() + impactAssessment.atmosphericEffects.slice(1)}
                </div>
              </div>

              {/* Scenario description */}
              {impactScenario && (
                <div className="bg-gray-800/50 p-2 rounded">
                  <div className="text-xs text-gray-300 font-semibold mb-1">Impact Scenario</div>
                  <div className="text-xs text-gray-200 leading-relaxed">{impactScenario}</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-5 rounded-xl border border-slate-600/50 min-h-[140px] overflow-hidden text-center shadow-lg hover:shadow-xl hover:border-slate-500/60 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-500/5 to-transparent" />
          <div className="relative">
            <div className="text-slate-400 text-[10px] mb-2 uppercase tracking-wider font-medium">Size Category</div>
            <div className={`font-bold text-2xl mb-2 ${
              asteroid.size === 'large' ? 'text-red-400' :
              asteroid.size === 'medium' ? 'text-orange-400' :
              asteroid.size === 'small' ? 'text-yellow-400' :
              'text-slate-400'
            }`}>
              {asteroid.size.toUpperCase()}
            </div>
            <div className="text-slate-300 text-sm font-medium">{asteroid.diameterM.toFixed(0)}m diameter</div>
          </div>
        </div>
        
        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-5 rounded-xl border border-slate-600/50 min-h-[140px] overflow-hidden text-center shadow-lg hover:shadow-xl hover:border-slate-500/60 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
          <div className="relative">
            <div className="text-slate-400 text-[10px] mb-2 uppercase tracking-wider font-medium">Time to Impact</div>
            <div className="font-bold text-2xl text-blue-200 mb-2">{timeToImpactDays.toFixed(1)}</div>
            <div className="text-slate-300 text-xs">days</div>
            <div className="text-slate-400 text-xs mt-1">±{asteroid.uncertaintyKm.toFixed(0)}km uncertainty</div>
          </div>
        </div>
        
        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-5 rounded-xl border border-slate-600/50 min-h-[140px] overflow-hidden text-center shadow-lg hover:shadow-xl hover:border-slate-500/60 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-transparent" />
          <div className="relative">
            <div className="text-slate-400 text-[10px] mb-2 uppercase tracking-wider font-medium">Impact Probability</div>
            <div className={`font-bold text-2xl mb-1 ${
              asteroid.impactProbability > 0.5 ? 'text-red-400' :
              asteroid.impactProbability > 0.2 ? 'text-orange-400' :
              'text-yellow-400'
            }`}>
              {(asteroid.impactProbability * 100).toFixed(1)}%
            </div>
            <div className="text-slate-300 text-xs mb-1">Torino Scale: {torinoScale}/10</div>
            <div className="text-slate-400 text-[10px] leading-tight">
              Risk assessment scale (0–10)
            </div>
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-slate-800/90 to-slate-900/90 p-5 rounded-xl border border-slate-600/50 min-h-[140px] overflow-hidden text-center shadow-lg hover:shadow-xl hover:border-slate-500/60 transition-all duration-200">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent" />
          <div className="relative">
            <div className="text-slate-400 text-[10px] mb-2 uppercase tracking-wider font-medium">Palermo Scale</div>
            <div className={`font-bold text-2xl mb-1 ${
              palermoScale >= 0 ? 'text-red-300' : 'text-slate-300'
            }`}>
              {palermoScale.toFixed(2)}
            </div>
            <div className="text-slate-300 text-xs mb-1">
              {palermoScale < 0 ? 'Below background' : palermoScale < 1 ? 'Comparable' : 'Above background'}
            </div>
            <div className="text-slate-400 text-[10px] leading-tight">
              Technical hazard scale
            </div>
          </div>
        </div>
      </div>
      
      {/* Action Buttons - Sticky at bottom */}
      <div className="sticky bottom-0 bg-gradient-to-t from-slate-900/98 via-slate-800/95 to-slate-800/90 backdrop-blur-md border-t border-slate-600/50 pt-5 -mx-6 px-6 shadow-2xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <button
            onClick={onTrack}
            disabled={!canTrack}
            className={`relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg ${
              canTrack 
                ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white border border-blue-500/30 hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02]' 
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
            }`}
            onMouseEnter={() => setShowTooltip('track')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="flex items-center justify-center gap-2">
              <span>🔭</span>
              <span>Track Object</span>
            </span>
          </button>
          
          <button
            onClick={onAlert}
            disabled={!canAlert}
            className={`relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg ${
              canAlert 
                ? 'bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-500 hover:to-amber-500 text-white border border-yellow-500/30 hover:shadow-xl hover:shadow-yellow-500/20 hover:scale-[1.02]' 
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
            }`}
            onMouseEnter={() => setShowTooltip('alert')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="flex items-center justify-center gap-2">
              <span>📢</span>
              <span>Issue Alert</span>
            </span>
          </button>
          
          <button
            onClick={() => setShowMissionOptions(!showMissionOptions)}
            disabled={!canLaunchMission}
            className={`relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg ${
              canLaunchMission 
                ? 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white border border-red-500/30 hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]' 
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
            }`}
            onMouseEnter={() => setShowTooltip('mission')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="flex items-center justify-center gap-2">
              <span>🚀</span>
              <span>Launch Mission</span>
            </span>
          </button>
          
          <button
            onClick={onEvacuate}
            disabled={!canEvacuate}
            className={`relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 shadow-lg ${
              canEvacuate
                ? 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white border border-purple-500/30 hover:shadow-xl hover:shadow-purple-500/20 hover:scale-[1.02]'
                : 'bg-slate-700/50 text-slate-500 cursor-not-allowed border border-slate-600/30'
            }`}
            onMouseEnter={() => setShowTooltip('evacuate')}
            onMouseLeave={() => setShowTooltip(null)}
          >
            <span className="flex items-center justify-center gap-2">
              <span>🚨</span>
              <span>Order Evacuation</span>
            </span>
          </button>

          {/* Observation actions */}
          <button
            onClick={() => onAsteroidUpdate && onAsteroidUpdate(applyOpticalFollowUp(asteroid))}
            className="relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white border border-emerald-500/30 shadow-lg hover:shadow-xl hover:shadow-emerald-500/20 hover:scale-[1.02]"
            title="Optical follow-up reduces uncertainty and refines probability"
          >
            <span className="flex items-center justify-center gap-2">
              <span>📡</span>
              <span>Optical Follow-up</span>
            </span>
          </button>
          <button
            onClick={() => onAsteroidUpdate && onAsteroidUpdate(applyRadarCampaign(asteroid))}
            className="relative px-5 py-3.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-gradient-to-r from-green-700 to-green-800 hover:from-green-600 hover:to-green-700 text-white border border-green-600/30 shadow-lg hover:shadow-xl hover:shadow-green-600/20 hover:scale-[1.02]"
            title="Radar campaign significantly reduces uncertainty"
          >
            <span className="flex items-center justify-center gap-2">
              <span>📊</span>
              <span>Radar Campaign</span>
            </span>
          </button>
        </div>
      </div>
      
      {/* Mission Options */}
      {showMissionOptions && canLaunchMission && (
        <div className="mb-6 p-5 bg-gradient-to-br from-slate-800/70 to-slate-900/70 rounded-xl border border-slate-600/50 shadow-xl">
          <h4 className="font-semibold mb-4 text-white text-lg flex items-center gap-2">
            <span className="text-2xl">🚀</span>
            <span>Select Mission Type</span>
          </h4>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => {
                onLaunchMission('kinetic');
                setShowMissionOptions(false);
              }}
              className="group px-5 py-4 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 rounded-xl text-sm font-semibold transition-all duration-200 border border-red-500/30 shadow-lg hover:shadow-xl hover:shadow-red-500/20 hover:scale-[1.02]"
              title={`Kinetic Impactor - Direct collision ($${ACTION_COSTS.launchKineticMission}B)`}
            >
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💥</span>
                  <div className="text-left">
                    <div>Kinetic Impactor</div>
                    <div className="text-xs text-red-100 opacity-90 font-normal">Direct high-speed collision</div>
                  </div>
                </div>
                <div className="text-lg">${ACTION_COSTS.launchKineticMission}B</div>
              </div>
            </button>
            <button
              onClick={() => {
                onLaunchMission('nuclear');
                setShowMissionOptions(false);
              }}
              className="group px-5 py-4 bg-gradient-to-r from-red-700 to-red-800 hover:from-red-600 hover:to-red-700 rounded-xl text-sm font-semibold transition-all duration-200 border border-red-600/30 shadow-lg hover:shadow-xl hover:shadow-red-600/20 hover:scale-[1.02]"
              title={`Nuclear Detonation - Standoff explosion ($${ACTION_COSTS.launchNuclearMission}B)`}
            >
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">☢️</span>
                  <div className="text-left">
                    <div>Nuclear Detonation</div>
                    <div className="text-xs text-red-100 opacity-90 font-normal">Standoff explosion</div>
                  </div>
                </div>
                <div className="text-lg">${ACTION_COSTS.launchNuclearMission}B</div>
              </div>
            </button>
            <button
              onClick={() => {
                onLaunchMission('gravity_tractor');
                setShowMissionOptions(false);
              }}
              className="group px-5 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 rounded-xl text-sm font-semibold transition-all duration-200 border border-blue-500/30 shadow-lg hover:shadow-xl hover:shadow-blue-500/20 hover:scale-[1.02]"
              title={`Gravity Tractor - Slow gravitational tug ($${ACTION_COSTS.launchGravityTractor}B)`}
            >
              <div className="flex items-center justify-between text-white">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🛸</span>
                  <div className="text-left">
                    <div>Gravity Tractor</div>
                    <div className="text-xs text-blue-100 opacity-90 font-normal">Slow gravitational tug</div>
                  </div>
                </div>
                <div className="text-lg">${ACTION_COSTS.launchGravityTractor}B</div>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Educational Tooltips */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 p-4 bg-slate-900 border border-slate-600 rounded-lg max-w-sm text-sm z-50 shadow-xl">
          {showTooltip === 'track' && (
            <div>
              <div className="font-semibold mb-2 text-white">Precision Tracking</div>
              <div className="text-slate-300 mb-2">Deploy additional telescopes and radar systems to improve orbital determination. Reduces position uncertainty over time through repeated observations.</div>
              <div className="text-slate-400 text-xs">Cost: ${ACTION_COSTS.trackAsteroid}B</div>
            </div>
          )}
          {showTooltip === 'alert' && (
            <div>
              <div className="font-semibold mb-2 text-white">Public Warning System</div>
              <div className="text-slate-300 mb-2">Activate emergency broadcasting and mobile alert systems. Reduces casualties but affects public trust if false alarm.</div>
              <div className="text-slate-400 text-xs">Cost: ${ACTION_COSTS.alertPublic}B</div>
            </div>
          )}
          {showTooltip === 'mission' && (
            <div>
              <div className="font-semibold mb-2 text-white">Deflection Missions</div>
              <div className="space-y-2 text-slate-300">
                <div><strong className="text-red-300">Kinetic Impactor:</strong> Direct collision to change momentum (like NASA&apos;s DART mission at Dimorphos)</div>
                <div><strong className="text-red-300">Nuclear Standoff:</strong> Detonation at distance using X-ray vaporization to push asteroid</div>
                <div><strong className="text-blue-300">Gravity Tractor:</strong> Spacecraft flies alongside asteroid, using gravity to slowly nudge trajectory</div>
              </div>
              <div className="text-blue-300 mt-3 text-xs bg-blue-900/20 p-2 rounded">
                NASA&apos;s DART successfully changed Dimorphos&apos; orbit in 2022, proving kinetic deflection works!
              </div>
            </div>
          )}
          {showTooltip === 'evacuate' && (
            <div>
              <div className="font-semibold mb-2 text-white">Emergency Evacuation</div>
              <div className="text-slate-300 mb-2">Coordinate mass evacuation of predicted impact zone. Most effective for reducing casualties from medium+ asteroids.</div>
              <div className="text-slate-400 text-xs">Cost: ${ACTION_COSTS.evacuateArea}B</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
