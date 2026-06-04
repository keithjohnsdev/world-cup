// Wikipedia article title overrides — for team names that don't match Wikipedia's exact article title
const WIKI_TITLE_OVERRIDES: Record<string, string> = {
  CZE: "Czech Republic",
  BIH: "Bosnia and Herzegovina",
  TUR: "Turkey",
  CIV: "Ivory Coast",
  COD: "Democratic Republic of the Congo",
  SCO: "Scotland",
  ENG: "England",
  KSA: "Saudi Arabia",
  CPV: "Cape Verde",
  RSA: "South Africa",
  USA: "United States",
  NED: "Netherlands",
  IRN: "Iran",
  NZL: "New Zealand",
  CUW: "Curaçao",
};

function getWikiTitle(teamId: string, teamName: string): string {
  return WIKI_TITLE_OVERRIDES[teamId] || teamName;
}

const SKIP_PATTERNS = [
  /flag/i, /map/i, /coat.of.arms/i, /arms/i, /emblem/i,
  /seal/i, /logo/i, /icon/i, /locator/i, /location/i,
  /shield/i, /badge/i, /blank/i, /outline/i, /template/i,
  /silhouette/i, /graph/i, /chart/i, /diagram/i, /administrative/i,
];

// Title keywords that suggest a scenic/wide shot — these get promoted to hero candidates
const HERO_HINTS = /skyline|panoram|aerial|cityscape|landscape|skyscape|horizon|downtown|bird.?s.eye/i;

function isGoodPhotoTitle(title: string): boolean {
  // Skip SVG (usually flags, maps, icons)
  if (title.toLowerCase().endsWith(".svg")) return false;
  return !SKIP_PATTERNS.some((p) => p.test(title));
}

function toHttps(src: string): string {
  return src.startsWith("//") ? `https:${src}` : src;
}

// Guess width from the srcset URL (e.g. "...1280px-File.jpg" → 1280)
function widthFromSrc(src: string): number {
  const m = src.match(/\/(\d+)px-[^/]+$/);
  return m ? parseInt(m[1], 10) : 0;
}

export interface CountryPhoto {
  src: string;
  caption: string;
}

export interface CountryPhotos {
  hero: string | null;
  gallery: CountryPhoto[];
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

export async function fetchCountryPhotos(
  teamId: string,
  teamName: string
): Promise<CountryPhotos> {
  const title = getWikiTitle(teamId, teamName);
  const encoded = encodeURIComponent(title.replace(/ /g, "_"));

  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/media-list/${encoded}`,
      { cache: "force-cache" }
    );
    if (!res.ok) return { hero: null, gallery: [] };

    const data = await res.json();
    const items: WikiMediaItem[] = data.items || [];

    const photos = items
      .filter((item) => {
        if (item.type !== "image") return false;
        if (!isGoodPhotoTitle(item.title)) return false;
        if (!item.srcset?.length) return false;
        // Must have at least one reasonably-sized source
        const maxW = Math.max(...item.srcset.map((s) => widthFromSrc(s.src)));
        if (maxW < 400) return false;
        return true;
      })
      .map((item) => {
        // Use the largest available srcset entry — Wikimedia only serves
        // thumbnails at canonical widths, so we can't request arbitrary sizes
        const sorted = [...(item.srcset || [])].sort(
          (a, b) => widthFromSrc(b.src) - widthFromSrc(a.src)
        );
        const largest = toHttps(sorted[0].src);
        // For gallery thumbnails, prefer a smaller size if available (saves bandwidth)
        const smaller = sorted.find((s) => widthFromSrc(s.src) <= 1000);
        const galleryUrl = smaller ? toHttps(smaller.src) : largest;
        return {
          heroSrc: largest,
          gallerySrc: galleryUrl,
          caption: item.caption?.text?.trim() || "",
          leadImage: !!item.leadImage,
          sectionId: item.section_id ?? 99,
          heroHint: HERO_HINTS.test(item.title),
        };
      });

    // Hero priority: leadImage → scenic hint → early section → first photo
    const hero =
      photos.find((p) => p.leadImage)?.heroSrc ||
      photos.find((p) => p.heroHint)?.heroSrc ||
      photos.find((p) => p.sectionId <= 2)?.heroSrc ||
      photos[0]?.heroSrc ||
      null;

    const gallery: CountryPhoto[] = photos.slice(0, 9).map((p) => ({
      src: p.gallerySrc,
      caption: p.caption,
    }));

    return { hero, gallery };
  } catch {
    return { hero: null, gallery: [] };
  }
}
