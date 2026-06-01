"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const FLAGS = ["🇧🇷","🇦🇷","🇫🇷","🇩🇪","🇪🇸","🏴󠁧󠁢󠁥󠁮󠁧󠁿","🇵🇹","🇳🇱","🇺🇸","🇲🇽","🇯🇵","🇲🇦","🇧🇪","🇺🇾","🇸🇳","🇳🇴","🇨🇦","🇨🇭","🇰🇷","🇦🇺"];

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
      className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden"
      style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 80% 50% at 50% 30%, rgba(22,163,74,0.12) 0%, transparent 70%)" }}
      />

      {/* Top flag strip */}
      <div className="absolute top-0 left-0 right-0 flex justify-center gap-2 px-2 pt-3 opacity-25 pointer-events-none select-none">
        {[...FLAGS, ...FLAGS].map((f, i) => (
          <span key={i} className="text-xl flex-shrink-0">{f}</span>
        ))}
      </div>

      {/* Main content */}
      <div className="relative text-center w-full max-w-xs">
        <div className="text-8xl mb-2 drop-shadow-2xl leading-none">🏆</div>

        <p className="text-amber-400/80 text-xs font-bold tracking-[0.5em] uppercase mt-4 mb-1">
          Family Bracket Challenge
        </p>
        <h1 className="text-6xl font-black text-white uppercase leading-none tracking-tight">
          World<br />Cup
        </h1>
        <p className="text-5xl font-black text-amber-400 uppercase leading-none tracking-tight mt-1">
          2026
        </p>

        {/* Flag row */}
        <div className="flex justify-center gap-1.5 mt-6 mb-8 flex-wrap">
          {FLAGS.slice(0, 10).map((f, i) => (
            <span key={i} className="text-2xl">{f}</span>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-2xl px-4 py-3.5 text-lg text-center text-white placeholder:text-white/30 focus:outline-none transition-colors"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "2px solid rgba(255,255,255,0.15)",
            }}
            onFocus={(e) => (e.currentTarget.style.border = "2px solid #fbbf24")}
            onBlur={(e) => (e.currentTarget.style.border = "2px solid rgba(255,255,255,0.15)")}
            maxLength={50}
            autoFocus
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full rounded-2xl py-3.5 text-lg font-black uppercase tracking-wide transition-all"
            style={{
              background: name.trim() && !loading ? "#fbbf24" : "rgba(255,255,255,0.08)",
              color: name.trim() && !loading ? "#78350f" : "rgba(255,255,255,0.2)",
              boxShadow: name.trim() ? "0 8px 32px rgba(251,191,36,0.25)" : "none",
            }}
          >
            {loading ? "Loading…" : "Make My Picks →"}
          </button>
        </form>
      </div>

      {/* Bottom flag strip */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center gap-2 px-2 pb-3 opacity-25 pointer-events-none select-none">
        {[...FLAGS].reverse().concat([...FLAGS].reverse()).map((f, i) => (
          <span key={i} className="text-xl flex-shrink-0">{f}</span>
        ))}
      </div>
    </main>
  );
}
