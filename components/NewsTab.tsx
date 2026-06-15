"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { TEAMS, getTeam } from "@/lib/data";
import { FlagIcon } from "@/components/FlagIcon";
import type { WebSearchArticle } from "@/lib/news-search";

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

function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 10) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}

export function NewsTab() {
  const [country, setCountry] = useState<string>(""); // "" = all
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState<string>(""); // raw input
  const [query, setQuery] = useState<string>(""); // debounced — what we fetch on
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openArticle, setOpenArticle] = useState<Article | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [, setNow] = useState(0); // ticks so "updated … ago" stays live

  // Web-search fallback state: only used when the local feed has no matches.
  const [webArticles, setWebArticles] = useState<WebSearchArticle[]>([]);
  const [webSearching, setWebSearching] = useState(false);
  const [webDone, setWebDone] = useState(false);
  const [webEnabled, setWebEnabled] = useState(true);
  const [webVia, setWebVia] = useState<string | null>(null);

  const sortedTeams = useMemo(
    () => [...TEAMS].sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  // Re-render every 30s so the "updated … ago" label keeps counting up.
  useEffect(() => {
    const id = setInterval(() => setNow((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Close the country dropdown on an outside click.
  useEffect(() => {
    if (!countryOpen) return;
    function onDown(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [countryOpen]);

  // Debounce the free-text search so we don't fetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    // Reset any prior web-fallback results for the new query/filter.
    setWebArticles([]);
    setWebSearching(false);
    setWebDone(false);
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (query) params.set("q", query);
    if (sort === "new") params.set("sort", "new");
    const qs = params.toString() ? `?${params.toString()}` : "";

    // When the local feed has nothing for a typed query, ask Claude to search
    // the same trusted outlets live. Only runs on a miss, so it's off the hot path.
    async function runWebSearch(q: string) {
      setWebSearching(true);
      try {
        const r = await fetch(`/api/news/search?q=${encodeURIComponent(q)}`);
        const data: { articles?: WebSearchArticle[]; enabled?: boolean; via?: string | null } = await r.json();
        if (cancelled) return;
        setWebArticles(Array.isArray(data.articles) ? data.articles : []);
        setWebEnabled(data.enabled !== false);
        setWebVia(data.via ?? null);
      } catch {
        if (!cancelled) setWebArticles([]);
      } finally {
        if (!cancelled) {
          setWebSearching(false);
          setWebDone(true);
        }
      }
    }

    fetch(`/api/news${qs}`)
      .then((r) => r.json())
      .then((data: { articles?: Article[] }) => {
        if (cancelled) return;
        const list = Array.isArray(data.articles) ? data.articles : [];
        setArticles(list);
        setLastFetched(new Date());
        setLoading(false);
        // Never serve an empty page: on any miss (string and/or country, or even
        // a cold feed) fall back to a live web search of the same outlets.
        if (list.length === 0) {
          const countryName = country ? getTeam(country)?.name ?? country : "";
          const term =
            [query, countryName].filter(Boolean).join(" ").trim() || "World Cup 2026 latest";
          runWebSearch(term);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, query, sort]);

  const selectedTeam = country ? getTeam(country) : null;
  // Human label for the live web-search states (string and/or country filter).
  const searchLabel = query
    ? `“${query}”${selectedTeam ? ` · ${selectedTeam.name}` : ""}`
    : selectedTeam
      ? selectedTeam.name
      : "World Cup news";
  // Always-available "browse more" escape hatch — a plain Google News search.
  const liveTerm = [query, selectedTeam?.name].filter(Boolean).join(" ").trim() || "World Cup 2026";
  const googleNewsUrl = `https://news.google.com/search?q=${encodeURIComponent(liveTerm)}`;

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
            Top World Cup stories from across the major outlets &mdash; the most-covered first.
          </p>
        </div>

        {/* Freshness line */}
        {lastFetched && (
          <p className="text-center text-white/40 text-[11px] mb-4">
            Updated {timeAgo(lastFetched)}
          </p>
        )}

        {/* Filter: sort pills + country dropdown + search */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
          <button
            onClick={() => setSort("hot")}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
              sort === "hot" ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/70 hover:text-white"
            }`}
          >
            🔥 Hottest
          </button>
          <button
            onClick={() => setSort("new")}
            className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
              sort === "new" ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/70 hover:text-white"
            }`}
          >
            🕐 Newest
          </button>

          {/* Country: styled flag dropdown */}
          <div className="relative" ref={countryRef}>
            <button
              onClick={() => setCountryOpen((o) => !o)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer ${
                country ? "bg-yellow-300 text-green-950" : "bg-white/10 text-white/70 hover:text-white"
              }`}
            >
              {selectedTeam ? (
                <>
                  <FlagIcon cc={selectedTeam.cc} name={selectedTeam.name} className="w-4 h-3 rounded-[2px]" />
                  {selectedTeam.id}
                </>
              ) : (
                "Country"
              )}
              <svg
                width="9" height="9" viewBox="0 0 10 10" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="transition-transform"
                style={{ transform: countryOpen ? "rotate(180deg)" : "none" }}
              >
                <path d="M2 3.5L5 6.5L8 3.5" />
              </svg>
            </button>

            {countryOpen && (
              <div className="absolute z-30 mt-2 left-1/2 -translate-x-1/2 w-60 max-h-72 overflow-y-auto rounded-2xl border border-white/15 shadow-2xl p-1.5" style={{ background: "#0d2137" }}>
                <button
                  onClick={() => { setCountry(""); setCountryOpen(false); }}
                  className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                    country === "" ? "bg-yellow-300/15 text-yellow-300" : "text-white hover:bg-white/10"
                  }`}
                >
                  <span className="w-5 text-center shrink-0">🌐</span>
                  <span className="font-bold">All countries</span>
                </button>
                <div className="h-px bg-white/10 my-1" />
                {sortedTeams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => { setCountry(t.id); setCountryOpen(false); }}
                    className={`flex items-center gap-2 w-full px-2.5 py-2 rounded-xl text-left text-xs transition-colors cursor-pointer ${
                      country === t.id ? "bg-yellow-300/15 text-yellow-300" : "text-white hover:bg-white/10"
                    }`}
                  >
                    <FlagIcon cc={t.cc} name={t.name} className="w-5 h-3.5 rounded-[2px] shrink-0" />
                    <span className="font-black w-8 shrink-0">{t.id}</span>
                    <span className="truncate text-white/70">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

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
          // Never serve an empty page: any miss falls back to a live web search.
          webSearching ? (
            <p className="text-center text-white/50 text-sm py-16">Searching the web for {searchLabel}&hellip;</p>
          ) : webArticles.length > 0 ? (
            <div>
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="text-[10px] font-black uppercase tracking-[0.15em] text-yellow-300">🌐 Live web results</span>
              </div>
              <div className="space-y-3">
                {webArticles.map((a) => {
                  // Google News carries no article image, so show a flag thumbnail:
                  // the team named in the headline, else the active country filter.
                  const flagTeam = getTeam(a.countries[0] || country);
                  return (
                    <a
                      key={a.url}
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/[0.08] transition-colors p-4"
                    >
                      <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-white/[0.06] flex-shrink-0 overflow-hidden">
                        {flagTeam ? (
                          <FlagIcon cc={flagTeam.cc} name={flagTeam.name} className="w-11 h-7 rounded-[2px] shadow" />
                        ) : (
                          <span className="text-2xl" aria-hidden>📰</span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[11px] font-black uppercase tracking-[0.1em] text-green-400">{a.source}</span>
                        </div>
                        <h3 className="font-bold text-white leading-snug">{a.title}</h3>
                        {a.summary && <p className="text-white/55 text-sm mt-1 line-clamp-2">{a.summary}</p>}
                        {a.countries.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <CountryFlags ids={a.countries} className="w-5 h-3.5 rounded-[2px]" />
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
              <p className="text-center text-white/25 text-[11px] mt-4">
                {webVia === "google" ? "Live from Google News" : "Found live on the web"} &mdash; not from our usual feed.
              </p>
              <div className="text-center mt-3">
                <a
                  href={googleNewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-black uppercase tracking-wide text-yellow-300/80 hover:text-yellow-200"
                >
                  More on Google News ↗
                </a>
              </div>
            </div>
          ) : webDone ? (
            <div className="text-center py-16">
              <p className="text-white/50 text-sm">
                Couldn&apos;t find anything for {searchLabel} in our feeds right now.
              </p>
              <a
                href={googleNewsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-4 text-xs font-black uppercase tracking-wide text-yellow-300 hover:text-yellow-200"
              >
                🔎 Browse {searchLabel} on Google News ↗
              </a>
            </div>
          ) : (
            <p className="text-center text-white/50 text-sm py-16">Searching the web for {searchLabel}&hellip;</p>
          )
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
