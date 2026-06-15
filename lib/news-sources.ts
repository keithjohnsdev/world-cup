// Curated RSS feeds for World Cup news aggregation. All free, no API key, no
// rate cap. Keep this list to reputable outlets — the "traction" ranking assumes
// independent editorial coverage, so the more distinct trustworthy sources the
// better the signal. Verify a feed still returns valid XML before adding it;
// outlets occasionally move their feed paths.

export interface NewsSource {
  name: string;
  url: string;
  // Article domain for this outlet (no scheme). Used to scope the Claude
  // web-search fallback to the same trusted outlets we already aggregate.
  domain: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  { name: "BBC Sport",         url: "https://feeds.bbci.co.uk/sport/football/rss.xml", domain: "bbc.com" },
  { name: "Guardian Football", url: "https://www.theguardian.com/football/rss",         domain: "theguardian.com" },
  { name: "ESPN Soccer",       url: "https://www.espn.com/espn/rss/soccer/news",         domain: "espn.com" },
  { name: "Sky Sports",        url: "https://www.skysports.com/rss/12040",               domain: "skysports.com" },
  { name: "Yahoo Sports",      url: "https://sports.yahoo.com/soccer/rss/",              domain: "sports.yahoo.com" },
  { name: "CBS Sports",        url: "https://www.cbssports.com/rss/headlines/soccer/",   domain: "cbssports.com" },
  { name: "talkSPORT",         url: "https://talksport.com/football/feed/",              domain: "talksport.com" },
  { name: "90min",             url: "https://www.90min.com/posts.rss",                   domain: "90min.com" },
];

// Additional reputable, factual outlets used only to scope the Claude web-search
// fallback (they have no usable public RSS feed, so they aren't aggregated, but
// they're trustworthy enough to surface for an on-demand query). Article domains
// only, no scheme.
const EXTRA_TRUSTED_DOMAINS = [
  "reuters.com",
  "apnews.com",
  "nytimes.com",
  "washingtonpost.com",
  "theathletic.com",
  "goal.com",
  "fourfourtwo.com",
  "espnfc.com",
  "mlssoccer.com",
  "fifa.com",
];

// Deduped allow-list of trusted article domains for the web-search fallback.
export const TRUSTED_NEWS_DOMAINS: string[] = Array.from(
  new Set([...NEWS_SOURCES.map((s) => s.domain), ...EXTRA_TRUSTED_DOMAINS]),
);
