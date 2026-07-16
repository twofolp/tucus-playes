/* ============================================================
   TUCUS Music Player — Full Web Version
   Pure vanilla JS, no frameworks, hosted on GitHub Pages
   ============================================================ */

// ── Demo Tracks (REAL YouTube IDs) ──
const DEMO_TRACKS = [
  { id:'dQw4w9WgXcQ', title:'Never Gonna Give You Up', artist:'Rick Astley', source:'youtube', duration:212, thumbnail:'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg' },
  { id:'kJQP7kiw5Fk', title:'Despacito', artist:'Luis Fonsi', source:'youtube', duration:284, thumbnail:'https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg' },
  { id:'fJ9rUzIMcZQ', title:'Bohemian Rhapsody', artist:'Queen', source:'youtube', duration:354, thumbnail:'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
  { id:'RgKAFK5djSk', title:'Faded', artist:'Alan Walker', source:'youtube', duration:263, thumbnail:'https://i.ytimg.com/vi/RgKAFK5djSk/hqdefault.jpg' },
  { id:'JGwWNGJdvx8', title:'Shape of You', artist:'Ed Sheeran', source:'youtube', duration:234, thumbnail:'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg' },
  { id:'2Vv-BfVoq4g', title:'Rockstar', artist:'Post Malone', source:'youtube', duration:218, thumbnail:'https://i.ytimg.com/vi/2Vv-BfVoq4g/hqdefault.jpg' },
  { id:'6MgNbaiE6CU', title:'Mood', artist:'24kGoldn', source:'youtube', duration:140, thumbnail:'https://i.ytimg.com/vi/6MgNbaiE6CU/hqdefault.jpg' },
  { id:'dk3Hf0KQfQM', title:'Bad Guy', artist:'Billie Eilish', source:'youtube', duration:194, thumbnail:'https://i.ytimg.com/vi/dk3Hf0KQfQM/hqdefault.jpg' },
  { id:'hMx2jEOBYOE', title:'Watermelon Sugar', artist:'Harry Styles', source:'youtube', duration:174, thumbnail:'https://i.ytimg.com/vi/hMx2jEOBYOE/hqdefault.jpg' },
  { id:'T1Wr0OijV6I', title:'Levitating', artist:'Dua Lipa', source:'youtube', duration:203, thumbnail:'https://i.ytimg.com/vi/T1Wr0OijV6I/hqdefault.jpg' },
  { id:'6FkMz7K2W4M', title:'Stay', artist:'The Kid LAROI', source:'youtube', duration:141, thumbnail:'https://i.ytimg.com/vi/6FkMz7K2W4M/hqdefault.jpg' },
  { id:'Y1GRCB_3fjk', title:'Peaches', artist:'Justin Bieber', source:'youtube', duration:198, thumbnail:'https://i.ytimg.com/vi/Y1GRCB_3fjk/hqdefault.jpg' },
  { id:'s489q2Oy2bY', title:'Montero', artist:'Lil Nas X', source:'youtube', duration:137, thumbnail:'https://i.ytimg.com/vi/s489q2Oy2bY/hqdefault.jpg' },
  { id:'uXnUOg6V0kI', title:'Industry Baby', artist:'Lil Nas X', source:'youtube', duration:212, thumbnail:'https://i.ytimg.com/vi/uXnUOg6V0kI/hqdefault.jpg' },
  { id:'kXYiU_JCYtU', title:"drivers license", artist:'Olivia Rodrigo', source:'youtube', duration:242, thumbnail:'https://i.ytimg.com/vi/kXYiU_JCYtU/hqdefault.jpg' },
  { id:'m4P8gWnY7Dk', title:'good 4 u', artist:'Olivia Rodrigo', source:'youtube', duration:178, thumbnail:'https://i.ytimg.com/vi/m4P8gWnY7Dk/hqdefault.jpg' },
  { id:'nfs8NYg7yQM', title:'Heat Waves', artist:'Glass Animals', source:'youtube', duration:238, thumbnail:'https://i.ytimg.com/vi/nfs8NYg7yQM/hqdefault.jpg' },
  { id:'lOBp2G79MOQ', title:'Shivers', artist:'Ed Sheeran', source:'youtube', duration:214, thumbnail:'https://i.ytimg.com/vi/lOBp2G79MOQ/hqdefault.jpg' },
  { id:'JbrMwVc1sYk', title:'Save Your Tears', artist:'The Weeknd', source:'youtube', duration:215, thumbnail:'https://i.ytimg.com/vi/JbrMwVc1sYk/hqdefault.jpg' },
  { id:'0yS60M6dxxA', title:'Blinding Lights', artist:'The Weeknd', source:'youtube', duration:200, thumbnail:'https://i.ytimg.com/vi/0yS60M6dxxA/hqdefault.jpg' },
  { id:'QYh6mYIJG2Y', title:'Starboy', artist:'The Weeknd', source:'youtube', duration:230, thumbnail:'https://i.ytimg.com/vi/QYh6mYIJG2Y/hqdefault.jpg' },
  { id:'pRpeEdMmmQ0', title:'Uptown Funk', artist:'Bruno Mars', source:'youtube', duration:269, thumbnail:'https://i.ytimg.com/vi/pRpeEdMmmQ0/hqdefault.jpg' },
  { id:'fJ9rUzIMcZQ', title:'We Will Rock You', artist:'Queen', source:'youtube', duration:122, thumbnail:'https://i.ytimg.com/vi/fJ9rUzIMcZQ/hqdefault.jpg' },
  { id:'YQHsXMglC9A', title:'Hello', artist:'Adele', source:'youtube', duration:295, thumbnail:'https://i.ytimg.com/vi/YQHsXMglC9A/hqdefault.jpg' },
  { id:'OPf0YbXqDm0', title:'Uptown Funk', artist:'Mark Ronson', source:'youtube', duration:269, thumbnail:'https://i.ytimg.com/vi/OPf0YbXqDm0/hqdefault.jpg' },
];

// Deduplicate by id
const seen = new Set();
const ALL_TRACKS = DEMO_TRACKS.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true; });

