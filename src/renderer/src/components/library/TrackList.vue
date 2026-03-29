<script setup lang="ts">
import { computed } from 'vue'
import type { Track } from '../../stores/player'
import { usePlayerStore } from '../../stores/player'

const props = withDefaults(
  defineProps<{
    tracks: Track[]
    showAlbum?: boolean
  }>(),
  {
    showAlbum: true
  }
)

const emit = defineEmits<{
  (e: 'play', track: Track): void
  (e: 'edit-metadata', track: Track): void
}>()

const player = usePlayerStore()

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function isCurrentlyPlaying(track: Track): boolean {
  return player.currentTrack?.id === track.id
}

function handleContextMenu(event: MouseEvent, track: Track) {
  event.preventDefault()
  emit('edit-metadata', track)
}
</script>

<template>
  <div class="overflow-x-auto w-full">
    <table class="w-full min-w-[800px]">
      <thead class="sticky top-0 bg-neutral-950 z-10">
        <tr class="text-xs text-neutral-400 uppercase border-b border-neutral-800">
          <th class="column-header w-12 text-center">#</th>
          <th class="column-header">Title</th>
          <th v-if="showAlbum" class="column-header">Album</th>
          <th class="column-header">Artist</th>
          <th class="column-header w-20 text-right">Duration</th>
          <th class="column-header w-20 text-right">Format</th>
          <th class="column-header w-24 text-right">Size</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(track, index) in tracks"
          :key="track.id"
          class="track-row group border-b border-neutral-900"
          :class="{ 'bg-blue-900/20': isCurrentlyPlaying(track) }"
          @dblclick="emit('play', track)"
          @contextmenu="handleContextMenu($event, track)"
        >
          <td class="px-3 py-2 text-sm text-neutral-500 text-center w-12">
            <span v-if="isCurrentlyPlaying(track) && player.isPlaying" class="text-blue-400 animate-pulse">
              ▶
            </span>
            <span v-else class="group-hover:hidden text-neutral-600">{{ index + 1 }}</span>
          </td>
          <td class="px-3 py-2">
            <div class="font-medium truncate">{{ track.title || 'Unknown Title' }}</div>
          </td>
          <td v-if="showAlbum" class="px-3 py-2">
            <span class="text-sm text-neutral-400 truncate block">
              {{ track.album || '-' }}
            </span>
          </td>
          <td class="px-3 py-2">
            <span class="text-sm text-neutral-400 truncate block">
              {{ track.artist || '-' }}
            </span>
          </td>
          <td class="px-3 py-2 text-sm text-neutral-400 text-right w-20">
            {{ formatDuration(track.duration) }}
          </td>
          <td class="px-3 py-2 text-right w-20">
            <span
              class="text-xs px-2 py-0.5 rounded"
              :class="{
                'bg-green-900/50 text-green-400': ['FLAC', 'DSF', 'DFF', 'WAV'].includes(track.format),
                'bg-blue-900/50 text-blue-400': track.format === 'MP3',
                'bg-neutral-800 text-neutral-400': !['FLAC', 'DSF', 'DFF', 'WAV', 'MP3'].includes(track.format)
              }"
            >
              {{ track.format }}
            </span>
          </td>
          <td class="px-3 py-2 text-sm text-neutral-500 text-right w-24">
            {{ formatFileSize(track.fileSize) }}
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="tracks.length === 0" class="p-8 text-center text-neutral-500">
      No tracks found. Add a folder to start building your library.
    </div>
  </div>
</template>
