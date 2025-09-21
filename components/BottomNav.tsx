// components/BottomNav.tsx
"use client";

import Link from "next/link";
import { useState } from "react";

export default function BottomNav() {
  const [isNavExpanded, setIsNavExpanded] = useState(true);
  const toggleNav = () => setIsNavExpanded((s) => !s);

  return (
    <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div
        className={`flex items-center justify-center transition-all duration-500 ease-in-out px-2 py-1 bg-white/10 backdrop-blur-md border border-white/20 rounded-full ${
          isNavExpanded ? "space-x-2" : "space-x-0"
        }`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleNav}
          className="flex flex-col items-center justify-center p-3 rounded-full hover:bg-white/20 transition-all duration-300 group relative z-10"
          aria-label={isNavExpanded ? "Minimize navigation" : "Expand navigation"}
        >
          <svg
            className={`w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-all duration-500 ${
              isNavExpanded ? "rotate-0" : "rotate-180"
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
            className={`text-xs text-white/80 group-hover:text-white transition-all duration-300 font-light ${
              isNavExpanded ? "opacity-100" : "opacity-0 w-0 h-0 overflow-hidden"
            }`}
          >
            {isNavExpanded ? "Hide" : "Show"}
          </span>
        </button>

        {/* Links */}
        <div
          className={`flex items-center transition-all duration-500 ease-in-out overflow-hidden ${
            isNavExpanded ? "max-w-full opacity-100 space-x-2" : "max-w-0 opacity-0 space-x-0"
          }`}
        >
          {/* Home */}
          <Link
            href="/"
            className="flex flex-col items-center justify-center p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap"
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
            <span id="nave-home" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light">
              Home
            </span>
          </Link>

          {/* Impact */}
          <Link
            href="/meteors"
            className="flex flex-col items-center justify-center p-3 rounded-full hover:bg白/20 transition-all duration-300 group whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m8 12 2 2 4-4" />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 2l2 3h3l-2 4 2 4h-3l-2 3-2-3H7l2-4-2-4h3l2-3z"
              />
            </svg>
            <span id="nav-impact" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light">
              Impact
            </span>
          </Link>

          {/* Defense */}
          <Link
            href="/ai"
            className="flex flex-col items-center justify-center p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap"
          >
            <svg
              className="w-5 h-5 mb-1 text-white/80 group-hover:text-white transition-colors duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span id="nav-mitigation" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light">
              Mitigation
            </span>
          </Link>

          {/* Scenario */}
          <Link
            href="/scenario"
            className="flex flex-col items-center justify-center p-3 rounded-full hover:bg-white/20 transition-all duration-300 group whitespace-nowrap"
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
            <span id="nav-scenario" className="text-xs text-white/80 group-hover:text-white transition-colors duration-300 font-light">
              Scenario
            </span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