// ── Helpers ──
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const fmt = s => { if (!s || isNaN(s)) return '0:00'; const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${sec < 10 ? '0' : ''}${sec}`; };
const escHTML = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── State ──
const S = {
  view: 'home',
  theme: localStorage.getItem('app_theme') || 'dark',
  tracks: [...ALL_TRACKS],
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: parseFloat(localStorage.getItem('tucus_volume') || '0.8'),
  isMuted: false,
  isShuffle: false,
  isRepeat: false,
  queue: [],
  queueIndex: -1,
  showQueue: false,
  showNowPlaying: false,
  likedTracks: JSON.parse(localStorage.getItem('tucus_liked') || '[]').filter(t => t && t.id && t.source),
  dislikedTracks: JSON.parse(localStorage.getItem('tucus_disliked') || '[]').filter(t => t && t.id && t.source),
  recentlyPlayed: JSON.parse(localStorage.getItem('tucus_recent') || '[]'),
  playlists: JSON.parse(localStorage.getItem('tucus_playlists') || '{}'),
  searchQuery: '',
  searchSource: 'all',
  searchResults: [],
  isLoading: false,
  activePlaylistName: null,
  npTab: 'lyrics',
  lyricsData: null,
  lyricsTranslated: null,
  lyricsLoading: false,
  lyricsTransLoading: false,
  similarTracks: [],
  eqBands: [0, 0, 0, 0, 0],
  eqEnabled: false,
};

let playTimer = null;
let ytPlayer = null;
let ytReady = false;
let audioCtx = null;
let audioSourceNode = null;
let eqFilters = [];
let lyricsCache = {};
let lyricsTransCache = {};

// ── Persistence ──
function saveLiked() { localStorage.setItem('tucus_liked', JSON.stringify(S.likedTracks)); }
function saveDisliked() { localStorage.setItem('tucus_disliked', JSON.stringify(S.dislikedTracks)); }
function saveRecentlyPlayed() { localStorage.setItem('tucus_recent', JSON.stringify(S.recentlyPlayed)); }
function savePlaylists() { localStorage.setItem('tucus_playlists', JSON.stringify(S.playlists)); }
function saveEqSettings() { localStorage.setItem('tucus_eq', JSON.stringify({ bands: S.eqBands, enabled: S.eqEnabled })); }
function loadEqSettings() {
  try {
    const d = JSON.parse(localStorage.getItem('tucus_eq') || '{}');
    if (d.bands) S.eqBands = d.bands;
    if (typeof d.enabled === 'boolean') S.eqEnabled = d.enabled;
  } catch (e) {}
}

// ── Like / Dislike ──
function isLiked(t) { return t && S.likedTracks.some(x => x.id === t.id && x.source === t.source); }
function isDisliked(t) { return t && S.dislikedTracks.some(x => x.id === t.id && x.source === t.source); }

function toggleLike(track) {
  if (!track) return;
  const was = isLiked(track);
  if (was) {
    S.likedTracks = S.likedTracks.filter(t => !(t.id === track.id && t.source === track.source));
  } else {
    S.likedTracks = [track, ...S.likedTracks].slice(0, 500);
    S.dislikedTracks = S.dislikedTracks.filter(t => !(t.id === track.id && t.source === track.source));
  }
  saveLiked(); saveDisliked();
  showToast(was ? 'Removed from liked' : `${track.title}`, was ? 'info' : 'success');
  renderCurrentView();
  updatePlayerBar();
}

function toggleDislike(track) {
  if (!track) return;
  const was = isDisliked(track);
  if (was) {
    S.dislikedTracks = S.dislikedTracks.filter(t => !(t.id === track.id && t.source === track.source));
  } else {
    S.dislikedTracks = [track, ...S.dislikedTracks].slice(0, 500);
    S.likedTracks = S.likedTracks.filter(t => !(t.id === track.id && t.source === track.source));
  }
  saveDisliked(); saveLiked();
  renderCurrentView();
  updatePlayerBar();
}

// ── Recently Played ──
function addRecentlyPlayed(track) {
  if (!track) return;
  S.recentlyPlayed = [track, ...S.recentlyPlayed.filter(t => !(t.id === track.id && t.source === track.source))].slice(0, 50);
  saveRecentlyPlayed();
}

// ── Toast ──
function showToast(msg, type = 'success') {
  const c = $('toast-container');
  if (!c) return;
  const t = document.createElement('div');
  t.className = `toast toast--${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

// ── SVG Icons ──
const ICON = {
  play: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pause: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  playSmall: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>',
  pauseSmall: '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>',
  heart: (fill) => `<svg width="14" height="14" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  thumbsDown: (fill) => `<svg width="13" height="13" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>`,
  plus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  folderPlus: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
  trash: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  search: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  x: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  chevronRight: '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>',
  listMusic: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  trendingUp: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
  clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  settings: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 19.4a1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  music: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  lyrics: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16M4 10h16M4 14h10M4 18h10"/></svg>',
  similar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
};

function sourceBadge(src) {
  const colors = { youtube: '#FF0000' };
  const labels = { youtube: 'YT' };
  return `<span class="src-badge" style="background:${colors[src] || '#666'};color:#fff;font-size:9px;padding:2px 5px;border-radius:3px">${labels[src] || src}</span>`;
}

function visualizerHTML(isPlaying) {
  return `<div class="css-visualizer ${isPlaying ? 'css-visualizer--playing' : ''}"><div class="v-bar v-bar-1"></div><div class="v-bar v-bar-2"></div><div class="v-bar v-bar-3"></div><div class="v-bar v-bar-4"></div></div>`;
}

// ── YouTube IFrame API ──
function onYouTubeIframeAPIReady() {
  ytPlayer = new YT.Player('yt-player', {
    height: '1',
    width: '1',
    playerVars: { autoplay: 0, controls: 0, disablekb: 1, fs: 0, modestbranding: 1, rel: 0 },
    events: {
      onReady: () => { ytReady = true; initAudioContext(); },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) {
          handleTrackEnded();
        }
        if (e.data === YT.PLAYING) {
          S.isPlaying = true;
          updatePlayerBar();
          renderCurrentView();
        }
        if (e.data === YT.PAUSED) {
          S.isPlaying = false;
          updatePlayerBar();
          renderCurrentView();
        }
      }
    }
  });
}

function ytLoadAndPlay(videoId) {
  if (!ytReady || !ytPlayer) return;
  try { ytPlayer.loadVideoById(videoId); } catch (e) {}
  ytPlayer.setVolume(S.isMuted ? 0 : S.volume * 100);
}

function ytTogglePlay() {
  if (!ytReady || !ytPlayer) return;
  try {
    const state = ytPlayer.getPlayerState();
    if (state === YT.PlayerState.PLAYING) ytPlayer.pauseVideo();
    else ytPlayer.playVideo();
  } catch (e) {}
}

function ytSeek(fraction) {
  if (!ytReady || !ytPlayer) return;
  const dur = ytPlayer.getDuration();
  if (dur > 0) ytPlayer.seekTo(fraction * dur, true);
}

function ytGetCurrentTime() {
  if (!ytReady || !ytPlayer) return 0;
  try { return ytPlayer.getCurrentTime() || 0; } catch (e) { return 0; }
}

function ytGetDuration() {
  if (!ytReady || !ytPlayer) return 0;
  try { return ytPlayer.getDuration() || 0; } catch (e) { return 0; }
}

function ytSetVolume(v) {
  if (!ytReady || !ytPlayer) return;
  try { ytPlayer.setVolume(Math.round(v * 100)); } catch (e) {}
}

// ── Web Audio API Equalizer ──
function initAudioContext() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const ytEl = document.querySelector('#yt-player iframe');
    if (ytEl) {
      audioSourceNode = audioCtx.createMediaElementSource(ytEl);
      const FREQS = [60, 230, 910, 4000, 14000];
      let prevNode = audioSourceNode;
      eqFilters = FREQS.map((freq, i) => {
        const filter = audioCtx.createBiquadFilter();
        filter.type = i === 0 ? 'lowshelf' : i === FREQS.length - 1 ? 'highshelf' : 'peaking';
        filter.frequency.value = freq;
        filter.gain.value = S.eqBands[i] || 0;
        filter.Q.value = 1.4;
        prevNode.connect(filter);
        prevNode = filter;
        return filter;
      });
      prevNode.connect(audioCtx.destination);
      applyEqSettings();
    }
  } catch (e) {
    console.warn('Web Audio API not available:', e);
  }
}

function applyEqSettings() {
  eqFilters.forEach((f, i) => {
    f.gain.value = S.eqEnabled ? (S.eqBands[i] || 0) : 0;
  });
}

function setEqBand(index, value) {
  S.eqBands[index] = value;
  if (eqFilters[index]) eqFilters[index].gain.value = S.eqEnabled ? value : 0;
  saveEqSettings();
}

function toggleEq() {
  S.eqEnabled = !S.eqEnabled;
  applyEqSettings();
  saveEqSettings();
}

// ── LRCLIB Lyrics ──
async function fetchLyrics(track) {
  if (!track || !track.artist || !track.title) return null;
  const cacheKey = `${track.artist}|||${track.title}`;
  if (lyricsCache[cacheKey]) return lyricsCache[cacheKey];

  try {
    const url = `https://lrclib.net/api/search?artist_name=${encodeURIComponent(track.artist)}&track_name=${encodeURIComponent(track.title)}`;
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (data && data.length > 0) {
      const best = data.find(d => d.syncedLyrics) || data[0];
      const result = {
        synced: best.syncedLyrics || null,
        plain: best.plainLyrics || null,
      };
      lyricsCache[cacheKey] = result;
      return result;
    }
  } catch (e) {
    console.warn('Lyrics fetch error:', e);
  }
  return null;
}

// ── Google Translate ──
async function translateText(text, targetLang = 'ru') {
  if (!text || text.length === 0) return '';
  const cacheKey = `${targetLang}|||${text}`;
  if (lyricsTransCache[cacheKey]) return lyricsTransCache[cacheKey];

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    const resp = await fetch(url);
    if (!resp.ok) return text;
    const data = await resp.json();
    if (data && data[0]) {
      const translated = data[0].map(s => s[0]).join('');
      lyricsTransCache[cacheKey] = translated;
      return translated;
    }
  } catch (e) {
    console.warn('Translation error:', e);
  }
  return text;
}

