import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Switch, StyleSheet, TouchableOpacity } from 'react-native';
import { storage } from '../services/storage';
import { usePlayer } from '../services/playerContext';
import { MiniPlayer } from '../components/MiniPlayer';

export default function SettingsScreen() {
  const { volume, setVolume, isShuffle, isRepeat, setIsShuffle, setIsRepeat } = usePlayer();
  const [token, setToken] = useState('');
  const [autoLyrics, setAutoLyrics] = useState(true);
  const [translation, setTranslation] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      setToken(await storage.getToken());
      setAutoLyrics(await storage.getAutoLyrics());
      setTranslation(await storage.getTranslation());
    })();
  }, []);

  const saveToken = async () => {
    await storage.setToken(token);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <ScrollView style={s.container}>
      <Text style={s.sectionTitle}>API Keys</Text>
      <View style={s.card}>
        <Text style={s.label}>Yandex Music Token</Text>
        <Text style={s.hint}>Get OAuth token from Yandex Music web version</Text>
        <TextInput style={s.input} placeholder="Paste token..." placeholderTextColor="#666" value={token} onChangeText={setToken} secureTextEntry />
        <TouchableOpacity style={[s.saveBtn, saved && s.savedBtn]} onPress={saveToken}>
          <Text style={s.saveBtnText}>{saved ? '✓ Saved!' : 'Save Token'}</Text>
        </TouchableOpacity>
      </View>

      <Text style={s.sectionTitle}>Playback</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>Auto-fetch Lyrics</Text>
          <Switch value={autoLyrics} onValueChange={(v) => { setAutoLyrics(v); storage.setAutoLyrics(v); }} trackColor={{ true: '#a855f7' }} />
        </View>
        <View style={s.row}>
          <Text style={s.label}>Show Translation</Text>
          <Switch value={translation} onValueChange={(v) => { setTranslation(v); storage.setTranslation(v); }} trackColor={{ true: '#a855f7' }} />
        </View>
      </View>

      <Text style={s.sectionTitle}>Shuffle & Repeat</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>Shuffle</Text>
          <Switch value={isShuffle} onValueChange={setIsShuffle} trackColor={{ true: '#a855f7' }} />
        </View>
        <View style={s.row}>
          <Text style={s.label}>Repeat</Text>
          <Switch value={isRepeat} onValueChange={setIsRepeat} trackColor={{ true: '#a855f7' }} />
        </View>
      </View>

      <Text style={s.sectionTitle}>About</Text>
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.label}>Version</Text>
          <Text style={s.value}>1.0.0</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>Source</Text>
          <Text style={s.value}>github.com/twofolp/tucus-playes</Text>
        </View>
      </View>
      <View style={{ height: 100 }} />
      <MiniPlayer />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f1a', padding: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', marginTop: 20, marginBottom: 8, letterSpacing: 1 },
  card: { backgroundColor: '#1a1a2e', borderRadius: 12, padding: 16, marginBottom: 8 },
  label: { color: '#fff', fontSize: 15, fontWeight: '500' },
  hint: { color: '#666', fontSize: 12, marginTop: 4, marginBottom: 8 },
  input: { backgroundColor: '#0f0f1a', borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, marginTop: 8 },
  saveBtn: { backgroundColor: '#a855f7', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 12 },
  savedBtn: { backgroundColor: '#22c55e' },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  value: { color: '#888', fontSize: 13 },
});
