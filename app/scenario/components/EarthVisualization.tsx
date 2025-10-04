'use client';

import React, { useMemo, useState } from 'react';
import { Asteroid } from '../types';
import { STARS } from '../constants';
import { estimateImpactCorridorParams } from '../gameUtils';

interface EarthVisualizationProps {
  asteroids: Asteroid[];
  selectedAsteroid: string | null;
  gameTime: Date;
  onSelectAsteroid: (id: string) => void;
}

export default function EarthVisualization({ 
  asteroids, 
  selectedAsteroid, 
  gameTime, 
  onSelectAsteroid 
}: EarthVisualizationProps) {
  const [showOrbits, setShowOrbits] = useState(true);
  const [showImpactZones, setShowImpactZones] = useState(true);
  const [showCorridor, setShowCorridor] = useState(true);
  const [autoFit, setAutoFit] = useState(true);
  const [zoom, setZoom] = useState(1);

  // Compute auto-fit scale so farthest object stays within the view
  const { distancesRaw, baseDistance, autoScale } = useMemo(() => {
    const base = 180;
    const raw = asteroids.map(a => {
      const distanceMultiplier = Math.max(0.2, a.timeToImpactHours / (24 * 7));
      return base + (distanceMultiplier * 120);
    });
    const maxRaw = raw.length ? Math.max(...raw) : base;
    const maxViewRadius = 180; // keep within the gravity sphere (~200px) with small margin
    const scale = maxRaw > 0 ? Math.min(1, maxViewRadius / (maxRaw + 20)) : 1;
    return { distancesRaw: raw, baseDistance: base, autoScale: scale };
  }, [asteroids]);

  const viewScale = (autoFit ? autoScale : 1) * zoom;
  
  return (
    <div className="relative w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 via-40% to-indigo-950 to-90%">
      {/* Stars background with multiple layers */}
      <div className="absolute inset-0">
        {/* Distant stars */}
        <div className="absolute inset-0 opacity-30">
          {STARS.map((star, i) => (
            <div
              key={i}
              className="absolute bg-white rounded-full animate-pulse"
              style={{
                width: i % 3 === 0 ? '2px' : '1px',
                height: i % 3 === 0 ? '2px' : '1px',
                left: `${star.left}%`,
                top: `${star.top}%`,
                animationDelay: `${star.animationDelay}s`,
                animationDuration: `${star.animationDuration}s`,
                opacity: i % 2 === 0 ? 0.8 : 0.5,
              }}
            />
          ))}
        </div>
        
        {/* Nebula-like background glow */}
        <div className="absolute top-20 right-20 w-96 h-96 bg-purple-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-32 left-32 w-80 h-80 bg-blue-600/5 rounded-full blur-3xl" />
      </div>
      
      {/* Earth system */}
      <div className="relative">
        {/* Earth's gravitational influence sphere */}
        <div className="absolute inset-0 rounded-full border border-slate-400/10" style={{
          width: '400px',
          height: '400px',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }} />
        
        {/* Earth */}
        <div className="relative">
          {/* Outer glow/atmosphere */}
          <div className="absolute w-72 h-72 rounded-full bg-blue-400/10 blur-2xl" style={{ left: '-16px', top: '-16px' }} />
          <div className="absolute w-68 h-68 rounded-full bg-cyan-300/20 blur-xl" style={{ left: '-8px', top: '-8px' }} />
          
          <div className="w-64 h-64 rounded-full bg-gradient-to-br from-blue-500 via-blue-600 to-green-600 border-2 border-blue-300/40 shadow-2xl relative overflow-hidden">
            {/* Atmospheric rim light */}
            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_60px_rgba(96,165,250,0.4)]" />
            
            {/* Earth surface details with better coloring */}
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-green-600 via-blue-600 to-blue-800 opacity-95">
              {/* Continents (simplified) with better shaping */}
              <div className="absolute top-6 left-10 w-20 h-16 bg-green-700/80 rounded-lg transform rotate-12 shadow-lg" />
              <div className="absolute top-16 right-6 w-16 h-12 bg-green-700/80 rounded-full shadow-lg" />
              <div className="absolute bottom-8 left-12 w-24 h-8 bg-green-700/80 rounded-lg transform -rotate-6 shadow-lg" />
              <div className="absolute top-32 left-20 w-12 h-20 bg-green-700/80 rounded-lg transform rotate-45 shadow-lg" />
              
              {/* Additional terrain features */}
              <div className="absolute top-20 left-6 w-8 h-10 bg-yellow-700/40 rounded-full" />
              <div className="absolute bottom-14 right-8 w-14 h-6 bg-green-600/60 rounded-lg transform -rotate-12" />
              
              {/* Clouds with animation */}
              <div className="absolute top-12 left-16 w-14 h-6 bg-white/40 rounded-full blur-[2px] animate-pulse" style={{ animationDuration: '3s' }} />
              <div className="absolute top-28 right-12 w-18 h-5 bg-white/40 rounded-full blur-[2px] animate-pulse" style={{ animationDuration: '4s' }} />
              <div className="absolute bottom-16 left-6 w-12 h-5 bg-white/40 rounded-full blur-[2px] animate-pulse" style={{ animationDuration: '3.5s' }} />
              <div className="absolute top-36 right-16 w-10 h-4 bg-white/35 rounded-full blur-[2px]" />
              
              {/* Polar ice caps */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-6 bg-white/60 rounded-full blur-[1px]" />
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-20 h-8 bg-white/60 rounded-full blur-[1px]" />
            </div>
            
            {/* Day/night terminator with enhanced lighting */}
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-200/5 via-transparent via-50% to-slate-900/60 rounded-full" />
            
            {/* Atmospheric scattering effect */}
            <div className="absolute inset-0 rounded-full bg-gradient-radial from-transparent via-transparent to-blue-300/20" />
            
            {/* Specular highlight (sun reflection) */}
            <div className="absolute top-10 left-12 w-16 h-16 bg-white/20 rounded-full blur-xl" />
          </div>
        </div>
        
        {/* Asteroid trajectories and positions */}
        {asteroids.map((asteroid, i) => {
          const isSelected = asteroid.id === selectedAsteroid;
          const angle = (asteroid.id.charCodeAt(0) * 17) % 360; // Pseudo-random angle based on ID
          const distance = distancesRaw[i] * viewScale;
          
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
                } shadow-lg animate-ping-slow`}
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
              <div className={`absolute top-6 left-1/2 transform -translate-x-1/2 text-xs whitespace-nowrap px-3 py-2 rounded-lg bg-slate-900/90 border backdrop-blur-sm ${
                isSelected ? 'text-blue-300 font-semibold border-blue-500/50 shadow-lg shadow-blue-500/20' : 'text-slate-300 border-slate-600/50'
              }`}>
                <div className="flex items-center gap-2">
                  <div className="font-medium">{asteroid.name}</div>
                  {asteroid.isPotentiallyHazardous && (
                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                  )}
                  {asteroid.realAsteroidKey && (
                    <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  )}
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  {asteroid.timeToImpactHours <= 0 ? 'Passed' : `${(asteroid.timeToImpactHours / 24).toFixed(1)}d`} • {(asteroid.impactProbability * 100).toFixed(0)}% • {asteroid.diameterM.toFixed(0)}m
                </div>
                {asteroid.realAsteroidKey && (
                  <div className="text-xs text-blue-300/80 mt-1">
                    NASA/JPL Data
                  </div>
                )}
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

        {/* Uncertainty corridor anchored to Earth's center (selected or highest-risk asteroid) */}
        {showCorridor && (() => {
          const active = asteroids.find(a => a.id === selectedAsteroid) || (asteroids.length ? asteroids.reduce((p, c) => c.impactProbability > p.impactProbability ? c : p) : null);
          if (!active || active.impactProbability <= 0.01) return null;
          const c = estimateImpactCorridorParams(active);
          const lengthPx = c.lengthKm / 50;
          const widthPx = c.widthKm / 50;
          return (
            <svg
              className="absolute pointer-events-none"
              style={{ left: '50%', top: '50%', width: '400px', height: '400px', transform: 'translate(-50%, -50%)' }}
            >
              <g transform={`rotate(${c.angleDeg} 200 200)`} opacity={0.25}>
                <rect
                  x={200 - lengthPx / 2}
                  y={200 - widthPx / 2}
                  width={lengthPx}
                  height={widthPx}
                  fill="#22c55e"
                />
                <rect
                  x={200 - lengthPx / 2}
                  y={200 - widthPx / 2}
                  width={lengthPx}
                  height={widthPx}
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth={1}
                />
              </g>
            </svg>
          );
        })()}
      </div>
      
      {/* Controls */}
      <div className="absolute top-4 right-4 space-y-2">
        <button
          onClick={() => setShowOrbits(!showOrbits)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showOrbits 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          title="Show/hide stylized projected orbit path"
        >
          {showOrbits ? 'Hide' : 'Show'} Orbits
        </button>
        <button
          onClick={() => setShowImpactZones(!showImpactZones)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showImpactZones 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          title="Show/hide approximate ground footprint at predicted impact location"
        >
          {showImpactZones ? 'Hide' : 'Show'} Impact Zones
        </button>
        <button
          onClick={() => setShowCorridor(!showCorridor)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            showCorridor 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
          title="Show/hide 3σ impact corridor based on current orbit uncertainty"
        >
          {showCorridor ? 'Hide' : 'Show'} Corridor
        </button>
        <button
          onClick={() => setAutoFit(!autoFit)}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            autoFit 
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white' 
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
          }`}
        >
          {autoFit ? 'Auto-fit: On' : 'Auto-fit: Off'}
        </button>
        <div className="bg-slate-900/90 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300">
          <div className="mb-1">Zoom</div>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-40 accent-indigo-500"
          />
        </div>
      </div>
      
      {/* Legend - Compact Design */}
      <div className="absolute bottom-4 left-4 bg-slate-900/95 backdrop-blur-md rounded-xl p-3 text-xs border border-slate-700/80 shadow-2xl max-w-xs">
        <div className="space-y-2.5">
          {/* Object Classification - Horizontal compact layout */}
          <div>
            <div className="font-semibold mb-1.5 text-slate-200 text-[10px] uppercase tracking-wider">Object Classification</div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="flex items-center gap-1.5 bg-slate-800/50 rounded px-1.5 py-1">
                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-slate-300 text-[10px]">Large (140m+)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/50 rounded px-1.5 py-1">
                <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                <span className="text-slate-300 text-[10px]">Medium (20-140m)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/50 rounded px-1.5 py-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                <span className="text-slate-300 text-[10px]">Small (5-20m)</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800/50 rounded px-1.5 py-1">
                <div className="w-2 h-2 rounded-full bg-slate-400 flex-shrink-0" />
                <span className="text-slate-300 text-[10px]">Tiny (&lt;5m)</span>
              </div>
            </div>
          </div>
          
          {/* Mission Status */}
          <div className="border-t border-slate-700/50 pt-2">
            <div className="font-semibold mb-1.5 text-slate-200 text-[10px] uppercase tracking-wider">Mission Status</div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-slate-300 text-[10px]">Active</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-slate-300 text-[10px]">En route</span>
              </div>
            </div>
          </div>

          {/* Overlays - Condensed */}
          <div className="border-t border-slate-700/50 pt-2">
            <div className="font-semibold mb-1.5 text-slate-200 text-[10px] uppercase tracking-wider">Overlays</div>
            <div className="space-y-1">
              <div className="flex items-start gap-1.5">
                <div className="w-2 h-2 bg-green-500/60 border border-green-400 flex-shrink-0 mt-0.5" />
                <div className="text-slate-300 text-[10px] leading-tight">
                  <span className="font-semibold text-green-300">Corridor (3σ):</span> impact path uncertainty band
                </div>
              </div>
              <div className="flex items-start gap-1.5">
                <div className="w-2 h-2 rounded-full bg-red-500/40 border border-red-400 flex-shrink-0 mt-0.5" />
                <div className="text-slate-300 text-[10px] leading-tight">
                  <span className="font-semibold text-red-300">Impact zone:</span> surface footprint preview
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Time display */}
      <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm rounded-lg p-4 text-sm border border-slate-600">
        <div className="font-semibold text-green-400 mb-1">Mission Time</div>
        <div className="font-mono text-slate-300">{gameTime.toISOString().replace('T', ' ').slice(0, 19)} UTC</div>
        <div className="text-xs text-slate-400 mt-2">
          {asteroids.length} objects tracked
        </div>
      </div>
    </div>
  );
}
