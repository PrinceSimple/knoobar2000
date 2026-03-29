import { contextBridge, ipcRenderer } from "electron";
import { electronAPI } from "@electron-toolkit/preload";

const api = {
  // Player controls
  player: {
    play: (filePath: string) => ipcRenderer.invoke("player:play", filePath),
    pause: () => {
      ipcRenderer.send("player:pause");
    },
    resume: () => ipcRenderer.send("player:resume"),
    stop: () => ipcRenderer.send("player:stop"),
    seek: (position: number) => ipcRenderer.invoke("player:seek", position),
    setVolume: (volume: number) =>
      ipcRenderer.invoke("player:setVolume", volume),
    setDevice: (deviceId: string) =>
      ipcRenderer.invoke("player:setDevice", deviceId),
    getDevices: () => ipcRenderer.invoke("player:getDevices"),
    setReplayGain: (enabled: boolean, preamp: number) =>
      ipcRenderer.invoke("player:setReplayGain", enabled, preamp),
    onPlaybackState: (callback: (state: PlaybackState) => void) => {
      ipcRenderer.on("player:playbackState", (_event, state) =>
        callback(state),
      );
    },
    onTimeUpdate: (callback: (time: TimeUpdate) => void) => {
      ipcRenderer.on("player:timeUpdate", (_event, time) => callback(time));
    },
  },

  // Library
  library: {
    scanFolder: (folderPath: string) =>
      ipcRenderer.invoke("library:scanFolder", folderPath),
    getTracks: (filters?: TrackFilters) =>
      ipcRenderer.invoke("library:getTracks", filters),
    getAlbums: () => ipcRenderer.invoke("library:getAlbums"),
    getArtists: () => ipcRenderer.invoke("library:getArtists"),
    getGenres: () => ipcRenderer.invoke("library:getGenres"),
    search: (query: string) => ipcRenderer.invoke("library:search", query),
    getRecent: (limit?: number) =>
      ipcRenderer.invoke("library:getRecent", limit),
    addWatchFolder: (folderPath: string) =>
      ipcRenderer.invoke("library:addWatchFolder", folderPath),
    removeWatchFolder: (folderPath: string) =>
      ipcRenderer.invoke("library:removeWatchFolder", folderPath),
    getWatchFolders: () => ipcRenderer.invoke("library:getWatchFolders"),
    updatePlayCount: (trackId: string) =>
      ipcRenderer.invoke("library:updatePlayCount", trackId),
    onScanProgress: (callback: (progress: ScanProgress) => void) => {
      ipcRenderer.on("library:scanProgress", (_event, progress) =>
        callback(progress),
      );
    },
    onLibraryUpdate: (callback: () => void) => {
      ipcRenderer.on("library:update", () => callback());
    },
  },

  // Metadata
  metadata: {
    getTags: (filePath: string) =>
      ipcRenderer.invoke("metadata:getTags", filePath),
    writeTags: (filePath: string, tags: MetadataTags) =>
      ipcRenderer.invoke("metadata:writeTags", filePath, tags),
    getCoverArt: (filePath: string) =>
      ipcRenderer.invoke("metadata:getCoverArt", filePath),
  },

  // Playlists
  playlists: {
    getAll: () => ipcRenderer.invoke("playlists:getAll"),
    getById: (id: string) => ipcRenderer.invoke("playlists:getById", id),
    create: (name: string) => ipcRenderer.invoke("playlists:create", name),
    delete: (id: string) => ipcRenderer.invoke("playlists:delete", id),
    addTrack: (playlistId: string, trackId: string) =>
      ipcRenderer.invoke("playlists:addTrack", playlistId, trackId),
    removeTrack: (playlistId: string, trackId: string) =>
      ipcRenderer.invoke("playlists:removeTrack", playlistId, trackId),
    reorderTrack: (playlistId: string, fromIndex: number, toIndex: number) =>
      ipcRenderer.invoke(
        "playlists:reorderTrack",
        playlistId,
        fromIndex,
        toIndex,
      ),
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke("settings:get"),
    set: (settings: Partial<AppSettings>) =>
      ipcRenderer.invoke("settings:set", settings),
  },

  // Dialog
  dialog: {
    selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
  },
};

export type PlaybackState = {
  status: "playing" | "paused" | "stopped";
  filePath: string;
  duration: number;
  format: string;
};

export type TimeUpdate = {
  position: number;
  duration: number;
};

export type TrackFilters = {
  artist?: string;
  album?: string;
  genre?: string;
  format?: string;
  limit?: number;
  offset?: number;
};

export type ScanProgress = {
  current: number;
  total: number;
  currentFile: string;
};

export type MetadataTags = {
  title?: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  year?: number;
  track?: number;
  disc?: number;
  genre?: string;
  comment?: string;
  lyrics?: string;
  composer?: string;
  bpm?: number;
  coverArt?: string;
};

export type AppSettings = {
  watchFolders: string[];
  outputDevice: string;
  volume: number;
  replayGainEnabled: boolean;
  replayGainPreamp: number;
  theme: "dark" | "light";
  libraryView: "list" | "grid";
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", electronAPI);
    contextBridge.exposeInMainWorld("api", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI;
  // @ts-ignore (define in dts)
  window.api = api;
}
