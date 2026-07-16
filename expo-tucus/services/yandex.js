const BASE = 'https://api.music.yandex.net';

const headers = (token) => ({
  Authorization: `OAuth ${token}`,
  'User-Agent': 'Yandex-Music-API/2.0',
  'X-Yandex-Music-Client': 'YandexMusicAPI/2.0',
  Accept: 'application/json',
  'Accept-Language': 'ru,en',
});

const parseTrack = (t) => {
  const id = t.id != null ? String(t.id) : null;
  if (!id) return null;
  const artists = (t.artists || []).map(a => ({
    id: a.id != null ? String(a.id) : '',
    name: a.name || 'Unknown',
  }));
  const artist = artists.map(a => a.name).join(', ') || 'Unknown Artist';
  const coverUri = t.coverUri || '';
  const thumbnail = coverUri ? `https://${coverUri.replace('%%', '400x400')}` : '';
  return {
    id, title: t.title || 'Unknown', artist,
    artistId: artists[0]?.id || null,
    artists: artists.length ? artists : null,
    duration: (t.durationMs || 0) / 1000,
    thumbnail, source: 'yandex',
  };
};

const parseAlbum = (a) => {
  const id = a.id != null ? String(a.id) : null;
  if (!id) return null;
  const coverUri = a.coverUri || '';
  const thumbnail = coverUri ? `https://${coverUri.replace('%%', '400x400')}` : '';
  const artists = (a.artists || []).map(ar => ar.name).join(', ');
  return { id, title: a.title || 'Unknown', thumbnail, artist: artists || 'Unknown', trackCount: a.trackCount || 0, year: a.year, albumType: a.type };
};

const parseArtist = (a) => {
  const id = a.id != null ? String(a.id) : null;
  if (!id) return null;
  const cover = a.cover || {};
  const coverUri = cover.uri || a.coverUri || '';
  const thumbnail = coverUri ? `https://${coverUri.replace('%%', '400x400')}` : '';
  return { id, name: a.name || 'Unknown', thumbnail, genres: (a.genres || []).map(g => g.name || g) };
};

