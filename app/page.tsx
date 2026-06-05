"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/data";

// "Let's go!" in the native language of every WC 2026 nation
const PHRASES: { teamId: string; text: string }[] = [
  { teamId: "MEX", text: "¡Ándale!" },     // Mexican Spanish
  { teamId: "RSA", text: "Asihambe!" },    // Zulu
  { teamId: "KOR", text: "Gaja!" },        // Korean
  { teamId: "CZE", text: "Jdeme!" },       // Czech
  { teamId: "CAN", text: "Allons-y!" },    // Canadian French
  { teamId: "BIH", text: "Hajde!" },       // Bosnian
  { teamId: "QAT", text: "Yalla!" },       // Arabic
  { teamId: "SUI", text: "Hopp!" },        // Swiss German
  { teamId: "BRA", text: "Vai!" },         // Brazilian Portuguese
  { teamId: "MAR", text: "Yalla!" },       // Moroccan Darija
  { teamId: "HAI", text: "Alé!" },         // Haitian Creole
  { teamId: "SCO", text: "C'mon!" },       // Scots English
  { teamId: "USA", text: "Let's Go!" },
  { teamId: "PAR", text: "¡Vamos!" },
  { teamId: "AUS", text: "C'mon Aussie!" },
  { teamId: "TUR", text: "Hadi!" },        // Turkish
  { teamId: "GER", text: "Los geht's!" },  // German
  { teamId: "CUW", text: "Bai!" },         // Papiamentu
  { teamId: "CIV", text: "Allez!" },       // French
  { teamId: "ECU", text: "¡Dale!" },       // Ecuadorian slang
  { teamId: "NED", text: "Kom op!" },      // Dutch
  { teamId: "JPN", text: "Ikuzo!" },       // Japanese
  { teamId: "SWE", text: "Kom igen!" },    // Swedish
  { teamId: "TUN", text: "Yalla!" },
  { teamId: "BEL", text: "Allez!" },
  { teamId: "EGY", text: "Yalla!" },
  { teamId: "IRN", text: "Berim!" },       // Persian
  { teamId: "NZL", text: "Kia kaha!" },    // Māori
  { teamId: "ESP", text: "¡Vamos!" },
  { teamId: "CPV", text: "Bai!" },         // Cape Verdean Creole
  { teamId: "KSA", text: "Yalla!" },
  { teamId: "URU", text: "¡Vamos!" },
  { teamId: "FRA", text: "Allez!" },
  { teamId: "SEN", text: "Dem na!" },      // Wolof
  { teamId: "IRQ", text: "Yalla!" },
  { teamId: "NOR", text: "Kom igjen!" },   // Norwegian
  { teamId: "ARG", text: "¡Vamos!" },
  { teamId: "ALG", text: "Yalla!" },
  { teamId: "AUT", text: "Los geht's!" },
  { teamId: "JOR", text: "Yalla!" },
  { teamId: "POR", text: "Vai!" },
  { teamId: "COD", text: "Tokende!" },     // Lingala
  { teamId: "UZB", text: "Ketdik!" },      // Uzbek
  { teamId: "COL", text: "¡Vamos!" },
  { teamId: "ENG", text: "Let's Go!" },
  { teamId: "CRO", text: "Hajdemo!" },     // Croatian
  { teamId: "GHA", text: "Kɔ!" },          // Twi
  { teamId: "PAN", text: "¡Vamos!" },
];

const INTERVAL_MS = 3000;
const RING_MS = 140_000; // ms per full rotation
const RADIUS = 355;
const FLAG_W = 52;
const FLAG_H = 36;
const SIZE = RADIUS * 2 + 150;

