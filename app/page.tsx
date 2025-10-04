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
        content: "Apply your mitigation strategies in a full-fledged simulation with consequences"
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
      <section className="absolute inset-0 z-1 flex items-center justify-center px-4 md:px-16 pointer-events-none">
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
              className="absolute inset-0 flex flex-col items-start justify-center max-w-2xl ml-auto mr-10 pointer-events-auto"
            >
              {/* Subtitle */}
              <motion.p
                className="text-base md:text-lg mb-3 text-gray-400 tracking-wide uppercase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              >
                Project Near Earth Objects
              </motion.p>

              {/* Title */}
              <motion.h1
                className="text-6xl md:text-8xl font-extrabold tracking-tight mb-6 leading-none"
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
                  N
                </motion.span>
                <motion.span
                  className="text-cyan-300 drop-shadow-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6, duration: 0.4 }}
                >
                  E
                </motion.span>
                <motion.span
                  className="text-cyan-200 drop-shadow-lg"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7, duration: 0.4 }}
                >
                  O
                </motion.span>
              </motion.h1>

              {/* Description */}
              <motion.p
                className="text-gray-300 text-lg md:text-xl leading-relaxed mb-8"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6 }}
              >
                Project NEO is a real-time simulator that visualizes asteroids in 3D.  
                Explore how they move, interact, and what can be done to keep our planet safe.
              </motion.p>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.6 }}
                className="px-8 py-3 bg-gradient-to-r from-cyan-400 to-cyan-600 hover:shadow-xl hover:scale-105 transition-transform text-black font-semibold rounded-lg shadow-lg pointer-events-auto"
                onClick={() => {
                  setRunTour(false);
                  setTimeout(() => setRunTour(true), 0); // next tick
                }}
              >
                Explore the Data
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </main>
  );
}
