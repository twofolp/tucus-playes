import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  YANDEX_TOKEN: 'yandex_token',
  LIKED: 'liked_tracks',
  DISLIKED: 'disliked_tracks',
  PLAYLISTS: 'playlists',
  RECENTLY: 'recently_played',
  AUTO_LYRICS: 'auto_fetch_lyrics',
  TRANSLATION: 'lyrics_translation_enabled',
};

export const storage = {
  // Token
  getToken: async () => (await AsyncStorage.getItem(KEYS.YANDEX_TOKEN)) || '',
  setToken: async (t) => AsyncStorage.setItem(KEYS.YANDEX_TOKEN, t),
  cleanToken: async () => {
    let tok = (await AsyncStorage.getItem(KEYS.YANDEX_TOKEN)) || '';
    if (tok.includes('access_token=')) {
      const m = tok.match(/access_token=([^&]+)/);
      if (m) tok = m[1];
    }
    return tok.trim();
  },

  // Liked
  getLiked: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.LIKED);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  toggleLike: async (track) => {
    const liked = await storage.getLiked();
    const idx = liked.findIndex(t => t.id === track.id && t.source === track.source);
    let updated;
    if (idx >= 0) {
      updated = liked.filter((_, i) => i !== idx);
    } else {
      updated = [track, ...liked].slice(0, 500);
      // Remove from disliked
      const disliked = await storage.getDisliked();
      const newDisliked = disliked.filter(t => !(t.id === track.id && t.source === track.source));
      await AsyncStorage.setItem(KEYS.DISLIKED, JSON.stringify(newDisliked));
    }
    await AsyncStorage.setItem(KEYS.LIKED, JSON.stringify(updated));
    return idx < 0; // returns true if now liked
  },
  isLiked: async (track) => {
    const liked = await storage.getLiked();
    return liked.some(t => t.id === track.id && t.source === track.source);
  },

  // Disliked
  getDisliked: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.DISLIKED);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  toggleDislike: async (track) => {
    const disliked = await storage.getDisliked();
    const idx = disliked.findIndex(t => t.id === track.id && t.source === track.source);
    let updated;
    if (idx >= 0) {
      updated = disliked.filter((_, i) => i !== idx);
    } else {
      updated = [track, ...disliked].slice(0, 500);
      const liked = await storage.getLiked();
      const newLiked = liked.filter(t => !(t.id === track.id && t.source === track.source));
      await AsyncStorage.setItem(KEYS.LIKED, JSON.stringify(newLiked));
    }
    await AsyncStorage.setItem(KEYS.DISLIKED, JSON.stringify(updated));
    return idx < 0;
  },

  // Playlists
  getPlaylists: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.PLAYLISTS);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  },
  addToPlaylist: async (name, track) => {
    const pls = await storage.getPlaylists();
    const tracks = pls[name] || [];
    if (!tracks.some(t => t.id === track.id && t.source === track.source)) {
      tracks.push(track);
      pls[name] = tracks;
      await AsyncStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(pls));
    }
  },
  createPlaylist: async (name) => {
    const pls = await storage.getPlaylists();
    if (!pls[name]) { pls[name] = []; await AsyncStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(pls)); }
  },
  deletePlaylist: async (name) => {
    const pls = await storage.getPlaylists();
    delete pls[name];
    await AsyncStorage.setItem(KEYS.PLAYLISTS, JSON.stringify(pls));
  },

  // Recently
  getRecently: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.RECENTLY);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  },
  addRecently: async (track) => {
    let recent = await storage.getRecently();
    recent = recent.filter(t => !(t.id === track.id && t.source === track.source));
    recent = [track, ...recent].slice(0, 50);
    await AsyncStorage.setItem(KEYS.RECENTLY, JSON.stringify(recent));
  },

  // Settings
  getAutoLyrics: async () => {
    const v = await AsyncStorage.getItem(KEYS.AUTO_LYRICS);
    return v !== 'false';
  },
  setAutoLyrics: async (v) => AsyncStorage.setItem(KEYS.AUTO_LYRICS, String(v)),
  getTranslation: async () => (await AsyncStorage.getItem(KEYS.TRANSLATION)) === 'true',
  setTranslation: async (v) => AsyncStorage.setItem(KEYS.TRANSLATION, String(v)),
};
