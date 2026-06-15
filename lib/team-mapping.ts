import { TEAMS } from "@/lib/data";

// Hand-coded overrides for API-Football name variants that don't match our names.
const OVERRIDES: Record<string, string> = {
  "korea republic":               "KOR",
  "south korea":                  "KOR",
  "united states":                "USA",
  "usa":                          "USA",
  "bosnia and herzegovina":       "BIH",
  "bosnia & herzegovina":         "BIH",
  "bosniaherzegovina":            "BIH", // API sends "Bosnia-Herzegovina"; hyphen is stripped on normalize
  "ivory coast":                  "CIV",
  "cote d'ivoire":                "CIV",
  "cote divoire":                 "CIV",
  "curacao":                      "CUW",
  "curaçao":                      "CUW",
  "dr congo":                     "COD",
  "congo dr":                     "COD",
  "democratic republic of congo": "COD",
  "saudi arabia":                 "KSA",
  "cape verde":                   "CPV",
  "cape verde islands":           "CPV", // football-data.org sends "Cape Verde Islands"
  "czechia":                      "CZE",
  "czech republic":               "CZE",
  "turkey":                       "TUR",
  "turkiye":                      "TUR",
  "türkiye":                      "TUR",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Build lookup from normalized our-names → team IDs
const nameToId = new Map<string, string>(
  TEAMS.map((t) => [normalize(t.name), t.id]),
);

export function apiNameToTeamId(apiName: string): string | null {
  const n = normalize(apiName);
  return OVERRIDES[n] ?? nameToId.get(n) ?? null;
}
