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

async function fetchSoundCloudTopCharts(genre = "all-music") {
  try {
    const tracks = await invoke("search_soundcloud_charts", { genre });
    return tracks || [];
  } catch (e) {
    try {
      const tracks = await invoke("search_soundcloud", { query: genre });
      return tracks || [];
    } catch (e2) {
      return [];
    }
  }
}

export async function loadHomeRecommendations(history, token, likedTracks = []) {
  const promises = [];

  // 1. Risazatvorchestvo.com New Releases
  promises.push(
    invoke("get_risazatvorchestvo_releases", { limit: 50 })
      .then(tracks => ({ type: "rztReleases", data: tracks || [] }))
      .catch(e => { console.log("[HomeLoader] RZT Releases failed:", e); return { type: "rztReleases", data: [] }; })
  );

  // 2. Yandex chart (if token available)
  if (token) {
    promises.push(
      invoke("get_yandex_chart", { token })
        .then(tracks => ({ type: "chart", data: tracks || [] }))
        .catch(e => { console.log("[HomeLoader] Chart failed:", e); return { type: "chart", data: [] }; })
    );
  }

  // 3. VK Recommendations (if token available)
  const vkTok = localStorage.getItem("vk_token") || "";
  if (vkTok) {
    promises.push(
      invoke("get_vk_recommendations", { token: vkTok, count: 30 })
        .then(tracks => ({ type: "vkRecs", data: tracks || [] }))
        .catch(e => { console.log("[HomeLoader] VK Recs failed:", e); return { type: "vkRecs", data: [] }; })
    );
  }

  const settled = await Promise.allSettled(promises);
  const results = {};

  for (const result of settled) {
    if (result.status === "fulfilled" && result.value) {
      const { type, data } = result.value;
      results[type] = data;
    }
  }

  const rztReleases = results.rztReleases || [];
  const vkRecs = results.vkRecs || [];
  const yandexChart = results.chart || [];

  const chart = yandexChart.length > 0 ? yandexChart : vkRecs;
  const releases = rztReleases;

  return {
    chart,
    releases,
    rztReleases,
    recommendations: releases,
    lastfmRecs: [],
    vkRecs,
    similarTracks: [],
    genreTracks: [],
    soundcloudPopular: [],
  };
}
