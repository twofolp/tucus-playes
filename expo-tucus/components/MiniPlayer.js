import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlayer } from '../services/playerContext';

export function MiniPlayer() {
  const router = useRouter();
  const { currentTrack, isPlaying, playPause, next, previous, currentTime, duration } = usePlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <TouchableOpacity style={s.container} onPress={() => router.push('/now-playing')}>
      <View style={[s.progressBar, { width: `${progress * 100}%` }]} />
      <View style={s.content}>
        <Image source={{ uri: currentTrack.thumbnail || null }} style={s.img} />
        <View style={s.info}>
          <Text style={s.title} numberOfLines={1}>{currentTrack.title}</Text>
          <Text style={s.artist} numberOfLines={1}>{currentTrack.artist}</Text>
        </View>
        <TouchableOpacity onPress={previous} style={s.btn}>
          <Text style={s.btnText}>⏮</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={playPause} style={s.btn}>
          <Text style={s.playBtn}>{isPlaying ? '⏸' : '▶️'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={next} style={s.btn}>
          <Text style={s.btnText}>⏭</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { backgroundColor: '#1a1a2e', borderTopWidth: 1, borderTopColor: '#222' },
  progressBar: { height: 2, backgroundColor: '#a855f7' },
  content: { flexDirection: 'row', alignItems: 'center', padding: 10, paddingHorizontal: 12 },
  img: { width: 44, height: 44, borderRadius: 8, backgroundColor: '#222' },
  info: { flex: 1, marginLeft: 10 },
  title: { color: '#fff', fontSize: 14, fontWeight: '600' },
  artist: { color: '#888', fontSize: 12, marginTop: 1 },
  btn: { padding: 8 },
  btnText: { fontSize: 18, color: '#fff' },
  playBtn: { fontSize: 24 },
});
