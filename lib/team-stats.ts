export interface TeamStats {
  fifaRank: number;
  coach: string;
  formation: string;
  lineup: string[]; // 11 starters: GK, then each formation line
  winOdds: number;        // % chance to win the tournament (e.g. 18 = 18%)
  groupAdvanceOdds: number; // % chance to finish top 2 and advance (per group, pairs sum to ~200%)
}

export const TEAM_STATS: Record<string, TeamStats> = {

  // ── Group A ── MEX KOR CZE RSA ────────────────────────────────────────
  MEX: { fifaRank: 13, coach: "Javier Aguirre",      formation: "4-3-3",   lineup: ["G. Ochoa", "J. Sánchez", "C. Montes", "J. Vásquez", "J. Gallardo", "E. Álvarez", "L. Romo", "O. Pineda", "C. Huerta", "S. Gimenez", "R. Jiménez"],                          winOdds: 0.8,  groupAdvanceOdds: 65 },
  KOR: { fifaRank: 22, coach: "Hong Myung-Bo",        formation: "4-2-3-1", lineup: ["J. Hyun-Woo", "K. Moon-Hwan", "K. Min-Jae", "L. Han-Beom", "J. Yu-Min", "H. In-Beom", "B. Jun-Ho", "L. Kang-In", "H. Hee-Chan", "L. Jae-Sung", "Son Heung-Min"],            winOdds: 0.3,  groupAdvanceOdds: 55 },
  CZE: { fifaRank: 36, coach: "Miroslav Koubek",      formation: "4-2-3-1", lineup: ["J. Staněk", "V. Coufal", "R. Hranáč", "L. Krejčí", "D. Jurásek", "T. Souček", "M. Sadílek", "L. Provod", "A. Hložek", "P. Schick", "T. Chorý"],                             winOdds: 0.08, groupAdvanceOdds: 45 },
  RSA: { fifaRank: 67, coach: "Hugo Broos",            formation: "4-4-2",   lineup: ["R. Williams", "K. Mudau", "N. Sibisi", "I. Okon", "A. Modiba", "T. Mokoena", "T. Mbatha", "J. Adams", "O. Appollis", "E. Makgopa", "L. Foster"],                              winOdds: 0.05, groupAdvanceOdds: 35 },

  // ── Group B ── SUI CAN BIH QAT ────────────────────────────────────────
  SUI: { fifaRank: 13, coach: "Murat Yakin",           formation: "4-2-3-1", lineup: ["G. Kobel", "S. Widmer", "M. Akanji", "N. Elvedi", "R. Rodriguez", "G. Xhaka", "R. Freuler", "R. Vargas", "A. Jashari", "B. Embolo", "N. Okafor"],                            winOdds: 0.6,  groupAdvanceOdds: 60 },
  CAN: { fifaRank: 36, coach: "Jesse Marsch",          formation: "4-3-3",   lineup: ["D. St. Clair", "A. Johnston", "D. Cornelius", "M. Bombito", "A. Davies", "S. Eustáquio", "I. Koné", "T. Buchanan", "J. David", "C. Larin", "T. Oluwaseyi"],                  winOdds: 0.5,  groupAdvanceOdds: 58 },
  BIH: { fifaRank: 52, coach: "Sergej Barbarez",       formation: "4-3-3",   lineup: ["N. Vasilj", "A. Dedic", "N. Katic", "D. Hadzikadunic", "S. Kolasinac", "A. Hadziahmetovic", "B. Tahirovic", "I. Sunjic", "E. Demirovic", "E. Dzeko", "H. Tabakovic"],        winOdds: 0.05, groupAdvanceOdds: 42 },
  QAT: { fifaRank: 38, coach: "Julen Lopetegui",       formation: "4-3-3",   lineup: ["M. Barsham", "P. Miguel", "B. Khoukhi", "L. Mendes", "H. Al-Amin", "A. Madibo", "K. Boudiaf", "A. Hatem", "A. Afif", "A. Ali", "E. Junior"],                                 winOdds: 0.03, groupAdvanceOdds: 40 },

  // ── Group C ── BRA MAR SCO HAI ────────────────────────────────────────
  BRA: { fifaRank: 5,  coach: "Carlo Ancelotti",       formation: "4-3-3",   lineup: ["Alisson", "Danilo", "Marquinhos", "G. Magalhães", "A. Sandro", "Bruno Guimarães", "Casemiro", "L. Paquetá", "Neymar", "Vinícius Jr", "Endrick"],                              winOdds: 11,   groupAdvanceOdds: 88 },
  MAR: { fifaRank: 18, coach: "Mohamed Ouahbi",        formation: "4-3-3",   lineup: ["Y. Bounou", "A. Hakimi", "N. Aguerd", "C. Riad", "N. Mazraoui", "S. Amrabat", "A. Ounahi", "B. El Khannouss", "B. Díaz", "A. El Kaabi", "A. Ezzalzouli"],                    winOdds: 0.7,  groupAdvanceOdds: 60 },
  SCO: { fifaRank: 28, coach: "Steve Clarke",          formation: "3-5-2",   lineup: ["A. Gunn", "G. Hanley", "J. Hendry", "S. McKenna", "A. Robertson", "S. McTominay", "J. McGinn", "B. Gilmour", "A. Hickey", "L. Shankland", "L. Dykes"],                       winOdds: 0.15, groupAdvanceOdds: 42 },
  HAI: { fifaRank: 83, coach: "Sebastien Migne",       formation: "4-4-2",   lineup: ["J. Placide", "C. Arcus", "J. Duverne", "D. Lacroix", "H. Delcroix", "J. Bellegarde", "D. Jean Jacques", "L. Pierre", "D. Simon", "W. Isidor", "D. Nazon"],                   winOdds: 0.02, groupAdvanceOdds: 10 },

  // ── Group D ── USA TUR AUS PAR ────────────────────────────────────────
  USA: { fifaRank: 11, coach: "Mauricio Pochettino",   formation: "4-3-3",   lineup: ["M. Turner", "S. Dest", "C. Richards", "M. Robinson", "A. Robinson", "T. Adams", "W. McKennie", "B. Aaronson", "C. Pulisic", "F. Balogun", "G. Reyna"],                        winOdds: 1.0,  groupAdvanceOdds: 62 },
  TUR: { fifaRank: 24, coach: "Vincenzo Montella",     formation: "4-2-3-1", lineup: ["U. Cakir", "Z. Celik", "M. Demiral", "C. Soyuncu", "F. Kadioglu", "H. Calhanoglou", "S. Ozcan", "A. Guler", "K. Yildiz", "O. Kokcu", "K. Akturkoglu"],                      winOdds: 0.4,  groupAdvanceOdds: 52 },
  AUS: { fifaRank: 23, coach: "Tony Popovic",          formation: "4-3-3",   lineup: ["M. Ryan", "J. Geria", "H. Souttar", "C. Burgess", "J. Bos", "J. Irvine", "A. O'Neill", "A. Hrustic", "M. Leckie", "N. Irankunda", "T. Yengi"],                               winOdds: 0.3,  groupAdvanceOdds: 50 },
  PAR: { fifaRank: 49, coach: "Gustavo Alfaro",        formation: "4-4-2",   lineup: ["G. Olveira", "J. Caceres", "G. Gómez", "F. Balbuena", "J. Alonso", "M. Almirón", "A. Cubas", "D. Gómez", "R. Sosa", "A. Sanabria", "J. Enciso"],                             winOdds: 0.1,  groupAdvanceOdds: 36 },

  // ── Group E ── GER ECU CIV CUW ────────────────────────────────────────
  GER: { fifaRank: 12, coach: "Julian Nagelsmann",     formation: "4-2-3-1", lineup: ["M. Neuer", "A. Rüdiger", "J. Tah", "N. Schlotterbeck", "D. Raum", "J. Kimmich", "L. Goretzka", "F. Wirtz", "J. Musiala", "L. Sané", "K. Havertz"],                          winOdds: 7,    groupAdvanceOdds: 84 },
  ECU: { fifaRank: 30, coach: "Sebastián Beccacece",   formation: "4-3-3",   lineup: ["H. Galíndez", "A. Preciado", "W. Pacho", "F. Torres", "P. Estupiñán", "M. Caicedo", "K. Páez", "J. Alcivar", "G. Plata", "E. Valencia", "A. Valencia"],                     winOdds: 0.2,  groupAdvanceOdds: 52 },
  CIV: { fifaRank: 55, coach: "Emerse Faé",            formation: "4-3-3",   lineup: ["Y. Fofana", "W. Singo", "O. Diomande", "E. Ndicka", "O. Kossounou", "S. Fofana", "F. Kessié", "I. Sangaré", "A. Diallo", "E. Wahi", "S. Adingra"],                          winOdds: 0.15, groupAdvanceOdds: 48 },
  CUW: { fifaRank: 81, coach: "Dick Advocaat",         formation: "4-4-2",   lineup: ["E. Room", "J. Brenet", "R. Bazoer", "A. Obispo", "S. Sambo", "J. Bacuna", "L. Bacuna", "T. Noslin", "A. Martha", "T. Chong", "J. Locadia"],                                   winOdds: 0.02, groupAdvanceOdds: 16 },

  // ── Group F ── NED JPN SWE TUN ────────────────────────────────────────
  NED: { fifaRank: 8,  coach: "Ronald Koeman",         formation: "4-3-3",   lineup: ["B. Verbruggen", "D. Dumfries", "J. Timber", "V. Van Dijk", "N. Aké", "F. De Jong", "T. Reijnders", "T. Koopmeiners", "C. Gakpo", "B. Brobbey", "D. Malen"],               winOdds: 4,    groupAdvanceOdds: 75 },
  JPN: { fifaRank: 14, coach: "Hajime Moriyasu",       formation: "4-2-3-1", lineup: ["Z. Suzuki", "Y. Sugawara", "K. Itakura", "S. Taniguchi", "T. Tomiyasu", "W. Endo", "A. Tanaka", "T. Kubo", "R. Doan", "D. Kamada", "A. Ueda"],                             winOdds: 0.8,  groupAdvanceOdds: 55 },
  SWE: { fifaRank: 26, coach: "Graham Potter",         formation: "4-3-3",   lineup: ["V. Johansson", "E. Holm", "V. Lindelöf", "I. Hien", "H. Ekdal", "L. Bergvall", "Y. Ayari", "M. Svanberg", "A. Isak", "V. Gyökeres", "A. Elanga"],                          winOdds: 0.3,  groupAdvanceOdds: 53 },
  TUN: { fifaRank: 35, coach: "Sabri Lamouchi",        formation: "4-3-3",   lineup: ["A. Dahmen", "Y. Valery", "M. Talbi", "D. Bronn", "O. Rekik", "E. Skhiri", "H. Mejbri", "A. Ben Slimane", "K. Ayari", "E. Saad", "I. Gharbi"],                              winOdds: 0.1,  groupAdvanceOdds: 17 },

  // ── Group G ── BEL IRN EGY NZL ────────────────────────────────────────
  BEL: { fifaRank: 6,  coach: "Rudi Garcia",           formation: "4-3-3",   lineup: ["T. Courtois", "T. Castagne", "Z. Debast", "A. Theate", "M. De Cuyper", "K. De Bruyne", "A. Onana", "Y. Tielemans", "J. Doku", "R. Lukaku", "L. Trossard"],                winOdds: 2,    groupAdvanceOdds: 80 },
  IRN: { fifaRank: 21, coach: "Amir Ghalenoei",        formation: "4-3-3",   lineup: ["A. Beiranvand", "R. Rezaeian", "H. Kanaani", "S. Hardani", "E. Hajsafi", "S. Ezatolahi", "M. Ghaedi", "A. Jahanbakhsh", "S. Ghoddos", "M. Taremi", "A. Hosseinzadeh"],  winOdds: 0.1,  groupAdvanceOdds: 52 },
  EGY: { fifaRank: 33, coach: "Hossam Hassan",         formation: "4-2-3-1", lineup: ["M. El Shenawy", "M. Hany", "H. Fathy", "Y. Ibrahim", "R. Rabia", "E. Ashour", "M. Saber", "O. Marmoush", "M. Trezeguet", "I. Adel", "M. Salah"],                          winOdds: 0.1,  groupAdvanceOdds: 50 },
  NZL: { fifaRank: 95, coach: "Darren Bazeley",        formation: "4-4-2",   lineup: ["M. Crocombe", "T. Smith", "M. Boxall", "N. Pijnaker", "L. Cacace", "J. Bell", "M. Stamenic", "A. Rufer", "S. Singh", "C. Wood", "B. Waine"],                               winOdds: 0.02, groupAdvanceOdds: 18 },

  // ── Group H ── ESP URU KSA CPV ────────────────────────────────────────
  ESP: { fifaRank: 3,  coach: "Luis de la Fuente",     formation: "4-3-3",   lineup: ["Unai Simón", "P. Porro", "P. Cubarsí", "A. Laporte", "M. Cucurella", "Rodri", "Pedri", "F. Ruiz", "L. Yamal", "N. Williams", "D. Olmo"],                                  winOdds: 9,    groupAdvanceOdds: 83 },
  URU: { fifaRank: 15, coach: "Marcelo Bielsa",        formation: "4-4-2",   lineup: ["S. Rochet", "G. Varela", "J. Giménez", "R. Araújo", "M. Olivera", "F. Valverde", "M. Ugarte", "R. Bentancur", "G. De Arrascaeta", "D. Núñez", "F. Pellistri"],           winOdds: 1.5,  groupAdvanceOdds: 65 },
  KSA: { fifaRank: 57, coach: "Georgios Donis",        formation: "4-3-3",   lineup: ["M. Al Owais", "S. Abdulhamid", "H. Tambakti", "J. Thikri", "A. Lajami", "M. Kanno", "N. Al Dawsari", "S. Al Dawsari", "F. Al Buraikan", "A. Al Hamdan", "S. Al Shehri"], winOdds: 0.08, groupAdvanceOdds: 37 },
  CPV: { fifaRank: 61, coach: "Bubista",               formation: "4-4-2",   lineup: ["Vozinha", "S. Moreira", "L. Costa", "W. Pina", "J. Paulo", "J. Monteiro", "T. Arcanjo", "Y. Semedo", "L. Duarte", "R. Mendes", "G. Rodrigues"],                           winOdds: 0.02, groupAdvanceOdds: 15 },

  // ── Group I ── FRA NOR SEN IRQ ────────────────────────────────────────
  FRA: { fifaRank: 2,  coach: "Didier Deschamps",      formation: "4-3-3",   lineup: ["M. Maignan", "J. Koundé", "I. Konaté", "W. Saliba", "T. Hernández", "N. Kanté", "A. Tchouaméni", "W. Zaïre-Emery", "O. Dembélé", "K. Mbappé", "M. Thuram"],              winOdds: 15,   groupAdvanceOdds: 87 },
  NOR: { fifaRank: 24, coach: "Ståle Solbakken",       formation: "4-3-3",   lineup: ["Ø. Nyland", "K. Pedersen", "L. Andersen", "A. Østigård", "M. Ryerson", "S. Berge", "M. Ødegaard", "F. Aursnes", "A. Sørloth", "E. Haaland", "V. Solbakken"],              winOdds: 0.4,  groupAdvanceOdds: 55 },
  SEN: { fifaRank: 20, coach: "Pape Thiaw",            formation: "4-3-3",   lineup: ["É. Mendy", "K. Diatta", "K. Koulibaly", "M. Niakhaté", "I. Jakobs", "I. Gueye", "P. Sarr", "L. Camara", "I. Sarr", "S. Mané", "I. Ndiaye"],                               winOdds: 0.7,  groupAdvanceOdds: 50 },
  IRQ: { fifaRank: 62, coach: "Jesús Casas",           formation: "4-3-3",   lineup: ["J. Hamid", "A. Al-Hamrani", "A. Karim", "H. Ali", "M. Al-Rashid", "H. Balla", "A. Latif", "A. Ibrahim", "M. Kareem", "A. Hassan", "I. Ahmed"],                              winOdds: 0.05, groupAdvanceOdds: 8 },

  // ── Group J ── ARG AUT ALG JOR ────────────────────────────────────────
  ARG: { fifaRank: 1,  coach: "Lionel Scaloni",        formation: "4-3-3",   lineup: ["E. Martínez", "G. Montiel", "C. Romero", "L. Martínez", "N. Tagliafico", "R. De Paul", "E. Fernández", "A. Mac Allister", "L. Messi", "J. Álvarez", "A. Dybala"],          winOdds: 18,   groupAdvanceOdds: 92 },
  AUT: { fifaRank: 25, coach: "Ralf Rangnick",         formation: "4-2-3-1", lineup: ["P. Pentz", "S. Posch", "K. Lienhart", "M. Wöber", "P. Mwene", "N. Seiwald", "K. Laimer", "M. Sabitzer", "F. Kainz", "C. Baumgartner", "M. Arnautovic"],                  winOdds: 0.3,  groupAdvanceOdds: 52 },
  ALG: { fifaRank: 30, coach: "Vladimir Petkovic",     formation: "4-3-3",   lineup: ["R. M'Bolhi", "A. Mandi", "D. Benlamri", "R. Bensebaini", "S. Atal", "I. Bennacer", "A. Zerrouki", "S. Feghouli", "R. Mahrez", "A. Belaïli", "B. Bounedjah"],              winOdds: 0.2,  groupAdvanceOdds: 48 },
  JOR: { fifaRank: 73, coach: "Hussain Ammouta",       formation: "4-4-2",   lineup: ["Y. Al-Nimer", "M. Al-Dmeiri", "O. Othman", "B. Al-Azzam", "A. Al-Rawabdeh", "M. Al-Taamari", "T. Al-Bawab", "A. Al-Aqrabawi", "Y. Al-Bakkar", "M. Homaidi", "Y. Al-Deheissat"], winOdds: 0.03, groupAdvanceOdds: 8 },

  // ── Group K ── POR COL COD UZB ────────────────────────────────────────
  POR: { fifaRank: 7,  coach: "Roberto Martínez",      formation: "4-3-3",   lineup: ["D. Costa", "J. Cancelo", "R. Dias", "G. Inácio", "N. Mendes", "B. Silva", "J. Palhinha", "B. Fernandes", "D. Jota", "C. Ronaldo", "R. Leão"],                              winOdds: 6,    groupAdvanceOdds: 80 },
  COL: { fifaRank: 19, coach: "Néstor Lorenzo",        formation: "4-2-3-1", lineup: ["D. Ospina", "D. Muñoz", "D. Sánchez", "C. Cuesta", "J. Mojica", "W. Barrios", "M. Castaño", "J. Cuadrado", "J. Carrascal", "L. Díaz", "R. Borré"],                        winOdds: 1.5,  groupAdvanceOdds: 68 },
  COD: { fifaRank: 57, coach: "Sébastien Desabre",     formation: "4-3-3",   lineup: ["J. Kiassumbua", "W. Bope", "C. Mbemba", "L. Tisserand", "A. Masuaku", "N. Kebano", "P. Muamba", "Y. Luyindama", "C. Bakambu", "D. Mbokani", "G. Kakuta"],                  winOdds: 0.1,  groupAdvanceOdds: 28 },
  UZB: { fifaRank: 59, coach: "Srečko Katanec",        formation: "4-3-3",   lineup: ["N. Nishonov", "D. Mirzaev", "J. Qodirov", "S. Tursunov", "O. Jaloliddinov", "J. Masharipov", "O. Shodiev", "A. Suyunov", "A. Ismoilov", "E. Shomurodov", "R. Negmatov"], winOdds: 0.05, groupAdvanceOdds: 24 },

  // ── Group L ── ENG CRO GHA PAN ────────────────────────────────────────
  ENG: { fifaRank: 4,  coach: "Thomas Tuchel",         formation: "4-3-3",   lineup: ["J. Pickford", "T. Alexander-Arnold", "J. Stones", "H. Maguire", "K. Trippier", "J. Bellingham", "D. Rice", "P. Foden", "B. Saka", "H. Kane", "M. Rashford"],              winOdds: 8,    groupAdvanceOdds: 76 },
  CRO: { fifaRank: 10, coach: "Zlatko Dalić",          formation: "4-3-3",   lineup: ["D. Livaković", "J. Stanišić", "D. Vida", "J. Gvardiol", "B. Sosa", "L. Modrić", "M. Brozović", "M. Kovačić", "I. Perišić", "A. Kramarić", "N. Vlašić"],                  winOdds: 1.0,  groupAdvanceOdds: 65 },
  GHA: { fifaRank: 60, coach: "Otto Addo",             formation: "4-2-3-1", lineup: ["L. Ati-Zigi", "A. Lamptey", "A. Amartey", "E. Amankwah", "T. Mensah", "T. Partey", "B. Sarr", "M. Kudus", "J. Ayew", "I. Sulemana", "O. Semenyo"],                        winOdds: 0.2,  groupAdvanceOdds: 42 },
  PAN: { fifaRank: 63, coach: "Thomas Christiansen",   formation: "4-4-2",   lineup: ["L. Mejía", "É. Davis", "A. Murillo", "R. Miller", "M. Mosquera", "J. Asprilla", "A. Godoy", "J. Quintero", "R. Torres", "A. Fajardo", "C. Mora"],                          winOdds: 0.02, groupAdvanceOdds: 17 },
};
