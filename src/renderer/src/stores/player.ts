import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { rendererAudioPlayer } from "../services/audioPlayer";

type AppSettings = {
  watchFolders: string[];
  outputDevice: string;
  volume: number;
  replayGainEnabled: boolean;
  replayGainPreamp: number;
  theme: "dark" | "light";
  libraryView: "list" | "grid";
};

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  albumArtist: string;
  year: number;
  trackNumber: number;
  discNumber: number;
  genre: string;
  format: string;
  duration: number;
  bitrate: number;
  sampleRate: number;
  channels: number;
  codec: string;
  replayGainTrack: number;
  replayGainAlbum: number;
  playCount: number;
  lastPlayed: string | null;
  dateAdded: string;
  fileSize: number;
}

export interface PlaybackState {
  status: "playing" | "paused" | "stopped";
  filePath: string;
  duration: number;
  format: string;
}

export interface TimeUpdate {
  position: number;
  duration: number;
}

export const usePlayerStore = defineStore("player", () => {
  const status = ref<"playing" | "paused" | "stopped">("stopped");
  const currentTrack = ref<Track | null>(null);
  const currentPosition = ref(0);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const queue = ref<Track[]>([]);
  const queueIndex = ref(-1);
  const repeat = ref<"none" | "one" | "all">("none");
  const shuffle = ref(false);

  const isPlaying = computed(() => status.value === "playing");
  const hasTrack = computed(() => currentTrack.value !== null);

  const progress = computed(() => {
    if (duration.value === 0) return 0;
    return (currentPosition.value / duration.value) * 100;
  });

  const formattedPosition = computed(() => formatTime(currentPosition.value));
  const formattedDuration = computed(() => formatTime(duration.value));

  const RENDERER_FORMATS = [
    ".flac",
    ".wav",
    ".mp3",
    ".aac",
    ".ogg",
    ".m4a",
    ".wma",
    ".alac",
    ".wv",
  ];
  const DSD_FORMATS = [".dsf", ".dff"];

  function useRendererPlayback(filePath: string): boolean {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
    return RENDERER_FORMATS.includes(ext);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function init() {
    rendererAudioPlayer.init({
      onTimeUpdate: (position, dur) => {
        currentPosition.value = position;
        if (!isNaN(dur) && dur > 0) {
          duration.value = dur;
        }
      },
      onEnded: () => {
        next();
      },
      onError: (error) => {},
      onStatusChange: (newStatus) => {
        status.value = newStatus;
      },
    });

    window.api.player.onPlaybackState((state: PlaybackState) => {
      if (state.status === "stopped" && useRendererPlayback(state.filePath)) {
        return;
      }
      status.value = state.status;
      if (state.duration) {
        duration.value = state.duration;
      }
    });

    window.api.player.onTimeUpdate((time: TimeUpdate) => {
      if (
        status.value === "playing" &&
        useRendererPlayback(currentTrack.value?.filePath || "")
      ) {
        return;
      }
      currentPosition.value = time.position;
      duration.value = time.duration;
    });

    window.api.settings.get().then((settings: AppSettings) => {
      volume.value = settings.volume;
      rendererAudioPlayer.setVolume(settings.volume);
    });
  }

  async function playTrack(track: Track) {
    currentTrack.value = track;
    currentPosition.value = 0;
    duration.value = track.duration;

    if (useRendererPlayback(track.filePath)) {
      await rendererAudioPlayer.play(track.filePath, 0);
      window.api.library.updatePlayCount(track.id);
    } else {
      await window.api.player.play(track.filePath);
      window.api.library.updatePlayCount(track.id);
    }
  }

  async function play() {
    if (!currentTrack.value) return;

    if (useRendererPlayback(currentTrack.value.filePath)) {
      await rendererAudioPlayer.resume();
    } else {
      await window.api.player.resume();
    }
  }

  function pause() {
    if (
      currentTrack.value &&
      useRendererPlayback(currentTrack.value.filePath)
    ) {
      rendererAudioPlayer.pause();
    } else {
      window.api.player.pause();
    }
  }

  async function stop() {
    if (
      currentTrack.value &&
      useRendererPlayback(currentTrack.value.filePath)
    ) {
      rendererAudioPlayer.stop();
    } else {
      await window.api.player.stop();
    }
    currentTrack.value = null;
    currentPosition.value = 0;
    duration.value = 0;
  }

  async function seek(position: number) {
    if (
      currentTrack.value &&
      useRendererPlayback(currentTrack.value.filePath)
    ) {
      rendererAudioPlayer.seek(position);
    } else {
      await window.api.player.seek(position);
    }
    currentPosition.value = position;
  }

  async function setVolume(vol: number) {
    volume.value = vol;
    rendererAudioPlayer.setVolume(vol);
    await window.api.player.setVolume(vol);
  }

  function playQueue(tracks: Track[], startIndex = 0) {
    queue.value = tracks;
    queueIndex.value = startIndex;
    if (tracks.length > 0 && startIndex < tracks.length) {
      playTrack(tracks[startIndex]);
    }
  }

  function next() {
    if (queue.value.length === 0) return;

    let nextIndex: number;
    if (shuffle.value) {
      nextIndex = Math.floor(Math.random() * queue.value.length);
    } else if (queueIndex.value < queue.value.length - 1) {
      nextIndex = queueIndex.value + 1;
    } else if (repeat.value === "all") {
      nextIndex = 0;
    } else {
      stop();
      return;
    }

    queueIndex.value = nextIndex;
    playTrack(queue.value[nextIndex]);
  }

  function previous() {
    if (currentPosition.value > 3) {
      seek(0);
      return;
    }

    if (queue.value.length === 0) return;

    let prevIndex: number;
    if (queueIndex.value > 0) {
      prevIndex = queueIndex.value - 1;
    } else if (repeat.value === "all") {
      prevIndex = queue.value.length - 1;
    } else {
      seek(0);
      return;
    }

    queueIndex.value = prevIndex;
    playTrack(queue.value[prevIndex]);
  }

  function toggleRepeat() {
    const modes: ("none" | "one" | "all")[] = ["none", "one", "all"];
    const currentIndex = modes.indexOf(repeat.value);
    repeat.value = modes[(currentIndex + 1) % modes.length];
  }

  function toggleShuffle() {
    shuffle.value = !shuffle.value;
  }

  function addToQueue(track: Track) {
    queue.value.push(track);
  }

  function clearQueue() {
    queue.value = [];
    queueIndex.value = -1;
  }

  return {
    status,
    currentTrack,
    currentPosition,
    duration,
    volume,
    isMuted,
    queue,
    queueIndex,
    repeat,
    shuffle,
    isPlaying,
    hasTrack,
    progress,
    formattedPosition,
    formattedDuration,
    init,
    playTrack,
    play,
    pause,
    stop,
    seek,
    setVolume,
    playQueue,
    next,
    previous,
    toggleRepeat,
    toggleShuffle,
    addToQueue,
    clearQueue,
  };
});
