export interface CountryInfo {
  isoA3: string;       // ISO alpha-3 for GeoJSON matching
  isoNumeric: number;  // ISO 3166-1 numeric for topojson matching
  lat: number;
  lng: number;
  capital: string;
  soccerHistory: string;  // 2-3 engaging sentences about WC/football history
  culture: string[];      // 2-3 bullet points
  cuisine: string[];      // 3-4 national dishes
  funFact: string;        // one surprising/delightful fact
}

export const COUNTRY_INFO: Record<string, CountryInfo> = {

  // ── Group A ──────────────────────────────────────────────────────────────

  MEX: {
    isoA3: "MEX",
    isoNumeric: 484,
    lat: 23.6345,
    lng: -102.5528,
    capital: "Mexico City",
    soccerHistory:
      "Mexico has qualified for every World Cup since 1994 and is infamous for the 'Quinto Partido' curse — they reached the Round of 16 in five straight tournaments without advancing further. El Tri's most beloved moment remains Hugo Sánchez's acrobatic goals of the 1980s and Cuauhtémoc Blanco's iconic hop-dribble in 1998. Co-hosting 2026 gives Mexico a chance to finally break through on home soil in front of 100,000 fans at Estadio Azteca.",
    culture: [
      "Home to Día de los Muertos, a vibrant UNESCO-recognised festival blending Aztec and Catholic traditions",
      "Mariachi music originated in Jalisco and is now a symbol of Mexican identity worldwide",
      "Mexico City is one of the largest cities on Earth and sits on the ruins of the Aztec capital Tenochtitlan",
    ],
    cuisine: ["Tacos al pastor", "Mole negro", "Chiles en nogada", "Pozole rojo"],
    funFact:
      "Mexico has won the FIFA U-17 World Cup more times than any other nation — eight titles and counting.",
  },

  RSA: {
    isoA3: "ZAF",
    isoNumeric: 710,
    lat: -30.5595,
    lng: 22.9375,
    capital: "Pretoria",
    soccerHistory:
      "South Africa made history in 2010 as the first African nation to host the FIFA World Cup, filling the air with the deafening roar of vuvuzelas. Bafana Bafana — 'The Boys, The Boys' — shocked the world by winning the 1996 Africa Cup of Nations just two years after the end of apartheid, with Philemon Masinga and Doctor Khumalo becoming household names. Their return to 2026 ends a lengthy absence and signals football's growing depth across the continent.",
    culture: [
      "South Africa has 11 official languages — the most of any country in the world",
      "Ubuntu philosophy ('I am because we are') shapes community life and hospitality",
      "The Johannesburg township of Soweto produced both Nelson Mandela and Desmond Tutu",
    ],
    cuisine: ["Braai (barbecue)", "Bunny chow", "Bobotie", "Biltong"],
    funFact:
      "The vuvuzela — the plastic horn synonymous with 2010 — produces a sound of roughly 127 decibels, louder than a chainsaw.",
  },

  KOR: {
    isoA3: "KOR",
    isoNumeric: 410,
    lat: 35.9078,
    lng: 127.7669,
    capital: "Seoul",
    soccerHistory:
      "South Korea's 2002 World Cup run — co-hosted with Japan — is one of football's greatest fairy tales: they defeated Spain, Italy, and Poland on the way to a stunning fourth-place finish, with coach Guus Hiddink becoming a national hero. The K-League has produced world-class exports like Son Heung-min, who became the first Asian player to win the Premier League Golden Boot. Korea has qualified for every World Cup since 1986, the longest current streak in Asia.",
    culture: [
      "K-pop and K-dramas have created a global 'Korean Wave' (Hallyu) influencing fashion, music, and food worldwide",
      "PC-bangs (internet cafés) are a cornerstone of Korean social culture and helped birth esports as a professional sport",
      "Confucian values of respect for elders and education remain central to everyday Korean life",
    ],
    cuisine: ["Kimchi jjigae", "Bibimbap", "Korean BBQ (samgyeopsal)", "Tteokbokki"],
    funFact:
      "South Korea is the only team outside Europe and South America to have reached a World Cup semi-final.",
  },

  CZE: {
    isoA3: "CZE",
    isoNumeric: 203,
    lat: 49.8175,
    lng: 15.473,
    capital: "Prague",
    soccerHistory:
      "Czechoslovakia reached two World Cup finals (1934 and 1962), and after the peaceful split of 1993 the Czech Republic quickly built a new identity, reaching the Euro 96 final where Patrik Berger and Karel Poborský dazzled Europe. The legendary Antonín Panenka invented the chipped penalty — now called a 'Panenka' worldwide — in the decisive spot-kick of Euro 1976. Czech clubs Sparta and Slavia Prague have a fierce derby rivalry stretching back over 120 years.",
    culture: [
      "The Czech Republic consumes more beer per capita than any other country on Earth",
      "Prague's Old Town Square has an astronomical clock (Orloj) built in 1410 that still works today",
      "Czech writer Franz Kafka's surreal fiction gave the world the adjective 'Kafkaesque'",
    ],
    cuisine: ["Svíčková (beef sirloin in cream sauce)", "Vepřo knedlo zelo", "Trdelník", "Bramboráky"],
    funFact:
      "The word 'robot' was coined by Czech playwright Karel Čapek in his 1920 play R.U.R.",
  },

  // ── Group B ──────────────────────────────────────────────────────────────

  CAN: {
    isoA3: "CAN",
    isoNumeric: 124,
    lat: 56.1304,
    lng: -106.3468,
    capital: "Ottawa",
    soccerHistory:
      "Canada's 2022 World Cup appearance was their first in 36 years, and the team — led by Alphonso Davies, the Bayern Munich superstar born in a Ghanaian refugee camp — arrived with genuine ambitions. The Canadians topped CONCACAF qualifying in 2022, finishing above both the USA and Mexico for the first time ever. Co-hosting 2026 at home stadiums in Toronto and Vancouver gives this young, talented squad a chance to etch their names into Canadian sporting history.",
    culture: [
      "Canada is officially bilingual and has more French speakers than any country outside France and sub-Saharan Africa",
      "Ice hockey is a national religion — the Stanley Cup has been contested since 1893",
      "Canada is home to more lakes than the rest of the world combined, covering nearly 9% of its land area",
    ],
    cuisine: ["Poutine", "Butter tarts", "Tourtière", "Nanaimo bars"],
    funFact:
      "Alphonso Davies was born in a refugee camp in Ghana and became a Champions League winner with Bayern Munich — one of football's most remarkable journeys.",
  },

  BIH: {
    isoA3: "BIH",
    isoNumeric: 70,
    lat: 43.9159,
    lng: 17.6791,
    capital: "Sarajevo",
    soccerHistory:
      "Bosnia & Herzegovina made their World Cup debut in 2014, with striker Edin Džeko — one of Europe's deadliest forwards of his generation — leading the charge in Brazil. The country's national team is nicknamed 'Zmajevi' (The Dragons) and has punched well above its weight given a population of just 3.5 million. Sarajevo was once a powerhouse of Yugoslav football and hosted the 1984 Winter Olympics, showing the city's love for major sporting events.",
    culture: [
      "Sarajevo sits at the crossroads of Catholic, Orthodox, Muslim, and Jewish communities, earning it the nickname 'Jerusalem of Europe'",
      "The assassination of Archduke Franz Ferdinand in Sarajevo in 1914 sparked the First World War",
      "Sevdalinka, a deeply emotional Bosnian music genre, is considered the soul of the nation",
    ],
    cuisine: ["Cevapi (grilled minced meat)", "Burek", "Bosanski lonac (Bosnian pot)", "Klepe (dumplings)"],
    funFact:
      "Bosnia's Edin Džeko scored the team's first-ever World Cup goal in 2014 — and it was a breathtaking solo strike against Argentina.",
  },

  QAT: {
    isoA3: "QAT",
    isoNumeric: 634,
    lat: 25.3548,
    lng: 51.1839,
    capital: "Doha",
    soccerHistory:
      "Qatar became the first Arab nation to host the World Cup in 2022, transforming the tournament with air-conditioned stadiums built in the desert. Although they became the first host nation to be eliminated in the group stage, their investment in domestic football through Aspire Academy has produced players like Akram Afif, winner of the 2023 AFC Asian Cup Golden Ball. Qatar's Al Sadd and Al Rayyan clubs have attracted legends like Xavi Hernández and Raúl throughout the years.",
    culture: [
      "Qatar went from one of the world's poorest nations in the 1940s to one of the richest within two generations due to natural gas",
      "The souq (market) culture of Doha blends ancient Bedouin trading traditions with ultramodern architecture",
      "Falconry is a UNESCO-recognised cultural heritage of Qatar, practiced for over 4,000 years in the region",
    ],
    cuisine: ["Machboos (spiced rice with meat)", "Harees", "Balaleet", "Thareed"],
    funFact:
      "Qatar is the world's largest exporter of liquefied natural gas and has a GDP per capita among the top five in the world.",
  },

  SUI: {
    isoA3: "CHE",
    isoNumeric: 756,
    lat: 46.8182,
    lng: 8.2275,
    capital: "Bern",
    soccerHistory:
      "Switzerland is one of Europe's most consistent World Cup performers — they have reached the knockout rounds in five of the last six tournaments. Granit Xhaka's passionate leadership and Xherdan Shaqiri's thunderbolt goals have made this diverse, multilingual squad a genuine dark horse at every major tournament. Switzerland reached the quarter-finals in 2022 after eliminating France in the Round of 16, proving they can topple any giant.",
    culture: [
      "Switzerland has four official national languages: German, French, Italian, and Romansh",
      "The country has been neutral in international conflicts since 1815, making Geneva a hub for diplomacy and international organisations",
      "Switzerland invented Velcro, the World Wide Web (Tim Berners-Lee at CERN), and the Swiss Army Knife",
    ],
    cuisine: ["Fondue", "Raclette", "Rösti", "Zürcher Geschnetzeltes"],
    funFact:
      "Switzerland's national football team is one of the most ethnically diverse in the world — over half their players have roots in countries other than Switzerland.",
  },

  // ── Group C ──────────────────────────────────────────────────────────────

  BRA: {
    isoA3: "BRA",
    isoNumeric: 76,
    lat: -14.235,
    lng: -51.9253,
    capital: "Brasília",
    soccerHistory:
      "Brazil is the only nation to have played in every FIFA World Cup and the only one to have won it five times — with Pelé, Ronaldo, Ronaldinho, and Cafu among the greatest players to ever play the game all wearing the famous yellow shirt. The 2014 Mineirazo — a 7-1 semi-final humiliation by Germany on home soil — remains one of sport's most shocking events, fuelling a burning desire for a sixth star. Brazil's 'jogo bonito' (beautiful game) philosophy has inspired footballers and coaches around the world for generations.",
    culture: [
      "Carnival in Rio de Janeiro is the world's largest annual festival, drawing over 2 million people per day to the streets",
      "Brazil is home to the Amazon rainforest — roughly 60% of the world's largest tropical forest",
      "Football is so central to Brazilian identity that the national team's matches are effectively national holidays",
    ],
    cuisine: ["Feijoada (black bean stew)", "Churrasco", "Pão de queijo", "Brigadeiro"],
    funFact:
      "Pelé scored his 1,000th career goal from a penalty kick on November 19, 1969 — a date now celebrated as 'O Dia do Rei' (The King's Day) in Brazil.",
  },

  MAR: {
    isoA3: "MAR",
    isoNumeric: 504,
    lat: 31.7917,
    lng: -7.0926,
    capital: "Rabat",
    soccerHistory:
      "Morocco's 2022 World Cup run was the greatest in African football history: the Atlas Lions became the first African and Arab nation ever to reach a World Cup semi-final, defeating Spain, Portugal, and Belgium along the way. Achraf Hakimi's composure and Yassine Bounou's penalty heroics captured the world's imagination, and the sight of Moroccan players kneeling in prayer after each win moved millions of viewers. With stars like Hakim Ziyech and Sofyan Amrabat patrolling midfield, Morocco arrive in 2026 as serious contenders.",
    culture: [
      "Morocco sits at the junction of Africa, Europe, and the Arab world, giving its culture an extraordinary multicultural richness",
      "The medina (old city) of Fez is the world's largest car-free urban area and a UNESCO World Heritage Site",
      "Traditional Moroccan zellige tilework, with its intricate geometric patterns, is considered one of the great art forms of Islamic civilisation",
    ],
    cuisine: ["Tagine", "Couscous", "Bastilla (pigeon pie)", "Harira soup"],
    funFact:
      "Morocco's national team is almost entirely made up of players born or raised in Europe — a testament to the massive Moroccan diaspora across France, the Netherlands, Spain, and Belgium.",
  },

  HAI: {
    isoA3: "HTI",
    isoNumeric: 332,
    lat: 18.9712,
    lng: -72.2852,
    capital: "Port-au-Prince",
    soccerHistory:
      "Haiti holds a special place in World Cup history: in 1974 they became only the second Caribbean nation to appear at the tournament, and Emmanuel Sanon's famous goal against Italy — ending Italy's World Cup goal-drought — remains one of the greatest upsets in tournament history. Les Grenadiers have faced immense adversity both on and off the pitch, but Haitian football has persisted through natural disasters and political turmoil with remarkable resilience. Their qualification for 2026 is a powerful symbol of hope for a nation that deeply needs it.",
    culture: [
      "Haiti was the world's first Black republic and the first nation founded by a successful slave revolution in 1804",
      "Haitian Vodou is a rich spiritual tradition that blends West African religions with Catholicism — very different from Hollywood stereotypes",
      "Haiti produces some of the finest rum and mangoes in the Caribbean, with over 300 mango varieties grown on the island",
    ],
    cuisine: ["Griot (fried pork)", "Riz et pois (rice and beans)", "Soup joumou", "Tasso"],
    funFact:
      "Soup joumou — a rich pumpkin soup — is eaten every January 1st by Haitians worldwide, commemorating the day enslaved people who were forbidden from eating it declared independence.",
  },

  SCO: {
    isoA3: "GBR",
    isoNumeric: 826,
    lat: 56.4907,
    lng: -4.2026,
    capital: "Edinburgh",
    soccerHistory:
      "Scotland and England played the world's first international football match in 1872 — a 0-0 draw in Glasgow — making Scotland one of the founding nations of the beautiful game. The Scots are notorious for the 'Tartan Army,' widely considered the friendliest and most colourful travelling support in world football, winning Fair Play awards at tournaments even when the team itself struggles. After a 23-year absence, Scotland qualified for Euro 2020 (played 2021) with a young squad built around Kieran Tierney and Andy Robertson.",
    culture: [
      "Scotland gifted the world golf, whisky, penicillin, the telephone, and the television",
      "The Highland Games tradition of throwing cabers (telephone-pole-sized logs) is a uniquely Scottish athletic spectacle",
      "Hogmanay (New Year's Eve) is Scotland's biggest celebration, involving street parties, fire festivals, and 'first-footing' neighbours with whisky and coal",
    ],
    cuisine: ["Haggis, neeps and tatties", "Cullen skink (smoked haddock soup)", "Deep-fried Mars bar", "Scotch pie"],
    funFact:
      "The Tartan Army has won UEFA's Fair Play award for supporter behaviour at major tournaments — a remarkable achievement for a national team that hasn't won a major trophy in decades.",
  },

  // ── Group D ──────────────────────────────────────────────────────────────

  USA: {
    isoA3: "USA",
    isoNumeric: 840,
    lat: 37.0902,
    lng: -95.7129,
    capital: "Washington D.C.",
    soccerHistory:
      "The United States shocked the footballing world in 1950 by defeating England 1-0 in one of the greatest World Cup upsets ever — a result so unbelievable that some British newspapers assumed it was a misprint. After decades of development, the MLS has grown into a serious league, and a golden generation featuring Christian Pulisic, Tyler Adams, and Weston McKennie reached the 2022 Round of 16. Co-hosting 2026 alongside Canada and Mexico is a transformative moment for American soccer, with the final to be played in the iconic MetLife Stadium.",
    culture: [
      "The US has won more Olympic gold medals than any other country in history",
      "American road-trip culture gave the world the concept of the motel, the drive-in cinema, and the fast-food chain",
      "The United States has the world's oldest written national constitution still in use, ratified in 1789",
    ],
    cuisine: ["Cheeseburger", "BBQ ribs", "Clam chowder", "Shrimp and grits"],
    funFact:
      "Soccer is now the most-played youth sport in the United States, surpassing both American football and basketball in participation numbers.",
  },

  PAR: {
    isoA3: "PRY",
    isoNumeric: 600,
    lat: -23.4425,
    lng: -58.4438,
    capital: "Asunción",
    soccerHistory:
      "Paraguay's golden era came in the 2000s when goalkeeper José Luis Chilavert — who famously scored penalties and free kicks for his club — helped Los Guaraníes reach the quarter-finals of the 2010 World Cup. The nation is football-mad despite its small size, producing top defenders and a warrior spirit that has toppled giants on the world stage. Roque Santa Cruz and Nelson Valdez thrilled fans across Europe with their club performances, raising the profile of Paraguayan football throughout the 2000s.",
    culture: [
      "Paraguay is the only country in the Americas where an indigenous language — Guaraní — is spoken by the majority of the population alongside the national language (Spanish)",
      "The Gran Chaco region of western Paraguay is one of South America's last great wilderness frontiers",
      "Paraguay produces some of South America's finest harp music, with the national instrument featuring in folk music traditions dating back centuries",
    ],
    cuisine: ["Sopa paraguaya (cornbread)", "Chipa", "Asado", "Mbejú"],
    funFact:
      "Paraguay's national goalkeeper José Luis Chilavert scored 62 goals during his career — the most by any goalkeeper in football history.",
  },

  AUS: {
    isoA3: "AUS",
    isoNumeric: 36,
    lat: -25.2744,
    lng: 133.7751,
    capital: "Canberra",
    soccerHistory:
      "Australia's 2006 World Cup — their first appearance in 32 years — produced one of the tournament's great moments when Tim Cahill scored twice against Japan and Mark Viduka terrorised defences across the group stage. The Socceroos reached the Round of 16 that year, losing narrowly to Italy on a contentious last-minute penalty. In 2022, a new golden generation featuring Sam Kerr's women's team and Mathew Leckie's men reached the quarter-finals, defeating Argentina's bête noire Denmark along the way.",
    culture: [
      "Australia is home to the world's oldest continuous cultures — Aboriginal and Torres Strait Islander peoples have lived on the continent for over 65,000 years",
      "Australians have a word — 'arvo' — for afternoon, and 'servo' for service station, reflecting a national passion for shortening every word possible",
      "The Great Barrier Reef is the world's largest living structure, visible from space, and home to over 1,500 species of fish",
    ],
    cuisine: ["Meat pie", "Vegemite on toast", "Pavlova", "Barramundi"],
    funFact:
      "Australia is the only continent where dangerous animals are considered part of everyday life — and yet its life expectancy is among the highest on Earth.",
  },

  TUR: {
    isoA3: "TUR",
    isoNumeric: 792,
    lat: 38.9637,
    lng: 35.2433,
    capital: "Ankara",
    soccerHistory:
      "Turkey produced one of the greatest World Cup surprises in 2002, finishing third in South Korea and Japan with strikers Hakan Şükür — who scored the fastest goal in World Cup history (11 seconds against South Korea) — and İlhan Mansız capturing the world's attention. Galatasaray became the first and only Turkish club to win a UEFA trophy in 2000, beating Arsenal on penalties in the UEFA Cup final. A new generation led by Hakan Çalhanoğlu and Arda Güler is poised to make Türkiye a force at 2026.",
    culture: [
      "Turkey sits at the crossroads of Europe and Asia and was home to the Byzantine and Ottoman empires, two of history's most influential civilisations",
      "Turkish tea (çay) culture is central to daily life — the country is among the top five tea-consuming nations per capita in the world",
      "Istanbul's Grand Bazaar is one of the world's oldest and largest covered markets, with over 4,000 shops spread across 61 covered streets",
    ],
    cuisine: ["Döner kebab", "Baklava", "Manti (Turkish dumplings)", "İskender kebap"],
    funFact:
      "Hakan Şükür's goal 11 seconds into the 2002 third-place play-off remains the fastest goal ever scored at a World Cup.",
  },

  // ── Group E ──────────────────────────────────────────────────────────────

  GER: {
    isoA3: "DEU",
    isoNumeric: 276,
    lat: 51.1657,
    lng: 10.4515,
    capital: "Berlin",
    soccerHistory:
      "Germany has won the World Cup four times and reached the final eight times — a record of consistency unmatched in football. From Fritz Walter's 'Miracle of Bern' in 1954 to Andrés Iniesta's heartbreak in 2010 to Götze's extra-time winner in 2014, German football is defined by dramatic finals and a relentless winning mentality. After disappointing exits in 2018 and 2022, a refreshed squad under Julian Nagelsmann — led by Florian Wirtz and Jamal Musiala — is hungry to reclaim glory.",
    culture: [
      "Germany's Oktoberfest in Munich is the world's largest beer festival, attracting over 6 million visitors each year",
      "The German autobahn is one of the world's only motorway networks with no general speed limit",
      "Germany has produced more Nobel Prize winners in science and medicine than any other country in history",
    ],
    cuisine: ["Bratwurst", "Sauerbraten", "Pretzels (Brezel)", "Schnitzel"],
    funFact:
      "Germany's World Cup-winning ball in the 2014 final was called the 'Brazuca' — and it was the same ball Brazil used in their 7-1 humiliation by Germany just days earlier.",
  },

  CUW: {
    isoA3: "CUW",
    isoNumeric: 531,
    lat: 12.1696,
    lng: -68.99,
    capital: "Willemstad",
    soccerHistory:
      "Curaçao is one of football's most extraordinary stories: a tiny Dutch Caribbean island of just 160,000 people has produced Premier League players and international-level talent far beyond what its size should allow. The island's football association has cleverly used FIFA eligibility rules to attract players of Curaçaoan descent from Europe, with Leandro Bacuna and Cuco Martina giving the 'Dushi Boys' real quality. Their 2026 qualification marks the first time this Caribbean nation has reached a World Cup — a genuine fairy tale.",
    culture: [
      "Curaçao's colourful waterfront buildings in Willemstad, a UNESCO World Heritage Site, make it one of the most photographed harbours in the Caribbean",
      "The island speaks Papiamentu — a unique creole language blending Spanish, Portuguese, Dutch, English, and West African languages",
      "Curaçao is the world's only producer of authentic Curaçao liqueur, made from the dried peel of the laraha citrus fruit",
    ],
    cuisine: ["Keshi yena (stuffed cheese)", "Karni stoba (beef stew)", "Pan bati (cornmeal pancakes)", "Funchi"],
    funFact:
      "Curaçao's Willemstad is one of the few cities in the world where you can walk across a floating pedestrian bridge — the Queen Emma Bridge — that swings open to let ships pass.",
  },

  CIV: {
    isoA3: "CIV",
    isoNumeric: 384,
    lat: 7.54,
    lng: -5.5471,
    capital: "Yamoussoukro",
    soccerHistory:
      "Ivory Coast's 'golden generation' — built around the legendary Didier Drogba — was one of the most feared squads in African football history, reaching the knockout rounds of three consecutive World Cups (2006, 2010, 2014). Drogba's passionate pre-match speech in 2005 is credited with convincing rival warlords to lay down arms during a civil war, one of sport's most remarkable real-world impacts. Stars like Yaya Touré and Kolo Touré helped transform Les Éléphants into a continental powerhouse.",
    culture: [
      "Ivory Coast is the world's largest exporter of cocoa — nearly 40% of all the world's chocolate starts here",
      "The Basilica of Our Lady of Peace in Yamoussoukro is the world's largest church by area, even surpassing St Peter's Basilica in Rome",
      "Ivorian Zouglou music, born in university dormitories in the 1990s, became one of West Africa's defining social commentary genres",
    ],
    cuisine: ["Attiéké (cassava couscous)", "Foutou with peanut sauce", "Aloco (fried plantain)", "Kedjenou"],
    funFact:
      "Didier Drogba's pre-match speech after Ivory Coast qualified for the 2006 World Cup — broadcast live on national television — is widely credited with helping broker a temporary ceasefire in the country's civil war.",
  },

  ECU: {
    isoA3: "ECU",
    isoNumeric: 218,
    lat: -1.8312,
    lng: -78.1834,
    capital: "Quito",
    soccerHistory:
      "Ecuador made a stunning statement at the 2022 World Cup, opening the tournament against host nation Qatar and winning 2-0 in the first match of the tournament — with Enner Valencia scoring twice despite being momentarily ruled offside. La Tri have qualified for four World Cups since 2002, with Valencia becoming their all-time leading scorer and one of CONMEBOL's most consistent performers. Ecuador's Liga Pro is growing in quality, with young talents increasingly attracting attention from European clubs.",
    culture: [
      "Ecuador was the first country to give rights to nature — including rivers, forests, and mountains — in its 2008 constitution",
      "The Galápagos Islands, a province of Ecuador, inspired Charles Darwin's theory of evolution and remain one of Earth's great natural wonders",
      "Ecuador sits right on the equator — the name 'Ecuador' literally means 'equator' in Spanish — and you can stand with one foot in each hemisphere",
    ],
    cuisine: ["Ceviche", "Llapingachos (potato cakes)", "Seco de pollo", "Caldo de manguera"],
    funFact:
      "Ecuador's Enner Valencia scored all three of his country's goals at the 2022 World Cup — he literally is Ecuador's entire World Cup attack.",
  },

  // ── Group F ──────────────────────────────────────────────────────────────

  NED: {
    isoA3: "NLD",
    isoNumeric: 528,
    lat: 52.1326,
    lng: 5.2913,
    capital: "Amsterdam",
    soccerHistory:
      "The Netherlands invented 'Total Football' — a revolutionary tactical system where every outfield player can play any position — under Johan Cruyff in the 1970s, influencing how the game is played to this day. Oranje have reached three World Cup finals (1974, 1978, 2010) without winning — making them the most successful nation never to lift the trophy. A resurgent Dutch squad featuring Virgil van Dijk and Cody Gakpo reached the 2022 quarter-finals, showing the Ajax academy pipeline remains world-class.",
    culture: [
      "The Netherlands has more bicycles than people — cycling is the primary mode of transport in most Dutch cities",
      "Dutch masters like Rembrandt and Vermeer created some of the world's most treasured paintings during the 17th-century 'Golden Age'",
      "The Netherlands is the world's second-largest agricultural exporter by value, despite being a small country — due to innovative greenhouse farming",
    ],
    cuisine: ["Stroopwafel", "Herring (haring) with onions", "Stamppot", "Bitterballen"],
    funFact:
      "Johan Cruyff's signature move — the 'Cruyff Turn' — was invented spontaneously during the 1974 World Cup and is still taught to footballers worldwide fifty years later.",
  },

  JPN: {
    isoA3: "JPN",
    isoNumeric: 392,
    lat: 36.2048,
    lng: 138.2529,
    capital: "Tokyo",
    soccerHistory:
      "Japan is Asia's most successful World Cup nation, having reached the Round of 16 at five tournaments, and their 2022 group stage — where they defeated both Germany and Spain — was one of the great footballing shocks of the modern era. The J-League, founded in 1993, helped build a domestic football culture that has since exported players like Hidetoshi Nakata, Shunsuke Nakamura, and Takumi Minamino to Europe's top leagues. Japan is famous for their remarkable fair-play record, with fans and players cleaning up after themselves at every World Cup.",
    culture: [
      "Japan has the world's oldest continuous monarchy — Emperor Naruhito is the 126th emperor in a line stretching back over 1,500 years",
      "The concept of 'ikigai' (a reason for being) and 'wabi-sabi' (beauty in imperfection) are Japanese philosophies influencing global wellness culture",
      "Japan has more vending machines per capita than any other country — roughly one for every 23 people",
    ],
    cuisine: ["Ramen", "Sushi", "Tempura", "Okonomiyaki"],
    funFact:
      "After Japan eliminated Germany at the 2022 World Cup, Japanese fans stayed behind to clean the stadium — a tradition they've maintained at every World Cup since 2014.",
  },

  SWE: {
    isoA3: "SWE",
    isoNumeric: 752,
    lat: 60.1282,
    lng: 18.6435,
    capital: "Stockholm",
    soccerHistory:
      "Sweden hosted and finished runners-up at the 1958 World Cup — the tournament where a 17-year-old Pelé announced himself to the world — and have been producing world-class footballers ever since. Zlatan Ibrahimović is arguably the greatest player never to appear at a World Cup knockout stage, a painful irony given his talent, while Henrik Larsson was considered one of Europe's deadliest strikers in the early 2000s. The Swedish women's team — 'Damkronorna' — are perennial medal contenders and silver medallists at three World Cups.",
    culture: [
      "Sweden has a concept called 'lagom' — roughly meaning 'just the right amount' — that is central to Swedish values of moderation and balance",
      "ABBA, IKEA, Spotify, Skype, and Minecraft all came from Sweden — a remarkable innovation record for a nation of 10 million people",
      "Sweden's midsommar celebration involves maypole dancing and flower-crown wearing in a country with up to 24 hours of daylight in summer",
    ],
    cuisine: ["Meatballs with lingonberry", "Smörgåsbord", "Gravlax", "Cinnamon buns (kanelbullar)"],
    funFact:
      "Zlatan Ibrahimović is so famous in his home country that a bridge in Malmö was unofficially renamed 'Zlatan Bridge' after locals voted for it — the city refused, but the nickname stuck.",
  },

  TUN: {
    isoA3: "TUN",
    isoNumeric: 788,
    lat: 33.8869,
    lng: 9.5375,
    capital: "Tunis",
    soccerHistory:
      "Tunisia was the first African nation to win a World Cup match, defeating Mexico 3-1 in 1978, making Les Aigles de Carthage pioneers for the entire continent. They have appeared at six World Cups — more than any other African nation — and produced stars like Hatem Ben Arfa and Wahbi Khazri who dazzled in Ligue 1. Tunisia's 2022 campaign ended with a famous victory over France, though they were already eliminated — a result that showed their quality on the biggest stage.",
    culture: [
      "Tunisia was home to Carthage, one of the ancient Mediterranean world's most powerful civilisations — founded by the legendary Queen Dido",
      "Sidi Bou Said, a white-and-blue clifftop village near Tunis, is considered one of the most beautiful villages in the world",
      "Tunisia sparked the Arab Spring in 2010-11, with the 'Jasmine Revolution' inspiring pro-democracy movements across the Middle East",
    ],
    cuisine: ["Couscous with merguez", "Brik (pastry with egg)", "Lablabi (chickpea soup)", "Tajine tunisien"],
    funFact:
      "Much of the Star Wars saga was filmed in Tunisia — the desert landscape of Tattooine is actually the Tunisian Sahara near Tozeur and Matmata.",
  },

  // ── Group G ──────────────────────────────────────────────────────────────

  BEL: {
    isoA3: "BEL",
    isoNumeric: 56,
    lat: 50.5039,
    lng: 4.4699,
    capital: "Brussels",
    soccerHistory:
      "Belgium's 'Golden Generation' — Hazard, De Bruyne, Lukaku, Courtois, Alderweireld — is considered one of the greatest collections of talent ever assembled under one national team, yet a World Cup trophy eluded them despite reaching the semi-finals in 2018. They were ranked number one in the world for four consecutive years (2018-2021), a record for a team that never won the tournament in that period. Now in transition, Belgium are rebuilding around Amadou Onana and Johan Bakayoko with an eye toward future glory.",
    culture: [
      "Belgium invented french fries — called 'frites' — and the waffle, two of the world's most beloved street foods",
      "Belgium produces over 220,000 tonnes of chocolate per year and has a Brussels airport chocolate shop that is the world's busiest single chocolate-selling point",
      "René Magritte and Pieter Bruegel the Elder are two of history's most influential painters — both Belgian",
    ],
    cuisine: ["Moules-frites (mussels and fries)", "Carbonade flamande", "Gaufres de Liège (waffles)", "Speculoos"],
    funFact:
      "Belgium was ranked number one in the FIFA world rankings for a record 1,536 days without ever winning a major international trophy.",
  },

  EGY: {
    isoA3: "EGY",
    isoNumeric: 818,
    lat: 26.8206,
    lng: 30.8025,
    capital: "Cairo",
    soccerHistory:
      "Egypt's Al Ahly is the most decorated club in African football history and one of the world's most supported clubs, with an estimated 50 million fans. The Pharaohs won the Africa Cup of Nations a record seven times, with the legendary Hossam Hassan — Africa's all-time top scorer — carrying the team for two decades. Mohamed Salah's emergence as one of the world's best players has given Egyptian football a global ambassador, though the team has struggled to translate club quality to World Cup success.",
    culture: [
      "Egypt is home to the only surviving Wonder of the Ancient World — the Great Pyramid of Giza, built over 4,500 years ago",
      "The Nile River, the world's longest, has sustained Egyptian civilisation for over 5,000 years of recorded history",
      "Cairo is Africa's largest city and one of the most densely populated urban areas on Earth, with over 20 million people in the metro area",
    ],
    cuisine: ["Koshari (lentils, rice and pasta)", "Ful medames (fava beans)", "Molokhia", "Hawawshi"],
    funFact:
      "Al Ahly FC has won the CAF Champions League (African Champions League) more times than Real Madrid has won the European Champions League — they are the most successful club in African football history.",
  },

  IRN: {
    isoA3: "IRN",
    isoNumeric: 364,
    lat: 32.4279,
    lng: 53.688,
    capital: "Tehran",
    soccerHistory:
      "Iran is the most successful football nation in Asia by some measures, winning the AFC Asian Cup three times and qualifying for six World Cups. Team Melli's 1998 World Cup victory over the United States — in one of the most politically charged matches in football history — remains one of the sport's defining geopolitical moments. Ali Daei held the world record for international goals (109) until Cristiano Ronaldo broke it in 2021, underscoring the quality Iran's domestic football has historically produced.",
    culture: [
      "Iran is home to one of humanity's oldest civilisations — the Persian Empire at its peak stretched from Greece to India",
      "Persian poetry, through masters like Rumi, Hafez, and Omar Khayyám, has profoundly influenced world literature and philosophy",
      "Nowruz (Persian New Year), celebrated on the spring equinox, is one of the world's oldest festivals, observed by over 300 million people",
    ],
    cuisine: ["Ghormeh sabzi (herb stew)", "Chelow kabab", "Fesenjan (pomegranate-walnut stew)", "Ash reshteh"],
    funFact:
      "Ali Daei held the world record for international goals with 109 for 16 years — a record many thought unbreakable — before Cristiano Ronaldo finally surpassed it in 2021.",
  },

  NZL: {
    isoA3: "NZL",
    isoNumeric: 554,
    lat: -40.9006,
    lng: 174.886,
    capital: "Wellington",
    soccerHistory:
      "New Zealand's All Whites famously went undefeated at the 2010 World Cup — drawing all three group matches — yet still went home in the group stage, one of football's quirky injustices. The country's football identity lives in the shadow of rugby, but the women's team — the Football Ferns — hosted the 2023 Women's World Cup alongside Australia and created unforgettable moments. Shane Smeltz, Rory Fallon, and Winston Reid gave New Zealand their 2010 heroes, while Chris Wood carries the torch as a Premier League-tested striker.",
    culture: [
      "New Zealand was the first country to give women the right to vote nationally, in 1893",
      "The Haka — the powerful Māori war dance performed by the All Blacks before rugby matches — is one of sport's most spine-tingling rituals",
      "New Zealand has more sheep than people (roughly 5 sheep per person), though the ratio has dropped dramatically over the decades",
    ],
    cuisine: ["Hāngī (earth oven feast)", "Pavlova", "Whitebait fritters", "Lamb roast"],
    funFact:
      "New Zealand was the only team to go undefeated at the 2010 World Cup — drawing with Slovakia, Italy, and Paraguay — yet they finished third in their group and were eliminated.",
  },

  // ── Group H ──────────────────────────────────────────────────────────────

  ESP: {
    isoA3: "ESP",
    isoNumeric: 724,
    lat: 40.4637,
    lng: -3.7492,
    capital: "Madrid",
    soccerHistory:
      "Spain's 2010 World Cup triumph in South Africa — built on the 'tiki-taka' possession style developed at Barcelona — revolutionised football tactics worldwide, and their back-to-back European Championship wins in 2008 and 2012 made them the greatest international team of their era. Iker Casillas, Xavi, Andrés Iniesta, and David Villa formed the spine of a once-in-a-generation squad. A brilliant new generation featuring Pedri, Gavi, and Lamine Yamal won Euro 2024 and arrives at 2026 as one of the tournament favourites.",
    culture: [
      "Spain has the most UNESCO World Heritage Sites of any country in Europe — from the Alhambra to Gaudí's Sagrada Família",
      "La Tomatina festival in Buñol turns the entire town red when 40,000 participants pelt each other with 150,000 kg of tomatoes",
      "Flamenco — the passionate dance and music form born in Andalusia — is one of the world's most expressive art forms",
    ],
    cuisine: ["Paella", "Jamón ibérico", "Gazpacho", "Patatas bravas"],
    funFact:
      "Andrés Iniesta's World Cup-winning goal in 2010 extra-time was scored with a shot from a boot he was about to replace — he'd been wearing it for comfort despite knowing it was worn out.",
  },

  CPV: {
    isoA3: "CPV",
    isoNumeric: 132,
    lat: 16.5388,
    lng: -23.0418,
    capital: "Praia",
    soccerHistory:
      "Cape Verde — the 'Blue Sharks' — are one of Africa's most surprising football success stories: a volcanic archipelago of just 550,000 people that has repeatedly punched above its weight at the Africa Cup of Nations. Liverpool and Wolves fans will recognise names like Rúben Neves and Nuno Mendes — players of Cape Verdean descent who have played at the highest level. Their 2026 qualification is a landmark moment for a football-crazy island nation with a massive diaspora across Portugal and the Netherlands.",
    culture: [
      "Morna music — a melancholic genre akin to Portuguese fado — is Cape Verde's UNESCO-recognised cultural treasure, made world-famous by Cesária Évora",
      "Cape Verde is one of Africa's most stable democracies and has one of the highest Human Development Indexes on the continent",
      "The islands are called 'Cabo Verde' (Green Cape) despite being semi-arid — early Portuguese sailors named them for the verdant western African cape they sailed from",
    ],
    cuisine: ["Cachupa (slow-cooked stew)", "Caldo de peixe (fish broth)", "Pastéis de atum (tuna pastries)", "Xerém"],
    funFact:
      "Cape Verde has a larger diaspora than home population — more Cape Verdeans live outside the islands (mainly in Portugal, the US, and the Netherlands) than on them.",
  },

  KSA: {
    isoA3: "SAU",
    isoNumeric: 682,
    lat: 23.8859,
    lng: 45.0792,
    capital: "Riyadh",
    soccerHistory:
      "Saudi Arabia's 2022 victory over Argentina — the eventual champions — was one of the biggest upsets in World Cup history, with goalkeeper Mohammed Al-Owais and striker Salem Al-Dawsari becoming national heroes overnight. The Saudi Pro League's recruitment of Cristiano Ronaldo in 2023 sparked a wave of superstar signings that has transformed the domestic league and raised the profile of the game. Saudi Arabia is hosting the 2034 World Cup, making 2026 crucial preparation for their moment in the global spotlight.",
    culture: [
      "Saudi Arabia is home to Mecca and Medina, the two holiest cities in Islam, welcoming over 2 million pilgrims during Hajj each year",
      "The Kingdom of Saudi Arabia controls roughly 16% of the world's proven petroleum reserves — the largest in the world",
      "Vision 2030 is Saudi Arabia's ambitious social transformation plan, opening entertainment venues, cinemas, and mixed-gender events for the first time in decades",
    ],
    cuisine: ["Kabsa (rice with meat)", "Mandi (slow-roasted lamb)", "Jareesh (crushed wheat)", "Mutabbaq"],
    funFact:
      "Salem Al-Dawsari's curling long-range winner against Argentina in 2022 was voted the third-greatest World Cup goal of all time in a FIFA poll conducted shortly after the tournament.",
  },

  URU: {
    isoA3: "URY",
    isoNumeric: 858,
    lat: -32.5228,
    lng: -55.7658,
    capital: "Montevideo",
    soccerHistory:
      "Uruguay is one of football's founding nations — they won the first-ever World Cup in 1930 on home soil and repeated the feat in 1950 with the legendary 'Maracanazo,' shocking Brazil in front of 200,000 people in Rio's Maracanã. Despite a population of just 3.5 million — smaller than many global cities — Uruguay has produced world-class talent for generations: Obdulio Varela, Enzo Francescoli, Diego Forlán (2010 Golden Ball), and Luis Suárez. La Celeste's footballing culture remains the richest per capita in South America.",
    culture: [
      "Uruguay was the first country in Latin America to legalise cannabis nationally and same-sex marriage",
      "Mate (a herbal tea drunk through a metal straw) is such a part of Uruguayan life that people carry thermos flasks everywhere, including to matches",
      "Carnival in Montevideo lasts longer than any other in the world — 40 days of candombe drumming and murga theatre performances",
    ],
    cuisine: ["Chivito (steak sandwich)", "Asado", "Mate (drink)", "Torta frita"],
    funFact:
      "Uruguay's 1950 World Cup win over Brazil in the Maracanã is considered the greatest sporting upset in history — the stadium held 200,000 people who all expected Brazil to win, and a Uruguayan journalist fainted from shock when the winning goal went in.",
  },

  // ── Group I ──────────────────────────────────────────────────────────────

  FRA: {
    isoA3: "FRA",
    isoNumeric: 250,
    lat: 46.2276,
    lng: 2.2137,
    capital: "Paris",
    soccerHistory:
      "France won back-to-back World Cups (1998 and 2018) with squads that redefined what international football could look like — in 1998, Zinedine Zidane's brilliant brace in the final at home lit up the entire country, and in 2018, Kylian Mbappé became only the second teenager after Pelé to score in a World Cup final. Les Bleus finished runners-up in 2022 in one of the greatest finals in history, losing on penalties to Argentina after Mbappé scored a hat-trick. France's conveyor belt of talent from their youth academies makes them perennial favourites.",
    culture: [
      "France has won more Nobel Prizes in literature than any other country, with writers like Albert Camus, Jean-Paul Sartre, and Samuel Beckett among the laureates",
      "The French invented cinema (the Lumière brothers), the bicycle, pasteurisation, and Braille",
      "French is the only language other than English spoken on every continent, with 300 million speakers worldwide",
    ],
    cuisine: ["Baguette with brie", "Coq au vin", "Bouillabaisse", "Crème brûlée"],
    funFact:
      "Kylian Mbappé scored a hat-trick in the 2022 World Cup final — the second ever in a final after Geoff Hurst in 1966 — and still ended up on the losing side.",
  },

  SEN: {
    isoA3: "SEN",
    isoNumeric: 686,
    lat: 14.4974,
    lng: -14.4524,
    capital: "Dakar",
    soccerHistory:
      "Senegal's 2002 World Cup debut was one of the most sensational in tournament history: as debutants they defeated reigning champions France in the opening match, then reached the quarter-finals — still the best performance by any African team at their first World Cup. Twenty years later they won the Africa Cup of Nations for the first time in 2022, with captain and inspiration Sadio Mané — who won the Premier League, Champions League, and AFCON in the same year — guiding the Lions of Teranga to glory.",
    culture: [
      "Teranga — the Wolof word for hospitality and generosity — is the defining national value of Senegal, making it one of Africa's most welcoming countries for visitors",
      "Dakar's Gorée Island, a UNESCO site, was a major transit point for the transatlantic slave trade and is now a powerful memorial",
      "Wrestling (Lutte sénégalaise) is Senegal's most popular sport after football — champions are celebrated like rock stars",
    ],
    cuisine: ["Thiéboudienne (fish and rice)", "Yassa poulet (chicken in onion-lemon sauce)", "Mafé (peanut stew)", "Domoda"],
    funFact:
      "Sadio Mané donated millions of euros of his own salary to build a hospital and school in his tiny home village of Bambali — a village so small it had no running water when he was born there.",
  },

  IRQ: {
    isoA3: "IRQ",
    isoNumeric: 368,
    lat: 33.2232,
    lng: 43.6793,
    capital: "Baghdad",
    soccerHistory:
      "Iraq's greatest footballing moment came at the 2007 AFC Asian Cup, when the Lions of Mesopotamia — playing in a country torn apart by war — defied all odds to win the tournament, sparking scenes of joyous celebration that briefly united the nation. The team played their 'home' matches in Jordan and Malaysia for years due to security conditions, yet qualified for the 1986 World Cup and consistently competes at the top of Asian football. Their 2026 qualification is a significant step in Iraqi football's long road back to the world stage.",
    culture: [
      "Iraq is the cradle of civilisation — Mesopotamia, the land between the Tigris and Euphrates rivers, gave humanity writing, mathematics, and the wheel",
      "Baghdad was once the world's greatest city, home to the legendary 'House of Wisdom' that preserved and advanced mathematics, astronomy, and medicine during the Islamic Golden Age",
      "Iraq has 11,000 archaeological sites — more than any country in the world — representing millennia of human history",
    ],
    cuisine: ["Masgouf (grilled fish)", "Tepsi baytinijan (aubergine casserole)", "Dolma", "Kleicha (date cookies)"],
    funFact:
      "When Iraq won the 2007 Asian Cup, millions of Iraqis poured into the streets to celebrate — it was described by observers as the largest peaceful gathering the country had seen in years.",
  },

  NOR: {
    isoA3: "NOR",
    isoNumeric: 578,
    lat: 60.472,
    lng: 8.4689,
    capital: "Oslo",
    soccerHistory:
      "Norway produced one of the world's great strikers in Ole Gunnar Solskjær, whose late substitute's winner gave Manchester United the Champions League in 1999. But the nation's most sensational footballing moment was qualifying for the 1994 World Cup under Egil Olsen's long-ball tactics and beating both England and Brazil in the group stage. Now Erling Haaland — perhaps the most prolific striker of his generation — gives Norway genuine hopes of a deep run at 2026, ending a three-decade absence from the tournament.",
    culture: [
      "Norway consistently tops the UN's Human Development Index and World Happiness Report, year after year",
      "The concept of 'friluftsliv' (outdoor life) is central to Norwegian identity — Norwegians spend weekends skiing, hiking, and kayaking regardless of weather",
      "Norway is the birthplace of skiing and the Norse mythology that gave us Thor, Odin, and Loki — later popularised by Marvel",
    ],
    cuisine: ["Rakfisk (fermented trout)", "Kjøttkaker (meatballs)", "Lutefisk", "Brunost (brown cheese)"],
    funFact:
      "Erling Haaland scored 97 goals in a single season across all competitions for Manchester City in 2022-23 — a scoring rate that statisticians say has never been seen in the history of professional football.",
  },

  // ── Group J ──────────────────────────────────────────────────────────────

  ARG: {
    isoA3: "ARG",
    isoNumeric: 32,
    lat: -38.4161,
    lng: -63.6167,
    capital: "Buenos Aires",
    soccerHistory:
      "Argentina are the reigning World Cup champions — Lionel Messi finally lifted the trophy in 2022 in Qatar in what is widely considered the greatest World Cup final ever played, ending a 36-year wait and fulfilling his destiny as the greatest player of all time. From Diego Maradona's 'Hand of God' and 'Goal of the Century' in 1986 to Messi's three tournament wins (U-20, Copa América, World Cup) over 20 years, Argentina produce football royalty with every generation. Buenos Aires has more football stadiums than any city on Earth.",
    culture: [
      "Tango was born in the working-class neighbourhoods of Buenos Aires in the late 19th century and is now a UNESCO cultural heritage",
      "Argentina's beef — from vast pampas-grazing cattle — is considered among the finest in the world, with asado (barbecue) a near-sacred ritual",
      "Buenos Aires has more psychologists per capita than any city in the world — the Porteños are famously introspective",
    ],
    cuisine: ["Asado", "Empanadas", "Dulce de leche", "Milanesa"],
    funFact:
      "After Argentina won the 2022 World Cup, over 4 million people flooded the streets of Buenos Aires — one of the largest spontaneous gatherings in human history.",
  },

  ALG: {
    isoA3: "DZA",
    isoNumeric: 12,
    lat: 28.0339,
    lng: 1.6596,
    capital: "Algiers",
    soccerHistory:
      "Algeria's 1982 World Cup win over West Germany — the reigning European champions — remains one of the greatest upsets in tournament history. Les Fennecs won their second Africa Cup of Nations in 2019, with Riyad Mahrez and Baghdad Bounedjah leading a golden generation of players. Algeria have a rich tradition of French-Algerian dual nationals choosing to represent the North African nation, building a multicultural squad that reflects the country's complex modern identity.",
    culture: [
      "Algeria is Africa's largest country by area — large enough to contain Western Europe entirely within its borders",
      "The Sahara Desert covers 80% of Algeria's territory, including the extraordinary stone formations and cave paintings of the Tassili n'Ajjer plateau",
      "Chaâbi music — a popular urban Algerian genre — blends Andalusian classical music brought by Muslims expelled from Spain in 1492 with Berber and Arab folk traditions",
    ],
    cuisine: ["Couscous with seven vegetables", "Chakhchoukha", "Merguez", "Baklawa"],
    funFact:
      "Algeria's victory over West Germany in 1982 — 2-1 over the European champions — prompted West Germany and Austria to conspire in their final group game to produce a result that eliminated Algeria, leading FIFA to ban simultaneous final group matches from ever starting at different times again.",
  },

  AUT: {
    isoA3: "AUT",
    isoNumeric: 40,
    lat: 47.5162,
    lng: 14.5501,
    capital: "Vienna",
    soccerHistory:
      "Austria's 'Wunderteam' of the 1930s — considered the first great international football team — won 14 consecutive matches under coach Hugo Meisl and introduced the concept of technical, passing football to a world used to kick-and-rush. Matthias Sindelar, their brilliant centre-forward nicknamed 'The Paper Man' for his slender frame and ghosting ability, is still considered one of football's all-time greats. A modernised Austria built around David Alaba and Marcel Sabitzer has returned to relevance, reaching the Euro 2024 Round of 16.",
    culture: [
      "Vienna was Europe's cultural capital for centuries — Beethoven, Mozart, Freud, Klimt, and Schubert all lived and worked there",
      "Austria's coffee house (Kaffeehaus) culture is a UNESCO cultural heritage — Viennese café life has been central to intellectual and artistic life since the 17th century",
      "Austria produces some of Europe's finest white wines, particularly Grüner Veltliner, in the Wachau and Burgenland regions",
    ],
    cuisine: ["Wiener Schnitzel", "Sachertorte", "Tafelspitz", "Kaiserschmarrn"],
    funFact:
      "Austria's 'Paper Man' Matthias Sindelar reportedly refused to play for the combined Austria-Germany team (Grossdeutschland) after the Nazi annexation in 1938 — and died under mysterious circumstances shortly after.",
  },

  JOR: {
    isoA3: "JOR",
    isoNumeric: 400,
    lat: 30.5852,
    lng: 36.2384,
    capital: "Amman",
    soccerHistory:
      "Jordan's World Cup qualification for 2026 is the most historic moment in the Nashama's football history — the small kingdom has never before reached the tournament's final stage. Their run to the 2023 AFC Asian Cup final was another landmark, showing genuine regional progress. Jordan's football development has accelerated with investment from King Abdullah II, who is a known football enthusiast, and the national league is increasingly attracting players who choose Jordan over European nations through eligibility.",
    culture: [
      "Jordan is home to Petra — the ancient Nabataean city carved directly into rose-red sandstone cliffs — one of the New Seven Wonders of the World",
      "The Dead Sea, on Jordan's western border with Israel, is Earth's lowest point on land and so salty that swimmers float effortlessly",
      "Jordan has taken in more refugees per capita than almost any other country in the world, demonstrating extraordinary national generosity",
    ],
    cuisine: ["Mansaf (lamb in yoghurt sauce)", "Maqluba (upside-down rice)", "Falafel", "Musakhan"],
    funFact:
      "Petra was built over 2,000 years ago by the Nabataean Arabs, who engineered a sophisticated water management system that supplied the city in a desert environment — technology ahead of its time.",
  },

  // ── Group K ──────────────────────────────────────────────────────────────

  POR: {
    isoA3: "PRT",
    isoNumeric: 620,
    lat: 39.3999,
    lng: -8.2245,
    capital: "Lisbon",
    soccerHistory:
      "Portugal's golden era began with Eusébio — 'The Black Panther' — leading them to third place at the 1966 World Cup, and their finest modern generation won Euro 2016 and the inaugural UEFA Nations League. Cristiano Ronaldo, widely considered among the two best players in football history, has carried Portugal for two decades, becoming the all-time leading scorer in international football with over 130 goals. A deep squad featuring Bruno Fernandes and Bernardo Silva means Portugal's future doesn't end with Ronaldo's international career.",
    culture: [
      "Fado — a hauntingly beautiful music genre expressing 'saudade' (longing) — is Portugal's UNESCO-recognised cultural soul",
      "Portugal founded the first global maritime empire, establishing trade routes to Asia, Africa, and the Americas in the 15th and 16th centuries",
      "Lisbon's Belém Tower and Jerónimos Monastery are masterpieces of Manueline architecture — a uniquely Portuguese style blending Gothic with maritime motifs",
    ],
    cuisine: ["Bacalhau à Brás (salt cod)", "Pastel de nata (custard tart)", "Francesinha", "Caldo verde"],
    funFact:
      "The Portuguese language is spoken by over 260 million people on five continents — making it the 6th most spoken language in the world — largely due to Portugal's 15th-century Age of Discovery.",
  },

  COD: {
    isoA3: "COD",
    isoNumeric: 180,
    lat: -4.0383,
    lng: 21.7587,
    capital: "Kinshasa",
    soccerHistory:
      "The Democratic Republic of Congo (then Zaire) was the first sub-Saharan African team to play at a World Cup, appearing in 1974 West Germany — though they famously allowed a free kick to be taken before the wall was set, leading to a chaotic 9-0 defeat to Yugoslavia. TP Mazembe from Kinshasa is one of Africa's most successful club teams, winning the CAF Champions League five times. A football-mad nation of 100 million people, DR Congo produces extraordinary raw talent that the 'Léopards' are finally channelling into consistent results.",
    culture: [
      "Congo is home to the Congo Basin rainforest — the second-largest tropical forest on Earth and one of the planet's most critical carbon sinks",
      "Kinshasa's music scene — particularly Congolese rumba and soukous — has been one of the most influential in Africa since the 1950s",
      "Congo has more navigable rivers than any country in the world, making river transport as important as road travel across the vast interior",
    ],
    cuisine: ["Moambe (palm nut chicken)", "Fufu with pondu (cassava leaves)", "Liboke (fish in banana leaves)", "Makemba (fried plantain)"],
    funFact:
      "TP Mazembe from Kinshasa became the first African club to reach the FIFA Club World Cup final in 2010, defeating Internacional of Brazil along the way.",
  },

  UZB: {
    isoA3: "UZB",
    isoNumeric: 860,
    lat: 41.3775,
    lng: 64.5853,
    capital: "Tashkent",
    soccerHistory:
      "Uzbekistan's 'White Wolves' are Central Asia's most exciting football story — the nation that produced the dominant AFC U-23 Asian Cup champions and is now bringing a generation of technically gifted players to the world's attention. Eldor Shomurodov has made an impact at Italian clubs Roma and Cagliari, introducing European audiences to Uzbek football quality. Their 2026 World Cup qualification is a historic first for the country and for Central Asia's growing football confidence.",
    culture: [
      "Uzbekistan's Silk Road cities — Samarkand, Bukhara, and Khiva — contain some of the world's most spectacular Islamic architecture, including the Registan complex",
      "Uzbekistan was home to the medieval astronomer Ulugh Beg, who built the world's largest sextant and calculated the length of the year to within a minute of modern measurements",
      "Plov (the Uzbek rice dish) is so central to the culture that UNESCO recognised Uzbek plov-making as an intangible cultural heritage",
    ],
    cuisine: ["Plov (rice with lamb and carrots)", "Shashlik", "Samsa (meat pastry)", "Lagman (pulled noodles)"],
    funFact:
      "Samarkand's Registan square — the heart of Tamerlane's empire — was once described by British diplomat Lord Curzon as 'the noblest public square in the world.'",
  },

  COL: {
    isoA3: "COL",
    isoNumeric: 170,
    lat: 4.5709,
    lng: -74.2973,
    capital: "Bogotá",
    soccerHistory:
      "Colombia's 2014 World Cup was their finest hour, with James Rodríguez winning the Golden Boot with six goals — including a breathtaking chest control and volley against Uruguay that won the Puskás Award. Carlos Valderrama's magnificent afro and magical passing game made him one of the most recognisable players of the 1980s and 90s. Colombia reached the Copa América final in 2024 before losing to Argentina, showing that their golden generation hasn't finished yet.",
    culture: [
      "Colombia produces about 15% of the world's coffee, and Colombian coffee is the only origin-specific coffee awarded protected geographical status in the EU",
      "Gabriel García Márquez, Nobel laureate and father of 'magical realism,' was Colombian — his hometown Aracataca inspired the fictional Macondo in One Hundred Years of Solitude",
      "Colombia has the most species of birds of any country on Earth — over 1,900 species — due to its extraordinary biodiversity",
    ],
    cuisine: ["Bandeja paisa (platter with beans, rice, pork)", "Ajiaco (potato soup)", "Empanadas", "Arepas"],
    funFact:
      "James Rodríguez's volley against Uruguay in the 2014 World Cup — a first-time chest control and left-foot volley from outside the box — was voted the greatest goal in World Cup history by a public poll conducted by FIFA.",
  },

  // ── Group L ──────────────────────────────────────────────────────────────

  ENG: {
    isoA3: "GBR",
    isoNumeric: 826,
    lat: 52.3555,
    lng: -1.1743,
    capital: "London",
    soccerHistory:
      "England invented association football in the 19th century and won the only World Cup in their history in 1966 on home soil — with Geoff Hurst's hat-trick and the infamous 'did it cross the line?' third goal still debated today. Since then, decades of near-misses have made England's tournament exits a national ritual, with penalty shootout heartbreak a recurring theme. A resurgent team under Gareth Southgate reached back-to-back European Championship finals in 2021 and 2024, and a squad featuring Jude Bellingham and Harry Kane finally looks capable of ending 60 years of hurt.",
    culture: [
      "Britain invented the Industrial Revolution, giving the world the steam engine, railways, and mass manufacturing",
      "The Premier League is the world's most-watched football league, broadcast in 188 countries to roughly 3 billion viewers worldwide",
      "Britain's literary tradition — Shakespeare, Dickens, Austen, Tolkien, Rowling — has shaped storytelling across the world",
    ],
    cuisine: ["Fish and chips", "Full English breakfast", "Chicken tikka masala", "Sunday roast"],
    funFact:
      "England's first international football match was played against Scotland in 1872 — and England have been over-hyped before every tournament ever since.",
  },

  CRO: {
    isoA3: "HRV",
    isoNumeric: 191,
    lat: 45.1,
    lng: 15.2,
    capital: "Zagreb",
    soccerHistory:
      "Croatia is the most remarkable overachiever in World Cup history: a nation of just 3.9 million people that has reached the final twice (2018) and the third-place play-off four times in six appearances. Luka Modrić — widely regarded as one of the greatest midfielders of all time — inspired Croatia to their 2018 final at age 32, winning the Golden Ball along the way. Davor Šuker's six goals won the 1998 Golden Boot, and Croatia's chess-board chequered jersey is one of football's most recognised kits.",
    culture: [
      "Croatia has over 1,200 islands along its Adriatic coastline — more than any Mediterranean country — and crystal-clear water that routinely wins Europe's cleanest sea awards",
      "Dubrovnik's medieval city walls inspired Game of Thrones' King's Landing, turning Croatia into one of the world's top tourism destinations",
      "Croatia invented the necktie — the word 'cravat' comes from 'Croat,' as Croatian soldiers in the Thirty Years' War wore distinctive knotted scarves",
    ],
    cuisine: ["Peka (slow-cooked lamb or octopus under the bell)", "Black risotto (crni rižot)", "Lamb from Pag island", "Strukli"],
    funFact:
      "Croatia's 4 million people have produced more Grand Slam tennis champions, world boxing champions, and basketball Hall of Famers per capita than almost any other nation.",
  },

  GHA: {
    isoA3: "GHA",
    isoNumeric: 288,
    lat: 7.9465,
    lng: -1.0232,
    capital: "Accra",
    soccerHistory:
      "Ghana's Black Stars were minutes away from becoming the first African nation to reach a World Cup semi-final in 2010 when Luis Suárez deliberately handballed on the goal line in extra-time — and Asamoah Gyan heartbreakingly hit the penalty against the crossbar. Ghana's Under-20 team won the FIFA World Youth Championship in 2009, with André Ayew inspiring a generation. Michael Essien, Asamoah Gyan, Sulley Muntari, and the Ayew family dynasty have made Ghana West Africa's most celebrated footballing nation.",
    culture: [
      "Ghana was the first sub-Saharan African country to gain independence from colonial rule in 1957 — a moment that inspired the entire continent's liberation movements",
      "Kente cloth — the brilliantly coloured woven fabric worn at ceremonies — is Ghana's most recognised cultural export and a symbol of African heritage worldwide",
      "Accra's Makola Market is West Africa's most vibrant trading hub, where everything from electronics to exotic spices changes hands in a festival of commerce",
    ],
    cuisine: ["Jollof rice", "Fufu with palm nut soup", "Kelewele (spiced fried plantain)", "Kontomire stew"],
    funFact:
      "The Ghana-Nigeria 'Jollof Wars' — an online debate about whose version of jollof rice is superior — is arguably West Africa's most passionate cultural rivalry, fought passionately on social media for over a decade.",
  },

  PAN: {
    isoA3: "PAN",
    isoNumeric: 591,
    lat: 8.538,
    lng: -80.7821,
    capital: "Panama City",
    soccerHistory:
      "Panama made their World Cup debut in 2018 in Russia, and midfielder Blas Pérez and captain Román Torres led the 'Canaleros' with immense pride — Torres's qualifying goal against Costa Rica sparked celebrations across the country that were compared to New Year's Eve. Though they lost all three group matches, Panama's debut was a source of immense national pride for a country that previously made headlines mainly for its canal. A growing football infrastructure is helping Panama punch above its weight in CONCACAF.",
    culture: [
      "The Panama Canal — one of humanity's greatest engineering achievements — connects the Atlantic and Pacific Oceans and handles about 5% of world trade",
      "Panama is one of the world's greatest biodiversity hotspots, with more bird species in a small area than all of North America combined",
      "The mola, a hand-stitched textile art created by the Guna people of Panama's islands, is considered among the most sophisticated folk art forms in the Americas",
    ],
    cuisine: ["Sancocho de gallina (hen stew)", "Ropa vieja (shredded beef)", "Carimañola (stuffed yuca fritter)", "Patacones"],
    funFact:
      "The Panama Canal saves ships roughly 15,000 km compared to sailing around the southern tip of South America — and Panama collects over $3 billion in tolls annually just for this shortcut.",
  },
};
