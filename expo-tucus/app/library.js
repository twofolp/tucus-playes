import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet, Alert, TextInput } from 'react-native';
import { usePlayer } from '../services/playerContext';
import { storage } from '../services/storage';
import { MiniPlayer } from '../components/MiniPlayer';

export default function LibraryScreen() {
  const { play } = usePlayer();
  const [tab, setTab] = useState('playlists');
  const [playlists, setPlaylists] = useState({});
  const [liked, setLiked] = useState([]);
  const [recently, setRecently] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);
  const [newName, setNewName] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setPlaylists(await storage.getPlaylists());
    setLiked(await storage.getLiked());
    setRecently(await storage.getRecently());
  };

  const playTrack = async (track, tracks) => {
    await play(track, tracks, tracks.findIndex(t => t.id === track.id));
  };

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    await storage.createPlaylist(newName.trim());
    setNewName('');
    load();
  };

  const deletePlaylist = async (name) => {
    Alert.alert('Delete', `Delete "${name}"?`, [
      { text: 'Cancel' },
      { text: 'Delete', onPress: async () => { await storage.deletePlaylist(name); load(); } },
    ]);
  };

  if (selectedPlaylist) {
    const tracks = playlists[selectedPlaylist] || [];
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => setSelectedPlaylist(null)}>
            <Text style={s.backBtn}>← Back</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>{selectedPlaylist}</Text>
        </View>
        <FlatList
          data={tracks}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.trackRow} onPress={() => playTrack(item, tracks)}>
              <Image source={{ uri: item.thumbnail || null }} style={s.trackImg} />
              <View style={s.trackInfo}>
                <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.trackArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
        <MiniPlayer />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.tabRow}>
        {['playlists', 'liked', 'history'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'playlists' ? 'Playlists' : t === 'liked' ? 'Liked' : 'History'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'playlists' && (
        <>
          <View style={s.createRow}>
            <TextInput style={s.createInput} placeholder="New playlist..." placeholderTextColor="#666" value={newName} onChangeText={setNewName} />
            <TouchableOpacity style={s.createBtn} onPress={createPlaylist}>
              <Text style={s.createBtnText}>+</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={Object.keys(playlists).sort()}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity style={s.playlistRow} onPress={() => setSelectedPlaylist(item)}>
                <Text style={s.playlistName}>📁 {item}</Text>
                <Text style={s.playlistCount}>{playlists[item]?.length || 0}</Text>
                <TouchableOpacity onPress={() => deletePlaylist(item)}>
                  <Text style={s.deleteBtn}>✕</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}
          />
        </>
      )}

      {tab === 'liked' && (
        <FlatList
          data={liked}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.trackRow} onPress={() => playTrack(item, liked)}>
              <Image source={{ uri: item.thumbnail || null }} style={s.trackImg} />
              <View style={s.trackInfo}>
                <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.trackArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}

      {tab === 'history' && (
        <FlatList
          data={recently}
          keyExtractor={(item) => `${item.source}-${item.id}`}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.trackRow} onPress={() => playTrack(item, recently)}>
              <Image source={{ uri: item.thumbnail || null }} style={s.trackImg} />
              <View style={s.trackInfo}>
                <Text style={s.trackTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={s.trackArtist} numberOfLines={1}>{item.artist}</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
      <MiniPlayer />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  backBtn: { color: '#a855f7', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  tabRow: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1e1e30', alignItems: 'center' },
  tabActive: { backgroundColor: '#a855f7' },
  tabText: { color: '#888', fontWeight: '600' },
  tabTextActive: { color: '#fff' },
  createRow: { flexDirection: 'row', padding: 12, gap: 8 },
  createInput: { flex: 1, backgroundColor: '#1e1e30', borderRadius: 8, padding: 10, color: '#fff' },
  createBtn: { backgroundColor: '#a855f7', borderRadius: 8, width: 40, alignItems: 'center', justifyContent: 'center' },
  createBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  playlistRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  playlistName: { flex: 1, color: '#fff', fontSize: 15 },
  playlistCount: { color: '#888', marginRight: 12 },
  deleteBtn: { color: '#ff4444', fontSize: 16 },
  trackRow: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: '#1a1a2e' },
  trackImg: { width: 48, height: 48, borderRadius: 6, backgroundColor: '#222' },
  trackInfo: { flex: 1, marginLeft: 12 },
  trackTitle: { color: '#fff', fontSize: 14, fontWeight: '500' },
  trackArtist: { color: '#888', fontSize: 12, marginTop: 2 },
});
