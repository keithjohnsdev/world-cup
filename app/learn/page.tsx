"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getTeam } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";
import { FlagIcon } from "@/components/FlagIcon";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import Link from "next/link";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = "globe" | "map";

export default function LearnPage() {
  const [view, setView] = useState<View>("globe");
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const router = useRouter();

  const handleHover = useCallback((teamId: string | null) => setHoveredTeam(teamId), []);
  const handleClick = useCallback((teamId: string) => router.push(`/learn/${teamId}`), [router]);

  const hovered = hoveredTeam ? getTeam(hoveredTeam) : null;
  const hoveredInfo = hoveredTeam ? COUNTRY_INFO[hoveredTeam] : null;

  return (
    <div className="h-screen bg-surface-deep flex flex-col overflow-hidden">
      <NavHeader
        variant="dark"
        left={
          <>
            <Link href="/bracket">
              <Button variant="ghost" size="sm">← Back to picks</Button>
            </Link>
            <span className="text-white/30">|</span>
            <h1 className="text-white font-bold">🌍 Explore the Teams</h1>
          </>
        }
        right={
          <div className="flex bg-white/10 rounded-xl p-1 gap-1">
            <Button
              variant={view === "globe" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setView("globe")}
            >
              🌐 Globe
            </Button>
            <Button
              variant={view === "map" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setView("map")}
            >
              🗺 Map
            </Button>
          </div>
        }
      />

      <div className="flex-1 relative min-h-0">
        {/* Hint overlay — floats above the globe, takes no layout space */}
        <p className="absolute top-2 left-1/2 -translate-x-1/2 z-10 text-white/40 text-xs pointer-events-none whitespace-nowrap">
          {view === "globe"
            ? "Rotate the globe · hover a green country · click to explore"
            : "Hover a green country · click to explore"}
        </p>

        {view === "globe" ? (
          <GlobeView onHover={handleHover} onCountryClick={handleClick} />
        ) : (
          <div className="h-full flex items-center">
            <MapView onHover={handleHover} onCountryClick={handleClick} />
          </div>
        )}

        {hovered && hoveredInfo && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <Card variant="dark" className="px-5 py-4 min-w-[260px] max-w-xs">
              <div className="flex items-center gap-3 mb-3">
                <FlagIcon cc={hovered.cc} name={hovered.name} className="w-10 h-7 rounded" />
                <div>
                  <div className="text-white font-bold text-lg leading-tight">{hovered.name}</div>
                  <div className="text-brand-400 text-xs font-medium">Group {hovered.group} · {hoveredInfo.capital}</div>
                </div>
              </div>
              <p className="text-white/70 text-xs leading-relaxed line-clamp-3">
                {hoveredInfo.soccerHistory.split(".")[0]}.
              </p>
              <p className="text-brand-400/70 text-xs mt-2">Click to learn more →</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
