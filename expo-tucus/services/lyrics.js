import { yandex } from './yandex';

export const lyricsService = {
  async fetch(track, yandexToken) {
    // 1. Try Yandex lyrics
    if (track.source === 'yandex' && yandexToken) {
      try {
        const lines = await yandex.getLyrics(track.id, yandexToken);
        if (lines.length) return lines;
      } catch {}
    }

    // 2. Try LRCLIB
    try {
      const lines = await this.fromLRCLIB(track);
      if (lines.length) return lines;
    } catch {}

    return [];
  },

  async fromLRCLIB(track) {
    const cleanArtist = cleanMeta(track.artist);
    const cleanTitle = cleanMeta(track.title);

    // Exact match
    const exact = await lrclibExact(cleanArtist, cleanTitle, track.duration);
    if (exact?.length) return exact;

    // Search fallback
    const search = await lrclibSearch(cleanArtist, cleanTitle, track.duration);
    if (search?.length) return search;

    return [];
  },

  async translate(lines, lang = 'ru') {
    const text = lines.map(l => l.text).join('\n');
    if (!text.trim()) return lines;
    try {
      const enc = encodeURIComponent(text);
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${enc}`);
      const json = await res.json();
      const translated = json[0]?.map(x => x[0]).join('') || '';
      const tl = translated.split('\n');
      return lines.map((l, i) => ({ ...l, translation: tl[i]?.trim() || '' }));
    } catch {
      return lines;
    }
  },
};

async function lrclibExact(artist, title, duration) {
  let url = `https://lrclib.net/api/get?artist_name=${enc(artist)}&track_name=${enc(title)}`;
  if (duration) url += `&duration=${Math.round(duration)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TucusRN/1.0' } });
  if (!res.ok) return null;
  const json = await res.json();
  return parseLRCLIB(json);
}

async function lrclibSearch(artist, title, duration) {
  const url = `https://lrclib.net/api/search?q=${enc(`${artist} ${title}`)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TucusRN/1.0' } });
  if (!res.ok) return null;
  const results = await res.json();
  if (!results?.length) return null;

  const queryArtist = artist.toLowerCase().replace(/\s/g, '');
  let best = null, bestScore = -1;

  for (const item of results) {
    let score = 0;
    const itemArtist = (item.artistName || '').toLowerCase().replace(/\s/g, '');
    if (itemArtist.includes(queryArtist) || queryArtist.includes(itemArtist)) score += 100;
    if (duration && item.duration) {
      const diff = Math.abs(item.duration - duration);
      if (diff <= 3) score += 200;
      else if (diff <= 10) score += 100;
    }
    if (item.syncedLyrics) score += 30;
    if (score > bestScore) { bestScore = score; best = item; }
  }

  return parseLRCLIB(best);
}

function parseLRCLIB(json) {
  if (!json) return null;
  if (json.syncedLyrics) {
    const lines = parseLRC(json.syncedLyrics);
    if (lines.length) return lines;
  }
  if (json.plainLyrics) {
    const lines = json.plainLyrics.split('\n').filter(l => l.trim()).map(l => ({ text: l, time: null, duration: null }));
    if (lines.length) return lines;
  }
  return null;
}

function parseLRC(text) {
  const lines = [];
  const re = /\[(\d+):(\d+)[.:](\d+)\]/g;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const times = [];
    let m;
    while ((m = re.exec(line)) !== null) {
      const min = parseInt(m[1]), sec = parseInt(m[2]);
      let ms = parseInt(m[3]);
      if (m[3].length === 1) ms *= 100;
      else if (m[3].length === 2) ms *= 10;
      times.push(min * 60 + sec + ms / 1000);
    }
    re.lastIndex = 0;
    if (!times.length) continue;
    const content = line.replace(/\[\d+:\d+[.:]\d+\]/g, '').trim();
    for (const t of times) lines.push({ text: content, time: t, duration: null });
  }
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time != null) {
      lines[i].duration = (lines[i + 1]?.time ?? (lines[i].time + 5)) - lines[i].time;
    }
  }
  return lines;
}

function cleanMeta(s) {
  return s
    .replace(/\b(feat|ft|prod|with)\b.*/gi, '')
    .replace(/\s*[\(\[][^\)]*[\)\]]/g, '')
    .replace(/[^\w\s']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function enc(s) { return encodeURIComponent(s); }
