"use client";
import { motion } from "framer-motion";
import React from "react";

interface LoadingScreenProps {
  loadingProgress: number;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ loadingProgress }) => {
  return (
    <motion.div
      key="loading-phase"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30, scale: 0.95 }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      className="flex flex-col items-center pointer-events-auto"
    >
      <motion.h1
        className="text-5xl md:text-7xl font-bold tracking-widest mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        Project
      </motion.h1>

      <motion.h1
        className="text-5xl md:text-7xl font-bold tracking-widest mb-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1, ease: "easeOut" }}
      >
        IMPACT
      </motion.h1>

      {/* Loading Bar Container */}
      <motion.div
        className="w-80 md:w-96 relative"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.8, ease: "easeOut" }}
      >
        {/* Loading Bar Background */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden border border-gray-700">
          {/* Loading Bar Fill */}
          <motion.div
            className="h-full bg-gradient-to-r from-cyan-500 via-cyan-400 to-cyan-300 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${loadingProgress}%` }}
            transition={{ duration: 0.1, ease: "easeOut" }}
          />
        </div>

        {/* Loading Percentage */}
        <motion.div
          className="mt-4 text-xl md:text-2xl font-semibold text-cyan-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          {Math.round(loadingProgress)}%
        </motion.div>

        {/* Loading Text */}
        <motion.div
          className="mt-2 text-sm md:text-base text-gray-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
        >
          Initializing orbital data...
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default LoadingScreen;
