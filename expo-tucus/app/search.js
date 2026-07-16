import React, { useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { usePlayer } from '../services/playerContext';
import { storage } from '../services/storage';
import { yandex } from '../services/yandex';
import { soundcloud } from '../services/soundcloud';
import { MiniPlayer } from '../components/MiniPlayer';

export default function SearchScreen() {
  const { play } = usePlayer();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState('all');

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults([]);
    const token = await storage.cleanToken();
    let tracks = [];
    try {
      if ((source === 'all' || source === 'yandex') && token) {
        tracks.push(...await yandex.search(query, token));
      }
      if (source === 'all' || source === 'soundcloud') {
        tracks.push(...await soundcloud.search(query));
      }
    } catch (e) { console.error(e); }
    setResults(tracks);
    setLoading(false);
  };

  const playTrack = async (track) => {
    const token = await storage.cleanToken();
    await play(track, results, results.findIndex(t => t.id === track.id));
  };

  return (
    <View style={s.container}>
      <View style={s.searchBar}>
        <TextInput
          style={s.input}
          placeholder="Search music..."
          placeholderTextColor="#666"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
          returnKeyType="search"
        />
      </View>
      <View style={s.sourceRow}>
        {['all', 'yandex', 'soundcloud'].map(src => (
          <TouchableOpacity key={src} style={[s.sourceBtn, source === src && s.sourceBtnActive]} onPress={() => setSource(src)}>
            <Text style={[s.sourceText, source === src && s.sourceTextActive]}>{src === 'all' ? 'All' : src === 'yandex' ? 'Yandex' : 'SC'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color="#a855f7" style={{ marginTop: 40 }} /> : (
        <FlatList
          data={results}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.trackRow} onPress={() => playTrack(item)}>
              <Image source={{ uri: item.thumbnail || null }} style={s.trackImg} />
              <View style={s.trackInfo}>
                <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.trackArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
              <Text style={s.trackSource}>{item.source.toUpperCase()}</Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={!loading && query ? <Text style={s.empty}>No results</Text> : null}
        />
      )}
      <MiniPlayer />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  searchBar: { padding: 12 },
  input: { backgroundColor: '#1e1e30', borderRadius: 12, padding: 12, color: '#fff', fontSize: 16 },
  sourceRow: { flexDirection: 'row', paddingHorizontal: 12, marginBottom: 8, gap: 8 },
  sourceBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, backgroundColor: '#1e1e30' },
  sourceBtnActive: { backgroundColor: '#a855f7' },
  sourceText: { color: '#888', fontSize: 13, fontWeight: '600' },
  sourceTextActive: { color: '#fff' },
  trackRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  trackImg: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#222' },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  trackArtist: { color: '#888', fontSize: 12, marginTop: 2 },
  trackSource: { color: '#a855f7', fontSize: 10, fontWeight: '700' },
  empty: { color: '#666', textAlign: 'center', marginTop: 40 },
});
