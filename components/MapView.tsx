"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useState, useMemo } from "react";
import { TEAMS } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

// teamId → flagcdn 2-letter cc
const TEAM_CC: Record<string, string> = {};
TEAMS.forEach((t) => { TEAM_CC[t.id] = t.cc; });

interface Props {
  onHover: (teamId: string | null) => void;
  onCountryClick: (teamId: string) => void;
}

export default function MapView({ onHover, onCountryClick }: Props) {
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  const numericToTeam = useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const [teamId, info] of Object.entries(COUNTRY_INFO)) {
      map[info.isoNumeric] = teamId;
    }
    return map;
  }, []);

  function getTeamForFeature(featureId: string | number): string | null {
    const numeric = parseInt(String(featureId), 10);
    if (isNaN(numeric)) return null;
    return numericToTeam[numeric] ?? null;
  }

  function handleMouseEnter(teamId: string) {
    setHoveredTeam(teamId);
    onHover(teamId);
  }

  function handleMouseLeave() {
    setHoveredTeam(null);
    onHover(null);
  }

  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 153 }}
        viewBox="0 0 800 450"
        style={{ width: "100%", height: "100%" }}
      >
        <defs>
          {Object.entries(TEAM_CC).map(([teamId, cc]) => (
            <pattern
              key={teamId}
              id={`flag-${teamId}`}
              patternUnits="objectBoundingBox"
              patternContentUnits="objectBoundingBox"
              width="1"
              height="1"
            >
              <image
                href={`https://flagcdn.com/w160/${cc}.png`}
                x="0"
                y="0"
                width="1"
                height="1"
                preserveAspectRatio="xMidYMid slice"
              />
            </pattern>
          ))}
        </defs>

        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const teamId = getTeamForFeature(geo.id);
              const isWC = teamId !== null;
              const isHovered = isWC && hoveredTeam === teamId;

              const fill = !isWC ? "#1e3a5f" : `url(#flag-${teamId})`;
              const stroke = isWC
                ? isHovered ? "#ffffff" : "rgba(255,255,255,0.3)"
                : "#0f2340";
              const strokeWidth = isHovered ? 1.5 : 0.5;

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={isWC ? () => handleMouseEnter(teamId!) : undefined}
                  onMouseLeave={isWC ? handleMouseLeave : undefined}
                  onClick={isWC ? () => onCountryClick(teamId!) : undefined}
                  cursor={isWC ? "pointer" : "default"}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>
    </div>
  );
}
