"use client";

import { useEffect, useRef, useState } from "react";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Globe = require("react-globe.gl").default;

const WC_ISO: Record<string, string> = {
  MEX: "MEX", ZAF: "RSA", KOR: "KOR", CZE: "CZE",
  CAN: "CAN", BIH: "BIH", QAT: "QAT", CHE: "SUI",
  BRA: "BRA", MAR: "MAR", HTI: "HAI", GBR: "ENG",
  USA: "USA", PRY: "PAR", AUS: "AUS", TUR: "TUR",
  DEU: "GER", CIV: "CIV", ECU: "ECU", CUW: "CUW",
  NLD: "NED", JPN: "JPN", SWE: "SWE", TUN: "TUN",
  BEL: "BEL", EGY: "EGY", IRN: "IRN", NZL: "NZL",
  ESP: "ESP", CPV: "CPV", SAU: "KSA", URY: "URU",
  FRA: "FRA", SEN: "SEN", IRQ: "IRQ", NOR: "NOR",
  ARG: "ARG", DZA: "ALG", AUT: "AUT", JOR: "JOR",
  PRT: "POR", COD: "COD", UZB: "UZB", COL: "COL",
  HRV: "CRO", GHA: "GHA", PAN: "PAN",
};

function getIso(feature: unknown): string {
  const f = feature as { id?: unknown; properties?: Record<string, string> };
  if (f.id) return String(f.id);
  return f.properties?.ISO_A3 || f.properties?.iso_a3 || "";
}

interface Props {
  onHover: (teamId: string | null) => void;
  onCountryClick: (teamId: string) => void;
}

interface GeoFeature {
  id?: unknown;
  properties?: Record<string, string>;
}

export default function GlobeView({ onHover, onCountryClick }: Props) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const globeRef = useRef<any>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [countries, setCountries] = useState<GeoFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIso, setHoveredIso] = useState<string | null>(null);

  // Observe wrapper size
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setDimensions({ width, height });
        }
      }
    });

    ro.observe(el);

    // Set initial size
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setDimensions({ width, height });
    }

    return () => ro.disconnect();
  }, []);

  // Fetch GeoJSON
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(
      "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
    )
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setCountries(data.features ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handlePolygonHover = (feature: unknown) => {
    if (!feature) {
      setHoveredIso(null);
      onHover(null);
      return;
    }
    const iso = getIso(feature);
    setHoveredIso(iso);
    const teamId = WC_ISO[iso] ?? null;
    onHover(teamId);
  };

  const handlePolygonClick = (feature: unknown) => {
    const iso = getIso(feature);
    const teamId = WC_ISO[iso];
    if (teamId) {
      onCountryClick(teamId);
    }
  };

  const getPolygonColor = (feature: unknown) => {
    const iso = getIso(feature);
    if (!WC_ISO[iso]) return "#1e3a5f";
    return iso === hoveredIso ? "#bbf7d0" : "#22c55e";
  };

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            backgroundColor: "rgba(0,0,0,0.4)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              border: "4px solid #22c55e",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "globe-spin 0.8s linear infinite",
            }}
          />
          <style>{`
            @keyframes globe-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}

      {!loading && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          polygonsData={countries}
          polygonAltitude={0.01}
          polygonCapColor={getPolygonColor}
          polygonSideColor={() => "#0f1f35"}
          polygonStrokeColor={() => "#0f1f35"}
          polygonLabel={(feature: unknown) => {
            const iso = getIso(feature);
            const teamId = WC_ISO[iso];
            const f = feature as { properties?: Record<string, string> };
            const name = f.properties?.name || iso;
            return teamId
              ? `<span style="background:#22c55e;color:#000;padding:2px 6px;border-radius:4px;font-weight:bold;">${name}</span>`
              : `<span style="color:#ccc;">${name}</span>`;
          }}
          onPolygonHover={handlePolygonHover}
          onPolygonClick={handlePolygonClick}
          polygonsTransitionDuration={200}
          atmosphereColor="#1e3a5f"
          atmosphereAltitude={0.15}
          animateIn={true}
          enablePointerInteraction={true}
          onGlobeReady={() => {
            if (globeRef.current) {
              const controls = globeRef.current.controls();
              controls.autoRotate = true;
              controls.autoRotateSpeed = 0.4;
            }
          }}
        />
      )}
    </div>
  );
}
