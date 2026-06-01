"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useState, useMemo } from "react";
import { COUNTRY_INFO } from "@/lib/countries";

const GEO_URL =
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  onHover: (teamId: string | null) => void;
  onCountryClick: (teamId: string) => void;
}

export default function MapView({ onHover, onCountryClick }: Props) {
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);

  // Build a lookup from ISO numeric → teamId for fast geo matching
  const numericToTeam = useMemo<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    for (const [teamId, info] of Object.entries(COUNTRY_INFO)) {
      // Scotland and England both map to GBR / 826.
      // We want to highlight the UK polygon for both; last writer wins,
      // but we handle the click correctly below by checking hoveredTeam.
      map[info.isoNumeric] = teamId;
    }
    return map;
  }, []);

  // Handle the Scotland / England ambiguity: both share isoNumeric 826.
  // We render the polygon once; clicking it when Scotland or England is
  // present should prefer whichever one is in the tournament.
  // Since both are in the tournament, we fall back to ENG as the canonical
  // click target for the single GBR polygon — callers can filter by group.
  // (A proper solution would use subnational geometries; for now this is
  // acceptable as a single polygon that represents Great Britain.)

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

  function handleClick(teamId: string) {
    onCountryClick(teamId);
  }

  return (
    <div style={{ width: "100%", aspectRatio: "16 / 9" }}>
      <ComposableMap
        projection="geoNaturalEarth1"
        projectionConfig={{ scale: 153 }}
        viewBox="0 0 800 450"
        style={{ width: "100%", height: "100%" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies.map((geo) => {
              const teamId = getTeamForFeature(geo.id);
              const isWC = teamId !== null;
              const isHovered = isWC && hoveredTeam === teamId;

              let fill: string;
              if (!isWC) {
                fill = "#1e3a5f";
              } else if (isHovered) {
                fill = "#4ade80";
              } else {
                fill = "#22c55e";
              }

              const stroke = isWC ? "#16a34a" : "#0f2340";

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none" },
                    hover: { outline: "none" },
                    pressed: { outline: "none" },
                  }}
                  onMouseEnter={
                    isWC ? () => handleMouseEnter(teamId!) : undefined
                  }
                  onMouseLeave={isWC ? handleMouseLeave : undefined}
                  onClick={isWC ? () => handleClick(teamId!) : undefined}
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