// ── Invidious Search ──
async function searchYouTube(query) {
  S.isLoading = true;
  renderSearchLoading();
  try {
    const url = `https://inv.nadeko.net/api/v1/search?q=${encodeURIComponent(query)}&type=video`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Search failed');
    const data = await resp.json();
    const results = (data || []).filter(v => v.type === 'video' && v.videoId).map(v => ({
      id: v.videoId,
      title: v.title || 'Unknown',
      artist: v.author || 'Unknown',
      source: 'youtube',
      duration: v.lengthSeconds || 0,
      thumbnail: `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`,
    }));
    S.searchResults = results;
  } catch (e) {
    console.warn('Invidious search error:', e);
    showToast('Search failed, try again', 'error');
    S.searchResults = [];
  }
  S.isLoading = false;
  renderSearchResults();
}

// ── Find Track ──
function findTrack(id, source) {
  return ALL_TRACKS.find(t => t.id === id && t.source === source)
    || S.searchResults.find(t => t.id === id && t.source === source)
    || S.likedTracks.find(t => t.id === id && t.source === source)
    || S.queue.find(t => t.id === id && t.source === source);
}

function findSimilarTracks(track) {
  if (!track) return [];
  return ALL_TRACKS.filter(t => t.id !== track.id && (t.artist === track.artist || t.title.toLowerCase().includes(track.artist.toLowerCase()))).slice(0, 8);
}

// ── Queue ──
function addToQueue(track) {
  if (!track) return;
  if (S.queue.some(t => t.id === track.id && t.source === track.source)) {
    showToast('Already in queue', 'info');
    return;
  }
  S.queue = [...S.queue, track];
  renderQueue();
  showToast(`Added to queue: ${track.title}`, 'info');
}

function clearQueue() {
  S.queue = [];
  S.queueIndex = -1;
  renderQueue();
}

