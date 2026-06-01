"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TEAMS } from "@/lib/data";

// "Let's go!" in the languages of the 48 WC nations, one per group
const PHRASES = [
  { text: "¡Vamos!",    flag: "🇦🇷" }, // Spanish  — Argentina, Mexico, Colombia, Spain, Uruguay…
  { text: "Let's Go!",  flag: "🇺🇸" }, // English  — USA, England, Australia, New Zealand, Scotland
  { text: "Allez!",     flag: "🇫🇷" }, // French   — France, Belgium, Senegal, Ivory Coast, DR Congo…
  { text: "Vai!",       flag: "🇧🇷" }, // Portuguese — Brazil, Portugal
  { text: "Los geht's!",flag: "🇩🇪" }, // German   — Germany, Austria, Switzerland
  { text: "Yalla!",     flag: "🇸🇦" }, // Arabic   — Saudi Arabia, Egypt, Iraq, Jordan, Morocco…
  { text: "Ikuzo!",     flag: "🇯🇵" }, // Japanese — Japan
  { text: "Kom op!",    flag: "🇳🇱" }, // Dutch    — Netherlands
  { text: "Hadi!",      flag: "🇹🇷" }, // Turkish  — Türkiye
  { text: "Hajde!",     flag: "🇭🇷" }, // Croatian — Croatia, Bosnia & Herzegovina
  { text: "Gaja!",      flag: "🇰🇷" }, // Korean   — South Korea
  { text: "Ketdik!",    flag: "🇺🇿" }, // Uzbek    — Uzbekistan
];

const RADIUS = 235;
const SIZE = RADIUS * 2 + 56;

export default function Home() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 2000);
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
      router.push("/bracket");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(22,163,74,0.14) 0%, transparent 70%)" }}
      />

      {/* Flag ring — encompasses crest + form */}
      <div
        className="relative flex items-center justify-center flex-shrink-0"
        style={{ width: SIZE, height: SIZE }}
      >
        {TEAMS.map((team, i) => {
          const angle = (i / TEAMS.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          return (
            <img
              key={team.id}
              src={`https://flagcdn.com/w40/${team.cc}.png`}
              alt={team.name}
              className="absolute rounded-sm object-cover pointer-events-none select-none"
              style={{
                width: 28,
                height: 20,
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                opacity: 0.85,
              }}
            />
          );
        })}

        {/* Center: crest + form */}
        <div className="relative z-10 flex flex-col items-center gap-7" style={{ width: 300 }}>
          {/* Crest */}
          <div className="text-center">
            <p className="text-green-500 text-[9px] font-black uppercase tracking-[0.4em] mb-2">
              Est. 2026
            </p>
            <h1 className="font-black text-white uppercase leading-none tracking-tight" style={{ fontSize: "clamp(1.8rem, 7vw, 2.6rem)" }}>
              Johnsies
            </h1>
            <h2 className="font-black text-yellow-300 uppercase leading-none tracking-tight" style={{ fontSize: "clamp(1.4rem, 5.5vw, 2rem)" }}>
              World Cup
            </h2>
          </div>

          {/* Form */}
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
            <style>{`
              @keyframes slot-tick {
                0%   { transform: translateY(110%); opacity: 0; }
                12%  { transform: translateY(0);    opacity: 1; }
                88%  { transform: translateY(0);    opacity: 1; }
                100% { transform: translateY(-110%); opacity: 0; }
              }
            `}</style>
            <button
              type="submit"
              disabled={!name.trim() || loading}
              className="w-full rounded-2xl py-3.5 font-black uppercase tracking-wide transition-all overflow-hidden"
              style={{
                background: name.trim() && !loading ? "#fbbf24" : "rgba(255,255,255,0.1)",
                color: name.trim() && !loading ? "#78350f" : "rgba(255,255,255,0.25)",
                boxShadow: name.trim() && !loading ? "0 6px 30px rgba(251,191,36,0.4)" : "none",
                height: "3.25rem",
                fontSize: "1.125rem",
              }}
            >
              {loading ? "Loading…" : (
                <span style={{ display: "block", position: "relative", height: "1.3em", overflow: "hidden" }}>
                  <span
                    key={phraseIdx}
                    style={{ display: "block", position: "absolute", width: "100%", animation: "slot-tick 2s ease both" }}
                  >
                    {PHRASES[phraseIdx].flag} {PHRASES[phraseIdx].text}
                  </span>
                </span>
              )}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
