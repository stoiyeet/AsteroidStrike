'use client';

import React from 'react';

interface SuccessOverlayProps {
  isVisible: boolean;
  onClose: () => void;
}

const SuccessOverlay: React.FC<SuccessOverlayProps> = ({ isVisible, onClose }) => {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-green-800 bg-opacity-90 text-white p-8 rounded-lg text-center backdrop-blur-sm">
        <h2 className="text-2xl font-bold mb-4 text-green-300">🎯 DEFLECTION SUCCESSFUL!</h2>
        <p className="mb-4">The kinetic impactor has successfully altered the asteroid&apos;s trajectory.</p>
        <p className="mb-6 text-sm text-green-200">Impact probability reduced to near zero.</p>
        <button
          onClick={onClose}
          className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded font-medium"
        >
          Continue Monitoring
        </button>
      </div>
    </div>
  );
};

export default SuccessOverlay;