import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import ReactDOM from 'react-dom';
import { invoke, convertFileSrc } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  Search, Play, Pause, SkipForward, SkipBack, Home,
  Volume2, VolumeX, Settings, Music, Shuffle, Repeat,
  ListMusic, Trash2, FolderPlus, Plus, Heart, ThumbsDown,
  List, X, Radio, ChevronRight, ChevronLeft, Clock, PlayCircle,
  Maximize2, Minimize2, Mic2, AlertCircle, Sliders, Disc, User, TrendingUp,
  CheckCircle, Info, Zap, Database, Palette, Share2, Globe, Shield, Terminal, Keyboard, Layers
} from "lucide-react";
import "./App.css";
import Aurora from "./Aurora";
import LyricsRenderer from "./LyricsRenderer";
import WaveCoverBackdrop from "./WaveCoverBackdrop";
import WaveView from "./WaveView";
import { extractCoverPalette } from "./coverColors";
import { analyzeListeningHistory } from "./recommendations";
import { loadHomeRecommendations } from "./homeLoader";


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: "#ff6b6b", fontFamily: "monospace" }}>
          <h3>Something went wrong</h3>
          <p style={{ fontSize: 12, opacity: 0.7 }}>{this.state.error?.toString()}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })} 
            style={{ marginTop: 10, padding: "6px 16px", background: "#fff", color: "#000", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Visualizer = ({ isPlaying }) => {
  return (
    <div className={`css-visualizer ${isPlaying ? "css-visualizer--playing" : ""}`}>
      <div className="v-bar v-bar-1" />
      <div className="v-bar v-bar-2" />
      <div className="v-bar v-bar-3" />
      <div className="v-bar v-bar-4" />
    </div>
  );
};

const SourceBadge = ({ source }) => {
  const cls = { youtube: "badge-yt", yandex: "badge-yx", spotify: "badge-sp", soundcloud: "badge-sc" };
  const lbl = { youtube: "YT", yandex: "YX", spotify: "SP", soundcloud: "SC" };
  return <span className={`src-badge ${cls[source] || ""}`}>{lbl[source] || source}</span>;
};

const YandexMusicLogo = ({ size = 16, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
    <circle cx="12" cy="12" r="10" fill="#FFCC00" />
    <path d="M11 6v7.26c-.45-.17-.95-.26-1.5-.26-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V8h4V6h-6.5z" fill="#000000" />
  </svg>
);

const SoundCloudLogo = ({ size = 16, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF5500" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
    <path d="M6 15.5c0 .28-.22.5-.5.5H5.1c-.28 0-.5-.22-.5-.5v-4c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v4zm2 0c0 .28-.22.5-.5.5H7.1c-.28 0-.5-.22-.5-.5v-6c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v6zm2 0c0 .28-.22.5-.5.5H9.1c-.28 0-.5-.22-.5-.5v-7c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v7zm2 0c0 .28-.22.5-.5.5h-.4c-.28 0-.5-.22-.5-.5v-8c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v8zm2 0c0 .28-.22.5-.5.5h-.4c-.28 0-.5-.22-.5-.5v-9c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v9zm2 .25c0 .28-.22.5-.5.5h-.4c-.28 0-.5-.22-.5-.5V8.5c0-.28.22-.5.5-.5h.4c.28 0 .5.22.5.5v7.25zM22.5 12c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5.2c-.44 0-.8-.36-.8-.8V12c0-.55-.45-1-1-1h-.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5h.3c.66 0 1.2-.54 1.2-1.2v-.3c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v.3c0 .28.22.5.5.5h.5c1.38 0 2.5 1.12 2.5 2.5 0 1.24-.9 2.27-2.1 2.47v.23h-.4z" />
  </svg>
);

const WaveBannerDecor = () => (
  <svg className="dotify-wave-lines" viewBox="0 0 1200 96" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 58 C180 22, 360 82, 540 48 S900 18, 1200 52" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1.2" />
    <path d="M0 68 C220 38, 420 88, 620 58 S940 28, 1200 62" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    <path d="M0 42 C160 62, 320 28, 480 52 S760 72, 1200 36" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="0.8" />
  </svg>
);



const TrackCard = memo(({ track, onClick, size = "md" }) => {
  const [hovered, setHovered] = useState(false);
  if (!track || !track.id) return null;
  const width = size === "sm" ? 130 : size === "lg" ? 200 : 165;

  const srcBadgeColor = { yandex: "#FFCC00", soundcloud: "#FF5500", youtube: "#FF0000" };
  const srcBadgeBg = { yandex: "#000", soundcloud: "#fff", youtube: "#fff" };

  return (
    <div
      className="track-card"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        minWidth: width, maxWidth: width, flexShrink: 0,
        cursor: "pointer", transition: "transform 0.2s",
        transform: hovered ? "scale(1.03)" : "none",
      }}
    >
      <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1/1" }}>
        <img
          src={track.thumbnail || ""}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={e => { e.target.onerror = null; e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231a1a2e' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-size='14'%3E♪%3C/text%3E%3C/svg%3E"; }}
        />
        <span style={{
          position: "absolute", bottom: 8, right: 8,
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          background: srcBadgeColor[track.source] || "#666",
          color: srcBadgeBg[track.source] || "#fff",
          padding: 4, borderRadius: "50%",
          boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
        }} title={track.source}>
          {track.source === "yandex" ? <YandexMusicLogo size={10}/> :
           track.source === "soundcloud" ? <SoundCloudLogo size={10}/> :
           <Play size={8} fill="currentColor"/>}
        </span>
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.3)", opacity: hovered ? 1 : 0,
          transition: "opacity 0.2s",
        }}>
          <Play size={22} fill="#fff" color="#fff" />
        </div>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
        {track.title || "Unknown"}
      </div>
      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
        {track.artist || "Unknown Artist"}
      </div>
    </div>
  );
});

const HorizontalSection = memo(({ title, icon, tracks, onTrackClick, onSeeAll }) => {
  if (!tracks || tracks.length === 0) return null;
  return (
    <div className="home-section" style={{ marginBottom: 24 }}>
      <div className="home-section__header" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
        {icon}
        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{title}</span>
        {onSeeAll && (
          <button onClick={onSeeAll} style={{
            marginLeft: "auto", fontSize: 12, fontWeight: 600,
            color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer",
          }}>
            Все <ChevronRight size={14} style={{ verticalAlign: "middle" }}/>
          </button>
        )}
      </div>
      <div className="horizontal-scroll-row" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
        {tracks.map((t, idx) => (
          <TrackCard key={`${t.source}-${t.id}-${idx}`} track={t} onClick={() => onTrackClick(t)} />
        ))}
      </div>
    </div>
  );
});

const fmt = (s) => { if (!s || isNaN(s)) return "0:00"; const m = Math.floor(s/60), sec = Math.floor(s%60); return `${m}:${sec<10?"0":""}${sec}`; };

const TrackRow = ({
  track,
  idx,
  active,
  isPlaying,
  liked,
  disliked,
  selectedTrackForPlaylist,
  setSelectedTrackForPlaylist,
  playlists,
  addToPlaylist,
  togglePlay,
  playTrack,
  toggleLike,
  toggleDislike,
  addToQueue,
  showRemove,
  onRemove,
  handleArtistClick
}) => {
  const [hovered, setHovered] = useState(false);
  if (!track || !track.id) return null;

  return (
    <div
      className={`track-row ${active ? "track-row--active" : ""}`}
      onClick={() => {
        if (active) togglePlay();
        else playTrack(track);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="track-row__index" onClick={e => { if (active) { e.stopPropagation(); togglePlay(); } }}>
        {active ? (
          hovered ? (
            isPlaying ? <Pause size={13} fill="currentColor" /> : <Play size={13} fill="currentColor" />
          ) : (
            isPlaying ? <Visualizer isPlaying={true} /> : <Play size={13} fill="currentColor" />
          )
        ) : (
          hovered ? <Play size={13} fill="currentColor" /> : <span className="track-row__num">{idx + 1}</span>
        )}
      </div>
      <img className="track-row__art" src={track.thumbnail || ""} alt="" loading="lazy"
        onError={e => { e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%231a1a1a' width='40' height='40'/%3E%3C/svg%3E"; }} />
      <div className="track-row__info">
        <div className="track-row__title" style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.title || "Unknown"}</span>
          <span className={`track-source-badge track-source-badge--${track.source}`} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", opacity: 0.6, flexShrink: 0 }} title={track.source}>
            {track.source === "yandex" ? (
              <YandexMusicLogo size={10}/>
            ) : track.source === "soundcloud" ? (
              <SoundCloudLogo size={10}/>
            ) : (
              <Play size={8} fill="currentColor" style={{ color: "#FF0000" }}/>
            )}
          </span>
        </div>
        <div 
          className="track-row__artist"
          style={{ cursor: "pointer", textDecoration: "hover:underline" }}
          onClick={(e) => {
            e.stopPropagation();
            if (handleArtistClick) handleArtistClick(e, track);
          }}
        >
          {track.artist || "Unknown Artist"}
        </div>
      </div>
      <div className="track-row__actions" onClick={e => e.stopPropagation()}>
        <button className={`icon-btn ${liked ? "icon-btn--liked" : ""}`} onClick={() => toggleLike(track)} title="Like (L)">
          <Heart size={14} fill={liked ? "currentColor" : "none"} />
        </button>
        <button className={`icon-btn ${disliked ? "icon-btn--disliked" : ""}`} onClick={() => toggleDislike(track)} title="Dislike">
          <ThumbsDown size={13} fill={disliked ? "currentColor" : "none"} />
        </button>
        <button className="icon-btn" onClick={() => addToQueue(track)} title="Add to queue">
          <Plus size={14} />
        </button>
        <div style={{ position: "relative" }}>
          <button className="icon-btn" onClick={() => setSelectedTrackForPlaylist(selectedTrackForPlaylist === track ? null : track)}>
            <FolderPlus size={14} />
          </button>
          {selectedTrackForPlaylist === track && (
            <div className="playlist-dropdown" onClick={e => e.stopPropagation()}>
              <div className="playlist-dropdown__label">Add to playlist</div>
              {Object.keys(playlists).length === 0 ? <div className="playlist-dropdown__empty">No playlists</div>
                : Object.keys(playlists).map(pn => (
                  <button key={pn} className="playlist-dropdown__item" onClick={() => addToPlaylist(pn, track)}>{pn}</button>
                ))}
            </div>
          )}
        </div>
        {showRemove && <button className="icon-btn icon-btn--danger" onClick={onRemove}><Trash2 size={13}/></button>}
      </div>
      <SourceBadge source={track.source} />
      <div className="track-row__duration">{fmt(track.duration)}</div>
    </div>
  );
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

const extractAccentColor = (imageUrl) => {
  if (!imageUrl) {
    document.documentElement.style.setProperty("--accent", "#8b5cf6");
    document.documentElement.style.setProperty("--accent-rgb", "139, 92, 246");
    return;
  }
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = imageUrl;
  img.onload = () => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      
      let hsl = rgbToHsl(r, g, b);
      hsl.s = Math.max(55, hsl.s);
      hsl.l = Math.max(45, Math.min(65, hsl.l));
      
      const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
      const accentStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      const accentRgbStr = `${rgb.r}, ${rgb.g}, ${rgb.b}`;
      
      document.documentElement.style.setProperty("--accent", accentStr);
      document.documentElement.style.setProperty("--accent-rgb", accentRgbStr);
    } catch (e) {
      document.documentElement.style.setProperty("--accent", "#8b5cf6");
      document.documentElement.style.setProperty("--accent-rgb", "139, 92, 246");
    }
  };
  img.onerror = () => {
    document.documentElement.style.setProperty("--accent", "#8b5cf6");
    document.documentElement.style.setProperty("--accent-rgb", "139, 92, 246");
  };
};

const yandexCuratedPlaylists = [
  { title: "100 хитов русского рэпа", owner: "yandexmusic", id: "1073", cover: "https://avatars.yandex.net/get-music-user-playlist/34120/1073/400x400", likes: "212 748", fallback: "https://images.unsplash.com/photo-1508973128325-171141276a14?w=400&q=80" },
  { title: "Громкие новинки: рэп", owner: "yandexmusic", id: "2316", cover: "https://avatars.yandex.net/get-music-user-playlist/38224/2316/400x400", likes: "85 187", fallback: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80" },
  { title: "Русский рэп: открытия", owner: "yandexmusic", id: "2325", cover: "https://avatars.yandex.net/get-music-user-playlist/51865/2325/400x400", likes: "60 974", fallback: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&q=80" },
  { title: "Рэп-принцессы", owner: "yandexmusic", id: "2129", cover: "https://avatars.yandex.net/get-music-user-playlist/27701/2129/400x400", likes: "14 104", fallback: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80" },
  { title: "Новый рэп из Беларуси", owner: "yandexmusic", id: "2377", cover: "https://avatars.yandex.net/get-music-user-playlist/51865/2377/400x400", likes: "2 796", fallback: "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=400&q=80" },
  { title: "Вечные хиты русского рэпа", owner: "yandexmusic", id: "2320", cover: "https://avatars.yandex.net/get-music-user-playlist/70547/2320/400x400", likes: "96 850", fallback: "https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?w=400&q=80" },
  { title: "Легенды хип-хопа", owner: "yandexmusic", id: "2228", cover: "https://avatars.yandex.net/get-music-user-playlist/38224/2228/400x400", likes: "172 714", fallback: "https://images.unsplash.com/photo-1484876065684-b683cf17d276?w=400&q=80" }
];

const yandexFeaturedArtists = [
  { name: "Miyagi & Эндшпиль", id: "2916627", cover: "https://avatars.yandex.net/get-music-content/8118065/e3a8de92.a.25418181-1/400x400", fallback: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80" },
  { name: "Macan", id: "6016140", cover: "https://avatars.yandex.net/get-music-content/9843648/cb018eb7.a.29418658-1/400x400", fallback: "https://images.unsplash.com/photo-1525683879097-75cc58cc175e?w=400&q=80" },
  { name: "Монеточка", id: "4296711", cover: "https://avatars.yandex.net/get-music-content/11181617/2ca92a6c.a.32626922-1/400x400", fallback: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&q=80" },
  { name: "Баста", id: "12879", cover: "https://avatars.yandex.net/get-music-content/11181617/db0f88e1.a.32431713-1/400x400", fallback: "https://images.unsplash.com/photo-1517256064527-09c53b2d0bc6?w=400&q=80" },
  { name: "Скриптонит", id: "1653229", cover: "https://avatars.yandex.net/get-music-content/9664483/52e5052a.a.28678077-1/400x400", fallback: "https://images.unsplash.com/photo-1563841930606-67e2b6c3d5fc?w=400&q=80" },
  { name: "Instasamka", id: "6405786", cover: "https://avatars.yandex.net/get-music-content/11090176/651f8a84.a.31758652-1/400x400", fallback: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=400&q=80" }
];

const soundcloudGenres = [
  { title: "Lofi Beats", query: "lofi hip hop", cover: "https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80" },
  { title: "Synthwave", query: "synthwave", cover: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80" },
  { title: "Chill & Deep", query: "chill house", cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80" },
  { title: "Hip-Hop / Rap", query: "underground rap", cover: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&q=80" },
  { title: "Techno & Club", query: "techno set", cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&q=80" }
];

function App() {
  const [activeView, setActiveView] = useState("home");
  const [theme, setTheme] = useState(localStorage.getItem("app_theme") || "dark");
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showSpeedDropdown, setShowSpeedDropdown] = useState(false);
  const [yandexToken, setYandexToken] = useState(localStorage.getItem("yandex_token") || "");
  const [settingsSubTab, setSettingsSubTab] = useState("yandex");
  const [autoFetchLyrics, setAutoFetchLyrics] = useState(localStorage.getItem("auto_fetch_lyrics") !== "false");
  const [discordRpcEnabled, setDiscordRpcEnabled] = useState(localStorage.getItem("discord_rpc_enabled") !== "false");
  const [proxyServer, setProxyServer] = useState(localStorage.getItem("proxy_server") || "");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchSource, setSearchSource] = useState("all");
  const [searchMode, setSearchMode] = useState("tracks"); // "tracks" | "lyrics" | "mood"
  const [searchResults, setSearchResults] = useState([]);
  const [searchTracks, setSearchTracks] = useState([]);
  const [searchAlbums, setSearchAlbums] = useState([]);
  const [searchArtists, setSearchArtists] = useState([]);
  const [searchSubTab, setSearchSubTab] = useState("tracks"); // "tracks", "albums", "artists"
  const [isLoading, setIsLoading] = useState(false);
  const [isTrackLoading, setIsTrackLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [showNowPlaying, setShowNowPlaying] = useState(false);
  const [showCinemaMode, setShowCinemaMode] = useState(false);
  const cinemaCanvasRef = useRef(null);
  const particlesRef = useRef([]);

  const [playHistory, setPlayHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("play_history") || "[]"); } catch { return []; }
  });

  const [showYandexGuide, setShowYandexGuide] = useState(false);
  const [selectedTrackForPlaylist, setSelectedTrackForPlaylist] = useState(null);
  const [activePlaylistName, setActivePlaylistName] = useState(null);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [isMyWaveActive, setIsMyWaveActive] = useState(false);
  const [waveMood, setWaveMood] = useState(localStorage.getItem("wave_mood") || "all");
  const [waveAlgorithm, setWaveAlgorithm] = useState(localStorage.getItem("wave_algorithm") || "old");
  const [showWaveSettingsDropdown, setShowWaveSettingsDropdown] = useState(false);
  
  // Close wave settings on outside click
  useEffect(() => {
    if (!showWaveSettingsDropdown) return;
    const handler = (e) => {
      if (!e.target.closest('.wave-settings-container')) {
        setShowWaveSettingsDropdown(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [showWaveSettingsDropdown]);
  const [waveAuroraColors, setWaveAuroraColors] = useState({ color1: "#6366f1", color2: "#ec4899" });
  const [lyrics, setLyrics] = useState([]);
  const [isLoadingLyrics, setIsLoadingLyrics] = useState(false);
  const [lyricsError, setLyricsError] = useState("");
  const [lyricsFontSize, setLyricsFontSize] = useState(localStorage.getItem("lyrics_font_size") || "md");
  const [lyricsTextStyle, setLyricsTextStyle] = useState(localStorage.getItem("lyrics_text_style") || "normal");
  const [lyricsHighlightLine, setLyricsHighlightLine] = useState(localStorage.getItem("lyrics_highlight_line") !== "false");
  const [lyricsHighlightWords, setLyricsHighlightWords] = useState(localStorage.getItem("lyrics_highlight_words") !== "false");
  const [showTranslation, setShowTranslation] = useState(localStorage.getItem("lyrics_translation_enabled") === "true");
  const [lyricsOffset, setLyricsOffset] = useState(0.0);
  const [showLyricsSettings, setShowLyricsSettings] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [likedTracks, setLikedTracks] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("liked_tracks") || "[]");
      return Array.isArray(raw) ? raw.filter(t => t && t.id && t.title && t.source) : [];
    } catch { return []; }
  });
  const [dislikedTracks, setDislikedTracks] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("disliked_tracks") || "[]");
      return Array.isArray(raw) ? raw.filter(t => t && t.id && t.title && t.source) : [];
    } catch { return []; }
  });
  const [recentlyPlayed, setRecentlyPlayed] = useState(() => {
    try { return JSON.parse(localStorage.getItem("recently_played") || "[]"); } catch { return []; }
  });
  const [playlists, setPlaylists] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("playlists") || "{}");
      // Validate: ensure each playlist is an array of valid tracks
      const validated = {};
      for (const [key, val] of Object.entries(raw)) {
        if (Array.isArray(val)) {
          validated[key] = val.filter(t => t && t.id && t.title && t.source && typeof t.title === "string" && t.title.trim().length > 0);
        }
      }
      return validated;
    } catch { return {}; }
  });

  // Dual audio players for Gapless playback
  const audio1Ref = useRef(null);
  const audio2Ref = useRef(null);
  const [activePlayer, setActivePlayer] = useState(1);

  // Equalizer states and refs
  const [eqGains, setEqGains] = useState(() => {
    try { return JSON.parse(localStorage.getItem("eq_gains") || "[0, 0, 0, 0, 0]"); } catch { return [0, 0, 0, 0, 0]; }
  });
  const [eqPreset, setEqPreset] = useState(localStorage.getItem("eq_preset") || "Flat");
  const [showEqModal, setShowEqModal] = useState(false);

  const audioCtxRef = useRef(null);
  const source1NodeRef = useRef(null);
  const source2NodeRef = useRef(null);
  const filtersRef = useRef([]);
  const analyserRef = useRef(null);
  const visualizerCanvasRef = useRef(null);
  const nowPlayingCanvasRef = useRef(null);
  const homeViewRef = useRef(null);

  // Preload next track refs
  const preloadTimeoutRef = useRef(null);
  const preloadedTrackRef = useRef(null);

  // Album detail view & Artist brief profile view
  const [activeAlbum, setActiveAlbum] = useState(null);
  const [activeAlbumTracks, setActiveAlbumTracks] = useState([]);
  const [isLoadingAlbum, setIsLoadingAlbum] = useState(false);

  const [activeArtist, setActiveArtist] = useState(null);
  const [activeArtistBrief, setActiveArtistBrief] = useState(null);
  const [isLoadingArtist, setIsLoadingArtist] = useState(false);

  // Home Page Charts and New Releases
  const [chartTracks, setChartTracks] = useState([]);
  const [newReleases, setNewReleases] = useState([]);
  const [soundcloudPopularTracks, setSoundcloudPopularTracks] = useState([]);
  const [soundcloudPopularPlaylists, setSoundcloudPopularPlaylists] = useState([]);
  const [isLoadingHomeData, setIsLoadingHomeData] = useState(false);

  // Home Recommendations
  const [homeRecommendations, setHomeRecommendations] = useState(null);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);

  const [useEqualizer, setUseEqualizer] = useState(() => localStorage.getItem("use_equalizer") === "true");
  const [viewHistory, setViewHistory] = useState([]);
  const [artistSelectTrack, setArtistSelectTrack] = useState(null);

  // Toast notifications
  const [toasts, setToasts] = useState([]);
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // Playlist / album search
  const [playlistSearch, setPlaylistSearch] = useState("");

  // Similar tracks in Now Playing
  const [similarTracks, setSimilarTracks] = useState([]);
  const [isLoadingSimilar, setIsLoadingSimilar] = useState(false);
  const [npTab, setNpTab] = useState("lyrics"); // "lyrics" | "similar"

  // Track change animation key
  const [trackChangeKey, setTrackChangeKey] = useState(0);

  const prevUseEqRef = useRef(useEqualizer);
  useEffect(() => {
    if (prevUseEqRef.current !== useEqualizer) {
      prevUseEqRef.current = useEqualizer;
      if (currentTrack) {
        playTrack(currentTrack, queueIndex, true);
      }
    }
  }, [useEqualizer]);

  const handleSidebarClick = (viewName, playlistName = null) => {
    setViewHistory([]);
    setActiveView(viewName);
    if (playlistName) setActivePlaylistName(playlistName);
    setIsMyWaveActive(viewName === "wave");
    if (viewName === "home") {
      requestAnimationFrame(() => {
        if (homeViewRef.current) homeViewRef.current.scrollTop = 0;
      });
    }
  };

  const handleBack = () => {
    if (viewHistory.length === 0) return;
    const last = viewHistory[viewHistory.length - 1];
    setViewHistory(prev => prev.slice(0, -1));
    setActiveView(last.view);
    setActiveAlbum(last.album);
    setActiveAlbumTracks(last.albumTracks);
    setActiveArtist(last.artist);
    setActiveArtistBrief(last.artistBrief);
    setActivePlaylistName(last.playlistName);
  };

  const handleArtistClick = (e, track) => {
    if (e) e.stopPropagation();
    if (!track) return;
    if (track.artists && track.artists.length > 1) {
      setArtistSelectTrack(track);
    } else if (track.artistId || track.artist_id) {
      const aId = track.artistId || track.artist_id;
      if (track.source === "soundcloud") {
        openSoundCloudArtist(aId, track.artist);
      } else {
        openArtist(aId, track.artist);
      }
    } else if (track.source === "yandex") {
      openArtist(track.id, track.artist);
    } else {
      console.log("YouTube artist profiles are not supported.");
    }
  };

  const getActiveAudio = () => activePlayer === 1 ? audio1Ref.current : audio2Ref.current;
  const getBgAudio = () => activePlayer === 1 ? audio2Ref.current : audio1Ref.current;

  useEffect(() => { document.body.className = `theme-${theme}`; localStorage.setItem("app_theme", theme); }, [theme]);
  
  // Keep both audio elements synchronized in volume and muted state
  useEffect(() => {
    if (audio1Ref.current) audio1Ref.current.volume = isMuted ? 0 : volume;
    if (audio2Ref.current) audio2Ref.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // Keep both audio elements synchronized in speed
  useEffect(() => {
    if (audio1Ref.current) audio1Ref.current.playbackRate = playbackSpeed;
    if (audio2Ref.current) audio2Ref.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Discord presence updates
  useEffect(() => {
    if (currentTrack) {
      invoke("update_discord_presence", {
        title: currentTrack.title,
        artist: currentTrack.artist,
        isPlaying,
        thumbnail: currentTrack.thumbnail || "",
        currentTime: Math.floor(currentTime),
        duration: Math.floor(duration || currentTrack.duration || 0)
      }).catch((e) => console.log("Discord presence error", e));
    }
  }, [currentTrack, isPlaying, duration]);

  // Sync Yandex liked tracks list automatically
  useEffect(() => {
    syncYandexLikedPlaylist();
  }, [yandexToken]);

  // Listen to automatic Yandex token capture
  useEffect(() => {
    let unlisten;
    const setupListener = async () => {
      unlisten = await listen("yandex_token_captured", (event) => {
        const token = event.payload;
        if (token) {
          setYandexToken(token);
          localStorage.setItem("yandex_token", token);
        }
      });
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    let animId;
    let running = true;

    // Pre-allocate frequency data array (reuse across frames)
    let cachedDataArray = null;
    let cachedBufferLength = 0;

    // Setup floating particles for Now Playing canvas
    const particles = [];
    for (let i = 0; i < 20; i++) {
      particles.push({
        x: Math.random() * 420,
        y: Math.random() * 420,
        size: Math.random() * 5 + 2,
        speedX: (Math.random() - 0.5) * 0.4,
        speedY: (Math.random() - 0.5) * 0.4,
        opacity: Math.random() * 0.4 + 0.15
      });
    }

    // Throttle: only draw every 2nd frame (~30fps for visuals) to save CPU
    let frameCount = 0;

    const draw = () => {
      if (!running) return;
      animId = requestAnimationFrame(draw);

      const analyser = analyserRef.current;
      if (!analyser || !isPlaying) return;

      frameCount++;
      if (frameCount % 2 !== 0) return; // skip every other frame

      const bufferLength = analyser.frequencyBinCount;
      // Reuse array if buffer size hasn't changed
      if (!cachedDataArray || cachedBufferLength !== bufferLength) {
        cachedDataArray = new Uint8Array(bufferLength);
        cachedBufferLength = bufferLength;
      }
      analyser.getByteFrequencyData(cachedDataArray);
      const dataArray = cachedDataArray;

      const bassVal = dataArray[2] || 0;
      const midVal = dataArray[10] || 0;

      // 1. Footer spectrum (only when footer is visible)
      if (!showNowPlaying && !showCinemaMode && visualizerCanvasRef.current) {
        const canvas = visualizerCanvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / 8) - 1.5;
        let x = 0;

        for (let i = 0; i < 8; i++) {
          const val = dataArray[i * 3] || 0;
          const barHeight = (val / 255) * canvas.height * 0.85 + 2;

          const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
          grad.addColorStop(0, "rgba(99, 102, 241, 0.1)");
          grad.addColorStop(1, "rgba(168, 85, 247, 0.8)");

          ctx.fillStyle = grad;
          ctx.shadowBlur = 3;
          ctx.shadowColor = "rgba(168, 85, 247, 0.4)";

          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          x += barWidth + 1.5;
        }
      }

      // 2. Now Playing canvas
      if (showNowPlaying && nowPlayingCanvasRef.current) {
        const canvas = nowPlayingCanvasRef.current;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const width = canvas.width;
        const height = canvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 175;

        ctx.strokeStyle = "rgba(168, 85, 247, 0.55)";
        ctx.lineWidth = 3.0;
        ctx.shadowBlur = 15;
        ctx.shadowColor = "rgba(168, 85, 247, 0.7)";

        ctx.beginPath();
        const numPoints = 64;
        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;
          const audioIdx = Math.floor((i / numPoints) * (bufferLength / 3.5));
          const val = dataArray[audioIdx] || 0;
          const offset = (val / 255) * 45;
          const r = radius + offset;

          const px = centerX + Math.cos(angle) * r;
          const py = centerY + Math.sin(angle) * r;

          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.shadowBlur = 5;
        const bassScale = 1.0 + (bassVal / 255) * 1.5;
        const sizeScale = 1.0 + (midVal / 255) * 0.8;
        particles.forEach(p => {
          p.x += p.speedX * bassScale;
          p.y += p.speedY * bassScale;
          if (p.x < 0 || p.x > width) p.speedX *= -1;
          if (p.y < 0 || p.y > height) p.speedY *= -1;

          ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity})`;
          ctx.shadowColor = "rgba(139, 92, 246, 0.5)";
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * sizeScale, 0, Math.PI * 2);
          ctx.fill();
        });

        // Update ambient backdrop
        const backdrop = document.querySelector(".ambient-background-backdrop");
        if (backdrop) {
          const bassS = 1.0 + (bassVal / 255) * 0.12;
          backdrop.style.transform = `scale(${1.25 * bassS})`;
          backdrop.style.filter = `blur(140px) saturate(${2.2 + (bassVal / 255) * 1.5}) opacity(${0.25 + (midVal / 255) * 0.12})`;
        }

        // Cover art glow
        const npArtWrap = document.querySelector(".np-modal__art-wrap");
        if (npArtWrap) {
          npArtWrap.style.transform = `scale(${1.0 + (bassVal / 255) * 0.035})`;
          npArtWrap.style.boxShadow = `0 16px 80px rgba(var(--accent-rgb), ${0.15 + (bassVal / 255) * 0.38})`;
        }
      }

      // 3. Cinema Mode canvas
      if (showCinemaMode) {
        const cinemaCanvas = document.getElementById("cinema-canvas");
        if (cinemaCanvas) {
          const ctx = cinemaCanvas.getContext("2d");
          if (cinemaCanvas.width !== cinemaCanvas.clientWidth || cinemaCanvas.height !== cinemaCanvas.clientHeight) {
            cinemaCanvas.width = cinemaCanvas.clientWidth;
            cinemaCanvas.height = cinemaCanvas.clientHeight;
          }
          ctx.clearRect(0, 0, cinemaCanvas.width, cinemaCanvas.height);

          if (particlesRef.current.length === 0) {
            for (let i = 0; i < 45; i++) {
              particlesRef.current.push({
                x: Math.random() * cinemaCanvas.width,
                y: Math.random() * cinemaCanvas.height,
                vx: (Math.random() - 0.5) * 1.6,
                vy: (Math.random() - 0.5) * 1.6,
                size: Math.random() * 5 + 2,
                opacity: Math.random() * 0.4 + 0.1
              });
            }
          }

          const pSpeed = 1.0 + (bassVal / 255) * 2.8;
          const pSize = 1.0 + (midVal / 255) * 1.5;

          ctx.shadowBlur = 10;
          ctx.shadowColor = "rgba(var(--accent-rgb), 0.35)";

          particlesRef.current.forEach(p => {
            p.x += p.vx * pSpeed;
            p.y += p.vy * pSpeed;
            if (p.x < 0) p.x = cinemaCanvas.width;
            if (p.x > cinemaCanvas.width) p.x = 0;
            if (p.y < 0) p.y = cinemaCanvas.height;
            if (p.y > cinemaCanvas.height) p.y = 0;

            ctx.fillStyle = `rgba(var(--accent-rgb), ${p.opacity + (bassVal / 255) * 0.15})`;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * pSize, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }
    };

    if (isPlaying) {
      draw();
    }
    return () => { running = false; cancelAnimationFrame(animId); };
  }, [isPlaying, showCinemaMode, showNowPlaying]);

  const syncYandexLikedPlaylist = async () => {
    const token = getCleanYandexToken();
    if (!token) return;
    try {
      const tracks = await invoke("get_yandex_liked_tracks", { token });
      if (tracks && tracks.length > 0) {
        const validTracks = tracks.filter(t => t && t.id && t.title && t.source);
        setPlaylists(prev => {
          const updated = { ...prev, "Yandex Liked": validTracks };
          localStorage.setItem("playlists", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.log("Failed to sync Yandex Liked tracks", err);
    }
  };

  // Fetch charts & releases on home view
  useEffect(() => {
    if (activeView === "home") {
      loadHomeData();
    }
  }, [activeView, yandexToken]);

  const waveCoverThumbnail =
    (isMyWaveActive && currentTrack?.thumbnail) ||
    currentTrack?.thumbnail ||
    recentlyPlayed[0]?.thumbnail ||
    likedTracks[0]?.thumbnail ||
    yandexFeaturedArtists[0]?.cover ||
    null;

  useEffect(() => {
    extractCoverPalette(waveCoverThumbnail, setWaveAuroraColors);
  }, [waveCoverThumbnail]);

  const loadHomeData = async () => {
    setIsLoadingHomeData(true);
    setIsLoadingRecommendations(true);
    const token = getCleanYandexToken();

    try {
      // Analyze user listening patterns
      const history = analyzeListeningHistory(playHistory, likedTracks);

      // Fetch personalized recommendations
      const recs = await loadHomeRecommendations(history, token, likedTracks);
      setHomeRecommendations(recs);

      // Also set legacy state for backward compatibility
      setChartTracks(recs.chart || []);
      setNewReleases(recs.releases || []);
      setSoundcloudPopularTracks(recs.soundcloudPopular || []);
    } catch (e) {
      console.log("Error loading home data", e);
    } finally {
      setIsLoadingHomeData(false);
      setIsLoadingRecommendations(false);
    }
  };

  useEffect(() => {
    if (currentTrack) {
      setLyricsOffset(0.0);
      setShowLyricsSettings(false);
      if (autoFetchLyrics) {
        fetchLyrics(currentTrack);
      } else {
        setLyrics([]);
        setLyricsError("Автопоиск текста отключен");
      }
      fetchSimilarForNowPlaying(currentTrack);
    }
  }, [currentTrack, autoFetchLyrics]);

  useEffect(() => {
    if (showTranslation && lyrics.length > 0 && lyrics.some(l => !l.translation) && !isTranslating) {
      translateCurrentLyrics();
    }
  }, [showTranslation, lyrics, isTranslating]);

  useEffect(() => {
    localStorage.setItem("lyrics_translation_enabled", showTranslation.toString());
  }, [showTranslation]);

  useEffect(() => {
    if (currentTrack) {
      extractAccentColor(currentTrack.thumbnail);
    } else {
      extractAccentColor(null);
    }
  }, [currentTrack]);

  const getCleanYandexToken = () => {
    let tok = yandexToken.trim();
    if (!tok) tok = localStorage.getItem("yandex_token") || "";
    if (tok.includes("access_token=")) {
      const m = tok.match(/access_token=([^&]+)/);
      if (m) return m[1];
    }
    return tok;
  };

  const fetchLyricsRef = useRef(null);
  const fetchLyrics = async (track) => {
    const fetchId = Date.now();
    fetchLyricsRef.current = fetchId;
    setLyrics([]); setLyricsError("");
    setIsLoadingLyrics(true);
    let success = false;
    
    // 1. If track is Yandex, query Yandex Music lyrics directly first
    if (track.source === "yandex") {
      const token = getCleanYandexToken();
      if (token) {
        try {
          const result = await invoke("get_yandex_lyrics", { trackId: track.id, token });
          if (result && result.length > 0 && fetchLyricsRef.current === fetchId) {
            setLyrics(result);
            success = true;
          }
        } catch (err) {
          console.log("Yandex lyrics direct fetch failed, trying fallback...", err);
        }
      }
    }
    
    // 2. Query LRCLIB search (as primary search for Soundcloud/others, or fallback for Yandex)
    if (!success) {
      try {
        const result = await invoke("get_lyrics", { 
          title: track.title, 
          artist: track.artist, 
          duration: track.duration ? Math.round(track.duration) : null,
          platform: track.source,
          trackId: track.id ? track.id.toString() : null
        });
        if (result && result.length > 0 && fetchLyricsRef.current === fetchId) {
          setLyrics(result);
          success = true;
        }
      } catch (e) {
        console.log("LRCLIB lyrics search failed", e);
      }
    }
    
    if (!success && fetchLyricsRef.current === fetchId) {
      setLyricsError("Lyrics not found. No lyrics available for this track.");
    }
    if (fetchLyricsRef.current === fetchId) setIsLoadingLyrics(false);
  };

  const translateLyricsText = async (lyricsArray, targetLang = "ru") => {
    const textToTranslate = lyricsArray.map(l => l.text || "").join("\n");
    if (!textToTranslate.trim()) return lyricsArray;
    
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(textToTranslate)}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data && data[0]) {
        const fullTranslation = data[0].map(x => x[0]).join("");
        const translatedLines = fullTranslation.split("\n");
        
        return lyricsArray.map((line, idx) => {
          return {
            ...line,
            translation: translatedLines[idx] ? translatedLines[idx].trim() : ""
          };
        });
      }
    } catch (err) {
      console.error("Lyrics translation failed", err);
    }
    return lyricsArray;
  };

  const translateCurrentLyrics = async () => {
    if (isTranslating || !lyrics.length) return;
    setIsTranslating(true);
    try {
      const translated = await translateLyricsText(lyrics, "ru");
      setLyrics(translated);
      showToast("✓ Текст переведен", "success");
    } catch (err) {
      showToast("Ошибка перевода текста", "error");
    } finally {
      setIsTranslating(false);
    }
  };
  
  const openYandexCuratedPlaylist = async (owner, playlistId) => {
    const token = getCleanYandexToken();
    if (!token) {
      setErrorMessage("Для загрузки этого плейлиста необходимо подключить аккаунт Яндекс Музыки в настройках.");
      return;
    }
    setIsLoading(true);
    try {
      const info = await invoke("get_yandex_playlist_info", { owner, playlist_id: playlistId.toString(), token });
      setPlaylists(prev => {
        const updated = { ...prev, [info.title]: info.tracks };
        localStorage.setItem("playlists", JSON.stringify(updated));
        return updated;
      });
      handleSidebarClick("playlist", info.title);
    } catch (err) {
      console.log("Failed to load curated playlist", err);
      setErrorMessage("Не удалось загрузить плейлист. Проверьте подключение к сети или токен.");
    } finally {
      setIsLoading(false);
    }
  };

  const openSoundcloudPlaylist = async (pl) => {
    setIsLoading(true);
    try {
      const searchQuery = pl.searchQuery || pl.title;
      const tracks = await invoke("search_soundcloud", { query: searchQuery });
      if (tracks && tracks.length > 0) {
        setQueue(tracks);
        playTrack(tracks[0], 0);
        showToast(`▶ ${pl.title}`, "success");
      } else {
      showToast("⚠ Не удалось загрузить треки плейлиста", "error");
      }
    } catch (err) {
      console.log("Failed to load SoundCloud playlist", err);
      showToast("⚠ Ошибка при загрузке плейлиста", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const openSoundCloudGenre = async (genreTitle, query) => {
    setIsLoading(true);
    try {
      const tracks = await invoke("search_soundcloud", { query });
      setPlaylists(prev => {
        const updated = { ...prev, [genreTitle]: tracks };
        localStorage.setItem("playlists", JSON.stringify(updated));
        return updated;
      });
      handleSidebarClick("playlist", genreTitle);
    } catch (err) {
      console.log("Failed to load SoundCloud genre", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const hk = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "ArrowRight") { e.preventDefault(); handleNextClick(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); handlePrev(); }
      if (e.key === "m" || e.key === "M") setIsMuted(p => !p);
      if (e.key === "l" || e.key === "L") { if (currentTrack) toggleLike(currentTrack); }
      if (e.key === "Escape") {
        if (activeView === "wave") { exitMyWave(); return; }
        if (showNowPlaying) { setShowNowPlaying(false); return; }
        if (showQueue) { setShowQueue(false); return; }
      }
    };
    window.addEventListener("keydown", hk);
    return () => window.removeEventListener("keydown", hk);
  }, [currentTrack, isPlaying, queue, queueIndex, activeView, showNowPlaying, showQueue]);

  const isLiked = (t) => t && likedTracks.some(x => x.id === t.id && x.source === t.source);
  const isDisliked = (t) => t && dislikedTracks.some(x => x.id === t.id && x.source === t.source);

  const toggleLike = async (track) => { if (!track) return;
    const token = getCleanYandexToken();
    const wasLiked = isLiked(track);

    setLikedTracks(prev => {
      const has = prev.some(t => t.id === track.id && t.source === track.source);
      const upd = has ? prev.filter(t => !(t.id === track.id && t.source === track.source)) : [track, ...prev].slice(0, 500);
      if (!has) setDislikedTracks(d => d.filter(t => !(t.id === track.id && t.source === track.source)));
      localStorage.setItem("liked_tracks", JSON.stringify(upd));
      return upd;
    });

    showToast(wasLiked ? `✕ Убрано из лайков` : `❤️ ${track.title}`, wasLiked ? "info" : "success");

    if (track.source === "yandex" && token) {
      try {
        await invoke("yandex_like_track", { trackId: track.id, token, remove: wasLiked });
        syncYandexLikedPlaylist();
      } catch (err) {
        console.error("Yandex like sync error", err);
      }
    }
  };

  const toggleDislike = async (track) => { if (!track) return;
    const token = getCleanYandexToken();
    const wasDisliked = isDisliked(track);

    setDislikedTracks(prev => {
      const has = prev.some(t => t.id === track.id && t.source === track.source);
      const upd = has ? prev.filter(t => !(t.id === track.id && t.source === track.source)) : [track, ...prev].slice(0, 500);
      if (!has) setLikedTracks(l => l.filter(t => !(t.id === track.id && t.source === track.source)));
      localStorage.setItem("disliked_tracks", JSON.stringify(upd));
      return upd;
    });

    if (track.source === "yandex" && token) {
      try {
        await invoke("yandex_dislike_track", { trackId: track.id, token, remove: wasDisliked });
      } catch (err) {
        console.error("Yandex dislike sync error", err);
      }
    }
  };

  const fetchSimilarForNowPlaying = async (track) => {
    if (!track) return;
    setSimilarTracks([]);
    setIsLoadingSimilar(true);
    const token = getCleanYandexToken();
    try {
      if (track.source === "yandex" && token) {
        const r = await invoke("get_yandex_similar", { trackId: track.id, token });
        if (r?.length > 0) { setSimilarTracks(r.slice(0, 12)); return; }
      }
      
      if (track.source === "soundcloud") {
        try {
          const r = await invoke("get_soundcloud_similar", { trackId: track.id });
          if (r?.length > 0) { setSimilarTracks(r.slice(0, 12)); return; }
        } catch (err) {
          console.log("get_soundcloud_similar failed, trying fallback...", err);
        }
      }

      // Fallback: search by title+artist
      const r = await invoke("search_soundcloud", { query: `${track.artist} ${track.title}` });
      if (r?.length > 0) setSimilarTracks(r.filter(t => t.id !== track.id).slice(0, 12));
    } catch(e) { console.log("Similar tracks error", e); }
    finally { setIsLoadingSimilar(false); }
  };

  const saveSettings = () => {
    let tok = yandexToken.trim();
    if (tok.includes("access_token=")) { const m = tok.match(/access_token=([^&]+)/); if (m) { tok = m[1]; setYandexToken(tok); } }
    localStorage.setItem("yandex_token", tok);
    localStorage.setItem("auto_fetch_lyrics", autoFetchLyrics ? "true" : "false");
    localStorage.setItem("discord_rpc_enabled", discordRpcEnabled ? "true" : "false");
    localStorage.setItem("proxy_server", proxyServer.trim());
    const btn = document.getElementById("save-btn");
    if (btn) { btn.textContent = "Сохранено!"; setTimeout(() => { btn.textContent = "Сохранить настройки"; }, 2000); }
  };

  const handleExportData = () => {
    const data = {
      likedTracks,
      dislikedTracks,
      recentlyPlayed,
      playlists,
      playHistory
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tucus_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("✓ Данные экспортированы", "success");
  };

  const handleImportData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.likedTracks) {
          setLikedTracks(data.likedTracks);
          localStorage.setItem("liked_tracks", JSON.stringify(data.likedTracks));
        }
        if (data.dislikedTracks) {
          setDislikedTracks(data.dislikedTracks);
          localStorage.setItem("disliked_tracks", JSON.stringify(data.dislikedTracks));
        }
        if (data.recentlyPlayed) {
          setRecentlyPlayed(data.recentlyPlayed);
          localStorage.setItem("recently_played", JSON.stringify(data.recentlyPlayed));
        }
        if (data.playlists) {
          setPlaylists(data.playlists);
          localStorage.setItem("playlists", JSON.stringify(data.playlists));
        }
        if (data.playHistory) {
          setPlayHistory(data.playHistory);
          localStorage.setItem("play_history", JSON.stringify(data.playHistory));
        }
        showToast("✓ Данные импортированы", "success");
      } catch (err) {
        showToast("⚠ Ошибка при импорте файла", "error");
      }
    };
    reader.readAsText(file);
  };

  const initEqualizer = () => {
    if (!useEqualizer) return;
    if (audioCtxRef.current) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtxClass();
      audioCtxRef.current = ctx;

      const source1 = ctx.createMediaElementSource(audio1Ref.current);
      const source2 = ctx.createMediaElementSource(audio2Ref.current);
      source1NodeRef.current = source1;
      source2NodeRef.current = source2;

      const bands = [60, 230, 910, 4000, 14000];
      const filters = bands.map((freq, i) => {
        const filter = ctx.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = eqGains[i];
        return filter;
      });

      // Setup analyser
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      source1.connect(filters[0]);
      source2.connect(filters[0]);

      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(analyser);
      analyser.connect(ctx.destination);
      filtersRef.current = filters;
    } catch (e) {
      console.error("Failed to initialize Web Audio Equalizer", e);
    }
  };

  const updateEqGain = (index, val) => {
    const next = [...eqGains];
    next[index] = val;
    setEqGains(next);
    localStorage.setItem("eq_gains", JSON.stringify(next));
    setEqPreset("Custom");
    localStorage.setItem("eq_preset", "Custom");

    initEqualizer();
    if (filtersRef.current[index]) {
      filtersRef.current[index].gain.value = val;
    }
  };

  const applyEqPreset = (name, gains) => {
    setEqPreset(name);
    localStorage.setItem("eq_preset", name);
    setEqGains(gains);
    localStorage.setItem("eq_gains", JSON.stringify(gains));

    initEqualizer();
    gains.forEach((g, i) => {
      if (filtersRef.current[i]) {
        filtersRef.current[i].gain.value = g;
      }
    });
  };

  const EQ_PRESETS = {
    Flat: [0, 0, 0, 0, 0],
    BassBoost: [6, 4, 0, -2, -4],
    Rock: [4, 2, -2, 2, 4],
    Pop: [-2, 1, 3, 1, -2],
    Classical: [5, 3, -2, -3, 4],
    VocalBoost: [-4, -2, 3, 5, 2],
    Electronic: [4, 1.5, -1.5, 2.5, 4]
  };

  const fadeVolume = (target, dur = 200) => new Promise(res => {
    const activeAudio = getActiveAudio();
    if (!activeAudio) return res();
    const cur = activeAudio.volume, steps = 10, stepTime = dur / steps, diff = target - cur;
    let step = 0;
    const iv = setInterval(() => {
      const a = getActiveAudio();
      if (!a) { clearInterval(iv); return res(); }
      step++; a.volume = Math.max(0, Math.min(1, cur + diff * (step / steps)));
      if (step >= steps) { clearInterval(iv); res(); }
    }, stepTime);
  });

  const togglePlay = async () => {
    const activeAudio = getActiveAudio();
    if (!currentTrack || !activeAudio) return;
    
    initEqualizer();
    if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
      await audioCtxRef.current.resume();
    }

    if (isPlaying) {
      await fadeVolume(0, 150); activeAudio.pause(); setIsPlaying(false);
      activeAudio.volume = isMuted ? 0 : volume;
    } else {
      activeAudio.volume = 0; activeAudio.play().catch(e => console.error(e));
      setIsPlaying(true); await fadeVolume(isMuted ? 0 : volume, 200);
    }
  };

  const preloadNextTrack = async (currentIndex, currentQueue) => {
    let nextIndex = currentIndex + 1;
    if (isShuffle && currentQueue.length > 1) {
      nextIndex = Math.floor(Math.random() * currentQueue.length);
    } else if (nextIndex >= currentQueue.length) {
      if (isRepeat) nextIndex = 0;
      else return;
    }

    const nextTrack = currentQueue[nextIndex];
    if (!nextTrack) return;

    try {
      const token = getCleanYandexToken();
      let streamUrl = "";
      if (nextTrack.source === "soundcloud") streamUrl = await invoke("get_soundcloud_stream", { trackId: nextTrack.id });
      else if (nextTrack.source === "yandex") streamUrl = await invoke("get_yandex_stream", { trackId: nextTrack.id, token });
      else if (nextTrack.source === "youtube") streamUrl = await invoke("get_youtube_stream", { videoId: nextTrack.id });

      if (streamUrl) {
        preloadedTrackRef.current = nextTrack;
        const bgAudio = getBgAudio();
        bgAudio.src = streamUrl;
        bgAudio.load();
      }
    } catch (err) {
      console.log("Next track preload failed", err);
    }
  };

  const playTrack = async (track, indexInQueue = -1, forceNoPreloadTransition = false) => {
    if (!track || !track.id) return;
    setIsTrackLoading(true); setErrorMessage("");
    const activeAudio = getActiveAudio();
    const bgAudio = getBgAudio();

    if (activeAudio) { activeAudio.pause(); }
    setIsPlaying(false);
    
    try {
      let streamUrl = "";
      const token = getCleanYandexToken();
      let wasPreloaded = false;

      // 1. Check local cache first
      let cachedPath = null;
      try {
        cachedPath = await invoke("check_cached_track", { trackId: track.id, source: track.source });
      } catch (e) {
        console.log("Failed to check cache", e);
      }

      if (cachedPath) {
        streamUrl = convertFileSrc(cachedPath);
      } else {
        if (!forceNoPreloadTransition && preloadedTrackRef.current && preloadedTrackRef.current.id === track.id && preloadedTrackRef.current.source === track.source) {
          wasPreloaded = true;
          streamUrl = bgAudio.src;
        }

        if (!wasPreloaded) {
          if (track.source === "soundcloud") streamUrl = await invoke("get_soundcloud_stream", { trackId: track.id });
          else if (track.source === "yandex") streamUrl = await invoke("get_yandex_stream", { trackId: track.id, token });
          else if (track.source === "youtube") streamUrl = await invoke("get_youtube_stream", { videoId: track.id });
        }
      }

      if (!streamUrl) throw new Error("Failed to get streaming URL");

      // Background caching if liked and not cached already
      if (!cachedPath && isLiked(track)) {
        invoke("cache_liked_track", { trackId: track.id, source: track.source, streamUrl })
        showToast(`🎵 ${track.title}`, "success")
          .catch(e => console.log("Failed to cache liked track", e));
      }

      let nq = [...queue], ni = indexInQueue;
      if (indexInQueue === -1) {
        const ei = queue.findIndex(t => t.id === track.id && t.source === track.source);
        if (ei !== -1) ni = ei; else { nq.push(track); ni = nq.length - 1; setQueue(nq); }
      }
      
      setQueueIndex(ni);
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      setTrackChangeKey(k => k + 1);
      setSimilarTracks([]);

      if (wasPreloaded) {
        const nextPlayer = activePlayer === 1 ? 2 : 1;
        setActivePlayer(nextPlayer);

        const newActiveAudio = nextPlayer === 1 ? audio1Ref.current : audio2Ref.current;
        newActiveAudio.currentTime = 0;
        newActiveAudio.playbackRate = playbackSpeed;

        initEqualizer();
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        await newActiveAudio.play().catch(err => {
          if (err.name !== "AbortError") console.error("Play error:", err);
        });
        setIsPlaying(true);
      } else {
        if (!activeAudio) throw new Error("Audio player not initialized");
        activeAudio.currentTime = 0;
        activeAudio.src = streamUrl;
        activeAudio.load();
        activeAudio.playbackRate = playbackSpeed;

        initEqualizer();
        if (audioCtxRef.current && audioCtxRef.current.state === "suspended") {
          await audioCtxRef.current.resume();
        }

        await activeAudio.play().catch(err => {
          if (err.name !== "AbortError") console.error("Play error:", err);
        });
        setIsPlaying(true);
      }

      // Save play history for statistics
      setPlayHistory(prev => {
        const entry = {
          id: track.id,
          source: track.source,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
          timestamp: Date.now()
        };
        const updated = [entry, ...prev].slice(0, 1000);
        localStorage.setItem("play_history", JSON.stringify(updated));
        return updated;
      });

      setRecentlyPlayed(prev => {
        const f = prev.filter(t => !(t.id === track.id && t.source === track.source));
        const u = [track, ...f].slice(0, 20);
        localStorage.setItem("recently_played", JSON.stringify(u)); return u;
      });

      if (isMyWaveActive && track.source === "yandex" && token) {
        invoke("yandex_send_feedback", {
          stationId: "user:onyourwave",
          trackId: track.id,
          feedbackType: "trackStarted",
          timestamp: new Date().toISOString(),
          token
        }).catch(err => console.log("[Wave] Feedback error:", err));
      }

      // fetchLyrics is handled by useEffect on currentTrack

      preloadedTrackRef.current = null;
      clearTimeout(preloadTimeoutRef.current);
      preloadTimeoutRef.current = setTimeout(() => {
        preloadNextTrack(ni, nq);
      }, 20000);

    } catch (err) { setErrorMessage(err.toString().replace("Error: ", "")); setIsPlaying(false); }
    finally { setIsTrackLoading(false); }
  };

  const addToQueue = (track) => {
    if (queue.some(t => t.id === track.id && t.source === track.source)) {
      return;
    }
    setQueue(prev => [...prev, track]);
  };

  const clearQueue = () => {
    setQueue([]);
    setQueueIndex(-1);
  };

  const openAlbum = async (album) => {
    setViewHistory(prev => [...prev, {
      view: activeView,
      album: activeAlbum,
      albumTracks: activeAlbumTracks,
      artist: activeArtist,
      artistBrief: activeArtistBrief,
      playlistName: activePlaylistName
    }]);
    setActiveAlbum(album);
    setActiveView("album");
    setIsLoadingAlbum(true);
    setActiveAlbumTracks([]);
    setErrorMessage("");
    try {
      const token = getCleanYandexToken();
      if (!token) throw new Error("Yandex Music token required. Set it in Settings.");
      const tracks = await invoke("get_yandex_album_tracks", { albumId: album.id, token });
      setActiveAlbumTracks(tracks || []);
    } catch (err) {
      setErrorMessage("Album tracks loading failed: " + err.toString());
    } finally {
      setIsLoadingAlbum(false);
    }
  };

  const openArtist = async (artistId, artistName) => {
    setViewHistory(prev => [...prev, {
      view: activeView,
      album: activeAlbum,
      albumTracks: activeAlbumTracks,
      artist: activeArtist,
      artistBrief: activeArtistBrief,
      playlistName: activePlaylistName
    }]);
    setActiveArtist({ id: artistId, name: artistName });
    setActiveView("artist");
    setIsLoadingArtist(true);
    setActiveArtistBrief(null);
    setErrorMessage("");
    try {
      const token = getCleanYandexToken();
      if (!token) throw new Error("Yandex Music token required. Set it in Settings.");
      const brief = await invoke("get_yandex_artist_brief", { artistId, token });
      setActiveArtistBrief(brief);
    } catch (err) {
      setErrorMessage("Artist profile loading failed: " + err.toString());
    } finally {
      setIsLoadingArtist(false);
    }
  };

  const openSoundCloudArtist = async (userId, artistName) => {
    setViewHistory(prev => [...prev, {
      view: activeView,
      album: activeAlbum,
      albumTracks: activeAlbumTracks,
      artist: activeArtist,
      artistBrief: activeArtistBrief,
      playlistName: activePlaylistName
    }]);
    setActiveArtist({ id: userId, name: artistName });
    setActiveView("artist");
    setIsLoadingArtist(true);
    setActiveArtistBrief(null);
    setErrorMessage("");
    try {
      const tracks = await invoke("get_soundcloud_user_tracks", { userId });
      setActiveArtistBrief({
        artist: { id: userId, name: artistName, thumbnail: "", genres: [] },
        tracks: tracks || [],
        albums: []
      });
    } catch (err) {
      setErrorMessage("SoundCloud artist loading failed: " + err.toString());
    } finally {
      setIsLoadingArtist(false);
    }
  };

  const handleSearch = async (e, overrideSource) => {
    if (e && e.preventDefault) e.preventDefault(); if (!searchQuery.trim()) return;
    
    let activeSrc = overrideSource || searchSource;
    const rawQuery = searchQuery.trim();

    // Adjust query per mode
    let scQuery = rawQuery;
    let ytQuery = rawQuery;
    let yxQuery = rawQuery;
    let scExtraPromises = [];
    if (searchMode === "lyrics") {
      scQuery = `${rawQuery} lyrics`;
      ytQuery = `${rawQuery} lyrics`;
    } else if (searchMode === "mood") {
      // Mood: map to SoundCloud genre charts + tag search
      const moodToGenres = {
        "чилл": ["chill", "ambient", "lofi"],
        "chill": ["chill", "ambient", "lofi"],
        "вечеринка": ["electronic", "dance", "house"],
        "party": ["electronic", "dance", "house"],
        "энергия": ["electronic", "punk", "metal"],
        "energy": ["electronic", "punk", "metal"],
        "грусть": ["ambient", "folksingersongwriter", "indie"],
        "sad": ["ambient", "folksingersongwriter", "indie"],
        "танцы": ["electronic", "dance", "house"],
        "dance": ["electronic", "dance", "house"],
        "спорт": ["electronic", "hiphoprap", "rock"],
        "workout": ["electronic", "hiphoprap", "rock"],
        "романтика": ["rbsoul", "pop", "ambient"],
        "love": ["rbsoul", "pop", "ambient"],
        "рэп": ["rap", "hiphoprap"],
        "rap": ["rap", "hiphoprap"],
        "рок": ["rock", "metal", "punk"],
        "rock": ["rock", "metal", "punk"],
        "поп": ["pop", "rbsoul"],
        "pop": ["pop", "rbsoul"],
      };
      const lowerQuery = rawQuery.toLowerCase();
      const matchedGenres = moodToGenres[lowerQuery] || ["rap", "hiphoprap", "pop", "electronic"];
      // Search by tags + charts for matched genres
      scQuery = rawQuery;
      ytQuery = `${rawQuery} music`;
      matchedGenres.forEach(genre => {
        scExtraPromises.push(
          invoke("search_soundcloud_charts", { genre })
            .then(tracks => ({ source:"soundcloud", data:(tracks||[]).slice(0, 5) }))
            .catch(() => ({ source:"soundcloud", data:[] }))
        );
      });
    }

    setIsLoading(true);
    setSearchResults([]);
    setSearchTracks([]);
    setSearchAlbums([]);
    setSearchArtists([]);
    setErrorMessage("");
    setActiveView("search");
    setSearchSubTab("tracks");

    const token = getCleanYandexToken();
    try {
      const promises = [];
      if (activeSrc === "all" || activeSrc === "soundcloud") {
        const scDurationFilter = searchMode === "mood" ? (t) => t.duration > 30 && t.duration < 600 : (t) => true;
        promises.push(invoke("search_soundcloud", { query: scQuery }).then(d => ({ source:"soundcloud", data:(d||[]).filter(scDurationFilter) })).catch(e => ({ source:"soundcloud", error:e.toString() })));
        // Extra mood queries for variety
        if (searchMode === "mood") {
          promises.push(...scExtraPromises);
        }
      }
      if (activeSrc === "all" || activeSrc === "youtube") {
        promises.push(invoke("search_youtube", { query: ytQuery }).then(d => ({ source:"youtube", data:d||[] })).catch(e => ({ source:"youtube", error:e.toString() })));
      }
      if (activeSrc === "yandex" || activeSrc === "all") {
        if (token) {
          promises.push(invoke("search_yandex_all", { query: yxQuery, token }).then(d => ({ source:"yandex_all", data:d })).catch(e => ({ source:"yandex_all", error:e.toString() })));
        } else if (activeSrc === "yandex") {
          throw new Error("Yandex token required. Go to Settings.");
        }
      }

      const results = await Promise.all(promises);
      let mergedTracks = [];
      let mergedAlbums = [];
      let mergedArtists = [];
      const errors = [];
      const seenIds = new Set();

      results.forEach(r => {
        if (r.error) {
          errors.push(r.error);
        } else if (r.source === "yandex_all") {
          if (r.data.tracks) {
            r.data.tracks.forEach(t => {
              const key = `${t.source}:${t.id}`;
              if (!seenIds.has(key)) { seenIds.add(key); mergedTracks.push(t); }
            });
          }
          if (r.data.albums) mergedAlbums = [...mergedAlbums, ...r.data.albums];
          if (r.data.artists) mergedArtists = [...mergedArtists, ...r.data.artists];
        } else if (r.data) {
          r.data.forEach(t => {
            const key = `${t.source}:${t.id}`;
            if (!seenIds.has(key)) { seenIds.add(key); mergedTracks.push(t); }
          });
        }
      });

      if (errors.length > 0 && mergedTracks.length === 0) setErrorMessage(errors.join(" | "));
      setSearchResults(mergedTracks);
      setSearchTracks(mergedTracks);
      setSearchAlbums(mergedAlbums);
      setSearchArtists(mergedArtists);
    } catch (err) { setErrorMessage(err.message || err.toString()); }
    finally { setIsLoading(false); }
  };

  const createPlaylist = (name) => {
    if (!name.trim()) return;
    const u = { ...playlists, [name.trim()]: [] };
    setPlaylists(u); localStorage.setItem("playlists", JSON.stringify(u)); setNewPlaylistName("");
  };
  const deletePlaylist = (name) => {
    if (!window.confirm(`Delete "${name}"?`)) return;
    const u = { ...playlists }; delete u[name];
    setPlaylists(u); localStorage.setItem("playlists", JSON.stringify(u));
    if (activePlaylistName === name) { setActiveView("home"); setActivePlaylistName(null); }
  };
  const addToPlaylist = (pn, track) => {
    const list = playlists[pn] || [];
    if (list.some(t => t.id === track.id && t.source === track.source)) {
      showToast(`✓ Уже в "${pn}"`, "info");
      return;
    }
    const u = { ...playlists, [pn]: [...list, track] };
    setPlaylists(u); localStorage.setItem("playlists", JSON.stringify(u)); setSelectedTrackForPlaylist(null);
    showToast(`✓ Добавлено в "${pn}"`, "success");
  };
  const removeFromPlaylist = (pn, tid, src) => {
    const u = { ...playlists, [pn]: playlists[pn].filter(t => !(t.id === tid && t.source === src)) };
    setPlaylists(u); localStorage.setItem("playlists", JSON.stringify(u));
  };
  const playPlaylist = (name) => { const l = playlists[name]||[]; if (!l.length) return; setQueue(l); playTrack(l[0], 0); };

  const MOOD_SEARCH_QUERIES = {
    chill: ["чилл лаунж релакс", "chillout lofi", "ambient chill", "downtempo relaxation"],
    summer: ["лето хиты 2024", "summer vibes", "летний микс", "beach party"],
    winter: ["зима новогодние песни", "winter christmas music", "зимний настрой", "новогодние хиты"],
    happy: ["весёлые хиты", "good mood party", "positive energy", "feel good music"],
    unfamiliar: ["новые открытия 2024", "underground gems", "indie discoveries", "new artists 2024"],
  };

  const fetchMoodTracks = async (mood, token) => {
    const queries = MOOD_SEARCH_QUERIES[mood];
    if (!queries || !token) return [];
    const query = queries[Math.floor(Math.random() * queries.length)];
    try {
      const result = await invoke("search_yandex_all", { query, token });
      const tracks = (result?.tracks || []).filter(t => t && t.duration > 30 && t.duration < 600);
      return tracks.slice(0, 8);
    } catch (e) {
      console.log("[Wave] Mood search error:", e);
      return [];
    }
  };

  const fetchWaveTracks = async (moodOverride) => {
    const token = getCleanYandexToken();
    if (!token) return [];
    const mood = moodOverride || waveMood;
    try {
      const tracks = await invoke("get_yandex_my_wave_tracks", { token, stationId: "user:onyourwave" });
      let result = tracks?.length > 0 ? tracks : [];
      // Mix in mood tracks if not "all"
      if (mood !== "all" && result.length > 0) {
        const moodTracks = await fetchMoodTracks(mood, token);
        if (moodTracks.length > 0) {
          const mixed = [];
          const maxLen = Math.max(result.length, moodTracks.length);
          for (let i = 0; i < maxLen; i++) {
            if (i < result.length) mixed.push(result[i]);
            if (i < moodTracks.length) mixed.push(moodTracks[i]);
          }
          result = mixed;
        }
      }
      return result;
    } catch (e) {
      console.log("fetchWaveTracks error", e);
      return [];
    }
  };

  const startMyWave = async (moodOverride) => {
    setViewHistory([]);
    setIsLoading(true); setErrorMessage("");
    const token = getCleanYandexToken();
    const mood = moodOverride || waveMood;
    console.log("[Wave] Starting with mood:", mood);
    try {
      setIsMyWaveActive(true); setActiveView("wave");
      let nq = [];
      if (token) {
        // 1. Fetch base wave
        try {
          const w = await invoke("get_yandex_my_wave_tracks", { token, stationId: "user:onyourwave" });
          console.log("[Wave] Base wave returned", w?.length || 0, "tracks");
          if (w?.length > 0) nq = w.filter(t => !isDisliked(t));
        } catch(e) { console.log("[Wave] Base wave error:", e); }

        // 2. If mood is not "all", mix in mood-specific tracks
        if (mood !== "all" && nq.length > 0) {
          const moodTracks = await fetchMoodTracks(mood, token);
          console.log("[Wave] Mood search returned", moodTracks.length, "tracks for:", mood);
          if (moodTracks.length > 0) {
            // Interleave: wave track, mood track, wave track, mood track...
            const mixed = [];
            const maxLen = Math.max(nq.length, moodTracks.length);
            for (let i = 0; i < maxLen; i++) {
              if (i < nq.length) mixed.push(nq[i]);
              if (i < moodTracks.length) mixed.push(moodTracks[i]);
            }
            nq = mixed;
          }
        }

        // 3. Fallback if nothing
        if (nq.length === 0) {
          try {
            const w = await invoke("get_yandex_my_wave_tracks", { token, stationId: "user:onyourwave" });
            if (w?.length > 0) nq = w.filter(t => !isDisliked(t));
          } catch(e) { console.log("[Wave] Fallback error", e); }
        }
      }
      if (!nq.length) throw new Error("No tracks. Check Yandex token in Settings.");
      console.log("[Wave] Playing", nq.length, "tracks, mood:", mood);
      const shuffled = [...nq].sort(() => Math.random() - 0.5);
      setQueue(shuffled); playTrack(shuffled[0], 0);
    } catch (err) { setErrorMessage("My Wave: " + err.toString()); setIsMyWaveActive(false); setActiveView("home"); }
    finally { setIsLoading(false); }
  };

  const exitMyWave = () => {
    setIsMyWaveActive(false);
    setViewHistory([]);
    setActiveView("home");
  };

  const handleTimeUpdate = (playerNum) => {
    if (playerNum !== activePlayer) return;
    const player = playerNum === 1 ? audio1Ref.current : audio2Ref.current;
    if (player) setCurrentTime(player.currentTime);
  };

  const handleLoadedMetadata = (playerNum) => {
    if (playerNum !== activePlayer) return;
    const player = playerNum === 1 ? audio1Ref.current : audio2Ref.current;
    if (player) {
      setDuration(player.duration);
      player.playbackRate = playbackSpeed;
    }
  };

  const handleEnded = (playerNum) => {
    if (playerNum !== activePlayer) return;
    const token = getCleanYandexToken();
    if (isMyWaveActive && currentTrack && currentTrack.source === "yandex" && token) {
      invoke("yandex_send_feedback", {
        stationId: "user:onyourwave",
        trackId: currentTrack.id,
        feedbackType: "trackFinished",
        timestamp: new Date().toISOString(),
        token
      }).catch(err => console.log("Failed to send trackFinished feedback", err));
    }

    if (isRepeat) {
      const activeAudio = getActiveAudio();
      if (activeAudio) { activeAudio.currentTime = 0; activeAudio.play().catch(()=>{}); }
    } else {
      handleNext();
    }
  };

  const handleNext = async () => {
    if (!queue.length) return;
    let ni = queueIndex + 1;
    if (isMyWaveActive && ni >= queue.length - 2) {
      const more = (await fetchWaveTracks()).filter(t => !isDisliked(t));
      if (more.length > 0) {
        setQueue(p => {
          const existingIds = new Set(p.map(t => `${t.source}:${t.id}`));
          const newTracks = more.filter(t => !existingIds.has(`${t.source}:${t.id}`));
          return [...p, ...newTracks];
        });
      }
    }

    if (ni >= queue.length && currentTrack?.source === "soundcloud") {
      try {
        const more = (await invoke("get_soundcloud_similar", { trackId: currentTrack.id })).filter(t => !isDisliked(t));
        if (more && more.length > 0) {
          const addedTracks = [];
          setQueue(p => {
            const existingIds = new Set(p.map(t => `${t.source}:${t.id}`));
            const newTracks = more.filter(t => !existingIds.has(`${t.source}:${t.id}`));
            addedTracks.push(...newTracks);
            return [...p, ...newTracks];
          });
          // Wait slightly for queue to update in state
          setTimeout(() => {
            if (addedTracks.length > 0) {
              playTrack(addedTracks[0], queue.length);
              showToast("🎶 Радио похожих треков", "info");
            }
          }, 50);
          return;
        }
      } catch (err) {
        console.log("SoundCloud Radio failed to load tracks", err);
      }
    }

    if (isShuffle && queue.length > 1) ni = Math.floor(Math.random() * queue.length);
    else if (ni >= queue.length) ni = isRepeat ? 0 : queue.length - 1;
    if (queue[ni]) playTrack(queue[ni], ni);
  };

  const handleNextClick = () => {
    const token = getCleanYandexToken();
    if (isMyWaveActive && currentTrack && currentTrack.source === "yandex" && token) {
      const activeAudio = getActiveAudio();
      if (activeAudio && activeAudio.duration && activeAudio.currentTime / activeAudio.duration < 0.8) {
        invoke("yandex_send_feedback", {
          stationId: "user:onyourwave",
          trackId: currentTrack.id,
          feedbackType: "skip",
          timestamp: new Date().toISOString(),
          token
        }).catch(err => console.log("Failed to send skip feedback", err));
      }
    }
    handleNext();
  };

  const handlePrev = () => {
    if (!queue.length || queueIndex === -1) return;
    const activeAudio = getActiveAudio();
    if (currentTime > 3 && activeAudio) { activeAudio.currentTime = 0; return; }
    let pi = queueIndex - 1;
    if (pi < 0) pi = isRepeat ? queue.length - 1 : 0;
    if (queue[pi]) playTrack(queue[pi], pi);
  };

  const handleSeek = (e) => {
    const activeAudio = getActiveAudio();
    if (!activeAudio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const t = ((e.clientX - rect.left) / rect.width) * duration;
    activeAudio.currentTime = t; setCurrentTime(t);

    if (currentTrack) {
      invoke("update_discord_presence", {
        title: currentTrack.title,
        artist: currentTrack.artist,
        isPlaying,
        thumbnail: currentTrack.thumbnail || "",
        currentTime: Math.floor(t),
        duration: Math.floor(duration || currentTrack.duration || 0)
      }).catch((e) => console.log("Discord presence seek error", e));
    }
  };

  const handleVolumeScroll = (e) => {
    const delta = e.deltaY < 0 ? 0.04 : -0.04;
    setVolume(prev => {
      const nv = Math.max(0, Math.min(1, prev + delta));
      if (audio1Ref.current) audio1Ref.current.volume = isMuted ? 0 : nv;
      if (audio2Ref.current) audio2Ref.current.volume = isMuted ? 0 : nv;
      return nv;
    });
    setIsMuted(false);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  const renderTrackRow = (t, i, extra = {}) => {
    return (
      <TrackRow
        key={extra.key || `${t.source}-${t.id}-${i}`}
        track={t}
        idx={i}
        active={currentTrack?.id === t.id && currentTrack?.source === t.source}
        isPlaying={isPlaying}
        liked={isLiked(t)}
        disliked={isDisliked(t)}
        selectedTrackForPlaylist={selectedTrackForPlaylist}
        setSelectedTrackForPlaylist={setSelectedTrackForPlaylist}
        playlists={playlists}
        addToPlaylist={addToPlaylist}
        togglePlay={togglePlay}
        playTrack={playTrack}
        toggleLike={toggleLike}
        toggleDislike={toggleDislike}
        addToQueue={addToQueue}
        handleArtistClick={handleArtistClick}
        {...extra}
      />
    );
  };

  const homeRecent = recentlyPlayed.slice(0, 8);

  return (
    <ErrorBoundary>
    <div className="app-root" onClick={() => setSelectedTrackForPlaylist(null)}>
      <div className="ambient-background-backdrop" style={{
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: currentTrack ? `url(${currentTrack.thumbnail})` : "none",
        backgroundSize: "80% 80%",
        backgroundPosition: "center",
        filter: "blur(140px) saturate(2.4) opacity(0.32)",
        zIndex: 2,
        transition: "background-image 1.5s ease-in-out, transform 0.1s ease-out",
        pointerEvents: "none",
        transform: "scale(1.2)"
      }} />
      <div className="liquid-bg" aria-hidden="true" style={{ zIndex: 1 }}>
        <div className="blob blob-1"/><div className="blob blob-2"/><div className="blob blob-3"/>
      </div>
      
      <audio 
        key={`audio1-eq-${useEqualizer}`}
        ref={audio1Ref}
        crossOrigin={useEqualizer ? "anonymous" : undefined}
        onTimeUpdate={() => handleTimeUpdate(1)}
        onLoadedMetadata={() => handleLoadedMetadata(1)}
        onPlay={() => { if (audio1Ref.current) audio1Ref.current.playbackRate = playbackSpeed; }}
        onEnded={() => handleEnded(1)}
        onError={() => { if (activePlayer === 1) { setErrorMessage("Stream error. Try playing again."); setIsPlaying(false); } }}
        style={{ display: "none" }} />

      <audio 
        key={`audio2-eq-${useEqualizer}`}
        ref={audio2Ref}
        crossOrigin={useEqualizer ? "anonymous" : undefined}
        onTimeUpdate={() => handleTimeUpdate(2)}
        onLoadedMetadata={() => handleLoadedMetadata(2)}
        onPlay={() => { if (audio2Ref.current) audio2Ref.current.playbackRate = playbackSpeed; }}
        onEnded={() => handleEnded(2)}
        onError={() => { if (activePlayer === 2) { setErrorMessage("Stream error. Try playing again."); setIsPlaying(false); } }}
        style={{ display: "none" }} />

      {showNowPlaying && currentTrack && (() => {
        const hasLyrics = lyrics && lyrics.length > 0;
        const showRightPanel = npTab === "similar" || (npTab === "lyrics" && hasLyrics);

        return (
          <div className="np-modal" onClick={() => setShowNowPlaying(false)}>
            <div className="np-modal__bg" style={{ backgroundImage: `url(${currentTrack.thumbnail})` }} />
            <div className="np-modal__overlay" />
            <div className={`np-modal__content ${showRightPanel ? "" : "np-modal__content--centered"}`} onClick={e => e.stopPropagation()}>
              <div className="np-modal__left">
                <div style={{ position: "relative", display: "inline-block" }}>
                  <canvas 
                    ref={nowPlayingCanvasRef} 
                    width={420} 
                    height={420} 
                    style={{ 
                      position: "absolute", 
                      top: -50, 
                      left: -50, 
                      width: "420px", 
                      height: "420px", 
                      pointerEvents: "none", 
                      zIndex: 0,
                      borderRadius: "50%",
                      display: useEqualizer ? "block" : "none" 
                    }} 
                  />
                  <div className={`np-modal__art-wrap ${isPlaying ? "np-modal__art-wrap--playing" : ""}`} style={{ position: "relative", zIndex: 1 }}>
                    <img className="np-modal__art" src={currentTrack.thumbnail || ""} alt={currentTrack.title} onError={e => e.target.style.opacity="0"} />
                  </div>
                </div>
                <div className="np-modal__meta">
                  <div className="np-modal__title">{currentTrack.title}</div>
                  <div className="np-modal__artist" style={{ cursor: "pointer", textDecoration: "underline" }} onClick={(e) => { setShowNowPlaying(false); handleArtistClick(e, currentTrack); }}>{currentTrack.artist}</div>
                  <div style={{marginTop:6}}><SourceBadge source={currentTrack.source}/></div>
                </div>
                <div className="np-modal__progress-wrap">
                  <span className="np-modal__time">{fmt(currentTime)}</span>
                  <div className="np-modal__progress" onClick={handleSeek}>
                    <div className="np-modal__progress-fill" style={{ width: `${pct}%` }} />
                    <div className="np-modal__progress-thumb" style={{ left: `${pct}%` }} />
                  </div>
                  <span className="np-modal__time">{fmt(duration)}</span>
                </div>
                <div className="np-modal__controls">
                  <button className={`np-ctrl ${isShuffle?"np-ctrl--active":""}`} onClick={()=>setIsShuffle(p=>!p)}><Shuffle size={20}/></button>
                  <button className="np-ctrl" onClick={handlePrev}><SkipBack size={26} fill="currentColor"/></button>
                  <button className="np-ctrl np-ctrl--play" onClick={togglePlay}>
                    {isPlaying ? <Pause size={30} fill="currentColor"/> : <Play size={30} fill="currentColor"/>}
                  </button>
                  <button className="np-ctrl" onClick={handleNextClick}><SkipForward size={26} fill="currentColor"/></button>
                  <button className={`np-ctrl ${isRepeat?"np-ctrl--active":""}`} onClick={()=>setIsRepeat(p=>!p)}><Repeat size={20}/></button>
                </div>
                <div className="np-modal__react">
                  <button className={`np-react-btn ${isLiked(currentTrack)?"np-react-btn--liked":""}`} onClick={()=>toggleLike(currentTrack)}>
                    <Heart size={18} fill={isLiked(currentTrack)?"currentColor":"none"}/><span>{isLiked(currentTrack)?"Liked":"Like"}</span>
                  </button>
                  <button className={`np-react-btn ${isDisliked(currentTrack)?"np-react-btn--disliked":""}`} onClick={()=>toggleDislike(currentTrack)}>
                    <ThumbsDown size={16} fill={isDisliked(currentTrack)?"currentColor":"none"}/><span>Dislike</span>
                  </button>
                </div>
                <div className="np-modal__volume">
                  <VolumeX size={15} onClick={()=>setIsMuted(p=>!p)} style={{cursor:"pointer",opacity:isMuted?1:0.4}}/>
                  <input type="range" className="volume-slider volume-slider--wide" min="0" max="1" step="0.02"
                    value={isMuted?0:volume} onChange={e=>{setVolume(parseFloat(e.target.value));setIsMuted(false);}} onClick={e=>e.stopPropagation()}/>
                  <Volume2 size={15} style={{opacity:0.4}}/>
                </div>
              </div>
              
              {showRightPanel && (
                <div className="np-modal__right">
                  {hasLyrics ? (
                    <div className="np-tabs-container" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div className="np-tabs" style={{ marginBottom: 0 }}>
                        <button className={`np-tab ${npTab === "lyrics" ? "np-tab--active" : ""}`} onClick={() => setNpTab("lyrics")}>
                          <Mic2 size={13}/> Текст
                        </button>
                        <button className={`np-tab ${npTab === "similar" ? "np-tab--active" : ""}`} onClick={() => setNpTab("similar")}>
                          <Radio size={13}/> Похожие
                        </button>
                      </div>
                      
                      {npTab === "lyrics" && (
                        <div className="lyrics-quick-controls" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button 
                            className={`lyrics-quick-btn ${showTranslation ? "lyrics-quick-btn--active" : ""}`}
                            onClick={() => setShowTranslation(p => !p)}
                            title="Перевод на русский"
                            style={{
                              background: showTranslation ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.05)",
                              border: showTranslation ? "1px solid rgb(168, 85, 247)" : "1px solid rgba(255,255,255,0.1)",
                              color: showTranslation ? "rgb(192, 132, 252)" : "rgba(255,255,255,0.6)",
                              padding: "4px 10px",
                              borderRadius: "8px",
                              fontSize: "11px",
                              fontWeight: "600",
                              cursor: "pointer",
                              transition: "all 0.2s"
                            }}
                          >
                            RU
                          </button>
                          
                          <div className="lyrics-settings-dropdown-wrapper" style={{ position: "relative" }} onMouseLeave={() => setShowLyricsSettings(false)}>
                            <button 
                              className={`lyrics-quick-btn ${showLyricsSettings ? "lyrics-quick-btn--active" : ""}`}
                              onClick={() => setShowLyricsSettings(p => !p)}
                              title="Настройки текста"
                              style={{
                                background: showLyricsSettings ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                color: "rgba(255,255,255,0.8)",
                                padding: "4px",
                                borderRadius: "8px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                                transition: "all 0.2s"
                              }}
                            >
                              <Settings size={14}/>
                            </button>
                            
                            {showLyricsSettings && (
                              <div 
                                className="lyrics-settings-menu glass-panel"
                                style={{
                                  position: "absolute",
                                  top: "30px",
                                  right: "0",
                                  zIndex: 100,
                                  width: "220px",
                                  background: "rgba(20, 20, 20, 0.9)",
                                  backdropFilter: "blur(20px)",
                                  border: "1px solid rgba(255, 255, 255, 0.1)",
                                  borderRadius: "16px",
                                  padding: "12px",
                                  boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px"
                                }}
                              >
                                <div className="lyrics-setting-item">
                                  <div className="lyrics-setting-label" style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Размер шрифта</div>
                                  <div style={{ display: "flex", gap: "4px" }}>
                                    {["sm", "md", "lg", "xl"].map(sz => (
                                      <button 
                                        key={sz}
                                        onClick={() => { setLyricsFontSize(sz); localStorage.setItem("lyrics_font_size", sz); }}
                                        style={{
                                          flex: 1,
                                          background: lyricsFontSize === sz ? "rgba(255,255,255,0.15)" : "transparent",
                                          border: "none",
                                          color: lyricsFontSize === sz ? "#fff" : "rgba(255,255,255,0.4)",
                                          fontSize: "11px",
                                          fontWeight: "bold",
                                          padding: "4px 0",
                                          borderRadius: "6px",
                                          cursor: "pointer"
                                        }}
                                      >
                                        {sz.toUpperCase()}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                
                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}/>
                                
                                <div className="lyrics-setting-item">
                                  <div className="lyrics-setting-label" style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Стиль текста</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                    {[
                                      { id: "normal", label: "Обычный" },
                                      { id: "scale", label: "Увеличение активного" },
                                      { id: "focus", label: "Фокус на активном" },
                                      { id: "neon", label: "Неоновое свечение" }
                                    ].map(st => (
                                      <button 
                                        key={st.id}
                                        onClick={() => { setLyricsTextStyle(st.id); localStorage.setItem("lyrics_text_style", st.id); }}
                                        style={{
                                          background: "transparent",
                                          border: "none",
                                          color: lyricsTextStyle === st.id ? "rgb(192, 132, 252)" : "rgba(255,255,255,0.5)",
                                          fontSize: "11px",
                                          fontWeight: lyricsTextStyle === st.id ? "600" : "500",
                                          padding: "5px 6px",
                                          borderRadius: "6px",
                                          textAlign: "left",
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "space-between"
                                        }}
                                      >
                                        <span style={{ flex: 1 }}>{st.label}</span>
                                        {lyricsTextStyle === st.id && <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "rgb(168, 85, 247)" }}/>}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}/>

                                <div className="lyrics-setting-item">
                                  <div className="lyrics-setting-label" style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Подсветка</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                    {[
                                      { id: "line", label: "Подсветка строки", value: lyricsHighlightLine, setter: setLyricsHighlightLine, key: "lyrics_highlight_line" },
                                      { id: "words", label: "Пословная подсветка", value: lyricsHighlightWords, setter: setLyricsHighlightWords, key: "lyrics_highlight_words" }
                                    ].map(toggle => (
                                      <div key={toggle.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                                        <span style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.6)" }}>{toggle.label}</span>
                                        <button
                                          onClick={() => {
                                            const next = !toggle.value;
                                            toggle.setter(next);
                                            localStorage.setItem(toggle.key, next.toString());
                                          }}
                                          style={{
                                            width: "36px",
                                            height: "20px",
                                            borderRadius: "10px",
                                            border: "none",
                                            padding: "2px",
                                            cursor: "pointer",
                                            background: toggle.value ? "rgb(168, 85, 247)" : "rgba(255,255,255,0.12)",
                                            transition: "background 0.2s",
                                            display: "flex",
                                            justifyContent: toggle.value ? "flex-end" : "flex-start",
                                            flexShrink: 0
                                          }}
                                        >
                                          <div style={{
                                            width: "16px",
                                            height: "16px",
                                            borderRadius: "50%",
                                            background: "#fff",
                                            transition: "transform 0.2s",
                                            boxShadow: "0 1px 3px rgba(0,0,0,0.3)"
                                          }} />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}/>

                                <div className="lyrics-setting-item">
                                  <div className="lyrics-setting-label" style={{ fontSize: "10px", fontWeight: "700", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>Синхронизация</div>
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <button 
                                      onClick={() => setLyricsOffset(o => o - 0.5)}
                                      style={{
                                        width: "26px",
                                        height: "24px",
                                        borderRadius: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        cursor: "pointer"
                                      }}
                                    >
                                      -
                                    </button>
                                    <button 
                                      onClick={() => setLyricsOffset(0)}
                                      style={{
                                        flex: 1,
                                        height: "24px",
                                        borderRadius: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        border: "none",
                                        color: "rgba(255,255,255,0.8)",
                                        fontSize: "11px",
                                        fontWeight: "500",
                                        cursor: "pointer",
                                        textAlign: "center"
                                      }}
                                      title="Сбросить сдвиг"
                                    >
                                      {lyricsOffset >= 0 ? "+" : ""}{lyricsOffset.toFixed(1)}s
                                    </button>
                                    <button 
                                      onClick={() => setLyricsOffset(o => o + 0.5)}
                                      style={{
                                        width: "26px",
                                        height: "24px",
                                        borderRadius: "6px",
                                        background: "rgba(255,255,255,0.08)",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        cursor: "pointer"
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="np-modal__lyrics-header" style={{ marginBottom: 12 }}>
                      <Radio size={15}/> <span>Похожие треки</span>
                    </div>
                  )}

                  {npTab === "lyrics" && hasLyrics && (
                    <LyricsRenderer
                      lyrics={lyrics}
                      fontSize={lyricsFontSize}
                      textStyle={lyricsTextStyle}
                      showTranslation={showTranslation}
                      isLoading={isLoadingLyrics}
                      onFindLyrics={() => fetchLyrics(currentTrack)}
                      getActiveAudio={getActiveAudio}
                      onSeek={(time) => {
                        const activeAudio = getActiveAudio();
                        if (activeAudio) {
                          activeAudio.currentTime = time;
                          setCurrentTime(time);
                          if (currentTrack) {
                            invoke("update_discord_presence", {
                              title: currentTrack.title,
                              artist: currentTrack.artist,
                              isPlaying,
                              thumbnail: currentTrack.thumbnail || "",
                              currentTime: Math.floor(time),
                              duration: Math.floor(duration || currentTrack.duration || 0)
                            }).catch((e) => console.log("Discord presence seek error", e));
                          }
                        }
                      }}
                    />
                  )}

                  {npTab === "similar" && (
                    <div className="np-similar">
                      {isLoadingSimilar && (
                        <div className="lyrics-loading">
                          <div className="lyrics-loading__dot"/><div className="lyrics-loading__dot" style={{animationDelay:".2s"}}/><div className="lyrics-loading__dot" style={{animationDelay:".4s"}}/>
                        </div>
                      )}
                      {!isLoadingSimilar && similarTracks.length === 0 && (
                        <div className="lyrics-unavailable">Нет похожих треков</div>
                      )}
                      {similarTracks.map((t, i) => (
                        <div key={`sim-${t.source}-${t.id}-${i}`} className="np-similar__item" onClick={() => { setQueue(q => { const ni = q.length; return [...q, t]; }); playTrack(t, queue.length); }}>
                          <img className="np-similar__art" src={t.thumbnail} alt="" loading="lazy" onError={e => e.target.style.opacity = "0"} />
                          <div className="np-similar__info">
                            <div className="np-similar__title">{t.title}</div>
                            <div className="np-similar__artist">{t.artist}</div>
                          </div>
                          <button className="np-similar__like" onClick={ev => { ev.stopPropagation(); toggleLike(t); }}>
                            <Heart size={14} fill={isLiked(t) ? "currentColor" : "none"} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="np-modal__actions" style={{ position: "absolute", top: 24, right: 24, display: "flex", gap: 12 }}>
                {similarTracks.length > 0 && (
                  <button className={`np-modal__action-btn ${npTab === "similar" ? "np-modal__action-btn--active" : ""}`} onClick={() => setNpTab(p => p === "similar" ? "lyrics" : "similar")} title="Похожие треки">
                    <Radio size={18}/>
                  </button>
                )}
                {!autoFetchLyrics && !hasLyrics && (
                  <button className="np-modal__action-btn" onClick={() => fetchLyrics(currentTrack)} title="Найти текст">
                    <Mic2 size={18}/>
                  </button>
                )}
                <button className="np-modal__action-btn" onClick={() => { setShowNowPlaying(false); setShowCinemaMode(true); }} title="Режим Кинотеатр"><Maximize2 size={18}/></button>
                <button className="np-modal__close" onClick={()=>setShowNowPlaying(false)} style={{ position: "static" }}><Minimize2 size={18}/></button>
              </div>
            </div>
          </div>
        );
      })()}

      {showCinemaMode && currentTrack && (
        <div className="cinema-view" onClick={() => setShowCinemaMode(false)}>
          <div className="cinema-bg" style={{ backgroundImage: `url(${currentTrack.thumbnail})` }} />
          <div className="cinema-overlay" />
          <canvas id="cinema-canvas" className="cinema-canvas" />

          <div className="cinema-content" onClick={e => e.stopPropagation()}>
            <div className={`cinema-art-wrap ${isPlaying ? "cinema-art-wrap--playing" : ""}`}>
              <img className="cinema-art" src={currentTrack.thumbnail || ""} alt="" onError={e => e.target.style.display="none"} />
            </div>

            <div className="cinema-meta">
              <h1 className="cinema-title">{currentTrack.title}</h1>
              <p className="cinema-artist">{currentTrack.artist}</p>
            </div>

            <div className="cinema-progress-row">
              <span className="cinema-time">{fmt(currentTime)}</span>
              <div className="cinema-progress" onClick={handleSeek}>
                <div className="cinema-progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <span className="cinema-time">{fmt(duration)}</span>
            </div>

            <div className="cinema-controls">
              <button className="cinema-btn" onClick={handlePrev}><SkipBack size={24} fill="currentColor"/></button>
              <button className="cinema-btn cinema-btn--play" onClick={togglePlay}>
                {isPlaying ? <Pause size={30} fill="currentColor"/> : <Play size={30} fill="currentColor"/>}
              </button>
              <button className="cinema-btn" onClick={handleNextClick}><SkipForward size={24} fill="currentColor"/></button>
            </div>

            <button className="cinema-close-btn" onClick={() => setShowCinemaMode(false)}><Minimize2 size={20}/></button>
          </div>
        </div>
      )}

      {showEqModal && (
        <div className="eq-modal" onClick={() => setShowEqModal(false)}>
          <div className="eq-modal__content liquid-glass-effect" onClick={e => e.stopPropagation()}>
            <div className="eq-modal__header">
              <Sliders size={18} style={{ marginRight: 8, opacity: 0.8 }}/>
              <h3>Equalizer Presets</h3>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setShowEqModal(false)}><X size={16}/></button>
            </div>
            
            <div className="eq-toggle-row" style={{ padding: "10px 0", borderBottom: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <input 
                type="checkbox" 
                id="eq-toggle-chk"
                checked={useEqualizer} 
                onChange={e => {
                  setUseEqualizer(e.target.checked);
                  localStorage.setItem("use_equalizer", e.target.checked.toString());
                }} 
              />
              <label htmlFor="eq-toggle-chk" style={{ fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--text-primary)" }}>Включить эквалайзер (отключите, если пропадает звук)</label>
            </div>
            
            <div className="eq-modal__presets" style={{ opacity: useEqualizer ? 1 : 0.4, pointerEvents: useEqualizer ? "auto" : "none", transition: "opacity 0.2s" }}>
              <span className="eq-label">PRESET</span>
              <div className="eq-presets-grid">
                {Object.keys(EQ_PRESETS).map(name => (
                  <button 
                    key={name} 
                    className={`eq-preset-btn ${eqPreset === name ? "eq-preset-btn--active" : ""}`}
                    onClick={() => applyEqPreset(name, EQ_PRESETS[name])}
                  >
                    {name === "BassBoost" ? "Bass Boost" : name === "VocalBoost" ? "Vocal Boost" : name}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="eq-sliders" style={{ opacity: useEqualizer ? 1 : 0.4, pointerEvents: useEqualizer ? "auto" : "none", transition: "opacity 0.2s" }}>
              {[60, 230, 910, 4000, 14000].map((freq, idx) => {
                const label = freq >= 1000 ? `${freq/1000}kHz` : `${freq}Hz`;
                const bandNames = ["Bass", "Low-Mid", "Mid", "High-Mid", "Treble"];
                return (
                  <div key={freq} className="eq-slider-col">
                    <span className="eq-slider-value">{eqGains[idx] > 0 ? `+${eqGains[idx]}` : eqGains[idx]} dB</span>
                    <input 
                      type="range" 
                      className="eq-slider" 
                      min="-12" 
                      max="12" 
                      step="1"
                      orient="vertical"
                      style={{ writingMode: "bt-lr", WebkitAppearance: "slider-vertical" }}
                      value={eqGains[idx]} 
                      onChange={e => updateEqGain(idx, parseInt(e.target.value))}
                    />
                    <span className="eq-slider-freq">{label}</span>
                    <span className="eq-slider-band">{bandNames[idx]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="layout" style={activeView === "wave" ? { gridTemplateColumns: "1fr" } : {}}>
        <aside className="sidebar glass-sidebar" style={activeView === "wave" ? { display: "none" } : {}}>
          <div className="sidebar__logo" onClick={() => handleSidebarClick("home")} style={{ cursor: "pointer" }}>
            <div className="sidebar__logo-icon" style={{ background: "none", boxShadow: "none" }}>
              <img src="/tucus_logo.png" alt="" style={{ width: "100%", height: "100%", borderRadius: 6, objectFit: "cover" }} />
            </div>
            <span className="sidebar__logo-text">tucus</span>
          </div>
          
          <div className="sidebar__services-status" style={{ display: "flex", padding: "0 16px 14px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", marginBottom: "12px", alignItems: "center" }}>
          </div>
          <nav className="sidebar__nav" style={{ marginTop: 6 }}>
            <div className="nav__section-label">Discover</div>
            <button className={`nav__item ${activeView==="home"?"nav__item--active":""}`} onClick={()=>handleSidebarClick("home")}><Home size={16}/><span>Главная</span></button>
            <button className={`nav__item ${activeView==="search"?"nav__item--active":""}`} onClick={()=>handleSidebarClick("search")}><Search size={16}/><span>Поиск</span></button>

            <button className={`nav__item ${activeView==="liked"?"nav__item--active":""}`} onClick={()=>handleSidebarClick("liked")}>
              <Heart size={16} fill={likedTracks.length>0?"currentColor":"none"}/><span>Любимые треки</span>
              {likedTracks.length>0&&<span className="nav__count">{likedTracks.length}</span>}
            </button>
            <div className="nav__section-label" style={{marginTop:16}}>Library</div>
            <button className={`nav__item ${activeView==="settings"?"nav__item--active":""}`} onClick={()=>handleSidebarClick("settings")}><Settings size={16}/><span>Settings</span></button>
          </nav>
          <div className="sidebar__playlists">
            <div className="nav__section-label">Playlists</div>
            <div className="sidebar__playlist-list">
              {Object.keys(playlists).map(name=>(
                <button key={name} className={`nav__item ${activeView==="playlist"&&activePlaylistName===name?"nav__item--active":""}`}
                  onClick={()=>handleSidebarClick("playlist", name)}>
                  <ListMusic size={14}/><span style={{flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
                  {name !== "Yandex Liked" && (
                    <Trash2 size={12} className="nav__item-delete" onClick={e=>{e.stopPropagation();deletePlaylist(name);}}/>
                  )}
                </button>
              ))}
            </div>
            <div className="sidebar__new-playlist">
              <input className="sidebar__playlist-input" type="text" placeholder="New playlist..." value={newPlaylistName}
                onChange={e=>setNewPlaylistName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&createPlaylist(newPlaylistName)} onClick={e=>e.stopPropagation()}/>
              <button className="sidebar__playlist-add" onClick={()=>createPlaylist(newPlaylistName)}><Plus size={13}/></button>
            </div>
          </div>
        </aside>

        <main className="main-content" style={activeView === "wave" ? { padding: 0, gap: 0 } : {}}>
          {viewHistory.length > 0 && activeView !== "wave" && (
            <button 
              type="button"
              className="back-btn glass-panel" 
              onClick={handleBack} 
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                color: "var(--text-secondary)",
                width: "fit-content",
                cursor: "pointer",
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-panel)",
                transition: "all 0.2s",
                alignSelf: "flex-start",
                marginBottom: 4
              }}
            >
              <ChevronLeft size={14}/>
              <span>Назад</span>
            </button>
          )}
          {(activeView==="search"||activeView==="home")&&activeView!=="wave"&&(
            <form className="search-bar" onSubmit={handleSearch}>
              <div className="search-bar__input-wrap">
                <Search size={17} className="search-bar__icon"/>
                <input className="search-bar__input" type="text" placeholder={searchMode === "lyrics" ? "Вставьте строчку из песни..." : searchMode === "mood" ? "Опишите настроение..." : "Search tracks, albums, artists..."} value={searchQuery}
                  onChange={e=>setSearchQuery(e.target.value)} onClick={e=>e.stopPropagation()}/>
                {searchQuery&&<button type="button" className="search-bar__clear" onClick={()=>setSearchQuery("")}><X size={15}/></button>}
              </div>
              <button type="submit" className="search-bar__btn" disabled={isLoading}>
                {isLoading?<div className="btn-spinner"/>:<ChevronRight size={19}/>}
              </button>
            </form>
          )}
          {activeView==="search"&&(
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="source-tabs">
                {["all","yandex","soundcloud","youtube"].map(src=>(
                  <button key={src} className={`source-tab source-tab--${src} ${searchSource===src?"source-tab--active":""}`} onClick={() => { setSearchSource(src); if (searchQuery.trim()) handleSearch(null, src); }}>
                    {src==="all"?"Все":src==="yandex"?"Яндекс":src==="soundcloud"?"SoundCloud":"YouTube Music"}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                {[
                  { id: "tracks", label: "Треки" },
                  { id: "lyrics", label: "По тексту" },
                  { id: "mood", label: "По настроению" }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => { setSearchMode(mode.id); if (searchQuery.trim()) setTimeout(() => handleSearch(null, searchSource), 0); }}
                    style={{
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "600",
                      border: "none",
                      cursor: "pointer",
                      background: searchMode === mode.id ? "rgba(168, 85, 247, 0.2)" : "rgba(255,255,255,0.04)",
                      color: searchMode === mode.id ? "rgb(192, 132, 252)" : "rgba(255,255,255,0.4)",
                      transition: "all 0.2s"
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {errorMessage&&(
            <div className="error-banner">
              <AlertCircle size={15}/><span>{errorMessage}</span>
              <button className="error-banner__close" onClick={()=>setErrorMessage("")}><X size={13}/></button>
            </div>
          )}
          {isLoading && activeView !== "home" && (
            <div className="skeleton-list">
              {Array(5).fill(0).map((_,i)=>(
                <div key={i} className="skeleton-row">
                  <div className="skeleton-box skeleton-box--sm"/><div className="skeleton-box skeleton-box--art"/>
                  <div className="skeleton-info"><div className="skeleton-line skeleton-line--title"/><div className="skeleton-line skeleton-line--artist"/></div>
                </div>
              ))}
            </div>
          )}

          {activeView==="home"&&(
            <div className="home-page">
              {/* Моя волна (My Wave) Banner — always pinned at top of home */}
              <div className="dotify-wave-banner glass-panel clickable" onClick={() => startMyWave(waveMood)} style={{ position: "relative", zIndex: 5 }}>
                <div className="dotify-wave-banner__bg">
                  <Aurora
                    colorStops={[waveAuroraColors.color1, waveAuroraColors.color2 || '#a855f7', waveAuroraColors.color1]}
                    amplitude={1.2}
                    blend={0.6}
                    speed={0.55}
                    style={{ filter: 'blur(12px) saturate(1.3)', opacity: 0.9 }}
                  />
                  <div className="dotify-wave-banner__shade" />
                </div>
                
                <div className="wave-banner-content">
                  <div style={{ display: "flex", alignItems: "center" }}>
                    {/* Outline Play icon next to text */}
                    <button className="wave-play-btn" onClick={(e) => { e.stopPropagation(); startMyWave(waveMood); }} style={{ background: "none", border: "none", color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "transform 0.2s", padding: 0 }} onMouseEnter={e=>e.target.style.transform="scale(1.08)"} onMouseLeave={e=>e.target.style.transform="none"}>
                      {isMyWaveActive && isPlaying ? <Pause size={28} color="#ffffff" strokeWidth={1.5} /> : <Play size={28} color="#ffffff" strokeWidth={1.5} fill="none" />}
                    </button>
                    
                    <span className="wave-title" style={{ fontSize: "24px", fontWeight: "700", color: "#ffffff", marginLeft: "14px" }}>Моя волна</span>
                    

                  </div>
                  
                  {/* Settings dropdown trigger */}
                  <div className="wave-settings-container" style={{ position: "relative", zIndex: 10 }} onClick={e => e.stopPropagation()}>
                    <button className="wave-settings-trigger-btn" onClick={(e) => { e.stopPropagation(); setShowWaveSettingsDropdown(p => !p); }} title="Настройки волны" style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={e=>{e.target.style.color="#ffffff"}} onMouseLeave={e=>{e.target.style.color="rgba(255,255,255,0.6)"}}>
                      <Sliders size={20} />
                    </button>

                    {showWaveSettingsDropdown && (
                      <div className="wave-settings-popup liquid-glass-effect" style={{ position: "absolute", right: "0", top: "44px", zIndex: 9999, width: "260px", padding: "16px", borderRadius: "16px", background: "rgba(10, 10, 15, 0.94)", border: "1px solid rgba(255, 255, 255, 0.08)", backdropFilter: "blur(20px)", boxShadow: "0 16px 48px rgba(0,0,0,0.6)" }} onClick={e => e.stopPropagation()}>
                        <div style={{ fontSize: "13px", fontWeight: "700", marginBottom: "12px", color: "#ffffff" }}>Настройки Моей волны</div>
                        
                        {/* Mood choice */}
                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: "600", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Настроение</div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                            {[
                              { id: "all", label: "Обычное" },
                              { id: "chill", label: "Чиловое" },
                              { id: "summer", label: "Летнее" },
                              { id: "winter", label: "Зимнее" },
                              { id: "happy", label: "Веселое" },
                              { id: "unfamiliar", label: "Незнакомое" }
                            ].map(mood => (
                              <button 
                                key={mood.id} 
                                className={`wave-popup-pill ${waveMood === mood.id ? "wave-popup-pill--active" : ""}`}
                                onClick={() => {
                                  setWaveMood(mood.id);
                                  localStorage.setItem("wave_mood", mood.id);
                                  if (isMyWaveActive) {
                                    setTimeout(() => startMyWave(mood.id), 50);
                                  }
                                }}
                                style={{
                                  padding: "6px",
                                  fontSize: "11.5px",
                                  fontWeight: "500",
                                  borderRadius: "8px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: waveMood === mood.id ? "#ffffff" : "rgba(255,255,255,0.05)",
                                  color: waveMood === mood.id ? "#000000" : "rgba(255,255,255,0.7)",
                                  transition: "all 0.2s"
                                }}
                              >
                                {mood.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Algorithm choice */}
                        <div style={{ marginBottom: "4px" }}>
                          <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)", fontWeight: "600", textTransform: "uppercase", marginBottom: "8px", letterSpacing: "0.5px" }}>Алгоритм</div>
                          <div style={{ display: "flex", gap: "6px" }}>
                            {[
                              { id: "old", label: "Старый" },
                              { id: "new", label: "Новый" }
                            ].map(algo => (
                              <button 
                                key={algo.id} 
                                className={`wave-popup-pill ${waveAlgorithm === algo.id ? "wave-popup-pill--active" : ""}`}
                                onClick={() => {
                                  setWaveAlgorithm(algo.id);
                                  localStorage.setItem("wave_algorithm", algo.id);
                                }}
                                style={{
                                  flex: 1,
                                  padding: "6px",
                                  fontSize: "11.5px",
                                  fontWeight: "500",
                                  borderRadius: "8px",
                                  border: "none",
                                  cursor: "pointer",
                                  background: waveAlgorithm === algo.id ? "#ffffff" : "rgba(255,255,255,0.05)",
                                  color: waveAlgorithm === algo.id ? "#000000" : "rgba(255,255,255,0.7)",
                                  transition: "all 0.2s"
                                }}
                              >
                                {algo.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>)}
                  </div>
                </div>
              </div>


              {isLoading ? (
                <div className="skeleton-list">
                  {Array(5).fill(0).map((_,i)=>(
                    <div key={i} className="skeleton-row">
                      <div className="skeleton-box skeleton-box--sm"/><div className="skeleton-box skeleton-box--art"/>
                      <div className="skeleton-info"><div className="skeleton-line skeleton-line--title"/><div className="skeleton-line skeleton-line--artist"/></div>
                    </div>
                  ))}
                </div>
              ) : (
              <div ref={homeViewRef} className="home-view">
              {/* Two Column Grid: История & Любимые треки */}
              <div className="dotify-split-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "24px" }}>
                {/* История */}
                <div 
                  className="dotify-history-card glass-panel clickable" 
                  onClick={() => { if (recentlyPlayed.length > 0) playTrack(recentlyPlayed[0]); }}
                  style={{ position: "relative", height: "96px", borderRadius: "16px", overflow: "hidden", display: "flex", alignItems: "center", padding: "16px 20px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s" }}
                >
                  <div className="card-covers-collage" style={{ display: "flex", position: "relative", width: "64px", height: "64px", flexShrink: 0, marginRight: "16px" }}>
                    {recentlyPlayed.slice(0, 3).map((t, idx) => (
                      <img 
                        key={t.id} 
                        src={t.thumbnail} 
                        alt="" 
                        style={{ 
                          position: "absolute", 
                          width: "48px", 
                          height: "48px", 
                          borderRadius: "8px", 
                          border: "1.5px solid #111115",
                          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                          left: idx * 8, 
                          top: idx * 8, 
                          zIndex: 10 - idx 
                        }} 
                        onError={e=>{ e.target.onerror = null; e.target.src="/tucus_logo.png"; }}
                      />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff" }}>История</div>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.55)", marginTop: "3px" }}>Ваши недавно прослушанные треки</div>
                  </div>
                </div>

                {/* Любимые треки */}
                <div 
                  className="dotify-favorites-card glass-panel clickable" 
                  onClick={() => handleSidebarClick("liked")}
                  style={{ position: "relative", height: "96px", borderRadius: "16px", overflow: "hidden", display: "flex", alignItems: "center", padding: "16px 20px", cursor: "pointer", border: "1px solid rgba(255,255,255,0.06)", transition: "all 0.2s" }}
                >
                  <div className="card-covers-collage" style={{ display: "flex", position: "relative", width: "64px", height: "64px", flexShrink: 0, marginRight: "16px" }}>
                    {likedTracks.slice(0, 3).map((t, idx) => (
                      <img 
                        key={t.id} 
                        src={t.thumbnail} 
                        alt="" 
                        style={{ 
                          position: "absolute", 
                          width: "48px", 
                          height: "48px", 
                          borderRadius: "8px", 
                          border: "1.5px solid #111115",
                          boxShadow: "0 4px 10px rgba(0,0,0,0.5)",
                          left: idx * 8, 
                          top: idx * 8, 
                          zIndex: 10 - idx 
                        }} 
                        onError={e=>{ e.target.onerror = null; e.target.src="/tucus_logo.png"; }}
                      />
                    ))}
                  </div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#ffffff" }}>Любимые треки</div>
                    <div style={{ fontSize: "11.5px", color: "rgba(255,255,255,0.55)", marginTop: "3px" }}>Ваша коллекция любимой музыки</div>
                  </div>
                </div>
              </div>

              {/* Популярное — персонализированные треки по жанрам */}
              <HorizontalSection
                title="Популярное"
                icon={<TrendingUp size={16}/>}
                tracks={soundcloudPopularTracks}
                onTrackClick={(t) => playTrack(t)}
              />

              {/* Чарт Яндекс Музыки */}
              {yandexToken && chartTracks.length > 0 && (
                <HorizontalSection
                  title="Чарт Яндекс Музыки"
                  icon={<TrendingUp size={16}/>}
                  tracks={chartTracks.slice(0, 10)}
                  onTrackClick={(t) => playTrack(t)}
                  onSeeAll={() => setActiveView("chart")}
                />
              )}

              {/* Новинки — новые релизы */}
              {yandexToken && newReleases.length > 0 && (
                <div className="home-section" style={{ marginBottom: 24 }}>
                  <div className="home-section__header" style={{ marginBottom: 14, display: "flex", alignItems: "center", gap: 8 }}>
                    <Music size={16}/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Новинки</span>
                  </div>
                  <div className="horizontal-scroll-row" style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 12 }}>
                    {newReleases.slice(0, 10).map((album, idx) => (
                      <div
                        key={`release-${album.id}-${idx}`}
                        className="track-card"
                        onClick={() => openAlbum(album)}
                        style={{ minWidth: 165, maxWidth: 165, flexShrink: 0, cursor: "pointer" }}
                      >
                        <div style={{ position: "relative", borderRadius: 12, overflow: "hidden", aspectRatio: "1/1" }}>
                          <img
                            src={album.thumbnail || ""}
                            alt=""
                            loading="lazy"
                            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                            onError={e => { e.target.onerror = null; e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Crect fill='%231a1a2e' width='200' height='200'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%23555' font-size='14'%3E♪%3C/text%3E%3C/svg%3E"; }}
                          />
                          <span style={{
                            position: "absolute", bottom: 8, right: 8,
                            background: "#FFCC00", color: "#000",
                            padding: "3px 6px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                            boxShadow: "0 2px 6px rgba(0,0,0,0.4)",
                          }}>Альбом</span>
                        </div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, marginTop: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                          {album.title || "Unknown"}
                        </div>
                        <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-primary)" }}>
                          {album.artist || ""} {album.year ? `· ${album.year}` : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Похожее — персонализированные рекомендации */}
              {homeRecommendations?.similarTracks?.length > 0 && (
                <HorizontalSection
                  title="Похожее на ваш вкус"
                  icon={<Heart size={16}/>}
                  tracks={homeRecommendations.similarTracks.slice(0, 12)}
                  onTrackClick={(t) => playTrack(t)}
                />
              )}

              {/* Из ваших жанров — треки по жанровым предпочтениям */}
              {homeRecommendations?.genreTracks?.map((genreGroup, idx) => (
                genreGroup.tracks.length > 0 && (
                  <HorizontalSection
                    key={`genre-${genreGroup.genre}-${idx}`}
                    title={genreGroup.genre.charAt(0).toUpperCase() + genreGroup.genre.slice(1)}
                    icon={<Radio size={16}/>}
                    tracks={genreGroup.tracks}
                    onTrackClick={(t) => playTrack(t)}
                  />
                )
              ))}

              {/* Недавно прослушано */}
              {homeRecent.length > 0 && (
                <div className="home-section">
                  <div className="home-section__header" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Clock size={14}/>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>Недавно прослушано</span>
                  </div>
                  <div className="track-list">
                    {homeRecent.slice(0, 10).map((t, i) => renderTrackRow(t, i, { key: `r-home-${t.source}-${t.id}-${i}` }))}
                  </div>
                </div>
              )}

              {/* Кнопка обновления */}
              <div style={{ textAlign: "center", marginTop: 8, marginBottom: 24 }}>
                <button
                  onClick={() => loadHomeData()}
                  disabled={isLoadingRecommendations}
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    color: "rgba(255,255,255,0.6)",
                    padding: "8px 20px",
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    opacity: isLoadingRecommendations ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { e.target.style.background = "rgba(255,255,255,0.1)"; e.target.style.color = "#fff"; }}
                  onMouseLeave={e => { e.target.style.background = "rgba(255,255,255,0.05)"; e.target.style.color = "rgba(255,255,255,0.6)"; }}
                >
                  {isLoadingRecommendations ? "Загрузка..." : "Обновить рекомендации"}
                </button>
              </div>
              </div>
              )}
            </div>
          )}

          {activeView==="chart"&&!isLoading&&(
            <div>
              <div className="view-header">
                <div className="view-header__icon"><TrendingUp size={26}/></div>
                <div>
                  <div className="view-header__title">Russian Top Chart</div>
                  <div className="view-header__sub">{chartTracks.length} tracks updated hourly</div>
                </div>
                <div className="view-header__btns">
                  {chartTracks.length > 0 && (
                    <button className="play-all-btn" onClick={() => { setQueue(chartTracks); playTrack(chartTracks[0], 0); }}>
                      <Play size={14} fill="currentColor"/> Play All
                    </button>
                  )}
                </div>
              </div>
              <div className="track-list">
                {chartTracks.map((t, i) => renderTrackRow(t, i, { key: `fullchart-${t.source}-${t.id}-${i}` }))}
              </div>
            </div>
          )}

          {activeView==="search"&&!isLoading&&(
            <div className="search-results-view">
              {searchSource === "yandex" || (searchSource === "all" && getCleanYandexToken()) ? (
                <div className="search-subtabs">
                  <button className={`search-subtab ${searchSubTab==="tracks"?"search-subtab--active":""}`} onClick={() => setSearchSubTab("tracks")}>Tracks ({searchTracks.length})</button>
                  <button className={`search-subtab ${searchSubTab==="albums"?"search-subtab--active":""}`} onClick={() => setSearchSubTab("albums")}>Albums ({searchAlbums.length})</button>
                  <button className={`search-subtab ${searchSubTab==="artists"?"search-subtab--active":""}`} onClick={() => setSearchSubTab("artists")}>Artists ({searchArtists.length})</button>
                </div>
              ) : null}

              {searchSubTab === "tracks" && (
                <div className="track-list">
                  {searchTracks.length>0?searchTracks.map((t,i)=>renderTrackRow(t,i,{key:`s-${t.source}-${t.id}-${i}`})):(
                    <div className="empty-state"><Search size={40} className="empty-state__icon"/><div className="empty-state__title">Search for music</div><div className="empty-state__sub">Try Yandex, SoundCloud, or YouTube Music</div></div>
                  )}
                </div>
              )}

              {searchSubTab === "albums" && (
                <div className="albums-grid">
                  {searchAlbums.length>0 ? searchAlbums.map(album => (
                    <div key={album.id} className="album-card" onClick={() => openAlbum(album)}>
                      <img className="album-card__art" src={album.thumbnail} alt={album.title} loading="lazy" />
                      <div className="album-card__info">
                        <div className="album-card__title">{album.title}</div>
                        <div className="album-card__artist">{album.artist}</div>
                        <div className="album-card__meta">{album.trackCount} tracks {album.year ? `· ${album.year}` : ""}</div>
                      </div>
                    </div>
                  )) : (
                    <div className="empty-state"><Disc size={40} className="empty-state__icon"/><div className="empty-state__title">No albums found</div></div>
                  )}
                </div>
              )}

              {searchSubTab === "artists" && (
                <div className="artists-grid">
                  {searchArtists.length>0 ? searchArtists.map(artist => (
                    <div key={artist.id} className="artist-card" onClick={() => openArtist(artist.id, artist.name)}>
                      <img className="artist-card__art" src={artist.thumbnail || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23222' width='100' height='100'/%3E%3C/svg%3E"} alt={artist.name} loading="lazy" />
                      <div className="artist-card__name">{artist.name}</div>
                      {artist.genres && artist.genres.length > 0 && (
                        <div className="artist-card__genres">{artist.genres.slice(0, 2).join(", ")}</div>
                      )}
                    </div>
                  )) : (
                    <div className="empty-state"><User size={40} className="empty-state__icon"/><div className="empty-state__title">No artists found</div></div>
                  )}
                </div>
              )}
            </div>
          )}

          {activeView==="album" && (
            <div className="album-detail-view">
              {activeAlbum && (
                <>
                  <div className="view-header">
                    <img className="album-detail__art" src={activeAlbum.thumbnail} alt={activeAlbum.title} />
                    <div className="album-detail__info">
                      <div className="album-detail__tag">ALBUM</div>
                      <h2 className="album-detail__title">{activeAlbum.title}</h2>
                      <div className="album-detail__artist" style={{ cursor: "pointer", textDecoration: "underline" }} onClick={(e) => {
                        e.stopPropagation();
                        if (activeAlbum.artistId) {
                          openArtist(activeAlbum.artistId, activeAlbum.artist);
                        } else {
                          console.log("No artist ID for this album");
                        }
                      }}>{activeAlbum.artist}</div>
                      <div className="album-detail__meta">{activeAlbumTracks.length} songs {activeAlbum.year ? `· ${activeAlbum.year}` : ""}</div>
                      {activeAlbumTracks.length > 0 && (
                        <button className="play-all-btn" style={{ marginTop: 12 }} onClick={() => { setQueue(activeAlbumTracks); playTrack(activeAlbumTracks[0], 0); }}>
                          <Play size={14} fill="currentColor"/> Play Album
                        </button>
                      )}
                    </div>
                  </div>
                  {isLoadingAlbum ? (
                    <div className="skeleton-list">
                      {Array(3).fill(0).map((_,i)=>(
                        <div key={i} className="skeleton-row">
                          <div className="skeleton-box skeleton-box--sm"/><div className="skeleton-box skeleton-box--art"/>
                          <div className="skeleton-info"><div className="skeleton-line skeleton-line--title"/><div className="skeleton-line skeleton-line--artist"/></div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="playlist-search-wrap">
                        <Search size={14} className="playlist-search-icon" />
                        <input
                          className="playlist-search-input"
                          type="text"
                          placeholder="Search tracks..."
                          value={playlistSearch}
                          onChange={e => setPlaylistSearch(e.target.value)}
                          onClick={e => e.stopPropagation()}
                        />
                        {playlistSearch && <button className="playlist-search-clear" onClick={() => setPlaylistSearch("")}><X size={12}/></button>}
                      </div>
                      <div className="track-list">
                        {activeAlbumTracks.filter(t => !playlistSearch || t.title?.toLowerCase().includes(playlistSearch.toLowerCase()) || t.artist?.toLowerCase().includes(playlistSearch.toLowerCase())).map((t, i) => {
                          const globalIdx = activeAlbumTracks.findIndex(at => at.id === t.id && at.source === t.source);
                          return renderTrackRow(t, i, { key: `al-${t.source}-${t.id}-${i}`, playTrack: (trk) => { setQueue(activeAlbumTracks); playTrack(trk, globalIdx); } });
                        })}
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeView==="artist" && (
            <div className="artist-detail-view">
              {activeArtist && (
                <>
                  {isLoadingArtist ? (
                    <div className="skeleton-list">
                      <div className="skeleton-row"><div className="skeleton-box skeleton-box--art" style={{ width: 80, height: 80, borderRadius: "50%" }}/><div className="skeleton-info"><div className="skeleton-line skeleton-line--title"/><div className="skeleton-line skeleton-line--artist"/></div></div>
                    </div>
                  ) : !activeArtistBrief ? (
                    <div className="empty-state">
                      <User size={40} className="empty-state__icon"/>
                      <div className="empty-state__title">Could not load artist</div>
                      <div className="empty-state__sub">Check your Yandex Music token in Settings</div>
                    </div>
                  ) : (
                    <>
                      <div className="view-header">
                        {activeArtistBrief.artist.thumbnail ? (
                          <img className="artist-detail__art" src={activeArtistBrief.artist.thumbnail} alt={activeArtistBrief.artist.name}
                            onError={e => { e.target.style.display = "none"; }} />
                        ) : (
                          <div className="artist-detail__art" style={{ display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-card)", borderRadius: "50%" }}>
                            <User size={48} style={{ opacity: 0.3 }} />
                          </div>
                        )}
                        <div className="artist-detail__info">
                          <div className="artist-detail__tag">
                            {activeArtist?.source === "soundcloud" ? "SOUNDCLOUD ARTIST" : "ARTIST"}
                          </div>
                          <h2 className="artist-detail__name">{activeArtistBrief.artist.name}</h2>
                          {activeArtistBrief.artist.genres && activeArtistBrief.artist.genres.length > 0 && (
                            <div className="artist-detail__genres">{activeArtistBrief.artist.genres.join(" · ")}</div>
                          )}
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                            {activeArtistBrief.tracks?.length || 0} tracks
                          </div>
                        </div>
                      </div>

                      {activeArtistBrief.tracks && activeArtistBrief.tracks.length > 0 && (
                        <div className="home-section" style={{ marginBottom: 24 }}>
                          <div className="home-section__header"><span>Popular Tracks</span></div>
                          <div className="track-list">
                            {activeArtistBrief.tracks.map((t, i) => renderTrackRow(t, i, { key: `arttr-${t.source}-${t.id}-${i}` }))}
                          </div>
                        </div>
                      )}

                      {activeArtistBrief.albums && activeArtistBrief.albums.length > 0 && (
                        <div className="home-section">
                          <div className="home-section__header"><span>Albums & EPs</span></div>
                          <div className="releases-grid">
                            {activeArtistBrief.albums.map(album => (
                              <div key={album.id} className="release-card" onClick={() => openAlbum(album)}>
                                <img className="release-card__art" src={album.thumbnail} alt={album.title} loading="lazy" />
                                <div className="release-card__title">{album.title}</div>
                                <div className="release-card__artist">{album.artist}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {activeView==="liked"&&!isLoading&&(
            <div>
              <div className="view-header">
                <div className="view-header__icon view-header__icon--heart"><Heart size={26} fill="currentColor"/></div>
                <div><div className="view-header__title">Liked Songs</div><div className="view-header__sub">{likedTracks.length} tracks</div></div>
                {likedTracks.length>0&&<button className="play-all-btn" onClick={()=>{setQueue(likedTracks);playTrack(likedTracks[0],0);}}><Play size={14} fill="currentColor"/> Play All</button>}
              </div>
              {likedTracks.length===0
                ?<div className="empty-state"><Heart size={40} className="empty-state__icon"/><div className="empty-state__title">No liked songs</div><div className="empty-state__sub">Press heart on any track</div></div>
                :<div className="track-list">{likedTracks.map((t,i)=>renderTrackRow(t,i,{key:`l-${t.source}-${t.id}-${i}`, showRemove: true, onRemove: () => toggleLike(t)}))}</div>
              }
            </div>
          )}

          {activeView==="playlist"&&activePlaylistName&&!isLoading&&(
            <div>
              <div className="view-header">
                <div className="view-header__icon"><ListMusic size={26}/></div>
                <div><div className="view-header__title">{activePlaylistName}</div><div className="view-header__sub">{(playlists[activePlaylistName]||[]).length} tracks</div></div>
                <div className="view-header__btns">
                  {(playlists[activePlaylistName]||[]).length>0&&<button className="play-all-btn" onClick={()=>{ try { playPlaylist(activePlaylistName); } catch(e) { console.error(e); } }}><Play size={14} fill="currentColor"/> Play All</button>}
                  {activePlaylistName !== "Yandex Liked" && (
                    <button className="delete-btn" onClick={()=>deletePlaylist(activePlaylistName)}><Trash2 size={14}/> Delete</button>
                  )}
                </div>
              </div>
              <div className="playlist-search-wrap">
                <Search size={14} className="playlist-search-icon" />
                <input
                  className="playlist-search-input"
                  type="text"
                  placeholder="Search in playlist..."
                  value={playlistSearch}
                  onChange={e => setPlaylistSearch(e.target.value)}
                  onClick={e => e.stopPropagation()}
                />
                {playlistSearch && <button className="playlist-search-clear" onClick={() => setPlaylistSearch("")}><X size={12}/></button>}
              </div>
              {(playlists[activePlaylistName]||[]).length===0
                ?<div className="empty-state"><ListMusic size={40} className="empty-state__icon"/><div className="empty-state__title">Empty playlist</div><div className="empty-state__sub">Add tracks using folder icon in search</div></div>
                :<div className="track-list">{(playlists[activePlaylistName]||[]).filter(t => t && t.id && t.source).filter(t => !playlistSearch || (t.title||"").toLowerCase().includes(playlistSearch.toLowerCase()) || (t.artist||"").toLowerCase().includes(playlistSearch.toLowerCase())).map((t,i) => {
                          const playlistTracks = (playlists[activePlaylistName]||[]).filter(t2 => t2 && t2.id && t2.source);
                          const globalIdx = playlistTracks.findIndex(pt => pt.id === t.id && pt.source === t.source);
                          return renderTrackRow(t,i,{key:`p-${String(t.source)}-${String(t.id)}-${i}`, showRemove: activePlaylistName !== "Yandex Liked", onRemove: () => removeFromPlaylist(activePlaylistName,t.id,t.source), playTrack: (trk) => { setQueue(playlistTracks); playTrack(trk, globalIdx); }});
                        })}</div>
              }
            </div>
          )}

          {activeView==="wave"&&!isLoading&&(
            <WaveView
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              isTrackLoading={isTrackLoading}
              currentTime={currentTime}
              duration={duration}
              pct={pct}
              lyrics={lyrics}
              lyricsOffset={lyricsOffset}
              lyricsFontSize={lyricsFontSize}
              lyricsTextStyle={lyricsTextStyle}
              showTranslation={showTranslation}
              isLoadingLyrics={isLoadingLyrics}
              isLiked={isLiked}
              togglePlay={togglePlay}
              handlePrev={handlePrev}
              handleNextClick={handleNextClick}
              handleSeek={handleSeek}
              toggleLike={toggleLike}
              toggleDislike={toggleDislike}
              setShowTranslation={setShowTranslation}
              fetchLyrics={fetchLyrics}
              getActiveAudio={getActiveAudio}
              setCurrentTime={setCurrentTime}
              onExit={exitMyWave}
            />
          )}

          {activeView==="settings"&&(
            <div className="settings-view">
              <div className="settings-view__header"><Settings size={22}/><h2>Настройки</h2></div>
              <div className="settings-container">
                <div className="settings-sidebar">
                  <div className="settings-sec-group">
                    <div className="settings-sec-title">ОСНОВНЫЕ</div>
                    <div className={`settings-sidebar-item ${settingsSubTab === "yandex" ? "active" : ""}`} onClick={() => setSettingsSubTab("yandex")}>
                      <Radio size={14}/> <span>Яндекс Музыка</span>
                    </div>
                    <div className={`settings-sidebar-item ${settingsSubTab === "other-services" ? "active" : ""}`} onClick={() => setSettingsSubTab("other-services")}>
                      <Layers size={14}/> <span>YouTube & SoundCloud</span>
                    </div>
                    <div className={`settings-sidebar-item ${settingsSubTab === "shortcuts" ? "active" : ""}`} onClick={() => setSettingsSubTab("shortcuts")}>
                      <Keyboard size={14}/> <span>Горячие клавиши</span>
                    </div>
                  </div>

                  <div className="settings-sec-group">
                    <div className="settings-sec-title">ОФОРМЛЕНИЕ</div>
                    <div className={`settings-sidebar-item ${settingsSubTab === "appearance" ? "active" : ""}`} onClick={() => setSettingsSubTab("appearance")}>
                      <Palette size={14}/> <span>Интерфейс и тема</span>
                    </div>
                  </div>

                  <div className="settings-sec-group">
                    <div className="settings-sec-title">ИНТЕГРАЦИИ</div>
                    <div className={`settings-sidebar-item ${settingsSubTab === "integrations" ? "active" : ""}`} onClick={() => setSettingsSubTab("integrations")}>
                      <Share2 size={14}/> <span>Интеграции и бэкапы</span>
                    </div>
                  </div>
                </div>

                <div className="settings-content">
                  {settingsSubTab === "yandex" && (
                    <div className="settings-card">
                      <div className="settings-card__title">Яндекс Музыка</div>
                      <p className="settings-card__desc">Свяжите свой аккаунт для синхронизации лайков, загрузки плейлистов и рекомендаций Моей Волны.</p>
                      <button className="settings-guide-btn" onClick={()=>setShowYandexGuide(p=>!p)} style={{ marginBottom: 12 }}>
                        {showYandexGuide ? "Скрыть инструкцию" : "Как получить токен?"}
                      </button>
                      {showYandexGuide && (
                        <div className="guide-box" style={{ marginBottom: 16 }}>
                          <ol>
                            <li>Авторизуйтесь на <strong>music.yandex.ru</strong></li>
                            <li>Нажмите кнопку ниже для автоматического забора токена, либо вставьте токен вручную.</li>
                            <li>Ссылка для ручной авторизации: <code style={{fontSize:10,wordBreak:"break-all"}}>https://oauth.yandex.ru/authorize?response_type=token&client_id=23cabbbdc6cd418abb4b39c32c41195d</code></li>
                          </ol>
                        </div>
                      )}
                      <div className="settings-yandex-row" style={{ display: "flex", gap: 10, marginTop: 8 }}>
                        <input className="settings-input" style={{ flex: 1 }} type="password" placeholder="Вставьте токен или URL перенаправления..." value={yandexToken} onChange={e=>setYandexToken(e.target.value)} onClick={e=>e.stopPropagation()}/>
                        <button type="button" className="save-btn" style={{ whiteSpace: "nowrap", background: "#f5c400", color: "#000", fontWeight: "600", padding: "0 16px" }} onClick={() => invoke("start_yandex_oauth").catch(e => setErrorMessage(e.toString()))}>
                          Авто-вход
                        </button>
                      </div>
                      {yandexToken && <div className="settings-status settings-status--ok" style={{ marginTop: 12 }}>✓ Подключено</div>}
                    </div>
                  )}

                  {settingsSubTab === "other-services" && (
                    <div className="settings-card">
                      <div className="settings-card__title">Управление сервисами</div>
                      <p className="settings-card__desc">Активированные стриминговые платформы в вашей системе.</p>
                      <div className="services-status-list">
                        <div className="service-status-item">
                          <div className="service-info">
                            <span className="dot active"></span>
                            <span className="name">YouTube Music (через Android API)</span>
                          </div>
                          <span className="badge">Встроенный обход блокировок</span>
                        </div>
                        <div className="service-status-item">
                          <div className="service-info">
                            <span className="dot active"></span>
                            <span className="name">SoundCloud API</span>
                          </div>
                          <span className="badge">Активен</span>
                        </div>
                      </div>

                      <div className="settings-option-toggle" style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="toggle-text">
                          <div className="toggle-title">Автопоиск текста песен</div>
                          <div className="toggle-sub">Автоматически запрашивать слова трека при открытии экрана плеера. При отключении плеер будет запускаться в лаконичном режиме по центру без лишней сетевой нагрузки.</div>
                        </div>
                        <input type="checkbox" className="settings-checkbox" checked={autoFetchLyrics} onChange={e=>setAutoFetchLyrics(e.target.checked)}/>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === "shortcuts" && (
                    <div className="settings-card">
                      <div className="settings-card__title">Горячие клавиши</div>
                      <p className="settings-card__desc">Быстрое управление воспроизведением с клавиатуры.</p>
                      <div className="shortcuts-grid">
                        <div className="shortcut"><kbd>Пробел</kbd><span>Воспроизведение / Пауза</span></div>
                        <div className="shortcut"><kbd>→</kbd><span>Следующий трек</span></div>
                        <div className="shortcut"><kbd>←</kbd><span>Предыдущий трек / С начала</span></div>
                        <div className="shortcut"><kbd>M</kbd><span>Выключить звук</span></div>
                        <div className="shortcut"><kbd>L</kbd><span>Лайкнуть текущий трек</span></div>
                        <div className="shortcut"><kbd>Esc</kbd><span>Закрыть экран плеера</span></div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === "appearance" && (
                    <div className="settings-card">
                      <div className="settings-card__title">Внешний вид</div>
                      <p className="settings-card__desc">Выберите цветовую тему оформления интерфейса Tucus.</p>
                      <div className="theme-grid">
                        <div className={`theme-card ${theme==="dark"?"theme-card--active":""}`} onClick={()=>setTheme("dark")}>
                          <div className="theme-card__preview" style={{ background: "#08080c" }}/>
                          <div className="theme-card__name">Тёмная (Рекомендуется)</div>
                        </div>
                        <div className={`theme-card ${theme==="light"?"theme-card--active":""}`} onClick={()=>setTheme("light")}>
                          <div className="theme-card__preview" style={{ background: "#f3f4f8", border: "1px solid rgba(0,0,0,0.08)" }}/>
                          <div className="theme-card__name">Светлая</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsSubTab === "integrations" && (
                    <div className="settings-card">
                      <div className="settings-card__title">Интеграции</div>
                      
                      <div className="settings-option-toggle">
                        <div className="toggle-text">
                          <div className="toggle-title">Discord Rich Presence</div>
                          <div className="toggle-sub">Транслировать название текущего трека в ваш игровой статус Discord.</div>
                        </div>
                        <input type="checkbox" className="settings-checkbox" checked={discordRpcEnabled} onChange={e=>setDiscordRpcEnabled(e.target.checked)}/>
                      </div>

                      <div className="settings-option-field" style={{ marginTop: 20 }}>
                        <div className="field-text">
                          <div className="toggle-title">Настройки прокси / Zapret</div>
                          <div className="toggle-sub">Настройте обход замедления YouTube и SoundCloud на территории РФ. Встроенная технология Zapret активна по умолчанию для YouTube.</div>
                        </div>
                        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                          <span className="dot active" style={{ marginTop: 10 }}></span>
                          <span style={{ fontSize: 12, opacity: 0.8 }}>Zapret: <strong>Активен</strong> (Автообход замедления YouTube)</span>
                        </div>
                        <input className="settings-input" style={{ marginTop: 12 }} type="text" placeholder="http://127.0.0.1:8080 (Альтернативный прокси-сервер)..." value={proxyServer} onChange={e=>setProxyServer(e.target.value)} onClick={e=>e.stopPropagation()}/>
                      </div>

                      <div className="settings-card__title" style={{ marginTop: 32, fontSize: 13, textTransform: "uppercase", letterSpacing: 0.5 }}>Резервное копирование</div>
                      <p className="settings-card__desc" style={{ marginTop: 4 }}>Сохраняйте и переносите вашу историю, лайки и плейлисты.</p>
                      <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                        <button type="button" className="save-btn" onClick={handleExportData} style={{ background: "rgba(139, 92, 246, 0.25)", color: "var(--accent)", border: "1px solid rgba(139, 92, 246, 0.35)", padding: "8px 16px", borderRadius: 10 }}>
                          Экспортировать
                        </button>
                        <label className="save-btn" style={{ cursor: "pointer", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", padding: "8px 16px", display: "flex", alignItems: "center", borderRadius: "10px", fontSize: "12px", fontWeight: "600" }}>
                          Импортировать
                          <input type="file" accept=".json" onChange={handleImportData} style={{ display: "none" }} />
                        </label>
                      </div>
                    </div>
                  )}

                  <div className="settings-actions-footer" style={{ marginTop: 32, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "flex-end" }}>
                    <button id="save-btn" className="save-btn" onClick={saveSettings} style={{ background: "#ffffff", color: "#000000", padding: "10px 24px", fontSize: 13, fontWeight: "600", borderRadius: 10 }}>
                      Сохранить настройки
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === "recap" && (() => {
            const artistCounts = playHistory.reduce((acc, h) => {
              acc[h.artist] = (acc[h.artist] || 0) + 1;
              return acc;
            }, {});
            const topArtists = Object.entries(artistCounts)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5);

            const trackCounts = playHistory.reduce((acc, h) => {
              const key = `${h.source}:${h.id}`;
              if (!acc[key]) acc[key] = { title: h.title, artist: h.artist, thumbnail: h.thumbnail, count: 0 };
              acc[key].count++;
              return acc;
            }, {});
            const topTracks = Object.values(trackCounts)
              .sort((a, b) => b.count - a.count)
              .slice(0, 5);

            const totalPlays = playHistory.length;
            const yandexPlays = playHistory.filter(h => h.source === "yandex").length;
            const scPlays = playHistory.filter(h => h.source === "soundcloud").length;

            return (
              <div className="recap-view">
                <div className="view-header">
                  <div className="view-header__icon" style={{ background: "rgba(139, 92, 246, 0.15)", color: "var(--accent)" }}><TrendingUp size={26}/></div>
                  <div>
                    <h2 className="view-header__title">Tucus Recap</h2>
                    <div className="view-header__sub">Ваша музыкальная статистика прослушиваний</div>
                  </div>
                </div>

                {totalPlays === 0 ? (
                  <div className="empty-state">
                    <Music size={40} className="empty-state__icon" />
                    <div className="empty-state__title">История пуста</div>
                    <div className="empty-state__sub">Слушайте больше треков, чтобы увидеть здесь свою статистику!</div>
                  </div>
                ) : (
                  <div className="recap-grid">
                    {/* General Summary */}
                    <div className="recap-card recap-card--full liquid-glass-effect">
                      <div className="recap-card__val">{totalPlays}</div>
                      <div className="recap-card__lbl">Всего прослушано треков</div>
                      <div className="recap-sources">
                        <div className="recap-source">
                          <span className="recap-source__dot recap-source__dot--yandex" />
                          <span>Яндекс.Музыка: <strong>{yandexPlays}</strong> ({Math.round(yandexPlays / totalPlays * 100)}%)</span>
                        </div>
                        <div className="recap-source">
                          <span className="recap-source__dot recap-source__dot--sc" />
                          <span>SoundCloud: <strong>{scPlays}</strong> ({Math.round(scPlays / totalPlays * 100)}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Top Artists */}
                    <div className="recap-card liquid-glass-effect">
                      <h3>Топ Исполнители</h3>
                      <div className="recap-list">
                        {topArtists.map(([name, count], idx) => (
                          <div key={name} className="recap-list-item">
                            <span className="recap-rank">#{idx + 1}</span>
                            <div className="recap-list-item__info">
                              <div className="recap-list-item__title">{name}</div>
                              <div className="recap-list-item__sub">{count} воспроизведений</div>
                            </div>
                            <div className="recap-bar" style={{ width: `${Math.round(count / topArtists[0][1] * 100)}%` }} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Tracks */}
                    <div className="recap-card liquid-glass-effect">
                      <h3>Топ Треки</h3>
                      <div className="recap-list">
                        {topTracks.map((item, idx) => (
                          <div key={idx} className="recap-list-item">
                            <span className="recap-rank">#{idx + 1}</span>
                            {item.thumbnail && <img className="recap-list-item__art" src={item.thumbnail} alt="" onError={e => e.target.style.display="none"} />}
                            <div className="recap-list-item__info">
                              <div className="recap-list-item__title">{item.title}</div>
                              <div className="recap-list-item__sub">{item.artist} · {item.count} раз</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </main>

        {showQueue&&(
          <aside className="queue-panel">
            <div className="queue-panel__header">
              <List size={15}/>
              <span style={{ flex: 1, marginLeft: 8 }}>Queue ({queue.length})</span>
              {queue.length > 0 && (
                <button className="clear-queue-btn" onClick={clearQueue}>Clear</button>
              )}
              <button className="icon-btn" onClick={()=>setShowQueue(false)}><X size={15}/></button>
            </div>
            <div className="queue-panel__list">
              {queue.length===0?<div className="empty-state" style={{padding:"40px 0"}}><ListMusic size={30} className="empty-state__icon"/><div className="empty-state__sub">Queue is empty</div></div>
                :queue.map((t,i)=>(
                  <div key={`q-${t.source}-${t.id}-${i}`} className={`queue-item ${i===queueIndex?"queue-item--active":""}`} onClick={()=>playTrack(t,i)}>
                    <img className="queue-item__art" src={t.thumbnail||""} alt="" onError={e=>e.target.style.display="none"}/>
                    <div className="queue-item__info"><div className="queue-item__title">{t.title}</div><div className="queue-item__artist">{t.artist}</div></div>
                    <button className="icon-btn" onClick={e=>{e.stopPropagation();const nq=queue.filter((_,j)=>j!==i);setQueue(nq);if(i<queueIndex)setQueueIndex(p=>p-1);}}><X size={12}/></button>
                  </div>
                ))
              }
            </div>
          </aside>
        )}
      </div>

      {activeView !== "wave" && (
        <footer className="player-bar">
          <div className="player-bar__track">
            {currentTrack?(
              <>
                <div key={`art-${trackChangeKey}`} className="player-bar__art-wrap" onClick={()=>setShowNowPlaying(true)} title="Open Now Playing" style={{cursor:"pointer"}}>
                  <img className="player-bar__art" src={currentTrack.thumbnail||""} alt="" onError={e=>e.target.style.opacity="0"}/>
                  {isPlaying&&<div className="player-bar__art-pulse"/>}
                </div>
                <div key={`meta-${trackChangeKey}`} className="player-bar__meta player-bar__meta--anim" onClick={()=>setShowNowPlaying(true)} style={{cursor:"pointer"}}>
                  <div className="player-bar__title">{currentTrack.title}</div>
                  <div className="player-bar__artist" style={{ textDecoration: "underline" }} onClick={(e) => { e.stopPropagation(); handleArtistClick(e, currentTrack); }}>{currentTrack.artist}</div>
                </div>
                <button className={`icon-btn player-bar__like ${isLiked(currentTrack)?"icon-btn--liked":""}`} onClick={()=>toggleLike(currentTrack)} title="Like (L)">
                  <Heart size={15} fill={isLiked(currentTrack)?"currentColor":"none"}/>
                </button>
                <canvas
                  ref={visualizerCanvasRef}
                  width={50}
                  height={24}
                  style={{
                    marginLeft: 12,
                    pointerEvents: "none",
                    opacity: 0.8,
                    display: useEqualizer ? "block" : "none"
                  }}
                />
              </>
            ):(
              <div className="player-bar__empty"><Music size={17} style={{opacity:0.25}}/><span style={{fontSize:12,opacity:0.3,marginLeft:10}}>Nothing playing</span></div>
            )}
          </div>
          <div className="player-bar__center">
            <div className="player-bar__controls">
              <button className={`ctrl-btn ctrl-btn--sm ${isShuffle?"ctrl-btn--active":""}`} onClick={()=>setIsShuffle(p=>!p)}><Shuffle size={15}/></button>
              <button className="ctrl-btn" onClick={handlePrev}><SkipBack size={19} fill="currentColor"/></button>
              <button className="ctrl-btn ctrl-btn--play" onClick={togglePlay} disabled={!currentTrack || isTrackLoading}>
                {isTrackLoading ? (
                  <div className="btn-spinner" style={{ width: 16, height: 16, border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "currentColor" }} />
                ) : isPlaying ? (
                  <Pause size={21} fill="currentColor"/>
                ) : (
                  <Play size={21} fill="currentColor"/>
                )}
              </button>
              <button className="ctrl-btn" onClick={handleNextClick}><SkipForward size={19} fill="currentColor"/></button>
              <button className={`ctrl-btn ctrl-btn--sm ${isRepeat?"ctrl-btn--active":""}`} onClick={()=>setIsRepeat(p=>!p)}><Repeat size={15}/></button>
            </div>
            <div className="player-bar__progress-wrap">
              <span className="player-bar__time">{fmt(currentTime)}</span>
              <div className="player-bar__progress" onClick={handleSeek}>
                <div className="player-bar__progress-fill" style={{width:`${pct}%`}}/>
                <div className="player-bar__progress-thumb" style={{left:`${pct}%`}}/>
              </div>
              <span className="player-bar__time">{fmt(duration)}</span>
            </div>
          </div>
          <div className="player-bar__right" onWheel={handleVolumeScroll}>
            <div className="speed-selector">
              <button className="speed-btn" onClick={() => setShowSpeedDropdown(p => !p)} title="Playback Speed">
                {playbackSpeed}x
              </button>
              {showSpeedDropdown && (
                <div className="speed-dropdown liquid-glass-effect" onMouseLeave={() => setShowSpeedDropdown(false)} style={{ padding: "12px", width: 140, display: "flex", flexDirection: "column", gap: 8, alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>Скорость: {playbackSpeed}x</div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.0" 
                    step="0.05" 
                    value={playbackSpeed} 
                    onChange={e => {
                      const val = parseFloat(e.target.value);
                      setPlaybackSpeed(val);
                      const a = getActiveAudio();
                      if (a) a.playbackRate = val;
                    }}
                    style={{ width: "100%", accentColor: "var(--accent)", height: 4, borderRadius: 2, background: "rgba(255,255,255,0.1)", outline: "none", cursor: "pointer" }}
                  />
                  <button 
                    type="button" 
                    className="speed-reset-btn" 
                    onClick={() => { 
                      setPlaybackSpeed(1.0); 
                      const a = getActiveAudio(); 
                      if (a) a.playbackRate = 1.0; 
                    }} 
                    style={{ width: "100%", fontSize: 10, padding: "5px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "var(--text-primary)", cursor: "pointer", fontWeight: 600 }}
                  >
                    Сбросить
                  </button>
                </div>
              )}
            </div>
            {currentTrack&&<button className="ctrl-btn ctrl-btn--sm" onClick={()=>setShowNowPlaying(true)} title="Now Playing"><Maximize2 size={15}/></button>}
            {currentTrack&&lyrics&&lyrics.length>0&&<button className={`ctrl-btn ctrl-btn--sm ${npTab==="lyrics"&&showNowPlaying?"ctrl-btn--active":""}`} onClick={()=>{setNpTab("lyrics");setShowNowPlaying(true);}} title="Текст песни"><Mic2 size={15}/></button>}
            <button className={`ctrl-btn ctrl-btn--sm ${showEqModal?"ctrl-btn--active":""}`} onClick={()=>setShowEqModal(p=>!p)} title="Equalizer"><Sliders size={15}/></button>
            <button className={`ctrl-btn ctrl-btn--sm ${showQueue?"ctrl-btn--active":""}`} onClick={()=>setShowQueue(p=>!p)}><List size={15}/></button>
            <button className="ctrl-btn ctrl-btn--sm" onClick={()=>setIsMuted(p=>!p)}>{isMuted?<VolumeX size={15}/>:<Volume2 size={15}/>}</button>
            <input className="volume-slider" type="range" min="0" max="1" step="0.02" value={isMuted?0:volume}
              onChange={e=>{setVolume(parseFloat(e.target.value));setIsMuted(false);}} onClick={e=>e.stopPropagation()}/>
          </div>
        </footer>
      )}
      {artistSelectTrack && (
        <div className="eq-modal" onClick={() => setArtistSelectTrack(null)}>
          <div className="eq-modal__content liquid-glass-effect" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="eq-modal__header">
              <User size={18} style={{ marginRight: 8, opacity: 0.8 }}/>
              <h3>Выберите исполнителя</h3>
              <button className="icon-btn" style={{ marginLeft: "auto" }} onClick={() => setArtistSelectTrack(null)}><X size={16}/></button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              {artistSelectTrack.artists.map(a => (
                <button 
                  key={a.id} 
                  className="nav__item"
                  style={{ justifyContent: "flex-start", padding: "12px 16px" }}
                  onClick={() => {
                    setArtistSelectTrack(null);
                    openArtist(a.id, a.name);
                  }}
                >
                  <User size={14} style={{ marginRight: 8, opacity: 0.6 }}/>
                  <span>{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast--${t.type}`}>
            <span className="toast__icon">
              {t.type === "success" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#34d399" stroke="#34d399" strokeWidth="1"/><path d="M8 12.5l2.5 2.5L16 9.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {t.type === "info" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#818cf8" stroke="#818cf8" strokeWidth="1"/><path d="M12 8v1M12 12v4" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>}
              {t.type === "error" && <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="#f87171" stroke="#f87171" strokeWidth="1"/><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round"/></svg>}
            </span>
            <span className="toast__text">{t.message}</span>
          </div>
        ))}
      </div>
    </div>
    </ErrorBoundary>
  );
}

export default App;
