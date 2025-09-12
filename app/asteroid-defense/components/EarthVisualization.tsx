'use client';

import React, { useState } from 'react';
import { Asteroid } from '../types';
import { STARS } from '../constants';

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
                  {asteroid.timeToImpactHours <= 0 ? 'Passed' : `${(asteroid.timeToImpactHours / 24).toFixed(1)}d`} • {(asteroid.impactProbability * 100).toFixed(0)}%
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
