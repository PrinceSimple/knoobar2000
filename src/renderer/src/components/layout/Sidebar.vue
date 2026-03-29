<script setup lang="ts">
import { useLibraryStore } from '../../stores/library'
import type { FacetType } from '../../stores/library'

const library = useLibraryStore()

interface FacetItem {
  id: FacetType
  label: string
  icon: string
}

const facets: FacetItem[] = [
  { id: 'all', label: 'All Music', icon: '♪' },
  { id: 'artists', label: 'Artists', icon: '👤' },
  { id: 'albums', label: 'Albums', icon: '💿' },
  { id: 'genres', label: 'Genres', icon: '🏷' },
  { id: 'recent', label: 'Recently Added', icon: '🕐' },
  { id: 'playlists', label: 'Playlists', icon: '📋' }
]
</script>

<template>
  <aside class="flex flex-col h-full bg-neutral-900 border-r border-neutral-800">
    <div class="p-4 border-b border-neutral-800">
      <h1 class="text-lg font-bold text-blue-400">knoobar2000</h1>
    </div>

    <nav class="flex-1 py-2 overflow-y-auto">
      <div
        v-for="facet in facets"
        :key="facet.id"
        class="facet-item"
        :class="{ active: library.activeFacet === facet.id }"
        @click="library.setFacet(facet.id)"
      >
        <span class="w-5 text-center">{{ facet.icon }}</span>
        <span>{{ facet.label }}</span>
      </div>
    </nav>

    <div class="p-3 border-t border-neutral-800">
      <button
        class="w-full px-3 py-2 text-sm bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
        @click="library.addWatchFolder"
      >
        + Add Folder
      </button>
    </div>

    <div v-if="library.watchFolders.length > 0" class="p-3 border-t border-neutral-800">
      <div class="text-xs text-neutral-500 mb-2">Watch Folders</div>
      <div
        v-for="folder in library.watchFolders"
        :key="folder"
        class="text-xs text-neutral-400 truncate mb-1"
        :title="folder"
      >
        {{ folder.split(/[/\\]/).pop() }}
      </div>
    </div>
  </aside>
</template>