function renderQueue() {
  const list = $('queue-list');
  const count = $('queue-count');
  if (!list || !count) return;
  count.textContent = `${S.queue.length} tracks`;
  list.innerHTML = S.queue.map((t, i) => `
    <div class="queue-item ${i === S.queueIndex ? 'queue-item--active' : ''}" data-qi="${i}">
      <img class="queue-item__art" src="${t.thumbnail}" alt="" loading="lazy" onerror="this.style.opacity=0.3">
      <div class="queue-item__info">
        <div class="queue-item__title">${escHTML(t.title)}</div>
        <div class="queue-item__artist">${escHTML(t.artist)}</div>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.queue-item').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset.qi);
      playTrack(S.queue[idx], idx);
    });
  });
}

// ── Playlist Management ──
function createPlaylist(name) {
  if (!name.trim()) return;
  if (S.playlists[name.trim()]) {
    showToast('Playlist already exists', 'info');
    return;
  }
  S.playlists[name.trim()] = [];
  savePlaylists();
  $('new-playlist-input').value = '';
  renderSidebarPlaylists();
  showToast(`Playlist "${name.trim()}" created`);
}

function deletePlaylist(name) {
  if (!confirm(`Delete "${name}"?`)) return;
  delete S.playlists[name];
  savePlaylists();
  if (S.activePlaylistName === name) { S.view = 'home'; renderCurrentView(); }
  renderSidebarPlaylists();
  showToast(`Playlist "${name}" deleted`, 'info');
}

function addToPlaylist(pn, track) {
  const list = S.playlists[pn] || [];
  if (list.some(t => t.id === track.id && t.source === track.source)) {
    showToast(`Already in "${pn}"`, 'info');
    return;
  }
  S.playlists[pn] = [...list, track];
  savePlaylists();
  showToast(`Added to "${pn}"`);
}

function removeFromPlaylist(pn, tid, src) {
  S.playlists[pn] = (S.playlists[pn] || []).filter(t => !(t.id === tid && t.source === src));
  savePlaylists();
  renderCurrentView();
}

// ── Sidebar ──
function renderSidebarPlaylists() {
  const el = $('playlist-list');
  if (!el) return;
  el.innerHTML = Object.keys(S.playlists).map(name => `
    <button class="nav__item ${S.view === 'playlist' && S.activePlaylistName === name ? 'nav__item--active' : ''}" data-playlist="${name}">
      ${ICON.listMusic}
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(name)}</span>
      <span class="nav__item-delete" data-del-playlist="${name}">${ICON.trash}</span>
    </button>
  `).join('');
  el.querySelectorAll('[data-playlist]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      if (e.target.closest('.nav__item-delete')) {
        e.stopPropagation();
        deletePlaylist(btn.dataset.playlist);
        return;
      }
      S.view = 'playlist';
      S.activePlaylistName = btn.dataset.playlist;
      updateNavActive();
      renderCurrentView();
    });
  });
}

function updateNavActive() {
  $$('.sidebar .nav__item[data-view]').forEach(btn => {
    btn.classList.toggle('nav__item--active', btn.dataset.view === S.view && !S.activePlaylistName);
  });
}

function updateLikedCount() {
  const el = $('liked-count');
  if (!el) return;
  if (S.likedTracks.length > 0) {
    el.style.display = '';
    el.textContent = S.likedTracks.length;
  } else {
    el.style.display = 'none';
  }
}

// ── Theme ──
function setTheme(t) {
  S.theme = t;
  document.body.className = `theme-${t}`;
  localStorage.setItem('app_theme', t);
}

// ── Track Row HTML ──
function trackRowHTML(t, idx, options = {}) {
  const active = S.currentTrack && t.id === S.currentTrack.id && t.source === S.currentTrack.source;
  const liked = isLiked(t);
  const disliked = isDisliked(t);
  const showRemove = options.showRemove || false;
  const larger = options.larger || false;

  return `
    <div class="track-row ${active ? 'track-row--active' : ''}" data-track-id="${t.id}" data-track-source="${t.source}" ${larger ? 'style="gap:18px;padding:12px 16px;min-height:72px"' : ''}>
      <div class="track-row__index" data-play-toggle="${t.id}-${t.source}">
        ${active ? (S.isPlaying ? visualizerHTML(true) : ICON.pauseSmall) : `<span class="track-row__num">${idx + 1}</span>`}
      </div>
      <img class="track-row__art" src="${t.thumbnail}" alt="" loading="lazy" style="${larger ? 'width:56px;height:56px;border-radius:10px' : ''}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2244%22 height=%2244%22%3E%3Crect fill=%22%231a1a2e%22 width=%2244%22 height=%2244%22 rx=%228%22/%3E%3C/svg%3E'">
      <div class="track-row__info">
        <div class="track-row__title" style="${larger ? 'font-size:15px' : ''}">
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHTML(t.title)}</span>
          <span class="track-source-badge track-source-badge--${t.source}">${sourceBadge(t.source)}</span>
        </div>
        <div class="track-row__artist">${escHTML(t.artist)}</div>
      </div>
      <div class="track-row__actions">
        <button class="icon-btn ${liked ? 'icon-btn--liked' : ''}" data-like="${t.id}-${t.source}" title="Like">${ICON.heart(liked)}</button>
        <button class="icon-btn ${disliked ? 'icon-btn--disliked' : ''}" data-dislike="${t.id}-${t.source}" title="Dislike">${ICON.thumbsDown(disliked)}</button>
        <button class="icon-btn" data-add-queue="${t.id}-${t.source}" title="Add to queue">${ICON.plus}</button>
        <div style="position:relative">
          <button class="icon-btn" data-add-playlist-trigger="${t.id}-${t.source}" title="Add to playlist">${ICON.folderPlus}</button>
        </div>
        ${showRemove ? `<button class="icon-btn icon-btn--danger" data-remove-from-playlist="${t.id}-${t.source}" title="Remove">${ICON.trash}</button>` : ''}
      </div>
      <span class="track-row__duration">${fmt(t.duration)}</span>
    </div>
  `;
}

// ── Track Card HTML ──
function trackCardHTML(t) {
  return `
    <div class="track-card" data-track-id="${t.id}" data-track-source="${t.source}">
      <div style="position:relative;border-radius:12px;overflow:hidden;aspect-ratio:1/1">
        <img src="${t.thumbnail}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%231a1a2e%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%23555%22 font-size=%2214%22%3E%E2%99%AA%3C/text%3E%3C/svg%3E'">
        <span style="position:absolute;bottom:8px;right:8px;display:inline-flex;align-items:center;justify-content:center;background:#FF0000;color:#fff;padding:4px;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4)" title="YouTube">
          <svg width="8" height="8" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </span>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);opacity:0;transition:opacity 0.2s" class="play-overlay">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div style="font-size:13.5px;font-weight:700;margin-top:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)">${escHTML(t.title)}</div>
      <div style="font-size:11.5px;opacity:0.5;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-primary)">${escHTML(t.artist)}</div>
    </div>
  `;
}

// ── Event Delegation for Track Rows ──
function attachTrackRowEvents(container) {
  if (!container) return;
  container.querySelectorAll('.track-row').forEach(row => {
    const tid = row.dataset.trackId;
    const tsrc = row.dataset.trackSource;
    const track = findTrack(tid, tsrc);
    if (!track) return;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn') || e.target.closest('.playlist-dropdown') || e.target.closest('[data-add-playlist-trigger]')) return;
      playTrack(track);
    });

    const likeBtn = row.querySelector(`[data-like="${tid}-${tsrc}"]`);
    if (likeBtn) likeBtn.addEventListener('click', e => { e.stopPropagation(); toggleLike(track); });

    const disBtn = row.querySelector(`[data-dislike="${tid}-${tsrc}"]`);
    if (disBtn) disBtn.addEventListener('click', e => { e.stopPropagation(); toggleDislike(track); });

    const qBtn = row.querySelector(`[data-add-queue="${tid}-${tsrc}"]`);
    if (qBtn) qBtn.addEventListener('click', e => { e.stopPropagation(); addToQueue(track); });

    const plBtn = row.querySelector(`[data-add-playlist-trigger="${tid}-${tsrc}"]`);
    if (plBtn) {
      plBtn.addEventListener('click', e => {
        e.stopPropagation();
        const existing = row.querySelector('.playlist-dropdown');
        if (existing) { existing.remove(); return; }
        document.querySelectorAll('.playlist-dropdown').forEach(d => d.remove());
        const dd = document.createElement('div');
        dd.className = 'playlist-dropdown';
        dd.innerHTML = `
          <div class="playlist-dropdown__label">Add to playlist</div>
          ${Object.keys(S.playlists).length === 0 ? '<div class="playlist-dropdown__empty">No playlists</div>' :
            Object.keys(S.playlists).map(pn => `<button class="playlist-dropdown__item" data-pl-name="${escHTML(pn)}">${escHTML(pn)}</button>`).join('')}
        `;
        plBtn.parentElement.appendChild(dd);
        dd.querySelectorAll('[data-pl-name]').forEach(btn => {
          btn.addEventListener('click', ev => {
            ev.stopPropagation();
            addToPlaylist(btn.dataset.plName, track);
            dd.remove();
          });
        });
      });
    }

    const rmBtn = row.querySelector(`[data-remove-from-playlist="${tid}-${tsrc}"]`);
    if (rmBtn) rmBtn.addEventListener('click', e => { e.stopPropagation(); removeFromPlaylist(S.activePlaylistName, tid, tsrc); });
  });
}

function attachCardEvents(container) {
  if (!container) return;
  container.querySelectorAll('.track-card').forEach(card => {
    const tid = card.dataset.trackId;
    const tsrc = card.dataset.trackSource;
    const track = findTrack(tid, tsrc);
    if (!track) return;

    card.addEventListener('mouseenter', () => { const ov = card.querySelector('.play-overlay'); if (ov) ov.style.opacity = '1'; });
    card.addEventListener('mouseleave', () => { const ov = card.querySelector('.play-overlay'); if (ov) ov.style.opacity = '0'; });
    card.addEventListener('click', () => playTrack(track));
  });
}

function horizontalSectionHTML(title, icon, tracks) {
  if (!tracks || tracks.length === 0) return '';
  return `
    <div class="home-section">
      <div class="home-section__header">${icon} ${title}</div>
      <div class="horizontal-scroll-row">${tracks.map(t => trackCardHTML(t)).join('')}</div>
    </div>
  `;
}

// ── Aurora Canvas ──
let auroraRAF = null;
function drawAurora(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width = canvas.clientWidth;
  const h = canvas.height = canvas.clientHeight;
  const t = Date.now() / 2000;

  ctx.fillStyle = 'rgba(5,5,8,1)';
  ctx.fillRect(0, 0, w, h);

  const g1 = ctx.createRadialGradient(w * 0.3, h * 0.5, 0, w * 0.3, h * 0.5, w * 0.6);
  g1.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
  g1.addColorStop(1, 'transparent');
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, w, h);

  const g2 = ctx.createRadialGradient(w * 0.7, h * 0.5, 0, w * 0.7, h * 0.5, w * 0.5);
  g2.addColorStop(0, 'rgba(236, 72, 153, 0.35)');
  g2.addColorStop(1, 'transparent');
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, w, h);

  const g3 = ctx.createRadialGradient(w * 0.5 + Math.sin(t) * w * 0.2, h * 0.4, 0, w * 0.5, h * 0.5, w * 0.4);
  g3.addColorStop(0, 'rgba(6, 182, 212, 0.25)');
  g3.addColorStop(1, 'transparent');
  ctx.fillStyle = g3;
  ctx.fillRect(0, 0, w, h);

  auroraRAF = requestAnimationFrame(() => drawAurora(canvas));
}

// ══════════════════════════════════════════════
// VIEW RENDERERS
// ══════════════════════════════════════════════

function renderCurrentView() {
  const mc = $('main-content');
  if (!mc) return;
  updateNavActive();
  updateLikedCount();

  switch (S.view) {
    case 'home': renderHome(mc); break;
    case 'search': renderSearch(mc); break;
    case 'liked': renderLiked(mc); break;
    case 'settings': renderSettings(mc); break;
    case 'playlist': renderPlaylist(mc); break;
    default: renderHome(mc);
  }
}

// ── HOME ──
function renderHome(mc) {
  const popularTracks = ALL_TRACKS.slice(0, 8);
  const recentTracks = S.recentlyPlayed.slice(0, 8);
  const recentHistory = S.recentlyPlayed.slice(0, 6);

  mc.innerHTML = `
    <div class="home-page">
      <div class="dotify-wave-banner" id="wave-banner">
        <div class="dotify-wave-banner__bg">
          <canvas id="aurora-canvas" style="width:100%;height:100%"></canvas>
        </div>
        <div class="wave-banner-content">
          <div style="display:flex;align-items:center">
            <button class="wave-play-btn" id="wave-play-btn">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff" stroke="none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            </button>
            <span class="wave-title">My Wave</span>
          </div>
        </div>
      </div>

      <div class="home-view">
        <div class="dotify-split-row">
          <div class="dotify-history-card" id="history-card" style="cursor:pointer">
            <div class="card-covers-collage">
              ${(recentHistory.length > 0 ? recentHistory : ALL_TRACKS.slice(0, 3)).slice(0, 3).map((t, i) => `
                <img src="${t.thumbnail}" alt="" style="position:absolute;width:48px;height:48px;border-radius:8px;border:1.5px solid #111115;box-shadow:0 4px 10px rgba(0,0,0,0.5);left:${i * 8}px;top:${i * 8}px;z-index:${10 - i}" onerror="this.style.display='none'">
              `).join('')}
            </div>
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text-primary)">History</div>
              <div style="font-size:11.5px;color:var(--text-secondary);margin-top:3px">Your recently played tracks</div>
            </div>
          </div>
          <div class="dotify-favorites-card" id="liked-card" style="cursor:pointer">
            <div class="card-covers-collage">
              ${(S.likedTracks.length > 0 ? S.likedTracks : ALL_TRACKS.slice(3, 6)).slice(0, 3).map((t, i) => `
                <img src="${t.thumbnail}" alt="" style="position:absolute;width:48px;height:48px;border-radius:8px;border:1.5px solid #111115;box-shadow:0 4px 10px rgba(0,0,0,0.5);left:${i * 8}px;top:${i * 8}px;z-index:${10 - i}" onerror="this.style.display='none'">
              `).join('')}
            </div>
            <div>
              <div style="font-size:14px;font-weight:800;color:var(--text-primary)">Liked tracks</div>
              <div style="font-size:11.5px;color:var(--text-secondary);margin-top:3px">Your favorite music collection</div>
            </div>
          </div>
        </div>

        ${horizontalSectionHTML('Popular', ICON.trendingUp, popularTracks)}
        ${horizontalSectionHTML('Recently played', ICON.clock, recentTracks.length > 0 ? recentTracks : ALL_TRACKS.slice(4, 10))}
      </div>
    </div>
  `;

  if (auroraRAF) cancelAnimationFrame(auroraRAF);
  const canvas = $('aurora-canvas');
  if (canvas) drawAurora(canvas);

  $('wave-banner').addEventListener('click', () => {
    const shuffled = [...ALL_TRACKS].sort(() => Math.random() - 0.5);
    S.queue = shuffled;
    playTrack(S.queue[0], 0);
  });

  $('history-card').addEventListener('click', () => {
    if (S.recentlyPlayed.length > 0) playTrack(S.recentlyPlayed[0]);
    else playTrack(ALL_TRACKS[0]);
  });

  $('liked-card').addEventListener('click', () => {
    S.view = 'liked';
    renderCurrentView();
  });

  $$('.home-view .horizontal-scroll-row').forEach(el => attachCardEvents(el));
}

// ── SEARCH ──
function renderSearch(mc) {
  mc.innerHTML = `
    <form class="search-bar" id="search-form">
      <div class="search-bar__input-wrap">
        <span class="search-bar__icon">${ICON.search}</span>
        <input class="search-bar__input" type="text" placeholder="Search tracks, artists..." value="${escHTML(S.searchQuery)}" id="search-input" autocomplete="off">
        ${S.searchQuery ? `<button type="button" class="search-bar__clear" id="search-clear">${ICON.x}</button>` : ''}
      </div>
      <button type="submit" class="search-bar__btn">${S.isLoading ? '<div style="width:18px;height:18px;border:2px solid rgba(0,0,0,0.2);border-top-color:#000;border-radius:50%;animation:spin 0.6s linear infinite"></div>' : ICON.chevronRight}</button>
    </form>
    <div style="display:flex;flex-direction:column;gap:8px">
      <div class="source-tabs">
        <button class="source-tab ${S.searchSource === 'all' ? 'source-tab--active' : ''}" data-source="all">All</button>
        <button class="source-tab ${S.searchSource === 'youtube' ? 'source-tab--active' : ''}" data-source="youtube">YouTube</button>
      </div>
    </div>
    <div class="search-results-view" id="search-results"></div>
  `;

  $('search-form').addEventListener('submit', e => { e.preventDefault(); doSearch(); });
  $('search-input').addEventListener('input', e => { S.searchQuery = e.target.value; });

  const clearBtn = $('search-clear');
  if (clearBtn) clearBtn.addEventListener('click', () => { S.searchQuery = ''; $('search-input').value = ''; $('search-input').focus(); renderSearch(mc); });

  $$('.source-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      S.searchSource = btn.dataset.source;
      renderSearch(mc);
      if (S.searchQuery.trim()) doSearch();
    });
  });

  if (S.searchResults.length > 0) renderSearchResults();
  else renderSearchEmpty();
}

function renderSearchEmpty() {
  const el = $('search-results');
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div style="opacity:0.15;margin-bottom:16px">${ICON.search}</div>
      <div class="empty-state__title">Search for music</div>
      <div class="empty-state__sub">Type a track name or artist to search YouTube</div>
    </div>
  `;
}

