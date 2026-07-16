import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { Audio } from 'expo-av';
import { storage } from './storage';
import { yandex } from './yandex';
import { soundcloud } from './soundcloud';

const PlayerContext = createContext();

export function PlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const soundRef = useRef(null);

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
    return () => { soundRef.current?.unloadAsync(); };
  }, []);

  const loadStream = async (track) => {
    const token = await storage.cleanToken();
    if (track.source === 'yandex' && token) {
      const url = await yandex.getStreamUrl(track.id, token);
      return { ...track, streamUrl: url };
    }
    if (track.source === 'soundcloud') {
      const url = await soundcloud.getStreamUrl(track.id);
      return { ...track, streamUrl: url };
    }
    return track;
  };

  const play = async (track, newQueue, index) => {
    try {
      if (soundRef.current) await soundRef.current.unloadAsync();
      const loaded = await loadStream(track);
      if (!loaded.streamUrl) return;

      const { sound } = await Audio.Sound.createAsync(
        { uri: loaded.streamUrl },
        { shouldPlay: true, volume },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;
      setCurrentTrack(loaded);
      setIsPlaying(true);
      if (newQueue) setQueue(newQueue);
      if (index != null) setQueueIndex(index);
      await storage.addRecently(track);
    } catch (e) {
      console.error('Play error:', e);
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setCurrentTime(status.positionMillis / 1000);
      setDuration((status.durationMillis || 0) / 1000);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish && !status.isLooping) next();
    }
  };

  const playPause = async () => {
    if (!soundRef.current) return;
    if (isPlaying) { await soundRef.current.pauseAsync(); setIsPlaying(false); }
    else { await soundRef.current.playAsync(); setIsPlaying(true); }
  };

  const seek = async (time) => {
    await soundRef.current?.setPositionAsync(time * 1000);
    setCurrentTime(time);
  };

  const next = async () => {
    if (!queue.length) return;
    let nextIdx;
    if (isShuffle) { nextIdx = Math.floor(Math.random() * queue.length); }
    else { nextIdx = queueIndex + 1; if (nextIdx >= queue.length) { if (isRepeat) nextIdx = 0; else return; } }
    setQueueIndex(nextIdx);
    await play(queue[nextIdx]);
  };

  const previous = async () => {
    if (!queue.length) return;
    if (currentTime > 3) { await seek(0); return; }
    const prevIdx = Math.max(0, queueIndex - 1);
    setQueueIndex(prevIdx);
    await play(queue[prevIdx]);
  };

  const addToQueue = (track) => setQueue(q => [...q, track]);

  return (
    <PlayerContext.Provider value={{
      currentTrack, isPlaying, currentTime, duration,
      queue, queueIndex, isShuffle, isRepeat, volume,
      play, playPause, seek, next, previous, addToQueue,
      setIsShuffle, setIsRepeat, setVolume: async (v) => {
        setVolume(v);
        await soundRef.current?.setVolumeAsync(v);
      },
    }}>
      {children}
    </PlayerContext.Provider>
  );
}

export const usePlayer = () => useContext(PlayerContext);
