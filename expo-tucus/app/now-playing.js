import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlayer } from '../services/playerContext';
import { storage } from '../services/storage';
import { lyricsService } from '../services/lyrics';

const { width } = Dimensions.get('window');

export default function NowPlayingScreen() {
  const router = useRouter();
  const { currentTrack, isPlaying, currentTime, duration, playPause, next, previous, seek, isShuffle, isRepeat, setIsShuffle, setIsRepeat } = usePlayer();
  const [lyrics, setLyrics] = useState([]);
  const [showLyrics, setShowLyrics] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [liked, setLiked] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (currentTrack) checkLiked();
    if (currentTrack && showLyrics) loadLyrics();
  }, [currentTrack?.id, showLyrics]);

  useEffect(() => {
    if (showLyrics && lyrics.length && scrollRef.current) {
      const idx = lyrics.findLastIndex(l => l.time != null && l.time <= currentTime);
      if (idx >= 0) {
        scrollRef.current.scrollTo({ y: idx * 52, animated: true });
      }
    }
  }, [currentTime, lyrics, showLyrics]);

  const checkLiked = async () => setLiked(await storage.isLiked(currentTrack));

  const loadLyrics = async () => {
    const token = await storage.cleanToken();
    const lines = await lyricsService.fetch(currentTrack, token || null);
    setLyrics(lines);
  };

  const toggleLike = async () => {
    await storage.toggleLike(currentTrack);
    setLiked(!liked);
  };

  const translate = async () => {
    if (!lyrics.length || isTranslating) return;
    setIsTranslating(true);
    setLyrics(await lyricsService.translate(lyrics));
    setIsTranslating(false);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  if (!currentTrack) return <View style={s.container}><Text style={s.noTrack}>No track playing</Text></View>;

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Text style={s.closeText}>▼</Text>
      </TouchableOpacity>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent}>
        <Image source={{ uri: currentTrack.thumbnail || null }} style={s.art} />
        <Text style={s.title}>{currentTrack.title}</Text>
        <Text style={s.artist}>{currentTrack.artist}</Text>

        <View style={s.actions}>
          <TouchableOpacity onPress={() => setShowLyrics(!showLyrics)}>
            <Text style={[s.actionBtn, showLyrics && s.actionActive]}>📝</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={toggleLike}>
            <Text style={s.actionBtn}>{liked ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
          {showLyrics && lyrics.length > 0 && (
            <TouchableOpacity onPress={translate}>
              <Text style={s.actionBtn}>{isTranslating ? '⏳' : '🌐'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showLyrics && lyrics.length > 0 && (
          <ScrollView ref={scrollRef} style={s.lyricsContainer} nestedScrollEnabled>
            {lyrics.map((line, i) => {
              const active = line.time != null && line.duration != null && currentTime >= line.time && currentTime < line.time + line.duration;
              const past = line.time != null && currentTime >= line.time + (line.duration || 0);
              return (
                <View key={i} style={s.lyricLine}>
                  <Text style={[s.lyricText, active && s.lyricActive, past && s.lyricPast]}>{line.text}</Text>
                  {line.translation ? <Text style={[s.lyricTranslation, active && s.lyricTransActive]}>{line.translation}</Text> : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>

      <View style={s.bottom}>
        <View style={s.progressRow}>
          <Text style={s.timeText}>{fmt(currentTime)}</Text>
          <View style={s.progressTrack}>
            <View style={[s.progressFill, { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }]} />
          </View>
          <Text style={s.timeText}>{fmt(duration)}</Text>
        </View>

        <View style={s.controls}>
          <TouchableOpacity onPress={() => setIsShuffle(!isShuffle)}>
            <Text style={[s.ctrlBtn, isShuffle && s.ctrlActive]}>🔀</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={previous}>
            <Text style={s.ctrlBtn}>⏮</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={playPause} style={s.playBtnWrap}>
            <Text style={s.playBtn}>{isPlaying ? '⏸' : '▶️'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={next}>
            <Text style={s.ctrlBtn}>⏭</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setIsRepeat(!isRepeat)}>
            <Text style={[s.ctrlBtn, isRepeat && s.ctrlActive]}>🔁</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a1a' },
  noTrack: { color: '#666', textAlign: 'center', marginTop: 100 },
  closeBtn: { alignItems: 'center', padding: 12 },
  closeText: { color: '#888', fontSize: 20 },
  scroll: { flex: 1 },
  scrollContent: { alignItems: 'center', paddingBottom: 20 },
  art: { width: width * 0.7, height: width * 0.7, borderRadius: 16, backgroundColor: '#1a1a2e', marginTop: 10 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 20, textAlign: 'center', paddingHorizontal: 20 },
  artist: { color: '#888', fontSize: 16, marginTop: 6, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 20, marginTop: 16 },
  actionBtn: { fontSize: 22 },
  actionActive: { opacity: 1 },
  lyricsContainer: { maxHeight: 200, width: '100%', paddingHorizontal: 24, marginTop: 12 },
  lyricLine: { paddingVertical: 6, alignItems: 'center' },
  lyricText: { color: '#fff8', fontSize: 16, textAlign: 'center' },
  lyricActive: { color: '#fff', fontSize: 19, fontWeight: '700' },
  lyricPast: { color: '#fff3' },
  lyricTranslation: { color: '#a855f780', fontSize: 13, marginTop: 2, textAlign: 'center' },
  lyricTransActive: { color: '#a855f7' },
  bottom: { paddingBottom: 30, paddingHorizontal: 20 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeText: { color: '#888', fontSize: 12, fontVariant: ['tabular-nums'] },
  progressTrack: { flex: 1, height: 4, backgroundColor: '#333', borderRadius: 2 },
  progressFill: { height: 4, backgroundColor: '#a855f7', borderRadius: 2 },
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 24, marginTop: 16 },
  ctrlBtn: { fontSize: 24, color: '#fff' },
  ctrlActive: { color: '#a855f7' },
  playBtnWrap: { backgroundColor: '#fff', borderRadius: 50, width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  playBtn: { fontSize: 28 },
});
