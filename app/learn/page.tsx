"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getTeam } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";
import { FlagIcon } from "@/components/FlagIcon";
import Link from "next/link";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = "globe" | "map";

export default function LearnPage() {
  const [view, setView] = useState<View>("globe");
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const router = useRouter();

  const handleHover = useCallback((teamId: string | null) => {
    setHoveredTeam(teamId);
  }, []);

  const handleClick = useCallback((teamId: string) => {
    router.push(`/learn/${teamId}`);
  }, [router]);

  const hovered = hoveredTeam ? getTeam(hoveredTeam) : null;
  const hoveredInfo = hoveredTeam ? COUNTRY_INFO[hoveredTeam] : null;

  return (
    <div className="min-h-screen bg-[#060d1a] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 z-10">
        <div className="flex items-center gap-3">
          <Link href="/bracket" className="text-green-400 hover:text-white text-sm transition-colors">
            ← Back to picks
          </Link>
          <span className="text-white/30">|</span>
          <h1 className="text-white font-bold">🌍 Explore the Teams</h1>
        </div>

        {/* Globe / Map toggle */}
        <div className="flex bg-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setView("globe")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "globe" ? "bg-green-500 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            🌐 Globe
          </button>
          <button
            onClick={() => setView("map")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              view === "map" ? "bg-green-500 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            🗺 Map
          </button>
        </div>
      </header>

      {/* Instruction hint */}
      <p className="text-center text-white/40 text-xs py-2">
        {view === "globe"
          ? "Rotate the globe · hover a green country · click to explore"
          : "Hover a green country · click to explore"}
      </p>

      {/* Main view */}
      <div className="flex-1 relative">
        {view === "globe" ? (
          <GlobeView onHover={handleHover} onCountryClick={handleClick} />
        ) : (
          <div className="h-full min-h-[70vh] flex items-center">
            <MapView onHover={handleHover} onCountryClick={handleClick} />
          </div>
        )}

        {/* Hover info panel */}
        {hovered && hoveredInfo && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="bg-[#0d1f35]/95 backdrop-blur border border-green-500/40 rounded-2xl px-5 py-4 shadow-2xl min-w-[260px] max-w-xs">
              <div className="flex items-center gap-3 mb-3">
                <FlagIcon cc={hovered.cc} name={hovered.name} className="w-10 h-7 rounded" />
                <div>
                  <div className="text-white font-bold text-lg leading-tight">{hovered.name}</div>
                  <div className="text-green-400 text-xs font-medium">Group {hovered.group} · {hoveredInfo.capital}</div>
                </div>
              </div>
              <p className="text-white/70 text-xs leading-relaxed line-clamp-3">
                {hoveredInfo.soccerHistory.split(".")[0]}.
              </p>
              <p className="text-green-400/70 text-xs mt-2">Click to learn more →</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
