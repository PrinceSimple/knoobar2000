import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Track } from './player'

export interface Album {
  id: string
  name: string
  artist: string
  year: number
  trackCount: number
  coverPath: string | null
}

export interface Artist {
  id: string
  name: string
  albumCount: number
  trackCount: number
}

export interface Playlist {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  trackCount: number
}

export interface ScanProgress {
  current: number
  total: number
  currentFile: string
}

export type FacetType = 'all' | 'artists' | 'albums' | 'genres' | 'recent' | 'playlists' | 'search'

export const useLibraryStore = defineStore('library', () => {
  const tracks = ref<Track[]>([])
  const albums = ref<Album[]>([])
  const artists = ref<Artist[]>([])
  const genres = ref<string[]>([])
  const playlists = ref<Playlist[]>([])
  const watchFolders = ref<string[]>([])

  const activeFacet = ref<FacetType>('all')
  const selectedArtist = ref<string | null>(null)
  const selectedAlbum = ref<string | null>(null)
  const selectedGenre = ref<string | null>(null)
  const searchQuery = ref('')

  const isScanning = ref(false)
  const scanProgress = ref<ScanProgress | null>(null)

  const filteredTracks = computed(() => {
    let result = tracks.value

    if (activeFacet.value === 'artists' && selectedArtist.value) {
      result = result.filter((t) => t.artist === selectedArtist.value)
    }
    if (activeFacet.value === 'albums' && selectedAlbum.value) {
      result = result.filter((t) => t.album === selectedAlbum.value)
    }
    if (activeFacet.value === 'genres' && selectedGenre.value) {
      result = result.filter((t) => t.genre === selectedGenre.value)
    }
    if (activeFacet.value === 'recent') {
      result = [...tracks.value].sort(
        (a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
      )
    }

    return result
  })

  const trackCount = computed(() => tracks.value.length)
  const albumCount = computed(() => albums.value.length)
  const artistCount = computed(() => artists.value.length)

  function init() {
    loadLibrary()
    setupListeners()
  }

  function setupListeners() {
    window.api.library.onScanProgress((progress) => {
      scanProgress.value = progress
      isScanning.value = progress.current < progress.total
    })

    window.api.library.onLibraryUpdate(() => {
      loadLibrary()
    })
  }

  async function loadLibrary() {
    try {
      const [tracksData, albumsData, artistsData, genresData, playlistsData, foldersData] =
        await Promise.all([
          window.api.library.getTracks(),
          window.api.library.getAlbums(),
          window.api.library.getArtists(),
          window.api.library.getGenres(),
          window.api.playlists.getAll(),
          window.api.library.getWatchFolders()
        ])

      tracks.value = tracksData
      albums.value = albumsData
      artists.value = artistsData
      genres.value = genresData
      playlists.value = playlistsData
      watchFolders.value = foldersData
    } catch (error) {
      console.error('Failed to load library:', error)
    }
  }

  async function scanFolder(folderPath: string) {
    isScanning.value = true
    scanProgress.value = { current: 0, total: 0, currentFile: '' }
    await window.api.library.scanFolder(folderPath)
  }

  async function addWatchFolder() {
    const folder = await window.api.dialog.selectFolder()
    if (folder) {
      await window.api.library.addWatchFolder(folder)
      watchFolders.value.push(folder)
      await scanFolder(folder)
    }
  }

  async function removeWatchFolder(folderPath: string) {
    await window.api.library.removeWatchFolder(folderPath)
    watchFolders.value = watchFolders.value.filter((f) => f !== folderPath)
  }

  function setFacet(facet: FacetType) {
    activeFacet.value = facet
    selectedArtist.value = null
    selectedAlbum.value = null
    selectedGenre.value = null
    searchQuery.value = ''
  }

  function selectArtist(artist: string) {
    selectedArtist.value = artist
    activeFacet.value = 'artists'
  }

  function selectAlbum(album: string) {
    selectedAlbum.value = album
    activeFacet.value = 'albums'
  }

  function selectGenre(genre: string) {
    selectedGenre.value = genre
    activeFacet.value = 'genres'
  }

  async function search(query: string) {
    searchQuery.value = query
    if (query.trim()) {
      const results = await window.api.library.search(query)
      tracks.value = results
      activeFacet.value = 'search'
    } else {
      await loadLibrary()
      activeFacet.value = 'all'
    }
  }

  async function createPlaylist(name: string) {
    const playlist = await window.api.playlists.create(name)
    playlists.value.push(playlist)
    return playlist
  }

  async function deletePlaylist(id: string) {
    await window.api.playlists.delete(id)
    playlists.value = playlists.value.filter((p) => p.id !== id)
  }

  async function getPlaylistTracks(id: string): Promise<Track[]> {
    return window.api.playlists.getById(id)
  }

  async function addToPlaylist(playlistId: string, trackId: string) {
    await window.api.playlists.addTrack(playlistId, trackId)
    const playlist = playlists.value.find((p) => p.id === playlistId)
    if (playlist) {
      playlist.trackCount++
    }
  }

  return {
    tracks,
    albums,
    artists,
    genres,
    playlists,
    watchFolders,
    activeFacet,
    selectedArtist,
    selectedAlbum,
    selectedGenre,
    searchQuery,
    isScanning,
    scanProgress,
    filteredTracks,
    trackCount,
    albumCount,
    artistCount,
    init,
    loadLibrary,
    scanFolder,
    addWatchFolder,
    removeWatchFolder,
    setFacet,
    selectArtist,
    selectAlbum,
    selectGenre,
    search,
    createPlaylist,
    deletePlaylist,
    getPlaylistTracks,
    addToPlaylist
  }
})
