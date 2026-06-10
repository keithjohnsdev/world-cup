"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { NavHeader } from "@/components/ui/NavHeader";
import { Button } from "@/components/ui/Button";

interface AwardEntry {
  name: string;
  user_name: string;
  reason: string;
}

const AWARD_META: Record<string, { description: string; emoji: string; category: "glory" | "funny" | "special" }> = {
  "The Champion":              { description: "Most total points overall",                                                                                    emoji: "🏆", category: "glory" },
  "True Believer":             { description: "Named the actual World Cup winner as their champion pick before the tournament",                               emoji: "🔮", category: "glory" },
  "The Closer":                { description: "Most points scored in the quarterfinals and beyond — peaked at the right time",                               emoji: "💪", category: "glory" },
  "The Hipster":               { description: "Correctly backed the lowest-ranked team to make the deepest run in the bracket",                              emoji: "😎", category: "glory" },
  "Bracket Brainiac":          { description: "Highest accuracy percentage in the knockout rounds",                                                          emoji: "🧠", category: "glory" },
  "The Pacemaker":             { description: "Led the overall standings for more rounds than anyone else — front-runner all tournament",                    emoji: "🏃", category: "glory" },
  "The Hand of God":           { description: "Correctly predicted the 1st-place team in all 12 groups — near impossible",                                  emoji: "✋", category: "glory" },
  "Wooden Spoon":              { description: "Dead last — awarded with full ceremony and a literal wooden spoon",                                           emoji: "🥄", category: "funny" },
  "Heartbreak Hotel":          { description: "Most picks eliminated specifically in penalty shootouts — the universe has a grudge",                         emoji: "💔", category: "funny" },
  "The Human Coin Flip":       { description: "Knockout accuracy closest to exactly 50% — perfectly, uselessly neutral",                                    emoji: "🪙", category: "funny" },
  "Help, I've Gone Cross-Eyed": { description: "Most picks where the team advanced but finished in the wrong position",                                     emoji: "😵", category: "funny" },
  "The Trendsetter":           { description: "Made the most unique picks that nobody else made — a true contrarian",                                       emoji: "🦄", category: "funny" },
  "Reverse Oracle":            { description: "Most incorrect knockout picks — so reliably wrong you're almost useful",                                     emoji: "🙃", category: "funny" },
  "Early Retirement":          { description: "Champion pick was eliminated in the group stage — sent home before the party started",                       emoji: "✈️", category: "funny" },
  "Upset Artist":              { description: "Most correctly predicted upsets — lower-ranked team beats higher-ranked",                                    emoji: "🎨", category: "special" },
  "Comeback Kid":              { description: "Biggest rank improvement from pre-bracket standings to the final result",                                    emoji: "⬆️", category: "special" },
  "Close But No Cigar":        { description: "Champion pick made the Final but lost — you saw it coming, you were almost right, and it hurts",             emoji: "🚬", category: "special" },
};

const CATEGORIES = [
  { key: "glory",   label: "Glory",              color: "text-yellow-300",  borderColor: "border-yellow-300/30", bg: "bg-yellow-300/5" },
  { key: "funny",   label: "Funny & Consolation", color: "text-green-400",  borderColor: "border-green-400/30",  bg: "bg-green-400/5"  },
  { key: "special", label: "Special",             color: "text-amber-400",  borderColor: "border-amber-400/30",  bg: "bg-amber-400/5"  },
] as const;

export default function AwardsPage() {
  const [awards, setAwards] = useState<AwardEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("wc_token");
    if (!token) { router.replace("/landing"); return; }

    fetch("/api/awards")
      .then(r => r.json())
      .then(data => {
        setVisible(data.visible ?? false);
        setAwards(data.awards ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  const byName = new Map(awards.map(a => [a.name, a]));
  const userName = typeof window !== "undefined" ? localStorage.getItem("wc_name") ?? "" : "";

  function signOut() {
    localStorage.removeItem("wc_token");
    localStorage.removeItem("wc_name");
    router.replace("/landing");
  }

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <NavHeader
        className="border-b border-white/10"
        style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 50%, #0a1a0f 100%)" }}
        left={
          <a href="/" className="flex items-center gap-2 select-none cursor-pointer">
            <img src="/world_cup_trophy.png" alt="" style={{ height: 36 }} />
            <div>
              <div className="font-black text-white uppercase tracking-tight text-sm leading-tight">Johnsies</div>
              <div className="font-black text-amber-400 uppercase tracking-tight text-sm leading-tight">World Cup</div>
            </div>
          </a>
        }
        right={
          <>
            {userName && <span className="text-green-400 text-sm font-medium hidden lg:inline">{userName}</span>}
            {userName.toLowerCase() === "keith" && (
              <a href="/admin" className="text-xs font-black uppercase tracking-wide text-amber-400 hover:text-amber-300 transition-colors">
                Admin
              </a>
            )}
            <Button variant="ghost" size="sm" onClick={signOut}>Sign out</Button>
          </>
        }
      />

      <div className="px-4 pt-10 pb-20 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <p className="font-black uppercase leading-none text-white mb-1" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>The</p>
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h1 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2.2rem, 7vw, 3rem)", letterSpacing: "-0.02em" }}>Awards</h1>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/40 text-sm mt-3">Everyone wins something.</p>
        </div>

        {loading ? (
          <div className="text-center text-white/30 text-sm py-16">Loading…</div>
        ) : !visible ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-6">🏆</div>
            <p className="text-white font-black text-xl mb-2">Awards coming after the Final</p>
            <p className="text-white/40 text-sm max-w-xs mx-auto">Results are still being played out. Check back here once the tournament is over.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {CATEGORIES.map(cat => {
              const catAwards = Object.entries(AWARD_META).filter(([, m]) => m.category === cat.key);
              return (
                <section key={cat.key}>
                  <div className="flex items-center gap-3 mb-4">
                    <h2 className={`font-black uppercase tracking-[0.15em] text-sm ${cat.color}`}>{cat.label}</h2>
                    <div className={`flex-1 h-px bg-gradient-to-r from-white/10 to-transparent`} />
                  </div>
                  <div className="space-y-3">
                    {catAwards.map(([awardName, meta]) => {
                      const result = byName.get(awardName);
                      const winner = result?.user_name;
                      const reason = result?.reason;
                      return (
                        <div
                          key={awardName}
                          className={`rounded-2xl border px-5 py-4 ${winner ? `${cat.borderColor} ${cat.bg}` : "border-white/8 bg-white/3"}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl leading-none mt-0.5 shrink-0">{meta.emoji}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 flex-wrap">
                                <span className="font-black text-white text-base leading-tight">{awardName}</span>
                                {winner ? (
                                  <span className={`font-black text-sm ${cat.color}`}>{winner}</span>
                                ) : (
                                  <span className="text-white/25 text-xs font-bold uppercase tracking-wide">TBD</span>
                                )}
                              </div>
                              <p className="text-white/50 text-xs mt-1 leading-relaxed">{meta.description}</p>
                              {reason && (
                                <p className={`text-xs mt-1.5 font-medium ${cat.color} opacity-80`}>{reason}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
