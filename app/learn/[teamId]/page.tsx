import { notFound } from "next/navigation";
import Link from "next/link";
import { TEAMS, getTeam } from "@/lib/data";
import { COUNTRY_INFO } from "@/lib/countries";

export function generateStaticParams() {
  return TEAMS.map((t) => ({ teamId: t.id }));
}

export default async function CountryPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const team = getTeam(teamId);
  const info = COUNTRY_INFO[teamId];
  if (!team || !info) notFound();

  return (
    <div className="min-h-screen bg-[#060d1a]">
      {/* Hero */}
      <div className="relative h-56 bg-gradient-to-b from-green-900/60 to-[#060d1a] flex items-end">
        <div className="absolute inset-0 overflow-hidden opacity-20">
          <img
            src={`https://flagcdn.com/w1280/${team.cc}.png`}
            alt=""
            className="w-full h-full object-cover object-center blur-sm scale-105"
          />
        </div>
        <div className="relative z-10 px-6 pb-6 flex items-end gap-5 w-full">
          <img
            src={`https://flagcdn.com/w160/${team.cc}.png`}
            alt={`${team.name} flag`}
            className="w-24 h-16 object-cover rounded-xl shadow-xl border-2 border-white/20"
          />
          <div>
            <div className="text-green-400 text-sm font-medium mb-1">Group {team.group}</div>
            <h1 className="text-white text-3xl font-bold">{team.name}</h1>
            <div className="text-white/50 text-sm mt-0.5">Capital: {info.capital}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Soccer History */}
        <section>
          <h2 className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">⚽ Soccer History</h2>
          <p className="text-white/80 leading-relaxed">{info.soccerHistory}</p>
        </section>

        {/* Culture */}
        <section>
          <h2 className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">🎭 Culture & People</h2>
          <ul className="space-y-2">
            {info.culture.map((item, i) => (
              <li key={i} className="flex gap-3 text-white/80">
                <span className="text-green-500 mt-0.5 shrink-0">•</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* Cuisine */}
        <section>
          <h2 className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">🍽 Must-Try Food</h2>
          <div className="flex flex-wrap gap-2">
            {info.cuisine.map((dish, i) => (
              <span
                key={i}
                className="bg-white/10 border border-white/20 text-white px-3 py-1.5 rounded-full text-sm"
              >
                {dish}
              </span>
            ))}
          </div>
        </section>

        {/* Fun fact */}
        <section className="bg-green-900/30 border border-green-500/30 rounded-2xl px-5 py-4">
          <h2 className="text-green-400 text-xs font-bold uppercase tracking-widest mb-2">💡 Did You Know?</h2>
          <p className="text-white/80 leading-relaxed">{info.funFact}</p>
        </section>

        {/* Navigation */}
        <div className="flex gap-3 pt-4">
          <Link
            href="/learn"
            className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl font-medium transition-colors"
          >
            ← Back to Globe
          </Link>
          <Link
            href="/bracket"
            className="flex-1 text-center bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-medium transition-colors"
          >
            Make Picks →
          </Link>
        </div>
      </div>
    </div>
  );
}
