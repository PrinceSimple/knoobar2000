import { defineStore } from "pinia";
import { ref, computed } from "vue";

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

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  function init() {
    window.api.player.onPlaybackState((state: PlaybackState) => {
      status.value = state.status;
      if (state.duration) {
        duration.value = state.duration;
      }
    });

    window.api.player.onTimeUpdate((time: TimeUpdate) => {
      currentPosition.value = time.position;
      duration.value = time.duration;
    });

    window.api.settings.get().then((settings) => {
      volume.value = settings.volume;
    });
  }

  async function playTrack(track: Track) {
    currentTrack.value = track;
    currentPosition.value = 0;
    duration.value = track.duration;
    await window.api.player.play(track.filePath);
    window.api.library.updatePlayCount(track.id);
  }

  async function play() {
    if (currentTrack.value) {
      await window.api.player.resume();
    }
  }

  function pause() {
    console.log("store-pause: START");
    window.api.player.pause();
    console.log("store-pause: END");
  }

  async function stop() {
    await window.api.player.stop();
    currentTrack.value = null;
    currentPosition.value = 0;
    duration.value = 0;
  }

  async function seek(position: number) {
    await window.api.player.seek(position);
    currentPosition.value = position;
  }

  async function setVolume(vol: number) {
    volume.value = vol;
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
