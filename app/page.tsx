"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

// All 48 World Cup 2026 teams, in group order
const ALL_FLAGS = [
  "🇲🇽","🇿🇦","🇰🇷","🇨🇿",
  "🇨🇦","🇧🇦","🇶🇦","🇨🇭",
  "🇧🇷","🇲🇦","🇭🇹","🏴󠁧󠁢󠁳󠁣󠁴󠁿",
  "🇺🇸","🇵🇾","🇦🇺","🇹🇷",
  "🇩🇪","🇨🇼","🇨🇮","🇪🇨",
  "🇳🇱","🇯🇵","🇸🇪","🇹🇳",
  "🇧🇪","🇪🇬","🇮🇷","🇳🇿",
  "🇪🇸","🇨🇻","🇸🇦","🇺🇾",
  "🇫🇷","🇸🇳","🇮🇶","🇳🇴",
  "🇦🇷","🇩🇿","🇦🇹","🇯🇴",
  "🇵🇹","🇨🇩","🇺🇿","🇨🇴",
  "🏴󠁧󠁢󠁥󠁮󠁧󠁿","🇭🇷","🇬🇭","🇵🇦",
];

const RADIUS = 185;

export default function Home() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

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
      className="min-h-screen flex flex-col items-center justify-center gap-10 p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 70% 60% at 50% 40%, rgba(22,163,74,0.14) 0%, transparent 70%)" }}
      />

      {/* Flag ring + crest */}
      <div className="relative flex items-center justify-center" style={{ width: RADIUS * 2 + 40, height: RADIUS * 2 + 40, flexShrink: 0 }}>
        {ALL_FLAGS.map((flag, i) => {
          const angle = (i / ALL_FLAGS.length) * 2 * Math.PI - Math.PI / 2;
          const x = Math.cos(angle) * RADIUS;
          const y = Math.sin(angle) * RADIUS;
          return (
            <span
              key={i}
              className="absolute select-none pointer-events-none leading-none"
              style={{
                left: "50%",
                top: "50%",
                transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                fontSize: "1.2rem",
              }}
            >
              {flag}
            </span>
          );
        })}

        {/* Crest center */}
        <div className="relative z-10 text-center">
          <div className="text-6xl leading-none mb-3">🏆</div>
          <p className="text-brand-400 text-[9px] font-black uppercase tracking-[0.4em] mb-1">
            Est. 2026
          </p>
          <h1 className="font-black text-white uppercase leading-none tracking-tight" style={{ fontSize: "clamp(1.6rem, 7vw, 2.4rem)" }}>
            Johnsies
          </h1>
          <h2 className="font-black text-amber-400 uppercase leading-none tracking-tight" style={{ fontSize: "clamp(1.4rem, 6vw, 2rem)" }}>
            World Cup
          </h2>
        </div>
      </div>

      {/* Form — outside the ring */}
      <div className="relative z-10 w-full max-w-xs">
        <form onSubmit={handleSubmit} className="space-y-3">
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
            className="w-full rounded-2xl py-3.5 text-lg font-black uppercase tracking-wide transition-all"
            style={{
              background: name.trim() && !loading ? "#fbbf24" : "rgba(255,255,255,0.1)",
              color: name.trim() && !loading ? "#78350f" : "rgba(255,255,255,0.25)",
              boxShadow: name.trim() && !loading ? "0 6px 30px rgba(251,191,36,0.4)" : "none",
            }}
          >
            {loading ? "Loading…" : "Make My Picks →"}
          </button>
        </form>
      </div>
    </main>
  );
}
