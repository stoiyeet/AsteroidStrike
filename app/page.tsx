"use client";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from "next/dynamic";
import React, { useState, useEffect } from "react";
import LoadingScreen from "../components/LoadingScreen";
import Joyride, { CallBackProps, STATUS } from "react-joyride";

const EarthScene = dynamic(() => import("@/components/EarthHome"), { ssr: false });


export default function Home(): React.ReactElement {
  const [currentPhase, setCurrentPhase] = useState<"loading" | "project">("loading");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [sceneLoaded, setSceneLoaded] = useState(false);
  const [runTour, setRunTour] = useState(false);
  const [mounted, setMounted] = useState(false);

  const steps = [
    {
      target: "#nav-impact",
      content: "Explore theoretical impacts of real and custom meteor strikes"
    },
    {
      target: "#nav-mitigation",
      content: "Simulate and learn cutting edge techniques to elimiate asteroid impact threats"
    },
    {
       target: "#nav-scenario",
        content: "Test your knowledge in a realistic asteroid defense scenario with real consequences"
    }
]

  useEffect(() => setMounted(true), []);

  // --- Visit counting logic ---
  useEffect(() => {
    const hasVisited = document.cookie.split("; ").find(row => row.startsWith("visited="));
    if (!hasVisited) {
      // first visit -> increment counter
      fetch("/api/visits", { method: "POST" });
      const expires = new Date();
      expires.setHours(expires.getHours() + 24);
      document.cookie = `visited=true; path=/; expires=${expires.toUTCString()}`;
    }
  }, []);

  useEffect(() => {
    const loadingInterval = setInterval(() => {
      setLoadingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(loadingInterval);
          setTimeout(() => setSceneLoaded(true), 300);
          setTimeout(() => setCurrentPhase("project"), 1000);
          return 100;
        }
        const increment = Math.random() * 15 + 5;
        return Math.min(prev + increment, 100);
      });
    }, 150);
    return () => clearInterval(loadingInterval);
  }, []);

  return (
    <main className="relative w-full h-screen bg-black text-white overflow-hidden">

      {mounted && (
        <Joyride
          steps={steps}
          run={runTour}
          continuous
          showSkipButton
          disableScrolling
          styles={{
            options: {zIndex: 10, arrowColor: "#111", backgroundColor: "#111", overlayColor: "rgba(0,0,0,0.6)", primaryColor: "#06b6d4", textColor: "#fff" },
            buttonNext: {backgroundColor: "#06b6d4", color: "#000", fontWeight: "bold" },
            buttonBack: {color: "#aaa" }
          }}
        />
      )}

      {/* 3D Background */}
      <motion.div
        className="absolute inset-0 w-full h-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: sceneLoaded ? 1 : 0 }}
        transition={{ duration: 2, ease: "easeInOut" }}
      >
        <EarthScene />
      </motion.div>

      {/* Overlay Content */}
      <section className="absolute inset-0 z-1 flex items-center justify-center px-4 md:px-16 pointer-events-none pt-20 md:pt-0">
        <AnimatePresence mode="wait">
          {currentPhase === "loading" && (
            <motion.div
              key="loading-screen"
              className="flex items-center justify-center w-full h-full"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
            >
              <LoadingScreen loadingProgress={loadingProgress} />
            </motion.div>
          )}

          {currentPhase === "project" && (
            <motion.div
              key="project-text"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="absolute inset-0 flex flex-col items-start md:items-start justify-center max-w-2xl w-full md:ml-auto md:mr-10 px-4 md:px-0 pointer-events-auto"
            >
              {/* Subtitle */}
              <motion.p
                className="text-sm md:text-base mb-2 text-gray-400 tracking-wide uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                Project
              </motion.p>

              {/* Title */}
              <motion.h1
                className="text-4xl sm:text-5xl md:text-8xl font-extrabold tracking-tight mb-4 leading-none"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.41 }}
              >
                <motion.span
                  className="text-cyan-400 drop-shadow-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5, duration: 0.4 }}
                >
                  IMPACT
                </motion.span>
              </motion.h1>

              {/* Description */}
              <motion.p
                className="text-gray-300 text-sm sm:text-base md:text-lg leading-relaxed mb-6 max-w-xl"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                Real-time asteroid simulator. Explore impacts, mitigation strategies, and test your defense skills.
              </motion.p>

              {/* Navigation Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="flex flex-col gap-3 w-full max-w-md"
              >
                <button
                  id="nav-impact"
                  className="px-6 py-4 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-cyan-400 font-medium rounded-lg backdrop-blur-sm pointer-events-auto text-sm sm:text-base min-h-[44px]"
                  onClick={() => window.location.href = '/meteors'}
                >
                  Impact Assessment
                </button>
                <button
                  id="nav-mitigation"
                  className="px-6 py-4 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-cyan-400 font-medium rounded-lg backdrop-blur-sm pointer-events-auto text-sm sm:text-base min-h-[44px]"
                  onClick={() => window.location.href = '/ai'}
                >
                  Mitigation Strategies
                </button>
                <button
                  id="nav-scenario"
                  className="px-6 py-4 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 hover:border-cyan-500/50 transition-all text-cyan-400 font-medium rounded-lg backdrop-blur-sm pointer-events-auto text-sm sm:text-base min-h-[44px]"
                  onClick={() => window.location.href = '/scenario'}
                >
                  Defense Scenario
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}