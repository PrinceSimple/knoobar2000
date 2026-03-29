<script setup lang="ts">
import { onMounted } from 'vue'
import AppLayout from './components/layout/AppLayout.vue'
import { usePlayerStore } from './stores/player'
import { useLibraryStore } from './stores/library'

const playerStore = usePlayerStore()
const libraryStore = useLibraryStore()

onMounted(() => {
  playerStore.init()
  libraryStore.init()
})
</script>

<template>
  <AppLayout />
</template>
