import { invoke } from "@tauri-apps/api/core";

function deduplicateTracks(tracks, excludeIds = new Set()) {
  const seen = new Set();
  return tracks.filter(t => {
    if (!t || !t.id) return false;
    const key = `${t.source}:${t.id}`;
    if (seen.has(key) || excludeIds.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchSimilarFromTrack(track, token) {
  try {
    if (track.source === "yandex" && token) {
      return await invoke("get_yandex_similar", { trackId: track.id, token });
    }
    if (track.source === "soundcloud") {
      return await invoke("get_soundcloud_similar", { trackId: track.id });
    }
  } catch (e) {
    console.log(`[HomeLoader] Similar fetch failed for ${track.title}:`, e);
  }
  return [];
}

async function fetchSoundCloudByGenre(genreQuery) {
  try {
    const tracks = await invoke("search_soundcloud_charts", { genre: genreQuery });
    return (tracks || []).slice(0, 5);
  } catch (e) {
    console.log(`[HomeLoader] SoundCloud charts failed for ${genreQuery}:`, e);
    // Fallback to text search
    try {
      const tracks = await invoke("search_soundcloud", { query: genreQuery });
      return (tracks || []).slice(0, 5);
    } catch (e2) {
      return [];
    }
  }
}

async function fetchSoundCloudSearch(query) {
  try {
    const tracks = await invoke("search_soundcloud", { query });
    return (tracks || []).slice(0, 5);
  } catch (e) {
    return [];
  }
}

export async function loadHomeRecommendations(history, token, likedTracks = []) {
  const {
    topArtists,
    genreQueries,
    likedTrackIds,
    recentTrackIds,
  } = history;

  // Collect tracks to exclude (already in history/liked)
  const excludeIds = new Set([...likedTrackIds, ...recentTrackIds]);

  // Parallel fetches
  const promises = [];

  // 1. Yandex chart (if token available)
  if (token) {
    promises.push(
      invoke("get_yandex_chart", { token })
        .then(tracks => ({ type: "chart", data: tracks || [] }))
        .catch(e => { console.log("[HomeLoader] Chart failed:", e); return { type: "chart", data: [] }; })
    );
  }

  // 2. Yandex new releases (if token available)
  if (token) {
    promises.push(
      invoke("get_yandex_new_releases", { token })
        .then(albums => ({ type: "releases", data: albums || [] }))
        .catch(e => { console.log("[HomeLoader] Releases failed:", e); return { type: "releases", data: [] }; })
    );
  }

  // 3. Similar tracks from liked tracks
  if (likedTracks.length > 0) {
    promises.push(
      (async () => {
        const results = [];
        // Take up to 3 liked tracks and fetch similar for each
        const sampleTracks = likedTracks.slice(0, 3);
        for (const track of sampleTracks) {
          try {
            const similar = await fetchSimilarFromTrack(track, token);
            results.push(...(similar || []));
          } catch (e) {
            // Individual failure is fine, continue
          }
        }
        return { type: "similar", data: results };
      })()
    );
  }

  // 4. SoundCloud genre tracks
  if (genreQueries.length > 0) {
    const genrePromises = genreQueries.slice(0, 4).map(gq =>
      fetchSoundCloudByGenre(gq.query)
        .then(tracks => ({ genre: gq.genre, tracks }))
    );
    promises.push(
      Promise.all(genrePromises)
        .then(results => ({ type: "genreTracks", data: results }))
    );
  }

  // 5. SoundCloud popular (random genres as fallback)
  promises.push(
    (async () => {
      const fallbackGenres = ["rap", "pop", "electronic", "chill", "rock", "house", "lofi", "hiphop"];
      const shuffled = [...fallbackGenres].sort(() => Math.random() - 0.5).slice(0, 5);
      const results = await Promise.all(
        shuffled.map(genre =>
          fetchSoundCloudByGenre(genre)
            .then(tracks => tracks)
            .catch(() => [])
        )
      );
      return { type: "soundcloudPopular", data: results.flat() };
    })()
  );

  // Wait for all with individual error handling
  const settled = await Promise.allSettled(promises);
  const results = {};

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      const { type, data } = result.value;
      results[type] = data;
    }
  }

  return {
    chart: results.chart || [],
    releases: results.releases || [],
    similarTracks: deduplicateTracks(results.similarTracks || [], excludeIds),
    genreTracks: results.genreTracks || [],
    soundcloudPopular: deduplicateTracks(results.soundcloudPopular || [], excludeIds).slice(0, 15),
  };
}
