"use client";

import Link from "next/link";
import { useState, useEffect } from "react";

export default function BottomNav() {
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const [mounted, setMounted] = useState(false);
  const toggleNav = () => setIsNavExpanded((s) => !s);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return (
    <nav className="fixed top-4 md:top-4 bottom-auto md:bottom-auto left-1/2 -translate-x-1/2 z-[100] pointer-events-auto">
      <div
        className={`flex items-center justify-center transition-all duration-500 ease-in-out bg-white/10 backdrop-blur-md border border-white/20 rounded-full
          ${isNavExpanded ? "space-x-2 px-3 py-1" : "space-x-0 px-1 py-0"}`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleNav}
          className="flex flex-col items-center justify-center p-2 md:p-3 rounded-full hover:bg-white/20 transition-all duration-300 group relative z-10 min-h-[44px] min-w-[44px]"
          aria-label={isNavExpanded ? "Minimize navigation" : "Expand navigation"}
        >
          <svg
            className={`w-5 h-5 mb-0.5 text-white/80 group-hover:text-white transition-all duration-500 ${isNavExpanded ? "rotate-0" : "rotate-180"
              }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d={isNavExpanded ? "M19 9l-7 7-7-7" : "M5 15l7-7 7 7"}
            />
          </svg>
          <span
            className={`text-xs text-white/80 group-hover:text-white transition-all duration-300 font-light ${isNavExpanded ? "opacity-100" : "opacity-0 w-0 h-0 overflow-hidden"
              }`}
          >
            {isNavExpanded ? "Hide" : "Show"}
          </span>
        </button>

        {/* Links */}
        <div
          className={`flex items-center transition-all duration-500 ease-in-out overflow-hidden ${isNavExpanded ? "max-w-full opacity-100 space-x-2" : "max-w-0 opacity-0 space-x-0"
            }`}
        >
          {/* Home */}
          <Link
            href="/"
            className="flex flex-col items-center justify-center p-2 md:p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap min-h-[44px] min-w-[44px]"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="m3 12 2-2m0 0 7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light hidden md:block">
              Home
            </span>
          </Link>

          {/* Impact */}
          <Link
            href="/meteors"
            className="flex flex-col items-center justify-center p-2 md:p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap min-h-[44px] min-w-[44px]"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m8 12 2 2 4-4" />
            </svg>
            <span id="nav-impact" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light hidden md:block">
              Impact
            </span>
          </Link>

          {/* Defense */}
          <Link
            href="/ai"
            className="flex flex-col items-center justify-center p-2 md:p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap min-h-[44px] min-w-[44px]"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span id="nav-mitigation" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light hidden md:block">
              Mitigation
            </span>
          </Link>

          {/* Scenario */}
          <Link
            href="/scenario"
            className="flex flex-col items-center justify-center p-2 md:p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap min-h-[44px] min-w-[44px]"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
            </svg>
            <span id="nav-scenario" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light hidden md:block">
              Scenario
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
