"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { GROUPS, getTeam } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";
import { FlagIcon } from "@/components/FlagIcon";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const GlobeView = dynamic(() => import("@/components/GlobeView"), { ssr: false });
const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

type View = "globe" | "map";
type Picks = Record<string, string>;

export default function LearnPage() {
  const [view, setView] = useState<View>("globe");
  const [hoveredTeam, setHoveredTeam] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    setUserName(localStorage.getItem("wc_name") || "");
    if (!token) return;
    fetch("/api/picks", { headers: { "x-session-token": token } })
      .then((r) => r.json())
      .then((data: { stage: string; slot: string; team_id: string }[]) => {
        if (Array.isArray(data)) {
          const loaded: Picks = {};
          data.forEach(({ stage, slot, team_id }) => { loaded[`${stage}:${slot}`] = team_id; });
          setPicks(loaded);
        }
      })
      .catch(() => {});
  }, []);

  function signOut() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_name");
    router.replace("/");
  }

  const handleHover = useCallback((teamId: string | null) => setHoveredTeam(teamId), []);
  const handleClick = useCallback((teamId: string) => router.push(`/learn/${teamId}`), [router]);

  const hovered = hoveredTeam ? getTeam(hoveredTeam) : null;
  const hoveredInfo = hoveredTeam ? COUNTRY_INFO[hoveredTeam] : null;
  const groupPickCount = GROUPS.filter((g) => picks[`group:${g.id}`]).length;

  return (
    <div className="h-screen bg-surface-deep flex flex-col overflow-hidden">
      <NavHeader
        className="border-b border-white/10"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
        left={
          <div className="select-none">
            <div className="leading-none">
              <span className="font-black text-white uppercase tracking-tight text-sm">Brotherinos </span>
              <span className="font-black text-amber-400 uppercase tracking-tight text-sm">World Cup</span>
            </div>
            <div className="text-green-600 text-[10px] font-black uppercase tracking-[0.2em] mt-0.5">2026</div>
          </div>
        }
        center={
          <div className="flex h-full">
            {(["rules", "groups", "bracket"] as const).map((t) => (
              <a
                key={t}
                href={`/bracket?tab=${t}`}
                className="relative flex items-center h-full px-4 text-xs font-black uppercase tracking-[0.15em] whitespace-nowrap text-slate-200 transition-all"
                onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.color = "#ffffff"; el.style.textShadow = "0 0 10px rgba(255,255,255,0.5)"; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.color = ""; el.style.textShadow = ""; }}
              >
                {t === "groups" ? "Phase 1 - Groups" : t === "bracket" ? "Phase 2 - Bracket" : "The Rules"}
                <span className="absolute bottom-[-1px] inset-x-0 h-[2px]" />
              </a>
            ))}
            <span className="relative flex items-center h-full px-4 text-xs font-black uppercase tracking-[0.15em] whitespace-nowrap text-yellow-300 cursor-default">
              🌍 The World
              <span className="absolute bottom-[-1px] inset-x-0 h-[2px] bg-yellow-300" />
            </span>
          </div>
        }
        right={
          <>
            {userName && <span className="text-green-400 text-sm font-medium hidden sm:inline">{userName}</span>}
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </>
        }
      />

      <div className="flex-1 relative min-h-0">
        {/* Globe / Map toggle */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 rounded-full bg-black/30 p-1 backdrop-blur-sm">
          {(["globe", "map"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-[0.12em] transition-all ${
                view === v ? "bg-yellow-300 text-green-950" : "text-white/60 hover:text-white"
              }`}
            >
              {v === "globe" ? "🌐 Globe" : "🗺 Map"}
            </button>
          ))}
        </div>

        {/* Hint */}
        <p className="absolute top-12 left-1/2 -translate-x-1/2 z-10 text-white/40 text-xs pointer-events-none whitespace-nowrap">
          {view === "globe"
            ? "Rotate the globe · hover a country · click to explore"
            : "Hover a country · click to explore"}
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
