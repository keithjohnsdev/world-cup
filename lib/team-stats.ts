export interface TeamStats {
  fifaRank: number;
  coach: string;
  formation: string;
  lineup: string[]; // 11 starters: GK, then each formation line
  winOdds: number;  // % chance to win the tournament (e.g. 18 = 18%)
}

export const TEAM_STATS: Record<string, TeamStats> = {

  // ── Group A ───────────────────────────────────────────────────────────
  MEX: {
    fifaRank: 13,
    coach: "Javier Aguirre",
    formation: "4-3-3",
    lineup: ["G. Ochoa", "J. Sánchez", "C. Montes", "J. Vásquez", "G. Reyes", "E. Álvarez", "H. Herrera", "C. Rodríguez", "H. Lozano", "R. Jiménez", "S. Córdova"],
    winOdds: 0.8,
  },
  RSA: {
    fifaRank: 67,
    coach: "Hugo Broos",
    formation: "4-4-2",
    lineup: ["R. Williams", "S. Terblanche", "S. Modise", "M. Mobbie", "N. Mthembu", "T. Hlongwane", "I. Maart", "T. Zwane", "P. Mosele", "P. Lepasa", "B. Mothiba"],
    winOdds: 0.05,
  },
  KOR: {
    fifaRank: 22,
    coach: "Hong Myung-bo",
    formation: "4-2-3-1",
    lineup: ["S. Kim", "M. Kim", "Y. Kim", "K. Kim", "J. Lee", "I. Hwang", "W. Jung", "H. Son", "C. Kwon", "B. Hwang", "S. Cho"],
    winOdds: 0.3,
  },
  CZE: {
    fifaRank: 36,
    coach: "Ivan Hašek",
    formation: "4-2-3-1",
    lineup: ["J. Staněk", "V. Coufal", "T. Holeš", "L. Holeš", "D. Jurásek", "T. Souček", "A. Barák", "M. Provod", "P. Šulc", "J. Kuchta", "O. Lingr"],
    winOdds: 0.08,
  },

  // ── Group B ───────────────────────────────────────────────────────────
  CAN: {
    fifaRank: 36,
    coach: "Jesse Marsch",
    formation: "4-3-3",
    lineup: ["M. Crepeau", "A. Johnston", "K. Miller", "S. Vitoria", "A. Davies", "T. Osorio", "S. Eustaquio", "I. Buchanan", "J. David", "C. Larin", "J. Hoilett"],
    winOdds: 0.5,
  },
  BIH: {
    fifaRank: 52,
    coach: "Sergej Barbarez",
    formation: "4-3-3",
    lineup: ["I. Petković", "E. Bicakcic", "D. Šunjić", "M. Krišto", "S. Kolasinac", "M. Kvesić", "H. Pjanić", "V. Lulić", "S. Stevanović", "E. Džeko", "M. Gigović"],
    winOdds: 0.05,
  },
  QAT: {
    fifaRank: 38,
    coach: "Tintin Marquez",
    formation: "4-3-3",
    lineup: ["M. Barsham", "P. Miguel", "B. Khoukhi", "A. Al-Rawi", "H. Hatim", "K. Boudiaf", "Y. Al-Malki", "A. Afif", "H. Al-Haydos", "A. Almoez", "M. Muntari"],
    winOdds: 0.03,
  },
  SUI: {
    fifaRank: 13,
    coach: "Murat Yakin",
    formation: "4-2-3-1",
    lineup: ["Y. Sommer", "S. Widmer", "M. Akanji", "F. Schär", "R. Rodríguez", "G. Xhaka", "R. Freuler", "X. Shaqiri", "D. Zakaria", "B. Embolo", "N. Okafor"],
    winOdds: 0.6,
  },

  // ── Group C ───────────────────────────────────────────────────────────
  BRA: {
    fifaRank: 5,
    coach: "Dorival Júnior",
    formation: "4-2-3-1",
    lineup: ["Alisson", "Danilo", "Marquinhos", "G. Magalhães", "G. Arana", "Bruno Guimarães", "Gerson", "Rodrygo", "Lucas Paquetá", "Vinícius Jr", "Endrick"],
    winOdds: 11,
  },
  MAR: {
    fifaRank: 18,
    coach: "Walid Regragui",
    formation: "4-3-3",
    lineup: ["Y. Bounou", "A. Hakimi", "R. Saïss", "N. Aguerd", "N. Masina", "S. Amrabat", "A. Ounahi", "I. Ziyech", "H. Ziyech", "Y. En-Nesyri", "S. Boufal"],
    winOdds: 0.7,
  },
  HAI: {
    fifaRank: 83,
    coach: "Marc Collat",
    formation: "4-4-2",
    lineup: ["O. Guichard", "G. Laguerre", "J. Pierre", "N. Mésidor", "K. Senat", "V. Vorbe", "A. Antoine", "D. Guerrier", "J. Prophète", "D. Chery", "K. Larrieux"],
    winOdds: 0.02,
  },
  SCO: {
    fifaRank: 28,
    coach: "Steve Clarke",
    formation: "3-5-2",
    lineup: ["A. Gunn", "L. Taylor", "G. Hanley", "K. Tierney", "A. Robertson", "C. McGregor", "B. Gilmour", "J. McGinn", "R. Christie", "S. McTominay", "L. Dykes"],
    winOdds: 0.15,
  },

  // ── Group D ───────────────────────────────────────────────────────────
  USA: {
    fifaRank: 11,
    coach: "Mauricio Pochettino",
    formation: "4-3-3",
    lineup: ["M. Turner", "S. Dest", "T. Richards", "C. Richards", "A. Robinson", "W. McKennie", "Y. Musah", "T. Aaronson", "C. Pulisic", "F. Pepi", "G. Reyna"],
    winOdds: 1.0,
  },
  PAR: {
    fifaRank: 49,
    coach: "Gustavo Alfaro",
    formation: "4-4-2",
    lineup: ["A. Silva", "R. Rojas", "G. Gómez", "J. Alonso", "J. Espínola", "R. Villasanti", "M. Cubas", "J. Enciso", "M. Almirón", "A. Sanabria", "D. Valdez"],
    winOdds: 0.1,
  },
  AUS: {
    fifaRank: 23,
    coach: "Tony Popovic",
    formation: "4-3-3",
    lineup: ["M. Ryan", "N. Atkinson", "H. Souttar", "K. Rowles", "A. Behich", "A. Mooy", "J. Irvine", "M. Leckie", "M. Devlin", "M. Duke", "M. Goodwin"],
    winOdds: 0.3,
  },
  TUR: {
    fifaRank: 24,
    coach: "Vincenzo Montella",
    formation: "4-2-3-1",
    lineup: ["A. Günok", "Z. Çelik", "M. Demiral", "K. Ayhan", "F. Kadioglu", "H. Çalhanoğlu", "S. Özcan", "K. Aktürkoğlu", "A. Güler", "Y. Yıldız", "B. Yılmaz"],
    winOdds: 0.4,
  },

  // ── Group E ───────────────────────────────────────────────────────────
  GER: {
    fifaRank: 12,
    coach: "Julian Nagelsmann",
    formation: "4-2-3-1",
    lineup: ["M. Neuer", "J. Kimmich", "A. Rüdiger", "J. Tah", "M. Mittelstädt", "R. Andrich", "I. Gündogan", "F. Wirtz", "J. Musiala", "T. Müller", "K. Havertz"],
    winOdds: 7,
  },
  CUW: {
    fifaRank: 81,
    coach: "Stanley Menzo",
    formation: "4-4-2",
    lineup: ["E. Cijntje", "T. Osepa", "V. Thomas", "A. Cijntje", "O. Flemming", "L. Aias", "R. Aias", "D. Berg", "Q. Pinas", "C. Pinedo", "J. Croes"],
    winOdds: 0.02,
  },
  CIV: {
    fifaRank: 55,
    coach: "Emerse Faé",
    formation: "4-3-3",
    lineup: ["Y. Fofana", "W. Deli", "J. Gosso", "E. Bailly", "G. Konan", "F. Kessié", "I. Sangaré", "S. Fofana", "N. Pépé", "W. Zaha", "S. Haller"],
    winOdds: 0.15,
  },
  ECU: {
    fifaRank: 30,
    coach: "Félix Sánchez",
    formation: "4-3-3",
    lineup: ["H. Domínguez", "A. Preciado", "F. Hincapié", "P. Arboleda", "P. Estupiñán", "A. Gruezo", "J. Sarmiento", "M. Caicedo", "G. Plata", "E. Cifuentes", "J. Méndez"],
    winOdds: 0.2,
  },

  // ── Group F ───────────────────────────────────────────────────────────
  NED: {
    fifaRank: 8,
    coach: "Ronald Koeman",
    formation: "4-3-3",
    lineup: ["B. Flekken", "D. Dumfries", "S. De Vrij", "V. Van Dijk", "N. Aké", "J. Schouten", "F. De Jong", "X. Simons", "C. Gakpo", "W. Weghorst", "D. Frimpong"],
    winOdds: 4,
  },
  JPN: {
    fifaRank: 14,
    coach: "Hajime Moriyasu",
    formation: "4-2-3-1",
    lineup: ["S. Gonda", "H. Sakai", "M. Itakura", "K. Tomiyasu", "Y. Nagatomo", "W. Endo", "H. Morita", "T. Minamino", "K. Doan", "D. Ito", "A. Ueda"],
    winOdds: 0.8,
  },
  SWE: {
    fifaRank: 26,
    coach: "Jon Dahl Tomasson",
    formation: "4-3-3",
    lineup: ["R. Olsen", "M. Lustig", "V. Lindelöf", "I. Hien", "L. Augustinsson", "D. Kulusevski", "A. Ekdal", "E. Forsberg", "A. Isak", "V. Gyökeres", "D. Elanga"],
    winOdds: 0.3,
  },
  TUN: {
    fifaRank: 35,
    coach: "Jalel Kadri",
    formation: "4-3-3",
    lineup: ["A. Dahmen", "M. Drager", "D. Bronn", "M. Talbi", "A. Abdi", "A. Laidouni", "E. Skhiri", "Y. Msakni", "N. Sliti", "W. Khazri", "H. Slimane"],
    winOdds: 0.1,
  },

  // ── Group G ───────────────────────────────────────────────────────────
  BEL: {
    fifaRank: 6,
    coach: "Domenico Tedesco",
    formation: "4-3-3",
    lineup: ["K. Casteels", "T. Castagne", "W. Faes", "J. Vertonghen", "T. Hazard", "Y. Tielemans", "K. De Bruyne", "J. Doku", "L. Openda", "R. Lukaku", "L. De Smet"],
    winOdds: 2,
  },
  EGY: {
    fifaRank: 33,
    coach: "Hossam El-Badry",
    formation: "4-2-3-1",
    lineup: ["M. El-Shennawy", "K. El-Ahmadi", "A. Hegazi", "O. Kamal", "A. Ashraf", "T. Hamed", "M. El-Nenny", "O. Marmoush", "R. El-Gaber", "M. Salah", "M. Sharaby"],
    winOdds: 0.1,
  },
  IRN: {
    fifaRank: 21,
    coach: "Amir Ghalenoei",
    formation: "4-3-3",
    lineup: ["A. Beiranvand", "S. Moharrami", "M. Hosseini", "M. Pouraliganji", "E. Hajsafi", "S. Ezatolahi", "A. Noorollahi", "M. Cheshmi", "M. Taremi", "S. Azmoun", "V. Amiri"],
    winOdds: 0.1,
  },
  NZL: {
    fifaRank: 95,
    coach: "Darren Bazeley",
    formation: "4-4-2",
    lineup: ["O. Sail", "B. Old", "N. Surman", "D. Rawlinson", "B. Smith", "A. Rojas", "B. Wood", "L. Brockie", "C. Wood", "M. Fisher", "J. Garbett"],
    winOdds: 0.02,
  },

  // ── Group H ───────────────────────────────────────────────────────────
  ESP: {
    fifaRank: 3,
    coach: "Luis de la Fuente",
    formation: "4-3-3",
    lineup: ["Unai Simón", "D. Carvajal", "R. Le Normand", "A. Laporte", "M. Cucurella", "Pedri", "Rodri", "F. Ruiz", "L. Yamal", "A. Morata", "Nico Williams"],
    winOdds: 9,
  },
  CPV: {
    fifaRank: 61,
    coach: "Bubista",
    formation: "4-4-2",
    lineup: ["L. Varela", "S. Lopes", "F. Semedo", "J. Graça", "E. Tavares", "P. Correia", "F. Rodrigues", "D. Monteiro", "G. Tavares", "Z. Tavares", "R. Andrade"],
    winOdds: 0.02,
  },
  KSA: {
    fifaRank: 57,
    coach: "Roberto Mancini",
    formation: "4-3-3",
    lineup: ["M. Al-Owais", "S. Al-Burayk", "A. Al-Amri", "A. Tambakti", "Y. Al-Shahrani", "A. Al-Malki", "M. Kanno", "S. Al-Dawsari", "F. Al-Burayk", "S. Al-Shehri", "H. Al-Qahtani"],
    winOdds: 0.08,
  },
  URU: {
    fifaRank: 15,
    coach: "Marcelo Bielsa",
    formation: "4-4-2",
    lineup: ["S. Rochet", "N. Nández", "J. Giménez", "R. Araújo", "M. Olivera", "F. Valverde", "M. Ugarte", "T. Vecino", "D. Núñez", "E. Cavani", "L. Suárez"],
    winOdds: 1.5,
  },

  // ── Group I ───────────────────────────────────────────────────────────
  FRA: {
    fifaRank: 2,
    coach: "Didier Deschamps",
    formation: "4-3-3",
    lineup: ["M. Maignan", "J. Koundé", "D. Upamecano", "W. Saliba", "T. Hernández", "A. Tchouaméni", "E. Camavinga", "A. Griezmann", "K. Mbappé", "M. Thuram", "O. Dembélé"],
    winOdds: 15,
  },
  SEN: {
    fifaRank: 20,
    coach: "Aliou Cissé",
    formation: "4-3-3",
    lineup: ["E. Mendy", "S. Sabaly", "K. Kouyaté", "A. Niakhate", "F. Mendy", "P. Gueye", "N. Mendy", "I. Sarr", "S. Mané", "B. Diallo", "N. Dia"],
    winOdds: 0.7,
  },
  IRQ: {
    fifaRank: 62,
    coach: "Jesús Casas",
    formation: "4-3-3",
    lineup: ["J. Hamid", "A. Al-Hamrani", "A. Karim", "H. Ali", "M. Al-Rashid", "H. Balla", "A. Latif", "A. Ibrahim", "M. Kareem", "A. Hassan", "I. Ahmed"],
    winOdds: 0.05,
  },
  NOR: {
    fifaRank: 24,
    coach: "Ståle Solbakken",
    formation: "4-3-3",
    lineup: ["Ø. Nyland", "K. Pedersen", "L. Andersen", "A. Østigård", "M. Ryerson", "S. Berge", "M. Ødegaard", "F. Aursnes", "A. Sørloth", "E. Haaland", "V. Solbakken"],
    winOdds: 0.4,
  },

  // ── Group J ───────────────────────────────────────────────────────────
  ARG: {
    fifaRank: 1,
    coach: "Lionel Scaloni",
    formation: "4-3-3",
    lineup: ["E. Martínez", "G. Montiel", "C. Romero", "L. Martínez", "N. Tagliafico", "R. De Paul", "E. Fernández", "A. Mac Allister", "L. Messi", "J. Álvarez", "A. Dybala"],
    winOdds: 18,
  },
  ALG: {
    fifaRank: 30,
    coach: "Vladimir Petkovic",
    formation: "4-3-3",
    lineup: ["R. M'Bolhi", "A. Mandi", "D. Benlamri", "R. Bensebaini", "S. Atal", "I. Bennacer", "A. Zerrouki", "S. Feghouli", "R. Mahrez", "A. Belaïli", "B. Bounedjah"],
    winOdds: 0.2,
  },
  AUT: {
    fifaRank: 25,
    coach: "Ralf Rangnick",
    formation: "4-2-3-1",
    lineup: ["P. Pentz", "S. Posch", "K. Lienhart", "M. Wöber", "P. Mwene", "N. Seiwald", "K. Laimer", "M. Sabitzer", "F. Kainz", "C. Baumgartner", "M. Arnautovic"],
    winOdds: 0.3,
  },
  JOR: {
    fifaRank: 73,
    coach: "Hussain Ammouta",
    formation: "4-4-2",
    lineup: ["Y. Al-Nimer", "M. Al-Dmeiri", "O. Othman", "B. Al-Azzam", "A. Al-Rawabdeh", "M. Al-Taamari", "T. Al-Bawab", "A. Al-Aqrabawi", "Y. Al-Bakkar", "M. Homaidi", "Y. Al-Deheissat"],
    winOdds: 0.03,
  },

  // ── Group K ───────────────────────────────────────────────────────────
  POR: {
    fifaRank: 7,
    coach: "Roberto Martínez",
    formation: "4-3-3",
    lineup: ["D. Costa", "J. Cancelo", "R. Dias", "G. Inácio", "N. Mendes", "B. Silva", "J. Palhinha", "B. Fernandes", "D. Jota", "C. Ronaldo", "R. Leão"],
    winOdds: 6,
  },
  COD: {
    fifaRank: 57,
    coach: "Sébastien Desabre",
    formation: "4-3-3",
    lineup: ["J. Kiassumbua", "W. Bope", "C. Mbemba", "L. Tisserand", "A. Masuaku", "N. Kebano", "P. Muamba", "Y. Luyindama", "C. Bakambu", "D. Mbokani", "G. Kakuta"],
    winOdds: 0.1,
  },
  UZB: {
    fifaRank: 59,
    coach: "Srečko Katanec",
    formation: "4-3-3",
    lineup: ["N. Nishonov", "D. Mirzaev", "J. Qodirov", "S. Tursunov", "O. Jaloliddinov", "J. Masharipov", "O. Shodiev", "A. Suyunov", "A. Ismoilov", "E. Shomurodov", "R. Negmatov"],
    winOdds: 0.05,
  },
  COL: {
    fifaRank: 19,
    coach: "Néstor Lorenzo",
    formation: "4-2-3-1",
    lineup: ["D. Ospina", "D. Muñoz", "D. Sánchez", "C. Cuesta", "J. Mojica", "W. Barrios", "M. Castaño", "J. Cuadrado", "J. Carrascal", "L. Díaz", "R. Borré"],
    winOdds: 1.5,
  },

  // ── Group L ───────────────────────────────────────────────────────────
  ENG: {
    fifaRank: 4,
    coach: "Thomas Tuchel",
    formation: "4-3-3",
    lineup: ["J. Pickford", "T. Alexander-Arnold", "J. Stones", "H. Maguire", "K. Trippier", "J. Bellingham", "D. Rice", "P. Foden", "B. Saka", "H. Kane", "M. Rashford"],
    winOdds: 8,
  },
  CRO: {
    fifaRank: 10,
    coach: "Zlatko Dalić",
    formation: "4-3-3",
    lineup: ["D. Livaković", "J. Stanišić", "D. Vida", "J. Gvardiol", "B. Sosa", "L. Modrić", "M. Brozović", "M. Kovačić", "I. Perišić", "A. Kramarić", "N. Vlašić"],
    winOdds: 1.0,
  },
  GHA: {
    fifaRank: 60,
    coach: "Otto Addo",
    formation: "4-2-3-1",
    lineup: ["L. Ati-Zigi", "A. Lamptey", "A. Amartey", "E. Amankwah", "T. Mensah", "T. Partey", "B. Sarr", "M. Kudus", "J. Ayew", "I. Sulemana", "O. Semenyo"],
    winOdds: 0.2,
  },
  PAN: {
    fifaRank: 63,
    coach: "Thomas Christiansen",
    formation: "4-4-2",
    lineup: ["L. Mejía", "É. Davis", "A. Murillo", "R. Miller", "M. Mosquera", "J. Asprilla", "A. Godoy", "J. Quintero", "R. Torres", "A. Fajardo", "C. Mora"],
    winOdds: 0.02,
  },
};
