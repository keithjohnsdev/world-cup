export interface CountryPhoto {
  src: string;
  caption: string;
}

export interface CountryPhotos {
  hero: string | null;
  gallery: CountryPhoto[];
}

// Wikipedia article names for each content type per country.
// Cuisine articles follow "{Nationality} cuisine" — all verified to exist on Wikipedia.
// Culture articles follow "Culture of {country}" consistently.
// Capital articles are used for hero + landscape landmarks.
const CUISINE_ARTICLE: Record<string, string> = {
  MEX: "Mexican cuisine",
  RSA: "South African cuisine",
  KOR: "Korean cuisine",
  CZE: "Czech cuisine",
  CAN: "Canadian cuisine",
  BIH: "Bosnian cuisine",
  QAT: "Qatari cuisine",
  SUI: "Swiss cuisine",
  BRA: "Brazilian cuisine",
  MAR: "Moroccan cuisine",
  HAI: "Haitian cuisine",
  SCO: "Scottish cuisine",
  USA: "American cuisine",
  PAR: "Paraguayan cuisine",
  AUS: "Australian cuisine",
  TUR: "Turkish cuisine",
  GER: "German cuisine",
  CUW: "Curaçaoan cuisine",
  CIV: "Ivorian cuisine",
  ECU: "Ecuadorian cuisine",
  NED: "Dutch cuisine",
  JPN: "Japanese cuisine",
  SWE: "Swedish cuisine",
  TUN: "Tunisian cuisine",
  BEL: "Belgian cuisine",
  EGY: "Egyptian cuisine",
  IRN: "Iranian cuisine",
  NZL: "New Zealand cuisine",
  ESP: "Spanish cuisine",
  CPV: "Cape Verdean cuisine",
  KSA: "Saudi Arabian cuisine",
  URU: "Uruguayan cuisine",
  FRA: "French cuisine",
  SEN: "Senegalese cuisine",
  IRQ: "Iraqi cuisine",
  NOR: "Norwegian cuisine",
  ARG: "Argentine cuisine",
  ALG: "Algerian cuisine",
  AUT: "Austrian cuisine",
  JOR: "Jordanian cuisine",
  POR: "Portuguese cuisine",
  COD: "Congolese cuisine",
  UZB: "Uzbek cuisine",
  COL: "Colombian cuisine",
  ENG: "English cuisine",
  CRO: "Croatian cuisine",
  GHA: "Ghanaian cuisine",
  PAN: "Panamanian cuisine",
};

// "Culture of X" article names (a few need "the")
const CULTURE_ARTICLE: Record<string, string> = {
  USA: "Culture of the United States",
  NED: "Culture of the Netherlands",
  CZE: "Culture of the Czech Republic",
  RSA: "Culture of South Africa",
  KOR: "Culture of South Korea",
  BIH: "Culture of Bosnia and Herzegovina",
  CIV: "Culture of Ivory Coast",
  COD: "Culture of the Democratic Republic of the Congo",
  ENG: "Culture of England",
  SCO: "Culture of Scotland",
  NZL: "Culture of New Zealand",
};
function getCultureArticle(teamId: string, teamName: string): string {
  return CULTURE_ARTICLE[teamId] || `Culture of ${teamName}`;
}

interface WikiMediaItem {
  title: string;
  type: string;
  leadImage?: boolean;
  section_id?: number;
  showInGallery?: boolean;
  caption?: { text?: string };
  srcset?: { src: string; scale: string }[];
}

