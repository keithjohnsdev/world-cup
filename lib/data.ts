export interface Team {
  id: string;
  name: string;
  flag: string;
  cc: string; // ISO 3166-1 alpha-2 code for flag images (flagcdn.com)
  group: string;
  seed: number; // 1 = strongest, 48 = weakest — used for upset/dark horse award calculations
}

export interface Group {
  id: string;
  name: string;
  teams: Team[];
}

export const TEAMS: Team[] = [
  // Group A
  { id: "MEX", name: "Mexico",             flag: "🇲🇽", cc: "mx", group: "A", seed: 13 },
  { id: "RSA", name: "South Africa",       flag: "🇿🇦", cc: "za", group: "A", seed: 40 },
  { id: "KOR", name: "South Korea",        flag: "🇰🇷", cc: "kr", group: "A", seed: 21 },
  { id: "CZE", name: "Czechia",            flag: "🇨🇿", cc: "cz", group: "A", seed: 31 },
  // Group B
  { id: "CAN", name: "Canada",             flag: "🇨🇦", cc: "ca", group: "B", seed: 15 },
  { id: "BIH", name: "Bosnia & Herz.",     flag: "🇧🇦", cc: "ba", group: "B", seed: 35 },
  { id: "QAT", name: "Qatar",              flag: "🇶🇦", cc: "qa", group: "B", seed: 39 },
  { id: "SUI", name: "Switzerland",        flag: "🇨🇭", cc: "ch", group: "B", seed: 14 },
  // Group C
  { id: "BRA", name: "Brazil",             flag: "🇧🇷", cc: "br", group: "C", seed: 2  },
  { id: "MAR", name: "Morocco",            flag: "🇲🇦", cc: "ma", group: "C", seed: 17 },
  { id: "HAI", name: "Haiti",              flag: "🇭🇹", cc: "ht", group: "C", seed: 44 },
  { id: "SCO", name: "Scotland",           flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", cc: "gb-sct", group: "C", seed: 32 },
  // Group D
  { id: "USA", name: "United States",      flag: "🇺🇸", cc: "us", group: "D", seed: 12 },
  { id: "PAR", name: "Paraguay",           flag: "🇵🇾", cc: "py", group: "D", seed: 33 },
  { id: "AUS", name: "Australia",          flag: "🇦🇺", cc: "au", group: "D", seed: 22 },
  { id: "TUR", name: "Türkiye",            flag: "🇹🇷", cc: "tr", group: "D", seed: 23 },
  // Group E
  { id: "GER", name: "Germany",            flag: "🇩🇪", cc: "de", group: "E", seed: 5  },
  { id: "CUW", name: "Curaçao",            flag: "🇨🇼", cc: "cw", group: "E", seed: 43 },
  { id: "CIV", name: "Ivory Coast",        flag: "🇨🇮", cc: "ci", group: "E", seed: 36 },
  { id: "ECU", name: "Ecuador",            flag: "🇪🇨", cc: "ec", group: "E", seed: 24 },
  // Group F
  { id: "NED", name: "Netherlands",        flag: "🇳🇱", cc: "nl", group: "F", seed: 8  },
  { id: "JPN", name: "Japan",              flag: "🇯🇵", cc: "jp", group: "F", seed: 20 },
  { id: "SWE", name: "Sweden",             flag: "🇸🇪", cc: "se", group: "F", seed: 25 },
  { id: "TUN", name: "Tunisia",            flag: "🇹🇳", cc: "tn", group: "F", seed: 37 },
  // Group G
  { id: "BEL", name: "Belgium",            flag: "🇧🇪", cc: "be", group: "G", seed: 9  },
  { id: "EGY", name: "Egypt",              flag: "🇪🇬", cc: "eg", group: "G", seed: 27 },
  { id: "IRN", name: "Iran",               flag: "🇮🇷", cc: "ir", group: "G", seed: 26 },
  { id: "NZL", name: "New Zealand",        flag: "🇳🇿", cc: "nz", group: "G", seed: 38 },
  // Group H
  { id: "ESP", name: "Spain",              flag: "🇪🇸", cc: "es", group: "H", seed: 7  },
  { id: "CPV", name: "Cape Verde",         flag: "🇨🇻", cc: "cv", group: "H", seed: 42 },
  { id: "KSA", name: "Saudi Arabia",       flag: "🇸🇦", cc: "sa", group: "H", seed: 34 },
  { id: "URU", name: "Uruguay",            flag: "🇺🇾", cc: "uy", group: "H", seed: 10 },
  // Group I
  { id: "FRA", name: "France",             flag: "🇫🇷", cc: "fr", group: "I", seed: 3  },
  { id: "SEN", name: "Senegal",            flag: "🇸🇳", cc: "sn", group: "I", seed: 18 },
  { id: "IRQ", name: "Iraq",               flag: "🇮🇶", cc: "iq", group: "I", seed: 45 },
  { id: "NOR", name: "Norway",             flag: "🇳🇴", cc: "no", group: "I", seed: 16 },
  // Group J
  { id: "ARG", name: "Argentina",          flag: "🇦🇷", cc: "ar", group: "J", seed: 1  },
  { id: "ALG", name: "Algeria",            flag: "🇩🇿", cc: "dz", group: "J", seed: 28 },
  { id: "AUT", name: "Austria",            flag: "🇦🇹", cc: "at", group: "J", seed: 30 },
  { id: "JOR", name: "Jordan",             flag: "🇯🇴", cc: "jo", group: "J", seed: 46 },
  // Group K
  { id: "POR", name: "Portugal",           flag: "🇵🇹", cc: "pt", group: "K", seed: 6  },
  { id: "COD", name: "Congo DR",           flag: "🇨🇩", cc: "cd", group: "K", seed: 47 },
  { id: "UZB", name: "Uzbekistan",         flag: "🇺🇿", cc: "uz", group: "K", seed: 48 },
  { id: "COL", name: "Colombia",           flag: "🇨🇴", cc: "co", group: "K", seed: 11 },
  // Group L
  { id: "ENG", name: "England",            flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", cc: "gb-eng", group: "L", seed: 4  },
  { id: "CRO", name: "Croatia",            flag: "🇭🇷", cc: "hr", group: "L", seed: 19 },
  { id: "GHA", name: "Ghana",              flag: "🇬🇭", cc: "gh", group: "L", seed: 29 },
  { id: "PAN", name: "Panama",             flag: "🇵🇦", cc: "pa", group: "L", seed: 41 },
];

export const GROUPS: Group[] = ["A","B","C","D","E","F","G","H","I","J","K","L"].map((id) => ({
  id,
  name: `Group ${id}`,
  teams: TEAMS.filter((t) => t.group === id),
}));

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
