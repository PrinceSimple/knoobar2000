<script setup lang="ts">
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore } from '../../stores/player'

const library = useLibraryStore()
const player = usePlayerStore()
</script>

<template>
  <footer class="flex items-center justify-between px-4 py-1 bg-neutral-950 border-t border-neutral-800 text-xs text-neutral-500">
    <div class="flex items-center gap-4">
      <span>{{ library.trackCount }} tracks</span>
      <span>{{ library.albumCount }} albums</span>
      <span>{{ library.artistCount }} artists</span>
    </div>

    <div class="flex items-center gap-4">
      <span v-if="player.currentTrack">
        {{ player.currentTrack.format }}
        <span v-if="player.currentTrack.sampleRate">
          · {{ (player.currentTrack.sampleRate / 1000).toFixed(1) }} kHz
        </span>
        <span v-if="player.currentTrack.bitrate">
          · {{ player.currentTrack.bitrate }} kbps
        </span>
      </span>
      <span v-if="player.isPlaying" class="text-green-400">▶ Playing</span>
    </div>
  </footer>
</template>