// Turn a Wikipedia filename into a human-readable caption fallback.
// e.g. "File:Angel-de-la-Independencia--Mexico-D.F.jpg"
//   → "Angel de la Independencia Mexico D.F."
function filenameToCaption(rawTitle: string): string {
  const base = rawTitle
    .replace(/^File:/i, "")
    .replace(/\.[^.]+$/, "");
  const decoded = decodeURIComponent(base).replace(/[_\-]+/g, " ").trim();
  // Strip parenthetical metadata like "(cropped)", "(25514321687)"
  const cleaned = decoded
    .replace(/\s*\([^)]{0,50}\)\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  // Skip pure codes/IDs — must have at least one lowercase word
  if (cleaned.length < 5 || !/[a-z]/.test(cleaned)) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function widthFromSrc(src: string): number {
  const m = src.match(/\/(\d+)px-[^/]+$/);
  return m ? parseInt(m[1], 10) : 0;
}

function toHttps(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

// Patterns that indicate non-photographic content: flags, maps, paintings, etc.
const ALWAYS_SKIP =
  /flag|coat.of.arms|emblem|seal|logo|\bmap\b|locator|silhouette|blank|painting|lithograph|engraving|fresco|tapestry|\bartwork\b|\bmural\b|illustration|still.life|manuscript|codex|\bportrait\b/i;

function extractPhotos(
  items: WikiMediaItem[],
  limit: number
): CountryPhoto[] {
  return items
    .filter((item) => {
      if (item.type !== "image") return false;
      if (item.title.toLowerCase().endsWith(".svg")) return false;
      if (ALWAYS_SKIP.test(item.title)) return false;
      if (!item.srcset?.length) return false;
      const maxW = Math.max(...item.srcset.map((s) => widthFromSrc(s.src)));
      if (maxW < 400) return false;
      return true;
    })
    .map((item) => {
      const sorted = [...(item.srcset || [])].sort(
        (a, b) => widthFromSrc(b.src) - widthFromSrc(a.src)
      );
      // Use the largest srcset size (already canonical for Wikimedia)
      const src = toHttps(sorted[0].src);
      return {
        src,
        caption: item.caption?.text?.trim() || filenameToCaption(item.title),
        leadImage: !!item.leadImage,
        sectionId: item.section_id ?? 99,
      };
    })
    .slice(0, limit);
}

const WIKIPEDIA_HEADERS = {
  // Wikipedia's API policy requires a descriptive User-Agent for automated requests.
  // Without it, requests are more aggressively rate-limited during bulk builds.
  "User-Agent":
    "JohnsiesWorldCup/1.0 (https://johnsies.vercel.app; keithjohnsdev@gmail.com)",
};

async function fetchArticlePhotos(
  articleTitle: string,
  limit: number
): Promise<CountryPhoto[]> {
  const encoded = encodeURIComponent(articleTitle.replace(/ /g, "_"));
  const url = `https://en.wikipedia.org/api/rest_v1/page/media-list/${encoded}`;

  // Retry up to 2 times with backoff — Wikipedia occasionally returns 429 or 5xx
  // during builds when many pages are generated concurrently.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
      const res = await fetch(url, {
        // Revalidate weekly — allows empty/failed caches to refresh on next build
        // rather than being permanently stuck as empty.
        next: { revalidate: 60 * 60 * 24 * 7 },
        headers: WIKIPEDIA_HEADERS,
      });
      if (res.status === 429 || res.status >= 500) continue;
      if (!res.ok) return [];
      const data = await res.json();
      return extractPhotos(data.items || [], limit);
    } catch {
      if (attempt === 2) return [];
    }
  }
  return [];
}

export async function fetchCountryPhotos(
  teamId: string,
  teamName: string,
  capital: string
): Promise<CountryPhotos> {
  const cuisineArticle = CUISINE_ARTICLE[teamId] || `${teamName} cuisine`;
  const cultureArticle = getCultureArticle(teamId, teamName);

  // Three targeted article fetches in parallel — each article contains
  // only its own theme (food, culture, city), so no historical paintings leak in
  const [cityPhotos, foodPhotos, culturePhotos] = await Promise.all([
    fetchArticlePhotos(capital, 6),
    fetchArticlePhotos(cuisineArticle, 4),
    fetchArticlePhotos(cultureArticle, 4),
  ]);

  // Hero: first photo from the capital city article (usually a skyline/panorama)
  const hero = cityPhotos[0]?.src || null;

  // Gallery: landmarks from city + food + culture, up to 9 total
  const gallery: CountryPhoto[] = [
    ...cityPhotos.slice(0, 3),
    ...foodPhotos.slice(0, 3),
    ...culturePhotos.slice(0, 3),
  ].slice(0, 9);

  return { hero, gallery };
}