function renderSearchLoading() {
  const el = $('search-results');
  if (!el) return;
  el.innerHTML = `
    <div class="empty-state">
      <div style="width:32px;height:32px;border:3px solid var(--border-subtle);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:16px"></div>
      <div class="empty-state__title">Searching...</div>
    </div>
  `;
}

function doSearch() {
  if (!S.searchQuery.trim()) return;
  searchYouTube(S.searchQuery.trim());
}

function renderSearchResults() {
  const el = $('search-results');
  if (!el) return;
  if (S.searchResults.length === 0) {
    renderSearchEmpty();
    return;
  }

  // Also search local demo tracks
  const q = S.searchQuery.toLowerCase();
  const localResults = ALL_TRACKS.filter(t => {
    const matchText = t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q);
    const matchSource = S.searchSource === 'all' || t.source === S.searchSource;
    return matchText && matchSource;
  });

  // Merge: local first, then YouTube API results (deduped)
  const seenIds = new Set(localResults.map(t => `${t.id}-${t.source}`));
  const ytResults = S.searchResults.filter(t => !seenIds.has(`${t.id}-${t.source}`));
  const allResults = [...localResults, ...ytResults];

  el.innerHTML = `
    <div class="track-list">
      ${allResults.map((t, i) => trackRowHTML(t, i, { larger: true })).join('')}
    </div>
  `;
  attachTrackRowEvents(el);
}

