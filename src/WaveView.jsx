import React, { memo, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Heart, ThumbsDown, Mic2, X } from "lucide-react";
import LyricsRenderer from "./LyricsRenderer";

const fmt = (s) => {
  if (!s || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec < 10 ? "0" : ""}${sec}`;
};

/**
 * Apple Music-style wave view.
 * Full-bleed layout: blurred cover background, cover+controls left, lyrics right.
 */
function WaveView({
  currentTrack,
  isPlaying,
  isTrackLoading,
  currentTime,
  duration,
  pct,
  lyrics,
  lyricsOffset,
  lyricsFontSize,
  lyricsTextStyle,
  showTranslation,
  isLoadingLyrics,
  isLiked,
  togglePlay,
  handlePrev,
  handleNextClick,
  handleSeek,
  toggleLike,
  toggleDislike,
  fetchLyrics,
  getActiveAudio,
  setCurrentTime,
  onExit,
  onArtistClick,
}) {
  const [showLyricsPanel, setShowLyricsPanel] = useState(true);

  if (!currentTrack) return null;

  const thumbnail = currentTrack.thumbnail || "";

  const currentAiQuote = currentTrack.explanation || currentTrack.reason || "";

  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "row",
      background: "#000",
      zIndex: 5,
      overflow: "hidden",
    }}>
      {/* Fullscreen blurred background */}
      <div style={{
        position: "absolute",
        inset: -80,
        backgroundImage: thumbnail ? `url(${thumbnail})` : "none",
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(100px) saturate(1.6) brightness(0.2)",
        transform: "scale(1.2)",
        zIndex: 0,
        transition: "background-image 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }} />

      {/* Gradient overlay for depth */}
      <div style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(135deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.6) 100%)",
        zIndex: 1,
      }} />

      {/* Exit button */}
      {onExit && (
        <button
          onClick={onExit}
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            zIndex: 10,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.15)",
            color: "rgba(255,255,255,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            backdropFilter: "blur(20px)",
            transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.2)"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.transform = "scale(1.08)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.transform = "scale(1)"; }}
          title="Вернуться на главную"
        >
          <X size={18} />
        </button>
      )}

      {/* LEFT: Cover + Controls */}
      <div style={{
        width: showLyricsPanel && lyrics && lyrics.length > 0 ? "420px" : "100%",
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        position: "relative",
        zIndex: 2,
        padding: "32px",
        transition: "width 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      }}>
        {/* Album Art */}
        <div style={{
          position: "relative",
          width: showLyricsPanel && lyrics && lyrics.length > 0 ? "320px" : "340px",
          height: showLyricsPanel && lyrics && lyrics.length > 0 ? "320px" : "340px",
          flexShrink: 0,
          transition: "all 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}>
          <img
            src={thumbnail}
            alt=""
            onError={e => { e.target.style.opacity = "0"; }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "20px",
              boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
              transition: "box-shadow 0.5s ease",
              animation: isPlaying ? "waveArtBreathe 6s ease-in-out infinite alternate" : "none",
            }}
          />
          <style>{`
            @keyframes waveArtBreathe {
              0% { transform: scale(1); box-shadow: 0 24px 80px rgba(0,0,0,0.6); }
              100% { transform: scale(1.02); box-shadow: 0 32px 100px rgba(0,0,0,0.7); }
            }
          `}</style>
          {/* Play/Pause overlay */}
          <div
            onClick={togglePlay}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.2)",
              opacity: isTrackLoading || !isPlaying ? 1 : 0,
              transition: "opacity 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              cursor: "pointer",
            }}
          >
            {isTrackLoading ? (
              <div className="btn-spinner" style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.2)", borderTopColor: "#fff" }} />
            ) : isPlaying ? (
              <Pause size={56} strokeWidth={1.5} color="rgba(255,255,255,0.95)" />
            ) : (
              <Play size={56} strokeWidth={1.5} color="rgba(255,255,255,0.95)" fill="rgba(255,255,255,0.95)" />
            )}
          </div>
        </div>

        {/* Track Info */}
        <div style={{ textAlign: "center", width: "100%", maxWidth: "320px" }}>
          <div style={{
            fontSize: "20px",
            fontWeight: "700",
            color: "#fff",
            lineHeight: 1.3,
            marginBottom: "4px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {currentTrack.title || "\u2014"}
          </div>
          <div
            onClick={(e) => onArtistClick && onArtistClick(e, currentTrack)}
            style={{
              fontSize: "14px",
              fontWeight: "400",
              color: "rgba(255,255,255,0.6)",
              cursor: "pointer",
              transition: "all 0.2s",
              display: "inline-block",
            }}
            onMouseEnter={e => { e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.textDecoration = "underline"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "rgba(255,255,255,0.6)"; e.currentTarget.style.textDecoration = "none"; }}
          >
            {currentTrack.artist || "\u2014"}
          </div>
        </div>

        {/* Progress Bar */}
        <div style={{ width: "100%", maxWidth: "320px" }}>
          <div
            onClick={handleSeek}
            style={{
              height: "4px",
              background: "rgba(255,255,255,0.12)",
              borderRadius: "2px",
              position: "relative",
              cursor: "pointer",
            }}
          >
            <div style={{
              width: `${pct}%`,
              height: "100%",
              background: "#fff",
              borderRadius: "2px",
              transition: "width 0.1s linear",
            }} />
            <div style={{
              left: `${pct}%`,
              position: "absolute",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "12px",
              height: "12px",
              background: "#fff",
              borderRadius: "50%",
              boxShadow: "0 0 8px rgba(255,255,255,0.2)",
              opacity: 0,
              transition: "opacity 0.3s ease",
            }}
            onMouseEnter={e => e.target.style.opacity = "1"}
            onMouseLeave={e => e.target.style.opacity = "0"}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>
              {fmt(currentTime)}
            </span>
            <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontVariantNumeric: "tabular-nums" }}>
              {fmt(duration)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "32px" }}>
          <button onClick={handlePrev} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 8,
            transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            <SkipBack size={22} fill="currentColor" />
          </button>
          <button
            onClick={togglePlay}
            disabled={isTrackLoading}
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#fff",
              color: "#000",
              border: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
              transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            {isTrackLoading ? (
              <div className="btn-spinner" style={{ width: 20, height: 20, border: "2px solid rgba(0,0,0,0.15)", borderTopColor: "#000" }} />
            ) : isPlaying ? (
              <Pause size={26} fill="currentColor" />
            ) : (
              <Play size={26} fill="currentColor" />
            )}
          </button>
          <button onClick={handleNextClick} style={{
            background: "none", border: "none", color: "rgba(255,255,255,0.6)", cursor: "pointer", padding: 8,
            transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.12)"; e.currentTarget.style.color = "#fff"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
          >
            <SkipForward size={22} fill="currentColor" />
          </button>
        </div>

        {/* Like / Dislike / Lyrics toggle */}
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <button
            onClick={() => toggleLike(currentTrack)}
            style={{
              background: "none",
              border: "none",
              color: isLiked(currentTrack) ? "#fff" : "rgba(255,255,255,0.35)",
              cursor: "pointer",
              padding: 8,
              transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <Heart size={18} fill={isLiked(currentTrack) ? "currentColor" : "none"} />
          </button>
          <button
            onClick={() => { toggleDislike(currentTrack); handleNextClick(); }}
            style={{
              background: "none", border: "none", color: "rgba(255,255,255,0.35)", cursor: "pointer", padding: 8,
              transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
            }}
            onMouseEnter={e => e.currentTarget.style.transform = "scale(1.15)"}
            onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
          >
            <ThumbsDown size={16} />
          </button>
          {lyrics && lyrics.length > 0 && (
            <button
              onClick={() => setShowLyricsPanel(p => !p)}
              style={{
                background: showLyricsPanel ? "rgba(255,255,255,0.12)" : "none",
                border: showLyricsPanel ? "1px solid rgba(255,255,255,0.2)" : "1px solid transparent",
                color: showLyricsPanel ? "#fff" : "rgba(255,255,255,0.35)",
                cursor: "pointer",
                padding: "6px 12px",
                borderRadius: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                fontWeight: "600",
                transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
              onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
            >
              <Mic2 size={14} />
              Текст
            </button>
          )}
        </div>

      </div>

      {/* RIGHT: Lyrics */}
      {showLyricsPanel && lyrics && lyrics.length > 0 && (
        <div style={{
          flex: 1,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "0 40px",
          background: "linear-gradient(180deg, rgba(255,255,255,0.015) 0%, rgba(255,255,255,0.005) 100%)",
          borderLeft: "1px solid rgba(255,255,255,0.04)",
          backdropFilter: "blur(40px)",
          WebkitBackdropFilter: "blur(40px)",
          animation: "smoothSlideLeft 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}>
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
              }
            }}
          />
        </div>
      )}

      {/* Show lyrics panel placeholder when lyrics panel is hidden */}
      {(!showLyricsPanel || !lyrics || lyrics.length === 0) && (
        <div style={{
          flex: 1,
          position: "relative",
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          opacity: 0.25,
          gap: 12,
        }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
          </svg>
          <div style={{ fontSize: 14, fontWeight: "500" }}>
            {isLoadingLyrics ? "Загрузка текста..." : "Текст песни отсутствует"}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(WaveView);
