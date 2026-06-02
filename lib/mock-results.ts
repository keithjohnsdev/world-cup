// Mock group stage results for local testing.
// Used by API routes as a fallback when the results table is empty.
// Includes both final standings (group/runner/third/fourth) and individual
// match winners (stage="gm") so heart pick scoring can be tested in the UI.

import type { ResultRow } from "@/lib/scoring";

export const MOCK_GROUP_RESULTS: ResultRow[] = [
  // Group A — MEX 1st, KOR 2nd, CZE 3rd, RSA 4th
  { stage: "group",  slot: "A", team_id: "MEX", was_shootout: false },
  { stage: "runner", slot: "A", team_id: "KOR", was_shootout: false },
  { stage: "third",  slot: "A", team_id: "CZE", was_shootout: false },
  { stage: "fourth", slot: "A", team_id: "RSA", was_shootout: false },

  // Group B — SUI 1st, CAN 2nd, BIH 3rd, QAT 4th
  { stage: "group",  slot: "B", team_id: "SUI", was_shootout: false },
  { stage: "runner", slot: "B", team_id: "CAN", was_shootout: false },
  { stage: "third",  slot: "B", team_id: "BIH", was_shootout: false },
  { stage: "fourth", slot: "B", team_id: "QAT", was_shootout: false },

  // Group C — BRA 1st, MAR 2nd, SCO 3rd, HAI 4th
  { stage: "group",  slot: "C", team_id: "BRA", was_shootout: false },
  { stage: "runner", slot: "C", team_id: "MAR", was_shootout: false },
  { stage: "third",  slot: "C", team_id: "SCO", was_shootout: false },
  { stage: "fourth", slot: "C", team_id: "HAI", was_shootout: false },

  // Group D — TUR 1st, USA 2nd, AUS 3rd, PAR 4th  (Türkiye upsets USA for top spot)
  { stage: "group",  slot: "D", team_id: "TUR", was_shootout: false },
  { stage: "runner", slot: "D", team_id: "USA", was_shootout: false },
  { stage: "third",  slot: "D", team_id: "AUS", was_shootout: false },
  { stage: "fourth", slot: "D", team_id: "PAR", was_shootout: false },

  // Group E — GER 1st, ECU 2nd, CIV 3rd, CUW 4th
  { stage: "group",  slot: "E", team_id: "GER", was_shootout: false },
  { stage: "runner", slot: "E", team_id: "ECU", was_shootout: false },
  { stage: "third",  slot: "E", team_id: "CIV", was_shootout: false },
  { stage: "fourth", slot: "E", team_id: "CUW", was_shootout: false },

  // Group F — NED 1st, JPN 2nd, SWE 3rd, TUN 4th
  { stage: "group",  slot: "F", team_id: "NED", was_shootout: false },
  { stage: "runner", slot: "F", team_id: "JPN", was_shootout: false },
  { stage: "third",  slot: "F", team_id: "SWE", was_shootout: false },
  { stage: "fourth", slot: "F", team_id: "TUN", was_shootout: false },

  // Group G — BEL 1st, IRN 2nd, EGY 3rd, NZL 4th
  { stage: "group",  slot: "G", team_id: "BEL", was_shootout: false },
  { stage: "runner", slot: "G", team_id: "IRN", was_shootout: false },
  { stage: "third",  slot: "G", team_id: "EGY", was_shootout: false },
  { stage: "fourth", slot: "G", team_id: "NZL", was_shootout: false },

  // Group H — ESP 1st, URU 2nd, KSA 3rd, CPV 4th
  { stage: "group",  slot: "H", team_id: "ESP", was_shootout: false },
  { stage: "runner", slot: "H", team_id: "URU", was_shootout: false },
  { stage: "third",  slot: "H", team_id: "KSA", was_shootout: false },
  { stage: "fourth", slot: "H", team_id: "CPV", was_shootout: false },

  // Group I — FRA 1st, NOR 2nd, SEN 3rd, IRQ 4th  (Norway edges Senegal for 2nd)
  { stage: "group",  slot: "I", team_id: "FRA", was_shootout: false },
  { stage: "runner", slot: "I", team_id: "NOR", was_shootout: false },
  { stage: "third",  slot: "I", team_id: "SEN", was_shootout: false },
  { stage: "fourth", slot: "I", team_id: "IRQ", was_shootout: false },

  // Group J — ARG 1st, AUT 2nd, ALG 3rd, JOR 4th
  { stage: "group",  slot: "J", team_id: "ARG", was_shootout: false },
  { stage: "runner", slot: "J", team_id: "AUT", was_shootout: false },
  { stage: "third",  slot: "J", team_id: "ALG", was_shootout: false },
  { stage: "fourth", slot: "J", team_id: "JOR", was_shootout: false },

  // Group K — COL 1st, POR 2nd, COD 3rd, UZB 4th  (Colombia upsets Portugal for top)
  { stage: "group",  slot: "K", team_id: "COL", was_shootout: false },
  { stage: "runner", slot: "K", team_id: "POR", was_shootout: false },
  { stage: "third",  slot: "K", team_id: "COD", was_shootout: false },
  { stage: "fourth", slot: "K", team_id: "UZB", was_shootout: false },

  // Group L — ENG 1st, CRO 2nd, GHA 3rd, PAN 4th
  { stage: "group",  slot: "L", team_id: "ENG", was_shootout: false },
  { stage: "runner", slot: "L", team_id: "CRO", was_shootout: false },
  { stage: "third",  slot: "L", team_id: "GHA", was_shootout: false },
  { stage: "fourth", slot: "L", team_id: "PAN", was_shootout: false },

  // ── Individual match winners (gm rows) — used for heart pick scoring ──────
  // 3 matches per team across the group stage. Winners match the final standings above.
  // Slot = fake fixture ID (50001–50035). Draws produce no gm row (no winner to count).
  { stage: "gm", slot: "50001", team_id: "MEX", was_shootout: false }, // MEX win
  { stage: "gm", slot: "50002", team_id: "KOR", was_shootout: false }, // KOR win
  { stage: "gm", slot: "50003", team_id: "MEX", was_shootout: false }, // MEX win
  { stage: "gm", slot: "50004", team_id: "SUI", was_shootout: false }, // SUI win
  { stage: "gm", slot: "50005", team_id: "CAN", was_shootout: false }, // CAN win
  { stage: "gm", slot: "50006", team_id: "SUI", was_shootout: false }, // SUI win
  { stage: "gm", slot: "50007", team_id: "BRA", was_shootout: false }, // BRA win
  { stage: "gm", slot: "50008", team_id: "BRA", was_shootout: false }, // BRA win
  { stage: "gm", slot: "50009", team_id: "MAR", was_shootout: false }, // MAR win
  { stage: "gm", slot: "50010", team_id: "USA", was_shootout: false }, // USA win
  { stage: "gm", slot: "50011", team_id: "TUR", was_shootout: false }, // TUR win (upset)
  { stage: "gm", slot: "50012", team_id: "TUR", was_shootout: false }, // TUR win
  { stage: "gm", slot: "50013", team_id: "GER", was_shootout: false }, // GER win
  { stage: "gm", slot: "50014", team_id: "GER", was_shootout: false }, // GER win
  { stage: "gm", slot: "50015", team_id: "ECU", was_shootout: false }, // ECU win
  { stage: "gm", slot: "50016", team_id: "NED", was_shootout: false }, // NED win
  { stage: "gm", slot: "50017", team_id: "NED", was_shootout: false }, // NED win
  { stage: "gm", slot: "50018", team_id: "JPN", was_shootout: false }, // JPN win
  { stage: "gm", slot: "50019", team_id: "BEL", was_shootout: false }, // BEL win
  { stage: "gm", slot: "50020", team_id: "BEL", was_shootout: false }, // BEL win
  { stage: "gm", slot: "50021", team_id: "IRN", was_shootout: false }, // IRN win
  { stage: "gm", slot: "50022", team_id: "ESP", was_shootout: false }, // ESP win
  { stage: "gm", slot: "50023", team_id: "ESP", was_shootout: false }, // ESP win
  { stage: "gm", slot: "50024", team_id: "URU", was_shootout: false }, // URU win
  { stage: "gm", slot: "50025", team_id: "FRA", was_shootout: false }, // FRA win
  { stage: "gm", slot: "50026", team_id: "FRA", was_shootout: false }, // FRA win
  { stage: "gm", slot: "50027", team_id: "NOR", was_shootout: false }, // NOR win
  { stage: "gm", slot: "50028", team_id: "ARG", was_shootout: false }, // ARG win
  { stage: "gm", slot: "50029", team_id: "ARG", was_shootout: false }, // ARG win
  { stage: "gm", slot: "50030", team_id: "AUT", was_shootout: false }, // AUT win
  { stage: "gm", slot: "50031", team_id: "COL", was_shootout: false }, // COL win (upset)
  { stage: "gm", slot: "50032", team_id: "COL", was_shootout: false }, // COL win
  { stage: "gm", slot: "50033", team_id: "POR", was_shootout: false }, // POR win
  { stage: "gm", slot: "50034", team_id: "ENG", was_shootout: false }, // ENG win
  { stage: "gm", slot: "50035", team_id: "ENG", was_shootout: false }, // ENG win
  { stage: "gm", slot: "50036", team_id: "CRO", was_shootout: false }, // CRO win
];
