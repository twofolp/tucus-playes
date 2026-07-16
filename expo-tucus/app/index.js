import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { usePlayer } from '../services/playerContext';
import { storage } from '../services/storage';
import { yandex } from '../services/yandex';
import { soundcloud } from '../services/soundcloud';
import { MiniPlayer } from '../components/MiniPlayer';

export default function HomeScreen() {
  const router = useRouter();
  const { play } = usePlayer();
  const [chartTracks, setChartTracks] = useState([]);
  const [scTracks, setScTracks] = useState([]);
  const [recently, setRecently] = useState([]);
  const [liked, setLiked] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const token = await storage.cleanToken();
    const r = await storage.getRecently();
    const l = await storage.getLiked();
    setRecently(r);
    setLiked(l);
    try {
      if (token) {
        const tracks = await yandex.search('хиты', token);
        setChartTracks(tracks);
      }
    } catch {}
    try {
      const sc = await soundcloud.search('lofi hip hop');
      setScTracks(sc);
    } catch {}
    setLoading(false);
  };

  const playTrack = async (track, tracks) => {
    const token = await storage.cleanToken();
    const idx = tracks?.findIndex(t => t.id === track.id) ?? 0;
    await play(track, tracks || [track], idx >= 0 ? idx : 0);
  };

  return (
    <View style={s.container}>
      <ScrollView style={s.scroll}>
        {loading ? <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} /> : (
          <>
            {recently.length > 0 && (
              <Section title="Recently Played" icon="🕐">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {recently.slice(0, 10).map((t, i) => (
                    <TrackCard key={i} track={t} onPress={() => playTrack(t, recently)} />
                  ))}
                </ScrollView>
              </Section>
            )}
            {liked.length > 0 && (
              <Section title="Liked" icon="❤️">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {liked.slice(0, 10).map((t, i) => (
                    <TrackCard key={i} track={t} onPress={() => playTrack(t, liked)} />
                  ))}
                </ScrollView>
              </Section>
            )}
            {chartTracks.length > 0 && (
              <Section title="Charts" icon="📈">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {chartTracks.slice(0, 10).map((t, i) => (
                    <TrackCard key={i} track={t} onPress={() => playTrack(t, chartTracks)} />
                  ))}
                </ScrollView>
              </Section>
            )}
            {scTracks.length > 0 && (
              <Section title="SoundCloud" icon="☁️">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {scTracks.slice(0, 10).map((t, i) => (
                    <TrackCard key={i} track={t} onPress={() => playTrack(t, scTracks)} />
                  ))}
                </ScrollView>
              </Section>
            )}
          </>
        )}
      </ScrollView>
      <MiniPlayer />
    </View>
  );
}

function Section({ title, icon, children }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={s.sectionTitle}>{icon} {title}</Text>
      {children}
    </View>
  );
}

function TrackCard({ track, onPress }) {
  return (
    <TouchableOpacity style={s.card} onPress={onPress}>
      <Image source={{ uri: track.thumbnail || null }} style={s.cardImg} />
      <Text style={s.cardTitle} numberOfLines={1}>{track.title}</Text>
      <Text style={s.cardArtist} numberOfLines={1}>{track.artist}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  scroll: { flex: 1, padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#fff', marginBottom: 12 },
  card: { width: 140, marginRight: 12 },
  cardImg: { width: 140, height: 140, borderRadius: 12, backgroundColor: '#222' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginTop: 6 },
  cardArtist: { fontSize: 11, color: '#888', marginTop: 2 },
});
