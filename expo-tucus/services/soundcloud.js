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

async function getClientId() {
  if (cachedClientId && Date.now() < clientIdExpiry) return cachedClientId;

  const fallbacks = [
    'a3e059563d7fd3372b49b37f00a00bcf',
    '2t9loNQH90kzJcsF6jGLssKfJaNuISww',
    'b45b1aa10f1ac2941910a7f0d10f8e28',
  ];
  for (const fb of fallbacks) {
    if (await validateClientId(fb)) {
      cachedClientId = fb;
      clientIdExpiry = Date.now() + 3600000;
      return fb;
    }
  }
  throw new Error('Failed to get SoundCloud client ID');
}

async function validateClientId(id) {
  try {
    const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id=${id}`);
    return res.ok;
  } catch { return false; }
}

export const soundcloud = {
  async search(query) {
    const clientId = await getClientId();
    const enc = encodeURIComponent(query);
    const res = await fetch(`https://api-v2.soundcloud.com/search/tracks?q=${enc}&client_id=${clientId}&limit=20`);
    if (!res.ok) throw new Error('SoundCloud search failed');
    const json = await res.json();
    return (json.collection || []).map(t => parseTrack(t));
  },

  async getStreamUrl(trackId) {
    const clientId = await getClientId();
    const res = await fetch(`https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${clientId}`);
    const json = await res.json();
    const transcodings = json.media?.transcodings || [];
    const transcoding = transcodings.find(t => t.format?.protocol === 'progressive') || transcodings[0];
    if (!transcoding?.url) throw new Error('No suitable format');

    const streamRes = await fetch(`${transcoding.url}?client_id=${clientId}`);
    const streamJson = await streamRes.json();
    return streamJson.url || streamJson.location || '';
  },

  async getCharts(genre) {
    const clientId = await getClientId();
    const enc = encodeURIComponent(genre);
    try {
      const res = await fetch(`https://api-v2.soundcloud.com/charts?kind=top&genre=soundcloud:genres:${enc}&client_id=${clientId}&limit=10`);
      if (res.ok) {
        const json = await res.json();
        const tracks = (json.collection || []).map(item => {
          const t = item.track || (item.id ? item : null);
          return t ? parseTrack(t) : null;
        }).filter(t => t && t.duration > 0 && t.duration <= 600);
        if (tracks.length) return tracks;
      }
    } catch {}
    return this.search(`top ${genre}`);
  },

  async getSimilar(trackId) {
    const clientId = await getClientId();
    const res = await fetch(`https://api-v2.soundcloud.com/tracks/${trackId}/related?client_id=${clientId}&limit=20`);
    if (!res.ok) throw new Error('Related failed');
    const json = await res.json();
    return (json.collection || []).map(t => parseTrack(t));
  },
};
