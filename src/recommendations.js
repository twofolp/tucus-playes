const GENRE_KEYWORDS = {
  rap: ["рэп", "rap", "hip-hop", "хип-хоп", "hiphop", "travis", "lil", "kanye", "drake", "migos", "playboi", "ski mask", "lil uzi", "lil baby", "lil keed", "pop smoke", "6ix9ine", "cardi", "tyga", "kendrick", "j cole", "eminem", "tech n9ne", "macan", "scriptonite", "многоточие", "face", "pharaoh", "kunteynir", "oscillate", "смешарики", "lishow", "kasta", "krec", "guf", "basta", "miyagi", "endspiel", "slava marlow", "ramil", "andro", "timati", "bizon", "bxbx", "ёлка", "instasamka", "огربез", "мишель", "greeicy"],
  rock: ["rock", "рок", "punk", "панк", "metal", "метал", "alternative", "indie rock", "garage", "grunge", "nirvana", "radiohead", "arctic monkeys", "green day", "blink-182", "linkin park", "system of a down", "slipknot", "metallica", "iron maiden", "ac dc", "guns n", "queen"],
  electronic: ["electronic", "edm", "techno", "house", "deep house", "progressive", "trance", "dubstep", "drum and bass", "dnb", "ambient", "synthwave", "vaporwave", "lo-fi", "lofi", "chillwave", "future bass", "electro", "disco", "synth", "kraftwerk", "deadmau5", "avicii", "calvin harris", "diplo", "marshmello", "martin garrix", "tiësto"],
  pop: ["pop", "поп", "диско", "dance", "dancehall", "k-pop", "j-pop", "britney", "taylor swift", "ariana grande", "dua lipa", "billie eilish", "olivia rodrigo", "harry styles", "ed sheeran", "the weeknd", "post malone", "justin bieber", "selena gomez", "rihanna", "beyonce", "lady gaga"],
  rnb: ["r&b", "rnb", "r and b", "soul", "соул", "neo-soul", "funk", "фанк", "gospel", "jill scott", "erykah badu", "frank ocean", "sza", "daniel caesar", "h.e.r.", "snoh aalegra", "jhené aiko", "the weeknd", "usher", "alicia keys", "beyonce"],
  hiphop: ["hip hop", "хип-хоп", "boom bap", "old school", "trap", "cloud rap", "mumble rap", "underground", "freestyle", "battle", "biggie", "tupac", "nas", "jay-z", "kanye", "drake", "lil wayne", "future", "travis scott", "playboi carti"],
  chill: ["chill", "чилл", "lofi", "lo-fi", "lofi hip hop", "study", "relax", "sleep", "chillhop", "jazz hop", "mellow", "smooth", "easy listening", "downtempo", "trip-hop"],
  dance: ["dance", "танцы", "club", "клуб", "house", "edm", "festival", "rave", "techno", "electro", "bass", "drop", "energy", "party", "вечеринка"],
  classical: ["classical", "классика", "orchestra", "symphony", "piano", "violin", "beethoven", "mozart", "chopin", "bach", "vivaldi", "tchaikovsky", "rachmaninoff", "debussy"],
  jazz: ["jazz", "джаз", "blues", "блюз", "swing", "bebop", "improvisation", "saxophone", "trumpet", "miles davis", "john coltrane", "charlie parker", "ella fitzgerald", "frank sinatra", "chet baker"],
};

function normalizeText(text) {
  return (text || "").toLowerCase().trim();
}

function detectGenresFromText(text) {
  const normalized = normalizeText(text);
  const detected = [];
  for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
    if (keywords.some(kw => normalized.includes(kw))) {
      detected.push(genre);
    }
  }
  return detected;
}

export function analyzeListeningHistory(playHistory = [], likedTracks = []) {
  const artistPlayCount = {};
  const sourcePlayCount = { yandex: 0, soundcloud: 0, youtube: 0 };
  const genreCount = {};
  const recentTrackIds = new Set();
  const likedTrackIds = new Set();

  // Analyze play history (most recent 500 entries)
  const historySlice = playHistory.slice(0, 500);
  for (const entry of historySlice) {
    if (!entry) continue;

    const artist = normalizeText(entry.artist);
    if (artist) {
      artistPlayCount[artist] = (artistPlayCount[artist] || 0) + 1;
    }

    const src = entry.source;
    if (src && sourcePlayCount[src] !== undefined) {
      sourcePlayCount[src]++;
    }

    // Detect genres from title + artist
    const combined = `${entry.title || ""} ${entry.artist || ""}`;
    const genres = detectGenresFromText(combined);
    for (const g of genres) {
      genreCount[g] = (genreCount[g] || 0) + 1;
    }

    if (entry.id) recentTrackIds.add(`${entry.source}:${entry.id}`);
  }

  // Analyze liked tracks
  for (const track of likedTracks) {
    if (!track) continue;
    if (track.id) likedTrackIds.add(`${track.source}:${track.id}`);

    const artist = normalizeText(track.artist);
    if (artist) {
      // Liked tracks count 3x more than regular plays
      artistPlayCount[artist] = (artistPlayCount[artist] || 0) + 3;
    }

    const combined = `${track.title || ""} ${track.artist || ""}`;
    const genres = detectGenresFromText(combined);
    for (const g of genres) {
      genreCount[g] = (genreCount[g] || 0) + 3;
    }
  }

  // Sort artists by play count
  const topArtists = Object.entries(artistPlayCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([artist, count]) => ({ artist, count }));

  // Sort genres by count
  const topGenres = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre, count]) => ({ genre, count }));

  // Determine primary source
  const primarySource = Object.entries(sourcePlayCount)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "soundcloud";

  // Map genres to SoundCloud search queries
  const genreToQuery = {
    rap: "rap hip hop",
    rock: "rock alternative",
    electronic: "electronic edm",
    pop: "pop hits",
    rnb: "r&b soul",
    hiphop: "hip hop underground",
    chill: "lofi chill",
    dance: "dance club",
    classical: "classical orchestra",
    jazz: "jazz blues",
  };

  const genreQueries = topGenres
    .slice(0, 4)
    .map(g => ({
      genre: g.genre,
      query: genreToQuery[g.genre] || g.genre,
      weight: g.count,
    }));

  return {
    topArtists,
    topGenres,
    primarySource,
    genreQueries,
    recentTrackIds,
    likedTrackIds,
    totalPlays: historySlice.length,
    totalLiked: likedTracks.length,
  };
}
