<script setup lang="ts">
import { ref } from 'vue'
import Sidebar from './Sidebar.vue'
import ColumnBrowser from './ColumnBrowser.vue'
import PlayerBar from '../player/PlayerBar.vue'
import StatusBar from './StatusBar.vue'
import MetadataEditor from '../library/MetadataEditor.vue'

const showMetadataEditor = ref(false)
const editingTrack = ref<{ id: string; filePath: string } | null>(null)

function openMetadataEditor(track: { id: string; filePath: string }) {
  editingTrack.value = track
  showMetadataEditor.value = true
}

function closeMetadataEditor() {
  showMetadataEditor.value = false
  editingTrack.value = null
}
</script>

<template>
  <div class="flex flex-col h-full">
    <div class="flex flex-1 overflow-hidden">
      <Sidebar class="w-48 flex-shrink-0" />
      <ColumnBrowser class="flex-1" @edit-metadata="openMetadataEditor" />
    </div>
    <PlayerBar />
    <StatusBar />
  </div>

  <MetadataEditor
    v-if="showMetadataEditor && editingTrack"
    :track-id="editingTrack.id"
    :file-path="editingTrack.filePath"
    @close="closeMetadataEditor"
  />
</template>