// ── LIKED ──
function renderLiked(mc) {
  mc.innerHTML = `
    <div class="view-header">
      <div class="view-header__icon" style="background:rgba(255,255,255,0.08)">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
      </div>
      <div>
        <div class="view-header__title">Liked tracks</div>
        <div class="view-header__sub">${S.likedTracks.length} tracks</div>
      </div>
      <div class="view-header__btns">
        ${S.likedTracks.length > 0 ? `<button class="play-all-btn" id="play-liked-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play All</button>` : ''}
      </div>
    </div>
    <div class="track-list" id="liked-list">
      ${S.likedTracks.length > 0 ? S.likedTracks.map((t, i) => trackRowHTML(t, i)).join('') :
        `<div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.15;margin-bottom:16px"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <div class="empty-state__title">No liked tracks yet</div>
          <div class="empty-state__sub">Tap the heart icon on any track to add it here</div>
        </div>`}
    </div>
  `;
  attachTrackRowEvents($('liked-list'));

  const playAllBtn = $('play-liked-all');
  if (playAllBtn) {
    playAllBtn.addEventListener('click', () => {
      if (S.likedTracks.length > 0) {
        S.queue = [...S.likedTracks];
        playTrack(S.queue[0], 0);
      }
    });
  }
}

// ── SETTINGS ──
function renderSettings(mc) {
  const EQ_LABELS = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz'];
  mc.innerHTML = `
    <div class="settings-view">
      <div style="display:flex;align-items:center;gap:12px;padding-bottom:6px">
        <div style="width:44px;height:44px;border-radius:var(--radius-md);background:var(--bg-card);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center">${ICON.settings}</div>
        <h2 style="font-size:22px;font-weight:800;letter-spacing:-0.4px">Settings</h2>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">Theme</div>
        <div class="theme-grid">
          <div class="theme-card ${S.theme === 'dark' ? 'theme-card--active' : ''}" data-theme="dark">
            <div class="theme-card__preview theme-card__preview--liquid"></div>
            <div class="theme-card__name">Dark</div>
          </div>
          <div class="theme-card ${S.theme === 'light' ? 'theme-card--active' : ''}" data-theme="light">
            <div class="theme-card__preview" style="background:linear-gradient(135deg,#f3f4f8 0%,#e8e8ec 100%);border:1px solid rgba(0,0,0,0.05)"></div>
            <div class="theme-card__name">Light</div>
          </div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">
          <span>Equalizer</span>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <span style="font-size:11px;font-weight:500;color:var(--text-secondary)">${S.eqEnabled ? 'ON' : 'OFF'}</span>
            <input type="checkbox" class="settings-checkbox" id="eq-toggle" ${S.eqEnabled ? 'checked' : ''}>
          </label>
        </div>
        <div id="eq-sliders" style="display:flex;flex-direction:column;gap:12px;${S.eqEnabled ? '' : 'opacity:0.4;pointer-events:none'}">
          ${EQ_LABELS.map((label, i) => `
            <div style="display:flex;align-items:center;gap:12px">
              <span style="font-size:11px;font-weight:600;color:var(--text-secondary);min-width:40px;text-align:right">${label}</span>
              <input type="range" min="-12" max="12" step="1" value="${S.eqBands[i]}" data-eq-band="${i}" style="flex:1;-webkit-appearance:none;height:4px;background:var(--border-subtle);border-radius:2px;outline:none;cursor:pointer">
              <span style="font-size:11px;color:var(--text-muted);min-width:30px">${S.eqBands[i] > 0 ? '+' : ''}${S.eqBands[i]}dB</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">Shortcuts</div>
        <div class="shortcuts-grid">
          <div class="shortcut"><kbd>Space</kbd><span>Play / Pause</span></div>
          <div class="shortcut"><kbd>&rarr;</kbd><span>Next track</span></div>
          <div class="shortcut"><kbd>&larr;</kbd><span>Previous track</span></div>
          <div class="shortcut"><kbd>M</kbd><span>Mute / Unmute</span></div>
          <div class="shortcut"><kbd>L</kbd><span>Like current</span></div>
          <div class="shortcut"><kbd>Esc</kbd><span>Close modal</span></div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-card__title">About</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6">
          <p><strong>TUCUS Music Player</strong> &mdash; Web Edition</p>
          <p style="margin-top:6px">Playback powered by YouTube IFrame API. Search via Invidious API. Lyrics from LRCLIB. Equalizer via Web Audio API.</p>
          <p style="margin-top:6px">All data (liked tracks, playlists, settings) is stored in your browser's localStorage.</p>
          <p style="margin-top:6px;opacity:0.5;font-size:11px">v2.0.0 &bull; Built with pure vanilla JS, no frameworks</p>
        </div>
      </div>
    </div>
  `;

  // Theme cards
  $$('[data-theme]').forEach(card => {
    card.addEventListener('click', () => {
      setTheme(card.dataset.theme);
      renderSettings(mc);
    });
  });

  // EQ toggle
  const eqToggle = $('eq-toggle');
  if (eqToggle) {
    eqToggle.addEventListener('change', () => {
      S.eqEnabled = eqToggle.checked;
      applyEqSettings();
      saveEqSettings();
      renderSettings(mc);
    });
  }

  // EQ sliders
  $$('[data-eq-band]').forEach(slider => {
    slider.addEventListener('input', (e) => {
      const bandIdx = parseInt(e.target.dataset.eqBand);
      setEqBand(bandIdx, parseInt(e.target.value));
      const valSpan = e.target.parentElement.querySelector('span:last-child');
      if (valSpan) {
        const v = parseInt(e.target.value);
        valSpan.textContent = `${v > 0 ? '+' : ''}${v}dB`;
      }
    });
  });
}

// ── PLAYLIST VIEW ──
function renderPlaylist(mc) {
  const name = S.activePlaylistName;
  if (!name || !S.playlists[name]) { S.view = 'home'; renderCurrentView(); return; }
  const tracks = S.playlists[name] || [];
  mc.innerHTML = `
    <div class="view-header">
      <div class="view-header__icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
      </div>
      <div>
        <div class="view-header__title">${escHTML(name)}</div>
        <div class="view-header__sub">${tracks.length} tracks</div>
      </div>
      <div class="view-header__btns">
        ${tracks.length > 0 ? `<button class="play-all-btn" id="play-playlist-all"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg> Play All</button>` : ''}
      </div>
    </div>
    <div class="track-list" id="playlist-track-list">
      ${tracks.length > 0 ? tracks.map((t, i) => trackRowHTML(t, i, { showRemove: true })).join('') :
        `<div class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:0.15;margin-bottom:16px"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          <div class="empty-state__title">Empty playlist</div>
          <div class="empty-state__sub">Add tracks using the + button on any track</div>
        </div>`}
    </div>
  `;
  attachTrackRowEvents($('playlist-track-list'));

  const playAllBtn = $('play-playlist-all');
  if (playAllBtn) {
    playAllBtn.addEventListener('click', () => {
      S.queue = [...tracks];
      playTrack(S.queue[0], 0);
    });
  }
}

// ══════════════════════════════════════════════
// PLAYER
// ══════════════════════════════════════════════

function playTrack(track, indexInQueue = -1) {
  if (!track || !track.id) return;

  addRecentlyPlayed(track);

  let nq = [...S.queue];
  let ni = indexInQueue;
  if (indexInQueue === -1) {
    const ei = nq.findIndex(t => t.id === track.id && t.source === track.source);
    if (ei !== -1) ni = ei;
    else { nq.push(track); ni = nq.length - 1; }
  }
  S.queue = nq;
  S.queueIndex = ni;
  S.currentTrack = track;
  S.currentTime = 0;
  S.duration = track.duration || 0;
  S.lyricsData = null;
  S.lyricsTranslated = null;

  ytLoadAndPlay(track.id);

  startProgressTimer();
  updatePlayerBar();
  renderCurrentView();
  renderQueue();
  updateAmbientBg();

  // Pre-fetch lyrics
  fetchLyrics(track).then(data => {
    S.lyricsData = data;
    if (S.showNowPlaying && S.npTab === 'lyrics') updateNpLyricsTab();
  });

  // Load similar tracks
  S.similarTracks = findSimilarTracks(track);
}

function togglePlay() {
  if (!S.currentTrack) return;
  ytTogglePlay();
}

function startProgressTimer() {
  stopProgressTimer();
  playTimer = setInterval(() => {
    if (S.currentTrack) {
      const realTime = ytGetCurrentTime();
      const realDur = ytGetDuration();
      if (realDur > 0) S.duration = realDur;
      if (realTime > 0) S.currentTime = realTime;
      updateProgress();
    }
  }, 250);
}

function stopProgressTimer() {
  if (playTimer) { clearInterval(playTimer); playTimer = null; }
}

function handleTrackEnded() {
  if (S.isRepeat) {
    playTrack(S.currentTrack, S.queueIndex);
    return;
  }
  handleNext();
}

function handleNext() {
  if (!S.queue.length) return;
  let ni = S.queueIndex + 1;
  if (S.isShuffle && S.queue.length > 1) {
    ni = Math.floor(Math.random() * S.queue.length);
  } else if (ni >= S.queue.length) {
    ni = 0;
  }
  if (S.queue[ni]) playTrack(S.queue[ni], ni);
}

function handlePrev() {
  if (!S.queue.length || S.queueIndex === -1) return;
  if (S.currentTime > 3) {
    ytSeek(0);
    S.currentTime = 0;
    updateProgress();
    return;
  }
  let pi = S.queueIndex - 1;
  if (pi < 0) pi = S.isRepeat ? S.queue.length - 1 : 0;
  if (S.queue[pi]) playTrack(S.queue[pi], pi);
}

function handleSeek(e) {
  if (!S.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  S.currentTime = fraction * S.duration;
  ytSeek(fraction);
  updateProgress();
}

function handleSeekMobile(e) {
  if (!S.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const fraction = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  S.currentTime = fraction * S.duration;
  ytSeek(fraction);
  updateProgress();
}

function updateProgress() {
  const pct = S.duration > 0 ? (S.currentTime / S.duration) * 100 : 0;

  // Player bar
  const fill = $('progress-fill');
  const thumb = $('progress-thumb');
  if (fill) fill.style.width = `${pct}%`;
  if (thumb) thumb.style.left = `${pct}%`;
  if ($('time-cur')) $('time-cur').textContent = fmt(S.currentTime);
  if ($('time-dur')) $('time-dur').textContent = fmt(S.duration);

  // Now Playing modal
  const npFill = $('np-progress-fill');
  const npThumb = $('np-progress-thumb');
  if (npFill) npFill.style.width = `${pct}%`;
  if (npThumb) npThumb.style.left = `${pct}%`;
  if ($('np-time-cur')) $('np-time-cur').textContent = fmt(S.currentTime);
  if ($('np-time-dur')) $('np-time-dur').textContent = fmt(S.duration);

  // Mobile
  const mFill = $('m-progress-fill');
  if (mFill) mFill.style.width = `${pct}%`;
  if ($('m-time-cur')) $('m-time-cur').textContent = fmt(S.currentTime);
  if ($('m-time-dur')) $('m-time-dur').textContent = fmt(S.duration);
}

function updatePlayerBar() {
  const t = S.currentTrack;
  if (t) {
    if ($('player-art')) $('player-art').src = t.thumbnail;
    if ($('player-title')) $('player-title').textContent = t.title;
    if ($('player-artist')) $('player-artist').textContent = t.artist;
    const likeBtn = $('player-like-btn');
    if (likeBtn) {
      likeBtn.innerHTML = ICON.heart(isLiked(t));
      likeBtn.className = `icon-btn player-bar__like ${isLiked(t) ? 'icon-btn--liked' : ''}`;
    }
  }

  // Play/Pause icons - player bar
  const playIcon = $('play-icon');
  if (playIcon) {
    playIcon.outerHTML = `<svg id="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">${S.isPlaying ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg>`;
  }

  // Now Playing modal
  if (t) {
    const npBg = $('np-bg');
    const npArt = $('np-art');
    if (npBg) npBg.style.backgroundImage = `url(${t.thumbnail})`;
    if (npArt) npArt.src = t.thumbnail;
    if ($('np-title')) $('np-title').textContent = t.title;
    if ($('np-artist')) $('np-artist').textContent = t.artist;
    if ($('np-badge-wrap')) $('np-badge-wrap').innerHTML = sourceBadge(t.source);

    const npArtWrap = $('np-art-wrap');
    if (npArtWrap) {
      if (S.isPlaying) npArtWrap.classList.add('np-modal__art-wrap--playing');
      else npArtWrap.classList.remove('np-modal__art-wrap--playing');
    }

    const npPlayIcon = $('np-play-icon');
    if (npPlayIcon) {
      npPlayIcon.innerHTML = S.isPlaying ?
        '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' :
        '<polygon points="5 3 19 12 5 21 5 3"/>';
    }

    const npLike = $('np-like-btn');
    if (npLike) {
      npLike.className = `np-react-btn ${isLiked(t) ? 'np-react-btn--liked' : ''}`;
      const svg = npLike.querySelector('svg');
      if (svg) svg.outerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="${isLiked(t) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
      const span = npLike.querySelector('span');
      if (span) span.textContent = isLiked(t) ? 'Liked' : 'Like';
    }

    const npDislike = $('np-dislike-btn');
    if (npDislike) {
      npDislike.className = `np-react-btn ${isDisliked(t) ? 'np-react-btn--disliked' : ''}`;
    }
  }

  // Shuffle/Repeat active states
  if ($('shuffle-btn')) $('shuffle-btn').className = `ctrl-btn ctrl-btn--sm ${S.isShuffle ? 'ctrl-btn--active' : ''}`;
  if ($('repeat-btn')) $('repeat-btn').className = `ctrl-btn ctrl-btn--sm ${S.isRepeat ? 'ctrl-btn--active' : ''}`;
  if ($('np-shuffle')) $('np-shuffle').className = `np-ctrl ${S.isShuffle ? 'np-ctrl--active' : ''}`;
  if ($('np-repeat')) $('np-repeat').className = `np-ctrl ${S.isRepeat ? 'np-ctrl--active' : ''}`;

  // Volume
  if ($('volume-slider')) $('volume-slider').value = S.isMuted ? 0 : S.volume;
  if ($('np-volume')) $('np-volume').value = S.isMuted ? 0 : S.volume;

  updateProgress();
  updateMobilePlayer();
}

function updateAmbientBg() {
  const bg = $('ambient-bg');
  if (!bg) return;
  if (S.currentTrack) {
    bg.style.backgroundImage = `url(${S.currentTrack.thumbnail})`;
  } else {
    bg.style.backgroundImage = 'none';
  }
}

// ── Now Playing Modal ──
function openNowPlaying() {
  if (!S.currentTrack) return;
  S.showNowPlaying = true;
  const modal = $('np-modal');
  if (modal) modal.style.display = '';
  updatePlayerBar();
  renderNpTabs();
}

function closeNowPlaying() {
  S.showNowPlaying = false;
  const modal = $('np-modal');
  if (modal) modal.style.display = 'none';
}

function renderNpTabs() {
  // We inject tabs below the badge wrap inside np-modal__left
  const badgeWrap = $('np-badge-wrap');
  if (!badgeWrap) return;

  // Remove existing tabs if any
  const existingTabs = badgeWrap.parentElement.querySelector('.np-tabs');
  if (existingTabs) existingTabs.remove();

  const tabsHTML = `
    <div class="np-tabs" style="display:flex;gap:6px;margin-top:4px">
      <button class="source-tab ${S.npTab === 'lyrics' ? 'source-tab--active' : ''}" data-np-tab="lyrics" style="font-size:11px;padding:4px 12px">${ICON.lyrics} Lyrics</button>
      <button class="source-tab ${S.npTab === 'similar' ? 'source-tab--active' : ''}" data-np-tab="similar" style="font-size:11px;padding:4px 12px">${ICON.similar} Similar</button>
    </div>
    <div class="np-tab-content" id="np-tab-content" style="margin-top:12px;max-height:200px;overflow-y:auto;text-align:left;width:100%;border-top:1px solid rgba(255,255,255,0.06);padding-top:12px"></div>
  `;
  badgeWrap.insertAdjacentHTML('afterend', tabsHTML);

  $$('[data-np-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.npTab = btn.dataset.npTab;
      $$('.np-tabs .source-tab').forEach(b => b.classList.remove('source-tab--active'));
      btn.classList.add('source-tab--active');
      updateNpTabContent();
    });
  });

  updateNpTabContent();
}

function updateNpTabContent() {
  if (S.npTab === 'lyrics') updateNpLyricsTab();
  else if (S.npTab === 'similar') updateNpSimilarTab();
}

function updateNpLyricsTab() {
  const el = $('np-tab-content');
  if (!el) return;

  if (!S.lyricsData && !S.lyricsLoading) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">No lyrics available</div>`;
    // Try fetching
    if (S.currentTrack) {
      S.lyricsLoading = true;
      fetchLyrics(S.currentTrack).then(data => {
        S.lyricsData = data;
        S.lyricsLoading = false;
        updateNpLyricsTab();
      });
    }
    return;
  }

  if (S.lyricsLoading) {
    el.innerHTML = `<div style="text-align:center;padding:20px"><div style="width:20px;height:20px;border:2px solid var(--border-subtle);border-top-color:var(--accent);border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto"></div><div style="color:var(--text-muted);font-size:11px;margin-top:8px">Loading lyrics...</div></div>`;
    return;
  }

  const lyricsText = S.lyricsTranslated || S.lyricsData?.synced || S.lyricsData?.plain;
  if (!lyricsText) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">No lyrics found for this track</div>`;
    return;
  }

  const lines = lyricsText.split('\n').filter(l => l.trim());
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.5px">${S.lyricsTranslated ? 'Translation (RU)' : 'Lyrics'}</span>
      ${!S.lyricsTranslated ? `<button id="np-translate-btn" style="font-size:10px;font-weight:600;color:var(--accent);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px">Translate to RU</button>` : `<button id="np-translate-btn" style="font-size:10px;font-weight:600;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:2px 6px;border-radius:4px">Show original</button>`}
    </div>
    <div style="font-size:13px;line-height:1.8;color:var(--text-secondary);white-space:pre-wrap;word-break:break-word">${lines.map(l => `<div>${escHTML(l)}</div>`).join('')}</div>
  `;

  const transBtn = $('np-translate-btn');
  if (transBtn) {
    transBtn.addEventListener('click', async () => {
      if (S.lyricsTranslated) {
        S.lyricsTranslated = null;
        updateNpLyricsTab();
        return;
      }
      transBtn.textContent = 'Translating...';
      transBtn.disabled = true;
      const original = S.lyricsData?.synced || S.lyricsData?.plain || '';
      S.lyricsTranslated = await translateText(original, 'ru');
      updateNpLyricsTab();
    });
  }
}

function updateNpSimilarTab() {
  const el = $('np-tab-content');
  if (!el) return;

  if (S.similarTracks.length === 0) {
    el.innerHTML = `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px">No similar tracks found</div>`;
    return;
  }

  el.innerHTML = S.similarTracks.map((t, i) => `
    <div class="queue-item" data-similar-idx="${i}" style="cursor:pointer">
      <img class="queue-item__art" src="${t.thumbnail}" alt="" loading="lazy" onerror="this.style.opacity=0.3">
      <div class="queue-item__info">
        <div class="queue-item__title">${escHTML(t.title)}</div>
        <div class="queue-item__artist">${escHTML(t.artist)}</div>
      </div>
    </div>
  `).join('');

  el.querySelectorAll('[data-similar-idx]').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.similarIdx);
      playTrack(S.similarTracks[idx]);
    });
  });
}

