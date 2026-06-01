"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <main className="min-h-screen bg-gradient-to-b from-brand-900 to-brand-700 flex items-center justify-center p-4">
      <Card className="p-8 w-full max-w-sm text-center">
        <div className="text-6xl mb-4">🏆</div>
        <h1 className="text-3xl font-bold text-brand-800 mb-1">World Cup 2026</h1>
        <p className="text-gray-500 mb-8">Family Bracket Challenge</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-lg text-center text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-brand-500 transition-colors"
            maxLength={50}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" size="lg" loading={loading} disabled={!name.trim()}>
            Make My Picks →
          </Button>
        </form>
      </Card>
    </main>
  );
}
