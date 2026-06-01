"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
      if (!res.ok) throw new Error("Failed to sign up");
      const data = await res.json();
      localStorage.setItem("wc_token", data.session_token);
      localStorage.setItem("wc_name", data.name);
      router.push("/bracket");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-900 to-green-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-3xl font-bold text-green-800 mb-1">World Cup 2026</h1>
        <p className="text-gray-500 mb-8">Family Bracket Challenge</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-green-500 transition-colors"
              maxLength={50}
              autoFocus
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={!name.trim() || loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 px-6 rounded-xl text-lg transition-colors"
          >
            {loading ? "Loading…" : "Make My Picks →"}
          </button>
        </form>
      </div>
    </main>
  );
}
