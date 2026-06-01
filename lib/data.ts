export interface Team {
  id: string;
  name: string;
  flag: string;
  group: string;
}

export interface Group {
  id: string;
  name: string;
  teams: Team[];
}

export const TEAMS: Team[] = [
  // Group A
  { id: "MEX", name: "Mexico", flag: "🇲🇽", group: "A" },
  { id: "RSA", name: "South Africa", flag: "🇿🇦", group: "A" },
  { id: "KOR", name: "South Korea", flag: "🇰🇷", group: "A" },
  { id: "CZE", name: "Czechia", flag: "🇨🇿", group: "A" },
  // Group B
  { id: "CAN", name: "Canada", flag: "🇨🇦", group: "B" },
  { id: "BIH", name: "Bosnia & Herzegovina", flag: "🇧🇦", group: "B" },
  { id: "QAT", name: "Qatar", flag: "🇶🇦", group: "B" },
  { id: "SUI", name: "Switzerland", flag: "🇨🇭", group: "B" },
  // Group C
  { id: "BRA", name: "Brazil", flag: "🇧🇷", group: "C" },
  { id: "MAR", name: "Morocco", flag: "🇲🇦", group: "C" },
  { id: "HAI", name: "Haiti", flag: "🇭🇹", group: "C" },
  { id: "SCO", name: "Scotland", flag: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", group: "C" },
  // Group D
  { id: "USA", name: "United States", flag: "🇺🇸", group: "D" },
  { id: "PAR", name: "Paraguay", flag: "🇵🇾", group: "D" },
  { id: "AUS", name: "Australia", flag: "🇦🇺", group: "D" },
  { id: "TUR", name: "Türkiye", flag: "🇹🇷", group: "D" },
  // Group E
  { id: "GER", name: "Germany", flag: "🇩🇪", group: "E" },
  { id: "CUW", name: "Curaçao", flag: "🇨🇼", group: "E" },
  { id: "CIV", name: "Ivory Coast", flag: "🇨🇮", group: "E" },
  { id: "ECU", name: "Ecuador", flag: "🇪🇨", group: "E" },
  // Group F
  { id: "NED", name: "Netherlands", flag: "🇳🇱", group: "F" },
  { id: "JPN", name: "Japan", flag: "🇯🇵", group: "F" },
  { id: "SWE", name: "Sweden", flag: "🇸🇪", group: "F" },
  { id: "TUN", name: "Tunisia", flag: "🇹🇳", group: "F" },
  // Group G
  { id: "BEL", name: "Belgium", flag: "🇧🇪", group: "G" },
  { id: "EGY", name: "Egypt", flag: "🇪🇬", group: "G" },
  { id: "IRN", name: "Iran", flag: "🇮🇷", group: "G" },
  { id: "NZL", name: "New Zealand", flag: "🇳🇿", group: "G" },
  // Group H
  { id: "ESP", name: "Spain", flag: "🇪🇸", group: "H" },
  { id: "CPV", name: "Cape Verde", flag: "🇨🇻", group: "H" },
  { id: "KSA", name: "Saudi Arabia", flag: "🇸🇦", group: "H" },
  { id: "URU", name: "Uruguay", flag: "🇺🇾", group: "H" },
  // Group I
  { id: "FRA", name: "France", flag: "🇫🇷", group: "I" },
  { id: "SEN", name: "Senegal", flag: "🇸🇳", group: "I" },
  { id: "IRQ", name: "Iraq", flag: "🇮🇶", group: "I" },
  { id: "NOR", name: "Norway", flag: "🇳🇴", group: "I" },
  // Group J
  { id: "ARG", name: "Argentina", flag: "🇦🇷", group: "J" },
  { id: "ALG", name: "Algeria", flag: "🇩🇿", group: "J" },
  { id: "AUT", name: "Austria", flag: "🇦🇹", group: "J" },
  { id: "JOR", name: "Jordan", flag: "🇯🇴", group: "J" },
  // Group K
  { id: "POR", name: "Portugal", flag: "🇵🇹", group: "K" },
  { id: "COD", name: "Congo DR", flag: "🇨🇩", group: "K" },
  { id: "UZB", name: "Uzbekistan", flag: "🇺🇿", group: "K" },
  { id: "COL", name: "Colombia", flag: "🇨🇴", group: "K" },
  // Group L
  { id: "ENG", name: "England", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", group: "L" },
  { id: "CRO", name: "Croatia", flag: "🇭🇷", group: "L" },
  { id: "GHA", name: "Ghana", flag: "🇬🇭", group: "L" },
  { id: "PAN", name: "Panama", flag: "🇵🇦", group: "L" },
];

export const GROUPS: Group[] = ["A","B","C","D","E","F","G","H","I","J","K","L"].map((id) => ({
  id,
  name: `Group ${id}`,
  teams: TEAMS.filter((t) => t.group === id),
}));

export function getTeam(id: string): Team | undefined {
  return TEAMS.find((t) => t.id === id);
}