export default function Home() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [hoveredTeamId, setHoveredTeamId] = useState<string | null>(null);
  const router = useRouter();

  // One ref per flag — RAF writes translate() directly, no React re-renders
  const flagRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hoveredRef = useRef<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let rafId: number;
    let prev: number | undefined;
    let angle = 0; // degrees

    function tick(ts: number) {
      if (prev !== undefined && !hoveredRef.current) angle = (angle + ((ts - prev) / RING_MS) * 360) % 360;
      prev = ts;

      const cx = SIZE / 2;
      const cy = SIZE / 2;
      TEAMS.forEach((_, i) => {
        const el = flagRefs.current[i];
        if (!el) return;
        const baseDeg = (i / TEAMS.length) * 360 - 90;
        const rad = ((baseDeg + angle) * Math.PI) / 180;
        const x = Math.cos(rad) * RADIUS;
        const y = Math.sin(rad) * RADIUS;
        el.style.transform = `translate(${cx + x - FLAG_W / 2}px, ${cy + y - FLAG_H / 2}px)`;
      });

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const canvas: HTMLCanvasElement = canvasEl;
    const ctx = canvas.getContext("2d")!;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    const COLORS = ["#fbbf24","#fde047","#f97316","#ef4444","#f87171","#60a5fa","#93c5fd","#4ade80","#e879f9","#ffffff","#fef3c7"];

    type Particle = { x: number; y: number; vx: number; vy: number; alpha: number; decay: number; color: string; size: number };
    type Rocket   = { x: number; y: number; vx: number; vy: number; color: string; targetY: number };
    type Burst    = { particles: Particle[] };

    const rockets: Rocket[] = [];
    const bursts: Burst[] = [];

    function spawnRocket() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      rockets.push({ x: Math.random() * canvas.width, y: canvas.height, vx: (Math.random() - 0.5) * 2, vy: -(Math.random() * 6 + 8), color, targetY: canvas.height * (0.15 + Math.random() * 0.45) });
    }

    function explode(x: number, y: number, color: string) {
      const count = 55 + Math.floor(Math.random() * 25);
      const particles: Particle[] = [];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = Math.random() * 4 + 1;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, alpha: 1, decay: Math.random() * 0.015 + 0.008, color, size: Math.random() * 2.2 + 0.8 });
      }
      bursts.push({ particles });
    }

    let lastSpawn = 0;
    let fwRafId: number;

    function draw(ts: number) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (ts - lastSpawn > 1200 + Math.random() * 1000) { spawnRocket(); lastSpawn = ts; }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx; r.y += r.vy; r.vy += 0.15;
        ctx.beginPath(); ctx.arc(r.x, r.y, 2, 0, Math.PI * 2); ctx.fillStyle = r.color; ctx.fill();
        if (r.y <= r.targetY || r.vy >= 0) { explode(r.x, r.y, r.color); rockets.splice(i, 1); }
      }

      for (let i = bursts.length - 1; i >= 0; i--) {
        const burst = bursts[i];
        for (let j = burst.particles.length - 1; j >= 0; j--) {
          const p = burst.particles[j];
          p.x += p.vx; p.y += p.vy; p.vy += 0.07; p.vx *= 0.98; p.alpha -= p.decay;
          if (p.alpha <= 0) { burst.particles.splice(j, 1); continue; }
          ctx.globalAlpha = p.alpha;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
        }
        if (burst.particles.length === 0) bursts.splice(i, 1);
      }
      ctx.globalAlpha = 1;
      fwRafId = requestAnimationFrame(draw);
    }

    fwRafId = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(fwRafId); window.removeEventListener("resize", resize); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => {
      let next: number;
      do { next = Math.floor(Math.random() * PHRASES.length); } while (next === i);
      return next;
    }), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && localStorage.getItem("wc_token")) {
      router.replace("/bracket");
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to sign up");
      }
      const data = await res.json();
      localStorage.setItem("wc_token", data.session_token);
      localStorage.setItem("wc_name", data.name);
      router.push(data.is_new ? "/bracket" : "/bracket?tab=groups");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const currentPhrase = PHRASES[phraseIdx];
  const currentTeam = TEAMS.find((t) => t.id === currentPhrase.teamId);

  return (
    <>
      <div style={{ position: "fixed", inset: 0, background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }} />
      <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 1 }} />
      <main
        className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
        style={{ position: "relative", zIndex: 2 }}
      >
      <style>{`
        @keyframes slot-tick {
          0%   { transform: translateY(110%); opacity: 0; }
          10%  { transform: translateY(0);    opacity: 1; }
          88%  { transform: translateY(0);    opacity: 1; }
          100% { transform: translateY(-110%); opacity: 0; }
        }
        @keyframes bubble-pop {
          0%   { transform: translateX(-50%) scale(0.5); opacity: 0; }
          10%  { transform: translateX(-50%) scale(1.08); opacity: 1; }
          16%  { transform: translateX(-50%) scale(1);   opacity: 1; }
          84%  { transform: translateX(-50%) scale(1);   opacity: 1; }
          100% { transform: translateX(-50%) scale(0.8); opacity: 0; }
        }
        @keyframes hover-bubble-pop {
          0%   { transform: translateX(-50%) scale(0.5); opacity: 0; }
          60%  { transform: translateX(-50%) scale(1.08); opacity: 1; }
          100% { transform: translateX(-50%) scale(1);   opacity: 1; }
        }
      `}</style>

      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(22,163,74,0.14) 0%, transparent 70%)" }}
      />

      {/* Outer sizing box */}
      <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0, zIndex: 2 }}>

        {/* Flags — RAF moves each one independently, no CSS rotation */}
        {TEAMS.map((team, i) => {
            const isHovered = team.id === hoveredTeamId;
            const isRotatingActive = team.id === currentPhrase.teamId;
            const isActive = isHovered || isRotatingActive;
            const teamPhrase = PHRASES.find(p => p.teamId === team.id);

            const bubbleStyle: React.CSSProperties = {
              position: "absolute",
              bottom: "calc(100% + 10px)",
              left: "50%",
              background: "white",
              color: "#111",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.03em",
              padding: "3px 8px",
              borderRadius: 6,
              whiteSpace: "nowrap",
              pointerEvents: "none",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            };
            const caretStyle: React.CSSProperties = {
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid white",
            };

            return (
              <div
                key={team.id}
                ref={(el) => { flagRefs.current[i] = el; }}
                onMouseEnter={() => { hoveredRef.current = team.id; setHoveredTeamId(team.id); }}
                onMouseLeave={() => { hoveredRef.current = null; setHoveredTeamId(null); }}
                style={{
                  position: "absolute",
                  width: FLAG_W,
                  height: FLAG_H,
                  zIndex: isActive ? 2 : 1,
                  cursor: teamPhrase ? "pointer" : "default",
                }}
              >
                {/* Hover bubble — pops in and stays visible while hovered */}
                {isHovered && teamPhrase && (
                  <div key={`hover-${team.id}`} style={{ ...bubbleStyle, animation: "hover-bubble-pop 300ms cubic-bezier(0.34,1.56,0.64,1) both" }}>
                    {teamPhrase.text}
                    <span style={caretStyle} />
                  </div>
                )}

                {/* Rotating-active bubble — suppressed while anything is hovered */}
                {isRotatingActive && !hoveredTeamId && (
                  <div key={phraseIdx} style={{ ...bubbleStyle, animation: `bubble-pop ${INTERVAL_MS}ms ease both` }}>
                    {currentPhrase.text}
                    <span style={caretStyle} />
                  </div>
                )}

                <img
                  src={`https://flagcdn.com/w80/${team.cc}.png`}
                  alt={team.name}
                  style={{
                    width: 52,
                    height: 36,
                    borderRadius: 4,
                    objectFit: "cover",
                    display: "block",
                    opacity: isActive ? 1 : 0.75,
                    transform: isActive ? "scale(1.55)" : "scale(1)",
                    boxShadow: isActive
                      ? "0 0 0 2px #fbbf24, 0 6px 18px rgba(251,191,36,0.55)"
                      : "0 1px 4px rgba(0,0,0,0.4)",
                    transition: "opacity 0.35s ease, box-shadow 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
                  }}
                />
              </div>
            );
          })}

        {/* Center crest + form */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10,
          width: 300,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
        }}>
          <div className="text-center">
            <img src="/world_cup_trophy.png" alt="" className="mx-auto mb-2" style={{ height: 52 }} />
            <h1 className="font-black text-white uppercase leading-none tracking-tight" style={{ fontSize: "clamp(2.2rem, 7vw, 2.6rem)" }}>
              Brotherinos
            </h1>
            <h2 className="font-black text-yellow-300 uppercase leading-none tracking-tight" style={{ fontSize: "clamp(1.75rem, 5.5vw, 2rem)" }}>
              World Cup
            </h2>
            <p
              className="font-black leading-none tracking-wide"
              style={{
                fontSize: "clamp(2.4rem, 8vw, 2.9rem)",
                marginTop: "0.15em",
                background: "linear-gradient(90deg, #92400e 0%, #d97706 20%, #fde047 45%, #fef3c7 55%, #fde047 65%, #d97706 82%, #92400e 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 6px rgba(251,191,36,0.6)) drop-shadow(0 0 16px rgba(251,191,36,0.25))",
              }}
            >
              2026
            </p>
          </div>

          <form onSubmit={handleSubmit} className="w-full space-y-3">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-2xl px-4 py-3.5 text-lg text-center text-gray-900 placeholder:text-gray-400 focus:outline-none transition-all bg-white"
              style={{ border: "3px solid #e5e7eb" }}
              onFocus={(e) => (e.currentTarget.style.border = "3px solid #fbbf24")}
              onBlur={(e) => (e.currentTarget.style.border = "3px solid #e5e7eb")}
              maxLength={50}
              autoFocus
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full rounded-2xl font-black uppercase tracking-wide transition-all"
              style={{
                background: name.trim() && !loading ? "#fbbf24" : "rgba(255,255,255,0.1)",
                color: name.trim() && !loading ? "#78350f" : "rgba(255,255,255,0.25)",
                boxShadow: name.trim() && !loading ? "0 6px 30px rgba(251,191,36,0.4)" : "none",
                height: "3.25rem",
                fontSize: "1.1rem",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {loading ? "Loading…" : (
                <span style={{ display: "block", position: "relative", height: "1.4em", overflow: "hidden" }}>
                  <span
                    key={phraseIdx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      position: "absolute",
                      inset: 0,
                      animation: `slot-tick ${INTERVAL_MS}ms ease both`,
                    }}
                  >
                    {currentTeam && (
                      <img
                        src={`https://flagcdn.com/w40/${currentTeam.cc}.png`}
                        alt=""
                        style={{ height: "1.1em", width: "auto", borderRadius: 2, flexShrink: 0 }}
                      />
                    )}
                    {currentPhrase.text}
                  </span>
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
      </main>
    </>
  );
}