// ── Volume ──
function setVolume(val) {
  S.volume = parseFloat(val);
  S.isMuted = false;
  ytSetVolume(S.volume);
  localStorage.setItem('tucus_volume', S.volume.toString());
  updatePlayerBar();
}

function toggleMute() {
  S.isMuted = !S.isMuted;
  ytSetVolume(S.isMuted ? 0 : S.volume);
  updatePlayerBar();
}

// ══════════════════════════════════════════════
// MOBILE PLAYER
// ══════════════════════════════════════════════

function updateMobilePlayer() {
  const mc = $('mobile-player-controls');
  if (!mc) return;
  if (S.currentTrack) {
    mc.style.display = '';
    const mPlayIcon = $('m-play-icon');
    if (mPlayIcon) {
      mPlayIcon.innerHTML = S.isPlaying ?
        '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' :
        '<polygon points="5 3 19 12 5 21 5 3"/>';
    }
    if ($('m-shuffle-btn')) $('m-shuffle-btn').className = `ctrl-btn ctrl-btn--sm ${S.isShuffle ? 'ctrl-btn--active' : ''}`;
    if ($('m-repeat-btn')) $('m-repeat-btn').className = `ctrl-btn ctrl-btn--sm ${S.isRepeat ? 'ctrl-btn--active' : ''}`;
  } else {
    mc.style.display = 'none';
  }
}

