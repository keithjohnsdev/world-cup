"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TEAMS, getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";

interface Article {
  url: string;
  title: string;
  source: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: string;
  countries: string[];
  sourceCount: number;
}

// Tournament hosts get quick-filter pills; everything else lives in the dropdown.
const HOST_IDS = ["USA", "MEX", "CAN"] as const;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function CountryFlags({ ids, className }: { ids: string[]; className?: string }) {
  return (
    <>
      {ids.slice(0, 4).map((id) => {
        const team = getTeam(id);
        if (!team) return null;
        return <FlagIcon key={id} cc={team.cc} name={team.name} className={className} />;
      })}
    </>
  );
}

// In-app reader: shows our own Claude-generated recap of the story (kept on-site,
// ad-free) with attribution and a link to the original. Recaps are cached, so the
// model runs at most once per story.
function NewsReaderModal({ article, onClose }: { article: Article; onClose: () => void }) {
  const [recap, setRecap] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetch(`/api/news/recap?url=${encodeURIComponent(article.url)}`)
      .then((r) => r.json())
      .then((data: { recap: string | null }) => {
        if (cancelled) return;
        if (data.recap) setRecap(data.recap);
        else setFailed(true); // no recap available — fall back to summary + link
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [article.url]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl my-8 rounded-2xl border border-white/10 bg-green-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M2 2l12 12M14 2L2 14" />
          </svg>
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap pr-8">
            <span className="text-[11px] font-black uppercase tracking-[0.1em] text-green-400">{article.source}</span>
            <span className="text-white/30 text-[11px]">·</span>
            <span className="text-white/40 text-[11px]">{relativeTime(article.publishedAt)}</span>
            {article.sourceCount > 1 && (
              <span className="text-[10px] font-black uppercase tracking-wide text-yellow-300 bg-yellow-300/10 rounded-full px-2 py-0.5">
                🔥 {article.sourceCount} outlets
              </span>
            )}
          </div>

          <h2 className="text-2xl font-black text-white leading-tight mb-3">{article.title}</h2>

          {article.countries.length > 0 && (
            <div className="flex items-center gap-1.5 mb-5">
              <CountryFlags ids={article.countries} className="w-6 h-4 rounded-[2px]" />
            </div>
          )}

          {loading ? (
            <div className="space-y-3 animate-pulse" aria-label="Loading recap">
              <div className="h-3.5 rounded bg-white/10 w-full" />
              <div className="h-3.5 rounded bg-white/10 w-[92%]" />
              <div className="h-3.5 rounded bg-white/10 w-[97%]" />
              <div className="h-3.5 rounded bg-white/10 w-[80%]" />
            </div>
          ) : recap ? (
            <div className="prose prose-invert prose-sm max-w-none text-green-50/90 [&>p]:mb-3 [&>p]:leading-relaxed">
              <ReactMarkdown>{recap}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-green-50/80 leading-relaxed">
              {article.summary || "We couldn't generate a recap for this story right now."}
            </p>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between gap-3">
            <span className="text-white/40 text-xs">
              {failed ? "Summary shown" : "Recap by Johnsies World Cup"} · Source: {article.source}
            </span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-black uppercase tracking-wide text-yellow-300 hover:text-yellow-200 whitespace-nowrap"
            >
              Read full story ↗
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewsTab() {
  const [country, setCountry] = useState<string>(""); // "" = all
  const [search, setSearch] = useState<string>(""); // raw input
  const [query, setQuery] = useState<string>(""); // debounced — what we fetch on
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);

  const sortedTeams = useMemo(
    () => [...TEAMS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // Debounce the free-text search so we don't fetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (query) params.set("q", query);
    const qs = params.toString() ? `?${params.toString()}` : "";
    fetch(`/api/news${qs}`)
      .then((r) => r.json())
      .then((data: { articles?: Article[] }) => {
        if (cancelled) return;
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, query]);

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #060d1a 0%, #0d2137 60%, #071628 100%)" }}>
      <div className="px-4 pt-10 pb-12 max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3">
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-yellow-300/60" />
            <h2 className="font-black uppercase leading-none text-yellow-300" style={{ fontSize: "clamp(2rem, 6vw, 2.75rem)", letterSpacing: "-0.02em" }}>
              News
            </h2>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-yellow-300/60" />
          </div>
          <p className="text-white/60 text-sm mt-3">
            Top World Cup stories from across the major outlets &mdash; the most-covered first. <span className="text-white/40">Experimental.</span>
          </p>
        </div>

        {/* Filter: host pills + full-country dropdown */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setCountry("")}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
              country === "" ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/70 hover:text-white"
            }`}
          >
            All
          </button>
          {HOST_IDS.map((id) => {
            const team = getTeam(id);
            if (!team) return null;
            return (
              <button
                key={id}
                onClick={() => setCountry(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
                  country === id ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/70 hover:text-white"
                }`}
              >
                <FlagIcon cc={team.cc} name={team.name} className="w-4 h-3 rounded-[2px]" />
                {team.id}
              </button>
            );
          })}
          <select
            value={HOST_IDS.includes(country as typeof HOST_IDS[number]) || country === "" ? "" : country}
            onChange={(e) => setCountry(e.target.value)}
            className="px-3 py-1.5 rounded-full bg-white/10 border border-white/15 text-white/80 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-yellow-300/50 cursor-pointer"
          >
            <option value="">More countries…</option>
            {sortedTeams.map((t) => (
              <option key={t.id} value={t.id} className="text-black">
                {t.name}
              </option>
            ))}
          </select>

          {/* Free-text search across story titles & summaries */}
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
              width="13" height="13" viewBox="0 0 16 16" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search stories…"
              className="w-44 pl-8 pr-3 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-white/80 text-xs font-bold placeholder:text-white/40 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
            />
          </div>
        </div>

        {/* Feed */}
        {loading ? (
          <p className="text-center text-white/50 text-sm py-16">Loading the latest…</p>
        ) : error ? (
          <p className="text-center text-white/50 text-sm py-16">Couldn&apos;t load the news right now. Try again shortly.</p>
        ) : articles.length === 0 ? (
          <p className="text-center text-white/50 text-sm py-16">
            {query
              ? `No stories matching “${query}”${country ? ` for ${getTeam(country)?.name ?? "this country"}` : ""}.`
              : `No stories yet${country ? ` for ${getTeam(country)?.name ?? "this country"}` : ""}. Check back soon.`}
          </p>
        ) : (
          <div className="space-y-3">
            {articles.map((a) => (
              <button
                key={a.url}
                onClick={() => setOpenArticle(a)}
                className="w-full flex gap-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors p-4 text-left cursor-pointer"
              >
                {a.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    className="hidden sm:block w-28 h-20 rounded-lg object-cover flex-shrink-0 bg-white/5"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[11px] font-black uppercase tracking-[0.1em] text-green-400">{a.source}</span>
                    <span className="text-white/30 text-[11px]">·</span>
                    <span className="text-white/40 text-[11px]">{relativeTime(a.publishedAt)}</span>
                    {a.sourceCount > 1 && (
                      <span className="text-[10px] font-black uppercase tracking-wide text-yellow-300 bg-yellow-300/10 rounded-full px-2 py-0.5">
                        🔥 {a.sourceCount} outlets
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-white leading-snug">{a.title}</h3>
                  {a.summary && (
                    <p className="text-white/55 text-sm mt-1 line-clamp-2">{a.summary}</p>
                  )}
                  {a.countries.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <CountryFlags ids={a.countries} className="w-5 h-3.5 rounded-[2px]" />
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {openArticle && <NewsReaderModal article={openArticle} onClose={() => setOpenArticle(null)} />}
    </div>
  );
}
