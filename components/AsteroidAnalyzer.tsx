import React, { useState, useEffect } from 'react';
import { X, Info, AlertTriangle, Target } from 'lucide-react';
import * as THREE from 'three';

interface AsteroidAnalyzerProps {
  isActive: boolean;
  asteroidPosition: THREE.Vector3; // kept for API, not used yet
  onComplete: () => void;
}

const AsteroidAnalyzer: React.FC<AsteroidAnalyzerProps> = ({
  isActive,
  asteroidPosition: _asteroidPosition,
  onComplete,
}) => {
  const [showHUD, setShowHUD] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    if (isActive && !isScanning && !showHUD) {
      startScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, isScanning, showHUD]);

  const startScan = () => {
    setIsScanning(true);
    setScanProgress(0);

    const scanDuration = 3000;
    const startTime = Date.now();

    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / scanDuration, 1);
      setScanProgress(progress * 100);

      if (progress < 1) {
        requestAnimationFrame(updateProgress);
      } else {
        setIsScanning(false);
        setShowHUD(true);
      }
    };

    updateProgress();
  };

  const handleClose = () => {
    setShowHUD(false);
    setScanProgress(0);
    setIsScanning(false);
    onComplete();
  };

  if (!isActive) return null;

  return (
    <>
      {/* === Scanning Progress Overlay === */}
      {isScanning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gray-900/90 rounded-xl border border-blue-500/50 p-8 text-center">
            <div className="text-2xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-4">Scanning Asteroid</h3>
            <div className="w-64 bg-gray-700 rounded-full h-3 mb-4">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-100"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-gray-300 text-sm">
              Analyzing composition, trajectory, and threat level...
            </p>
          </div>
        </div>
      )}

      {/* === Analysis HUD === */}
      {showHUD && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-gray-900/95 rounded-2xl border border-blue-500/50 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 rounded-t-2xl flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Target size={24} className="text-white" />
                <div>
                  <h2 className="text-2xl font-bold text-white">Impactor-2025</h2>
                  <p className="text-blue-100">Near-Earth Object Analysis</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg"
              >
                <X size={20} className="text-white" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 text-white space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Threat Assessment */}
                <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-4">
                  <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
                    <AlertTriangle size={20} /> Threat Level: CRITICAL
                  </h3>
                  <p className="text-sm mt-2">Impact Probability: <span className="text-red-400 font-bold">99.7%</span></p>
                  <p className="text-sm">Time to Impact: <span className="text-red-400 font-bold">47 days</span></p>
                  <p className="text-sm">Energy Release: <span className="text-red-400 font-bold">~15 Megatons TNT</span></p>
                </div>

                {/* Physical Properties */}
                <div className="bg-blue-900/30 border border-blue-500/50 rounded-xl p-4">
                  <h3 className="text-lg font-bold text-blue-400 flex items-center gap-2">
                    <Info size={20} /> Physical Properties
                  </h3>
                  <p className="text-sm mt-2">Diameter: <span className="text-blue-400 font-bold">340 m</span></p>
                  <p className="text-sm">Mass: <span className="text-blue-400 font-bold">4.2 × 10⁷ tonnes</span></p>
                  <p className="text-sm">Composition: <span className="text-blue-400 font-bold">Stony (S-type)</span></p>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg"
                >
                  Close Analysis
                </button>
                <button
                  onClick={handleClose}
                  className="bg-red-600 hover:bg-red-500 px-6 py-2 rounded-lg"
                >
                  Recommend Action
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AsteroidAnalyzer;
