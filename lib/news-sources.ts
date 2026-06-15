// Curated RSS feeds for World Cup news aggregation. All free, no API key, no
// rate cap. Keep this list to reputable outlets — the "traction" ranking assumes
// independent editorial coverage, so the more distinct trustworthy sources the
// better the signal. Verify a feed still returns valid XML before adding it;
// outlets occasionally move their feed paths.

export interface NewsSource {
  name: string;
  url: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  { name: "BBC Sport",         url: "https://feeds.bbci.co.uk/sport/football/rss.xml" },
  { name: "Guardian Football", url: "https://www.theguardian.com/football/rss" },
  { name: "ESPN Soccer",       url: "https://www.espn.com/espn/rss/soccer/news" },
  { name: "Sky Sports",        url: "https://www.skysports.com/rss/12040" },
  { name: "Yahoo Sports",      url: "https://sports.yahoo.com/soccer/rss/" },
  { name: "CBS Sports",        url: "https://www.cbssports.com/rss/headlines/soccer/" },
];
