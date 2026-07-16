let cachedClientId = null;
let clientIdExpiry = 0;

const parseTrack = (t, artistId) => ({
  id: String(t.id),
  title: t.title || 'Unknown Track',
  artist: t.user?.username || 'Unknown Artist',
  artistId: artistId || String(t.user?.id || ''),
  artists: null,
  duration: (t.duration || 0) / 1000,
  thumbnail: t.artwork_url
    ? t.artwork_url.replace('-large.', '-t500x500.')
    : t.user?.avatar_url || '',
  source: 'soundcloud',
});

const FALLBACK_IDS = [
  'a3e059563d7fd3372b49b37f00a00bcf',
  '2t9loNQH90kzJcsF6jGLssKfJaNuISww',
  'b45b1aa10f1ac2941910a7f0d10f8e28',
  'MhFkNSjOPK5BCgSGJdQKyPhdOByGNrKj',
  'qHf7V3Y7rN0vJ9sD1hQ5yZ6kB0FJfR1e',
  'cYfVh7FmNH9sPjJqfUvL3kT2xWbR5nDg',
];

async function getClientId() {
  if (cachedClientId && Date.now() < clientIdExpiry) return cachedClientId;

  for (const id of FALLBACK_IDS) {
    try {
      const res = await fetch(
        `https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id=${id}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (res.ok) {
        cachedClientId = id;
        clientIdExpiry = Date.now() + 3600000;
        return id;
      }
    } catch {}
  }

  throw new Error('SoundCloud unavailable');
}

async function withClientId(fn) {
  try {
    const id = await getClientId();
    return await fn(id);
  } catch (e) {
    console.warn('SoundCloud error:', e.message);
    return null;
  }
}

export const soundcloud = {
  async search(query) {
    return (await withClientId(async (clientId) => {
      const enc = encodeURIComponent(query);
      const res = await fetch(
        `https://api-v2.soundcloud.com/search/tracks?q=${enc}&client_id=${clientId}&limit=20`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.collection || []).map(t => parseTrack(t));
    })) || [];
  },

  async getStreamUrl(trackId) {
    const clientId = await getClientId();
    const res = await fetch(
      `https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${clientId}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error('Track not found');
    const json = await res.json();
    const transcodings = json.media?.transcodings || [];
    const transcoding =
      transcodings.find(t => t.format?.protocol === 'progressive') ||
      transcodings[0];
    if (!transcoding?.url) throw new Error('No suitable format');

    const streamRes = await fetch(`${transcoding.url}?client_id=${clientId}`, {
      signal: AbortSignal.timeout(8000),
    });
    const streamJson = await streamRes.json();
    return streamJson.url || streamJson.location || '';
  },

  async getCharts(genre) {
    return (await withClientId(async (clientId) => {
      const enc = encodeURIComponent(genre);
      const res = await fetch(
        `https://api-v2.soundcloud.com/charts?kind=top&genre=soundcloud:genres:${enc}&client_id=${clientId}&limit=10`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return await this.search(`top ${genre}`);
      const json = await res.json();
      const tracks = (json.collection || [])
        .map(item => {
          const t = item.track || (item.id ? item : null);
          return t ? parseTrack(t) : null;
        })
        .filter(t => t && t.duration > 0 && t.duration <= 600);
      return tracks.length ? tracks : await this.search(`top ${genre}`);
    })) || [];
  },

  async getSimilar(trackId) {
    return (await withClientId(async (clientId) => {
      const res = await fetch(
        `https://api-v2.soundcloud.com/tracks/${trackId}/related?client_id=${clientId}&limit=20`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return (json.collection || []).map(t => parseTrack(t));
    })) || [];
  },
};