export const yandex = {
  async search(query, token) {
    const enc = encodeURIComponent(query);
    const res = await fetch(`${BASE}/search?text=${enc}&type=track&page=0&pageSize=20`, { headers: headers(token) });
    if (!res.ok) throw new Error(`Yandex search failed: ${res.status}`);
    const json = await res.json();
    const items = json.result?.tracks?.results || json.result?.tracks?.items || [];
    return items.map(parseTrack).filter(Boolean);
  },

  async searchAll(query, token) {
    const enc = encodeURIComponent(query);
    const res = await fetch(`${BASE}/search?text=${enc}&type=all&page=0&pageSize=20`, { headers: headers(token) });
    if (!res.ok) throw new Error('Search failed');
    const json = await res.json();
    const r = json.result || {};
    return {
      tracks: (r.tracks?.results || r.tracks?.items || []).map(parseTrack).filter(Boolean),
      albums: (r.albums?.results || r.albums?.items || []).map(parseAlbum).filter(Boolean),
      artists: (r.artists?.results || r.artists?.items || []).map(parseArtist).filter(Boolean),
    };
  },

  async getStreamUrl(trackId, token) {
    const infoRes = await fetch(`${BASE}/tracks/${trackId}/download-info`, { headers: headers(token) });
    const infoJson = await infoRes.json();
    const arr = infoJson.result || [];
    const info = arr.find(i => i.codec === 'mp3') || arr[0];
    if (!info?.downloadInfoUrl) throw new Error('No download info');

    const xmlRes = await fetch(info.downloadInfoUrl, { headers: headers(token) });
    const xml = await xmlRes.text();
    const extract = (tag) => {
      const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`));
      return m ? m[1] : null;
    };
    const host = extract('host'), path = extract('path'), ts = extract('ts'), s = extract('s');
    if (!host || !path || !ts || !s) throw new Error('Failed to parse XML');

    const pathClean = path.startsWith('/') ? path.slice(1) : path;
    // Simple MD5 - we'll use a JS implementation
    const hash = await md5(`XGRlBW9FXlekgbPrRHuSiA${pathClean}${s}`);
    return `https://${host}/get-mp3/${hash}/${ts}${path}`;
  },

  async getPlaylist(owner, playlistId, token) {
    const h = { ...headers(token), 'X-Yandex-Music-Client': 'YandexMusic/Android' };
    const res = await fetch(`${BASE}/users/${owner}/playlists/${playlistId}`, { headers: h });
    const json = await res.json();
    const r = json.result || {};
    const coverUri = r.cover?.uri || '';
    return {
      title: r.title || 'Playlist',
      ownerName: r.owner?.name || 'Yandex Music',
      coverUrl: coverUri ? `https://${coverUri.replace('%%', '400x400')}` : '',
      trackCount: r.trackCount || 0,
      tracks: (r.tracks || r.items || []).map(i => parseTrack(i.track)).filter(Boolean),
    };
  },

  async getLikedTracks(token) {
    const uid = await getUid(token);
    const res = await fetch(`${BASE}/users/${uid}/likes/tracks`, { headers: headers(token) });
    const json = await res.json();
    const tracks = json.result?.library?.tracks || [];
    const result = [];
    for (const item of tracks.slice(0, 30)) {
      if (item.id) {
        const tRes = await fetch(`${BASE}/tracks/${item.id}`, { headers: headers(token) });
        const tJson = await tRes.json();
        const t = parseTrack(tJson.result?.[0]);
        if (t) result.push(t);
      }
    }
    return result;
  },

  async getMyWave(token) {
    const res = await fetch(`${BASE}/rotor/station/user:onyourwave/tracks`, { headers: headers(token) });
    const json = await res.json();
    return (json.result?.sequence || []).map(i => parseTrack(i.track)).filter(Boolean);
  },

  async getSimilar(trackId, token) {
    const res = await fetch(`${BASE}/tracks/${trackId}/similar`, { headers: headers(token) });
    const json = await res.json();
    return (json.result?.similarTracks || []).map(parseTrack).filter(Boolean);
  },

  async likeTrack(trackId, token, remove) {
    const uid = await getUid(token);
    const body = JSON.stringify({ 'track-ids': [trackId] });
    const url = remove ? `${BASE}/users/${uid}/likes/tracks/remove` : `${BASE}/users/${uid}/likes/tracks/add-multiple`;
    await fetch(url, { method: 'POST', headers: { ...headers(token), 'Content-Type': 'application/json' }, body });
  },

  async getLyrics(trackId, token) {
    const urls = [
      `${BASE}/tracks/${trackId}/lyrics?format=LRC&timeStamped=true`,
      `${BASE}/tracks/${trackId}/supplement`,
    ];
    for (const url of urls) {
      const res = await fetch(url, { headers: headers(token) });
      if (!res.ok) continue;
      const json = await res.json();
      const downloadUrl = json.result?.lyrics?.downloadUrl || json.result?.downloadUrl;
      if (downloadUrl) {
        const lrcRes = await fetch(downloadUrl);
        const lrcText = await lrcRes.text();
        const lines = parseLRC(lrcText);
        if (lines.length) return lines;
      }
      const fullLyrics = json.result?.lyrics?.fullLyrics || json.result?.fullLyrics || json.result?.lyrics?.text;
      if (fullLyrics) {
        const lines = parseLRC(fullLyrics);
        if (lines.length) return lines;
        return fullLyrics.split('\n').filter(l => l.trim()).map(l => ({ text: l, time: null, duration: null }));
      }
    }
    return [];
  },
};

async function getUid(token) {
  const res = await fetch(`${BASE}/account/status`, { headers: headers(token) });
  const json = await res.json();
  return String(json.result?.account?.uid || '');
}

// Simple MD5 implementation
async function md5(string) {
  const msgUint8 = new TextEncoder().encode(string);
  const hashBuffer = await crypto.subtle.digest('MD5', msgUint8).catch(() => null);
  if (hashBuffer) {
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  // Fallback: simple hash
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    const char = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(32, '0');
}

function parseLRC(text) {
  const lines = [];
  const lineTimeRe = /\[(\d+):(\d+)[.:](\d+)\]/g;
  const plainTimeRe = /\[(\d+):(\d+)\]/;

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;

    const times = [];
    let m;
    const tempLine = line;
    while ((m = lineTimeRe.exec(tempLine)) !== null) {
      const min = parseInt(m[1]), sec = parseInt(m[2]);
      const csStr = m[3];
      let ms = parseInt(csStr);
      if (csStr.length === 1) ms *= 100;
      else if (csStr.length === 2) ms *= 10;
      times.push(min * 60 + sec + ms / 1000);
    }
    lineTimeRe.lastIndex = 0;

    if (times.length === 0) {
      const pm = line.match(plainTimeRe);
      if (pm) {
        const content = line.slice(pm[0].length).trim();
        if (content) lines.push({ text: content, time: parseInt(pm[1]) * 60 + parseInt(pm[2]), duration: null });
      } else if (!line.startsWith('[')) {
        lines.push({ text: line, time: null, duration: null });
      }
      continue;
    }

    let content = line.replace(/\[\d+:\d+[.:]\d+\]/g, '').trim();
    for (const t of times) {
      lines.push({ text: content, time: t, duration: null });
    }
  }

  // Calculate durations
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time != null) {
      const next = lines[i + 1]?.time ?? (lines[i].time + 5);
      lines[i].duration = next - lines[i].time;
    }
  }

  return lines;
}