function initMobileNav() {
  const bottomNav = $('mobile-bottom-nav');
  if (!bottomNav) return;

  bottomNav.querySelectorAll('[data-mview]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.view = btn.dataset.mview;
      S.activePlaylistName = null;
      renderCurrentView();
      renderSidebarPlaylists();
      bottomNav.querySelectorAll('[data-mview]').forEach(b => b.classList.remove('mobile-bottom-nav__item--active'));
      btn.classList.add('mobile-bottom-nav__item--active');
    });
  });

  // Mobile player controls
  if ($('m-play-btn')) $('m-play-btn').addEventListener('click', togglePlay);
  if ($('m-prev-btn')) $('m-prev-btn').addEventListener('click', handlePrev);
  if ($('m-next-btn')) $('m-next-btn').addEventListener('click', handleNext);
  if ($('m-shuffle-btn')) $('m-shuffle-btn').addEventListener('click', () => { S.isShuffle = !S.isShuffle; updatePlayerBar(); });
  if ($('m-repeat-btn')) $('m-repeat-btn').addEventListener('click', () => { S.isRepeat = !S.isRepeat; updatePlayerBar(); });
  if ($('m-progress-bar')) $('m-progress-bar').addEventListener('click', handleSeekMobile);
}

// ══════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════

function init() {
  loadEqSettings();
  setTheme(S.theme);

  // Sidebar nav
  $$('.sidebar .nav__item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      S.view = btn.dataset.view;
      S.activePlaylistName = null;
      renderCurrentView();
      renderSidebarPlaylists();
    });
  });

  if ($('logo-btn')) {
    $('logo-btn').addEventListener('click', () => {
      S.view = 'home';
      S.activePlaylistName = null;
      renderCurrentView();
      renderSidebarPlaylists();
    });
  }

  if ($('create-playlist-btn')) {
    $('create-playlist-btn').addEventListener('click', () => createPlaylist($('new-playlist-input').value));
  }
  if ($('new-playlist-input')) {
    $('new-playlist-input').addEventListener('keydown', e => { if (e.key === 'Enter') createPlaylist(e.target.value); });
  }

  // Player controls
  if ($('play-btn')) $('play-btn').addEventListener('click', togglePlay);
  if ($('next-btn')) $('next-btn').addEventListener('click', handleNext);
  if ($('prev-btn')) $('prev-btn').addEventListener('click', handlePrev);
  if ($('shuffle-btn')) $('shuffle-btn').addEventListener('click', () => { S.isShuffle = !S.isShuffle; updatePlayerBar(); });
  if ($('repeat-btn')) $('repeat-btn').addEventListener('click', () => { S.isRepeat = !S.isRepeat; updatePlayerBar(); });

  if ($('volume-slider')) $('volume-slider').addEventListener('input', e => setVolume(e.target.value));
  if ($('mute-btn')) $('mute-btn').addEventListener('click', toggleMute);
  if ($('np-volume')) $('np-volume').addEventListener('input', e => setVolume(e.target.value));
  if ($('np-mute')) $('np-mute').addEventListener('click', toggleMute);

  if ($('progress-bar')) $('progress-bar').addEventListener('click', handleSeek);
  if ($('np-progress')) $('np-progress').addEventListener('click', handleSeek);

  // Click on player track area to open Now Playing
  if ($('player-track-area')) {
    $('player-track-area').addEventListener('click', (e) => {
      if (e.target.closest('.icon-btn')) return;
      openNowPlaying();
    });
  }

  if ($('player-art-wrap')) {
    $('player-art-wrap').addEventListener('click', (e) => {
      e.stopPropagation();
      openNowPlaying();
    });
  }

  if ($('player-like-btn')) {
    $('player-like-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (S.currentTrack) toggleLike(S.currentTrack);
    });
  }

  // Queue toggle
  if ($('queue-toggle-btn')) {
    $('queue-toggle-btn').addEventListener('click', () => {
      S.showQueue = !S.showQueue;
      const qp = $('queue-panel');
      const layout = $('layout');
      if (qp) qp.style.display = S.showQueue ? '' : 'none';
      if (layout) layout.classList.toggle('queue-open', S.showQueue);
      renderQueue();
    });
  }

  if ($('clear-queue-btn')) $('clear-queue-btn').addEventListener('click', clearQueue);

  // Now Playing modal controls
  if ($('np-close')) $('np-close').addEventListener('click', closeNowPlaying);
  if ($('np-modal')) {
    $('np-modal').addEventListener('click', (e) => {
      if (e.target === $('np-modal') || e.target.classList.contains('np-modal__bg') || e.target.classList.contains('np-modal__overlay')) {
        closeNowPlaying();
      }
    });
  }
  if ($('np-play')) $('np-play').addEventListener('click', togglePlay);
  if ($('np-next')) $('np-next').addEventListener('click', handleNext);
  if ($('np-prev')) $('np-prev').addEventListener('click', handlePrev);
  if ($('np-shuffle')) $('np-shuffle').addEventListener('click', () => { S.isShuffle = !S.isShuffle; updatePlayerBar(); });
  if ($('np-repeat')) $('np-repeat').addEventListener('click', () => { S.isRepeat = !S.isRepeat; updatePlayerBar(); });
  if ($('np-like-btn')) $('np-like-btn').addEventListener('click', () => { if (S.currentTrack) toggleLike(S.currentTrack); });
  if ($('np-dislike-btn')) $('np-dislike-btn').addEventListener('click', () => { if (S.currentTrack) toggleDislike(S.currentTrack); });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    if (e.code === 'ArrowRight') { e.preventDefault(); handleNext(); }
    if (e.code === 'ArrowLeft') { e.preventDefault(); handlePrev(); }
    if (e.key === 'm' || e.key === 'M') toggleMute();
    if (e.key === 'l' || e.key === 'L') { if (S.currentTrack) toggleLike(S.currentTrack); }
    if (e.key === 'Escape') {
      if (S.showNowPlaying) { closeNowPlaying(); return; }
      if (S.showQueue) {
        S.showQueue = false;
        const qp = $('queue-panel');
        const layout = $('layout');
        if (qp) qp.style.display = 'none';
        if (layout) layout.classList.remove('queue-open');
        return;
      }
    }
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.playlist-dropdown') && !e.target.closest('[data-add-playlist-trigger]')) {
      document.querySelectorAll('.playlist-dropdown').forEach(d => d.remove());
    }
  });

  // Volume scroll
  document.addEventListener('wheel', (e) => {
    if (e.target.closest('.volume-slider') || e.target.closest('#progress-bar') || e.target.closest('#np-progress') || e.target.closest('.search-bar__input') || e.target.closest('.settings-view')) return;
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    setVolume(Math.max(0, Math.min(1, S.volume + delta)));
  }, { passive: true });

  // Initial render
  renderSidebarPlaylists();
  renderCurrentView();
  renderQueue();
  updateLikedCount();
  updateMobilePlayer();
  initMobileNav();

  console.log('TUCUS Music Player v2.0 initialized');
}

document.addEventListener('DOMContentLoaded', init);
