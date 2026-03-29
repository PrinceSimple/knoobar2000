<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  trackId: string
  filePath: string
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface MetadataTags {
  title: string
  artist: string
  album: string
  albumArtist: string
  year: number
  track: number
  disc: number
  genre: string
}

const tags = ref<MetadataTags>({
  title: '',
  artist: '',
  album: '',
  albumArtist: '',
  year: 0,
  track: 0,
  disc: 1,
  genre: ''
})

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const metadata = await window.api.metadata.getTags(props.filePath)
    tags.value = {
      title: metadata.title || '',
      artist: metadata.artist || '',
      album: metadata.album || '',
      albumArtist: metadata.albumArtist || '',
      year: metadata.year || 0,
      track: metadata.trackNumber || 0,
      disc: metadata.discNumber || 1,
      genre: metadata.genre || ''
    }
  } catch (err) {
    error.value = 'Failed to load metadata'
    console.error(err)
  } finally {
    loading.value = false
  }
})

async function saveTags() {
  saving.value = true
  error.value = null

  try {
    await window.api.metadata.writeTags(props.filePath, tags.value)
    emit('close')
  } catch (err) {
    error.value = 'Failed to save metadata'
    console.error(err)
  } finally {
    saving.value = false
  }
}

function handleOverlayClick(event: MouseEvent) {
  if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
    emit('close')
  }
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/70 flex items-center justify-center z-50 modal-overlay"
    @click="handleOverlayClick"
  >
    <div class="bg-neutral-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
      <header class="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <h2 class="text-lg font-semibold">Edit Metadata</h2>
        <button
          class="p-1 hover:bg-neutral-800 rounded transition-colors"
          @click="emit('close')"
        >
          ✕
        </button>
      </header>

      <div class="p-6 overflow-y-auto max-h-[60vh]">
        <div v-if="loading" class="text-center py-8 text-neutral-500">Loading...</div>
        <div v-else-if="error" class="text-center py-8 text-red-400">{{ error }}</div>
        <form v-else class="space-y-4">
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Title</label>
              <input
                v-model="tags.title"
                type="text"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Artist</label>
              <input
                v-model="tags.artist"
                type="text"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Album</label>
              <input
                v-model="tags.album"
                type="text"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Album Artist</label>
              <input
                v-model="tags.albumArtist"
                type="text"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="grid grid-cols-4 gap-4">
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Year</label>
              <input
                v-model.number="tags.year"
                type="number"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Track #</label>
              <input
                v-model.number="tags.track"
                type="number"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Disc #</label>
              <input
                v-model.number="tags.disc"
                type="number"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label class="block text-sm text-neutral-400 mb-1">Genre</label>
              <input
                v-model="tags.genre"
                type="text"
                class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div class="text-xs text-neutral-500 mt-2">
            File: {{ filePath }}
          </div>
        </form>
      </div>

      <footer class="flex justify-end gap-3 px-6 py-4 border-t border-neutral-800">
        <button
          class="px-4 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
          @click="emit('close')"
        >
          Cancel
        </button>
        <button
          class="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded transition-colors disabled:opacity-50"
          :disabled="saving"
          @click="saveTags"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
      </footer>
    </div>
  </div>
</template>
