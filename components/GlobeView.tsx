"use client";

import { useEffect, useRef, useState } from "react";
import { TEAMS } from "@/lib/data";

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

// GeoJSON ISO-A3 → flagcdn 2-letter country code
const ISO_TO_CC: Record<string, string> = (() => {
  const byId: Record<string, string> = {};
  TEAMS.forEach((t) => { byId[t.id] = t.cc; });
  const out: Record<string, string> = {};
  Object.entries(WC_ISO).forEach(([geoIso, teamId]) => {
    if (byId[teamId]) out[geoIso] = byId[teamId];
  });
  return out;
})();

// MeshBasicMaterial.color multiplies the texture: gray dims, white = full brightness
const TINT_NORMAL = 0xcccccc;
const TINT_HOVER  = 0xffffff;

function getIso(feature: unknown): string {
  const f = feature as { id?: unknown; properties?: Record<string, string> };
  if (f.id) return String(f.id);
  return f.properties?.ISO_A3 || f.properties?.iso_a3 || "";
}

// Returns a unit vector pointing from Earth toward the real Sun right now.
// Uses solar declination (axial tilt effect) + sub-solar longitude (time of day).
function getSunDirection(): { x: number; y: number; z: number } {
  const now = new Date();
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  const dayOfYear = Math.floor(
    (now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000
  ) + 1;
  // Solar declination: Earth's axial tilt puts the sub-solar latitude between ±23.45°
  const decl = -23.45 * Math.cos(((2 * Math.PI) / 365) * (dayOfYear + 10)) * (Math.PI / 180);
  // Sub-solar longitude: solar noon at prime meridian = UTC 12:00; 15°/hour westward
  const lon = (12 - utcH) * 15 * (Math.PI / 180);
  return {
    x: Math.cos(decl) * Math.sin(lon),
    y: Math.sin(decl),
    z: Math.cos(decl) * Math.cos(lon),
  };
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
  const [, setTextureVersion] = useState(0);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materialCache = useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nonWcMaterial = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sunRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nightOverlayRef = useRef<any>(null);

  // Update sun direction every minute — moves both the light and the night overlay shader
  useEffect(() => {
    const tick = () => {
      const { x, y, z } = getSunDirection();
      if (sunRef.current) sunRef.current.position.set(x * 5, y * 5, z * 5);
      if (nightOverlayRef.current) {
        nightOverlayRef.current.material.uniforms.sunDir.value.set(x, y, z);
      }
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // Observe wrapper size
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) setDimensions({ width, height });
      }
    });
    ro.observe(el);
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) setDimensions({ width, height });
    return () => ro.disconnect();
  }, []);

  // Fetch GeoJSON
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) { setCountries(data.features ?? []); setLoading(false); }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Pre-load all WC flag textures once GeoJSON is ready
  useEffect(() => {
    if (loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { TextureLoader, MeshBasicMaterial } = require("three");
    Object.entries(ISO_TO_CC).forEach(([geoIso, cc]) => {
      if (materialCache.current[geoIso]) return;
      const loader = new TextureLoader();
      loader.crossOrigin = "anonymous";
      const texture = loader.load(
        `https://flagcdn.com/w320/${cc}.png`,
        () => setTextureVersion((v) => v + 1)
      );
      materialCache.current[geoIso] = new MeshBasicMaterial({
        map: texture,
        color: TINT_NORMAL,
      });
    });
  }, [loading]);

  // Update material tint + render order whenever hover changes
  useEffect(() => {
    const hoveredMat = hoveredIso ? materialCache.current[hoveredIso] : null;
    const wcMats = new Set(Object.values(materialCache.current));

    Object.entries(materialCache.current).forEach(([iso, mat]) => {
      if (!mat?.color) return;
      mat.color.setHex(iso === hoveredIso ? TINT_HOVER : TINT_NORMAL);
      mat.depthTest = iso !== hoveredIso;
      mat.needsUpdate = true;
    });

    // Push hovered polygon above the night overlay (renderOrder 10) so it cuts through
    if (globeRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      globeRef.current.scene().traverse((obj: any) => {
        if (!obj.isMesh || !wcMats.has(obj.material)) return;
        obj.renderOrder = obj.material === hoveredMat ? 15 : 0;
      });
    }
  }, [hoveredIso]);

  const handlePolygonHover = (feature: unknown) => {
    if (!feature) { setHoveredIso(null); onHover(null); return; }
    const iso = getIso(feature);
    setHoveredIso(iso);
    onHover(WC_ISO[iso] ?? null);
  };

  const handlePolygonClick = (feature: unknown) => {
    const iso = getIso(feature);
    const teamId = WC_ISO[iso];
    if (teamId) onCountryClick(teamId);
  };

  const getPolygonCapMaterial = (feature: unknown) => {
    const iso = getIso(feature);
    if (!WC_ISO[iso]) {
      if (!nonWcMaterial.current) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { MeshBasicMaterial } = require("three");
        nonWcMaterial.current = new MeshBasicMaterial({
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
      }
      return nonWcMaterial.current;
    }
    return materialCache.current[iso] ?? "#22c55e";
  };

  return (
    <div ref={wrapperRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      {loading && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10, backgroundColor: "rgba(0,0,0,0.4)" }}>
          <div style={{ width: 48, height: 48, border: "4px solid #22c55e", borderTopColor: "transparent", borderRadius: "50%", animation: "globe-spin 0.8s linear infinite" }} />
          <style>{`@keyframes globe-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {!loading && (
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          polygonsData={countries}
          polygonAltitude={0.01}
          polygonCapMaterial={getPolygonCapMaterial}
          polygonSideColor={() => "rgba(0,0,0,0)"}
          polygonStrokeColor={(feature: unknown) => {
            const iso = getIso(feature);
            if (!WC_ISO[iso]) return "#1a2744";
            return iso === hoveredIso ? "#ffffff" : "#cccccc";
          }}
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
          atmosphereColor="#82c8ff"
          atmosphereAltitude={0.18}
          animateIn={true}
          enablePointerInteraction={true}
          onGlobeReady={() => {
            if (!globeRef.current) return;

            const controls = globeRef.current.controls();
            controls.autoRotate = true;
            controls.autoRotateSpeed = 0.4;

            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const THREE = require("three");
            const scene = globeRef.current.scene();

            // Restore ambient so the day side looks natural
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            scene.traverse((obj: any) => {
              if (obj.isAmbientLight) obj.intensity = 0.7;
            });

            // Sun light for the directional shading pass
            const dir = getSunDirection();
            const sun = new THREE.DirectionalLight(0xfff8e7, 1.4);
            sun.name = "sun";
            sun.position.set(dir.x * 5, dir.y * 5, dir.z * 5);
            scene.add(sun);
            sunRef.current = sun;

            // Night overlay — sphere slightly larger than globe.
            // Camera orbits (globe stays fixed in world space), so a world-space
            // overlay aligns correctly with geography without needing globe's rotation.
            // depthTest:false bypasses the atmosphere sphere's depth writes.
            const GLOBE_R = 100;
            const nightMat = new THREE.ShaderMaterial({
              uniforms: { sunDir: { value: new THREE.Vector3(dir.x, dir.y, dir.z) } },
              vertexShader: `
                varying vec3 vDir;
                void main() {
                  // World-space direction from globe center to this vertex.
                  // For a sphere at the origin this equals the world-space surface normal.
                  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `,
              fragmentShader: `
                uniform vec3 sunDir;
                varying vec3 vDir;
                void main() {
                  float d = dot(vDir, normalize(sunDir));
                  float t = smoothstep(0.06, -0.06, d);
                  gl_FragColor = vec4(0.0, 0.01, 0.06, t * 0.55);
                }
              `,
              transparent: true,
              depthTest: false,   // atmosphere writes depth first; skip the test
              depthWrite: false,
              side: THREE.FrontSide,
            });
            const nightMesh = new THREE.Mesh(
              new THREE.SphereGeometry(GLOBE_R * 1.001, 64, 64),
              nightMat
            );
            nightMesh.renderOrder = 10; // draw after globe + atmosphere
            scene.add(nightMesh);       // scene root — globe doesn't rotate, camera does
            nightOverlayRef.current = nightMesh;
          }}
        />
      )}
    </div>
  );
}
