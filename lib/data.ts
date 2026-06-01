export interface Team {
  id: string;
  name: string;
  flag: string;
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
  { id: "MEX", name: "Mexico",             flag: "🇲🇽", group: "A", seed: 13 },
  { id: "RSA", name: "South Africa",       flag: "🇿🇦", group: "A", seed: 40 },
  { id: "KOR", name: "South Korea",        flag: "🇰🇷", group: "A", seed: 21 },
  { id: "CZE", name: "Czechia",            flag: "🇨🇿", group: "A", seed: 31 },
  // Group B
  { id: "CAN", name: "Canada",             flag: "🇨🇦", group: "B", seed: 15 },
  { id: "BIH", name: "Bosnia & Herzegovina", flag: "🇧🇦", group: "B", seed: 35 },
  { id: "QAT", name: "Qatar",              flag: "🇶🇦", group: "B", seed: 39 },
  { id: "SUI", name: "Switzerland",        flag: "🇨🇭", group: "B", seed: 14 },
  // Group C
  { id: "BRA", name: "Brazil",             flag: "🇧🇷", group: "C", seed: 2  },
  { id: "MAR", name: "Morocco",            flag: "🇲🇦", group: "C", seed: 17 },
  { id: "HAI", name: "Haiti",              flag: "🇭🇹", group: "C", seed: 44 },
  { id: "SCO", name: "Scotland",           flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C", seed: 32 },
  // Group D
  { id: "USA", name: "United States",      flag: "🇺🇸", group: "D", seed: 12 },
  { id: "PAR", name: "Paraguay",           flag: "🇵🇾", group: "D", seed: 33 },
  { id: "AUS", name: "Australia",          flag: "🇦🇺", group: "D", seed: 22 },
  { id: "TUR", name: "Türkiye",            flag: "🇹🇷", group: "D", seed: 23 },
  // Group E
  { id: "GER", name: "Germany",            flag: "🇩🇪", group: "E", seed: 5  },
  { id: "CUW", name: "Curaçao",            flag: "🇨🇼", group: "E", seed: 43 },
  { id: "CIV", name: "Ivory Coast",        flag: "🇨🇮", group: "E", seed: 36 },
  { id: "ECU", name: "Ecuador",            flag: "🇪🇨", group: "E", seed: 24 },
  // Group F
  { id: "NED", name: "Netherlands",        flag: "🇳🇱", group: "F", seed: 8  },
  { id: "JPN", name: "Japan",              flag: "🇯🇵", group: "F", seed: 20 },
  { id: "SWE", name: "Sweden",             flag: "🇸🇪", group: "F", seed: 25 },
  { id: "TUN", name: "Tunisia",            flag: "🇹🇳", group: "F", seed: 37 },
  // Group G
  { id: "BEL", name: "Belgium",            flag: "🇧🇪", group: "G", seed: 9  },
  { id: "EGY", name: "Egypt",              flag: "🇪🇬", group: "G", seed: 27 },
  { id: "IRN", name: "Iran",               flag: "🇮🇷", group: "G", seed: 26 },
  { id: "NZL", name: "New Zealand",        flag: "🇳🇿", group: "G", seed: 38 },
  // Group H
  { id: "ESP", name: "Spain",              flag: "🇪🇸", group: "H", seed: 7  },
  { id: "CPV", name: "Cape Verde",         flag: "🇨🇻", group: "H", seed: 42 },
  { id: "KSA", name: "Saudi Arabia",       flag: "🇸🇦", group: "H", seed: 34 },
  { id: "URU", name: "Uruguay",            flag: "🇺🇾", group: "H", seed: 10 },
  // Group I
  { id: "FRA", name: "France",             flag: "🇫🇷", group: "I", seed: 3  },
  { id: "SEN", name: "Senegal",            flag: "🇸🇳", group: "I", seed: 18 },
  { id: "IRQ", name: "Iraq",               flag: "🇮🇶", group: "I", seed: 45 },
  { id: "NOR", name: "Norway",             flag: "🇳🇴", group: "I", seed: 16 },
  // Group J
  { id: "ARG", name: "Argentina",          flag: "🇦🇷", group: "J", seed: 1  },
  { id: "ALG", name: "Algeria",            flag: "🇩🇿", group: "J", seed: 28 },
  { id: "AUT", name: "Austria",            flag: "🇦🇹", group: "J", seed: 30 },
  { id: "JOR", name: "Jordan",             flag: "🇯🇴", group: "J", seed: 46 },
  // Group K
  { id: "POR", name: "Portugal",           flag: "🇵🇹", group: "K", seed: 6  },
  { id: "COD", name: "Congo DR",           flag: "🇨🇩", group: "K", seed: 47 },
  { id: "UZB", name: "Uzbekistan",         flag: "🇺🇿", group: "K", seed: 48 },
  { id: "COL", name: "Colombia",           flag: "🇨🇴", group: "K", seed: 11 },
  // Group L
  { id: "ENG", name: "England",            flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L", seed: 4  },
  { id: "CRO", name: "Croatia",            flag: "🇭🇷", group: "L", seed: 19 },
  { id: "GHA", name: "Ghana",              flag: "🇬🇭", group: "L", seed: 29 },
  { id: "PAN", name: "Panama",             flag: "🇵🇦", group: "L", seed: 41 },
];

export const GROUPS: Group[] = ["A","B","C","D","E","F","G","H","I","J","K","L"].map((id) => ({
  id,
  name: `Group ${id}`,
  teams: TEAMS.filter((t) => t.group === id),
}));

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
