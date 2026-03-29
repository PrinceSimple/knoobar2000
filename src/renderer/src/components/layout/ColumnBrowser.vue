<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useLibraryStore } from '../../stores/library'
import { usePlayerStore, type Track } from '../../stores/player'
import TrackList from '../library/TrackList.vue'

const emit = defineEmits<{
  (e: 'edit-metadata', track: { id: string; filePath: string }): void
}>()

const library = useLibraryStore()
const player = usePlayerStore()

const searchInput = ref('')
const showSearch = ref(false)

const breadcrumb = computed(() => {
  const parts: string[] = []
  if (library.activeFacet === 'artists' && library.selectedArtist) {
    parts.push('Artists', library.selectedArtist)
  } else if (library.activeFacet === 'albums' && library.selectedAlbum) {
    parts.push('Albums', library.selectedAlbum)
  } else if (library.activeFacet === 'genres' && library.selectedGenre) {
    parts.push('Genres', library.selectedGenre)
  } else if (library.activeFacet === 'playlists') {
    parts.push('Playlists')
  } else {
    parts.push('All Music')
  }
  return parts
})

watch(searchInput, (query) => {
  if (query.length >= 2) {
    library.search(query)
  } else if (query.length === 0 && library.activeFacet === 'search') {
    library.setFacet('all')
  }
})

function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchInput.value = ''
    library.setFacet('all')
  }
}

function handleTrackDoubleClick(track: Track) {
  player.playTrack(track)
}

function handleTrackContextMenu(track: Track) {
  emit('edit-metadata', { id: track.id, filePath: track.filePath })
}

function getArtistAlbums(artist: string) {
  return library.albums.filter((a) => a.artist === artist).slice(0, 5)
}

function getAlbumTracks(album: string) {
  return library.tracks.filter((t) => t.album === album)
}
</script>

<template>
  <main class="flex flex-col h-full bg-neutral-950">
    <header class="flex items-center gap-4 px-4 py-3 border-b border-neutral-800">
      <div class="flex items-center gap-2">
        <button
          v-for="(crumb, index) in breadcrumb"
          :key="index"
          class="text-sm"
          :class="[
            index === breadcrumb.length - 1 ? 'text-white' : 'text-neutral-400 hover:text-white'
          ]"
          @click="
            () => {
              if (index === 0) {
                if (crumb === 'All Music') library.setFacet('all')
                else if (crumb === 'Artists') library.setFacet('artists')
                else if (crumb === 'Albums') library.setFacet('albums')
                else if (crumb === 'Genres') library.setFacet('genres')
              }
            }
          "
        >
          {{ crumb }}
          <span v-if="index < breadcrumb.length - 1" class="ml-2 text-neutral-600">/</span>
        </button>
      </div>

      <div class="flex-1" />

      <button
        class="p-2 hover:bg-neutral-800 rounded transition-colors"
        :class="{ 'bg-neutral-800': showSearch }"
        @click="toggleSearch"
      >
        🔍
      </button>
    </header>

    <div v-if="showSearch" class="px-4 py-3 border-b border-neutral-800">
      <input
        v-model="searchInput"
        type="text"
        placeholder="Search tracks, artists, albums..."
        class="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
        autofocus
      />
    </div>

    <div v-if="library.isScanning" class="px-4 py-3 bg-blue-900/30 border-b border-neutral-800">
      <div class="flex items-center gap-3">
        <div class="animate-spin">⟳</div>
        <div class="flex-1">
          <div class="text-sm text-blue-400">
            Scanning... {{ library.scanProgress?.current }} /
            {{ library.scanProgress?.total }}
          </div>
          <div
            v-if="library.scanProgress?.currentFile"
            class="text-xs text-neutral-500 truncate"
          >
            {{ library.scanProgress.currentFile }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- All Music / Search View -->
      <div v-if="library.activeFacet === 'all' || library.activeFacet === 'search'">
        <TrackList
          :tracks="library.filteredTracks"
          @play="handleTrackDoubleClick"
          @edit-metadata="handleTrackContextMenu"
        />
      </div>

      <!-- Artists View -->
      <div v-else-if="library.activeFacet === 'artists'">
        <template v-if="!library.selectedArtist">
          <div class="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div
              v-for="artist in library.artists"
              :key="artist.id"
              class="p-4 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
              @click="library.selectArtist(artist.name)"
            >
              <div class="w-full h-32 bg-neutral-800 rounded mb-3 flex items-center justify-center text-4xl">
                👤
              </div>
              <div class="font-medium truncate">{{ artist.name }}</div>
              <div class="text-sm text-neutral-500">{{ artist.albumCount }} albums</div>
            </div>
          </div>
        </template>
        <template v-else>
          <div class="p-4">
            <h2 class="text-xl font-bold mb-4">{{ library.selectedArtist }}</h2>
            <div
              v-for="album in getArtistAlbums(library.selectedArtist!)"
              :key="album.id"
              class="mb-6"
            >
              <div class="flex items-center gap-4 mb-2">
                <div class="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center">
                  💿
                </div>
                <div>
                  <div class="font-medium">{{ album.name }}</div>
                  <div class="text-sm text-neutral-500">{{ album.year }}</div>
                </div>
              </div>
              <TrackList
                :tracks="getAlbumTracks(album.name)"
                :show-album="false"
                @play="handleTrackDoubleClick"
              />
            </div>
          </div>
        </template>
      </div>

      <!-- Albums View -->
      <div v-else-if="library.activeFacet === 'albums'">
        <div class="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <div
            v-for="album in library.albums"
            :key="album.id"
            class="p-3 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
            @click="library.selectAlbum(album.name)"
          >
            <div class="w-full aspect-square bg-neutral-800 rounded mb-3 flex items-center justify-center text-4xl">
              💿
            </div>
            <div class="font-medium truncate">{{ album.name }}</div>
            <div class="text-sm text-neutral-500 truncate">{{ album.artist }}</div>
          </div>
        </div>
      </div>

      <!-- Genres View -->
      <div v-else-if="library.activeFacet === 'genres'">
        <template v-if="!library.selectedGenre">
          <div class="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div
              v-for="genre in library.genres"
              :key="genre"
              class="p-4 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
              @click="library.selectGenre(genre)"
            >
              <span class="text-2xl mr-2">🏷</span>
              {{ genre }}
            </div>
          </div>
        </template>
        <template v-else>
          <TrackList
            :tracks="library.filteredTracks"
            @play="handleTrackDoubleClick"
            @edit-metadata="handleTrackContextMenu"
          />
        </template>
      </div>

      <!-- Recent View -->
      <div v-else-if="library.activeFacet === 'recent'">
        <TrackList
          :tracks="library.filteredTracks"
          @play="handleTrackDoubleClick"
          @edit-metadata="handleTrackContextMenu"
        />
      </div>

      <!-- Playlists View -->
      <div v-else-if="library.activeFacet === 'playlists'">
        <div class="p-4">
          <button
            class="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded transition-colors"
            @click="library.createPlaylist('New Playlist')"
          >
            + New Playlist
          </button>

          <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            <div
              v-for="playlist in library.playlists"
              :key="playlist.id"
              class="p-4 bg-neutral-900 rounded-lg hover:bg-neutral-800 cursor-pointer transition-colors"
            >
              <div class="w-full h-24 bg-neutral-800 rounded mb-3 flex items-center justify-center text-4xl">
                📋
              </div>
              <div class="font-medium truncate">{{ playlist.name }}</div>
              <div class="text-sm text-neutral-500">{{ playlist.trackCount }} tracks</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
