import { ipcMain, dialog, BrowserWindow } from "electron";
import {
  getAllTracks,
  getAlbums,
  getArtists,
  getGenres,
  searchTracks,
  getRecentTracks,
  updatePlayCount as dbUpdatePlayCount,
  getPlaylists,
  getPlaylistTracks,
  createPlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  getWatchFolders,
  getSetting,
  setSetting,
} from "../services/database";
import {
  play,
  pause,
  resume,
  stop,
  seek,
  setVolume,
  setReplayGain,
  getAudioDevices,
} from "../services/audio";
import {
  parseMetadata,
  getCoverArt,
  writeMetadata,
} from "../services/metadata";
import {
  scanFolder,
  addWatchFolder,
  removeWatchFolder,
  startWatching,
} from "../services/scanner";

export function setupIpcHandlers(): void {
  // Player handlers
  ipcMain.handle("player:play", async (_event, filePath: string) => {
    await play(filePath);
  });

  ipcMain.on("player:pause", () => {
    console.time("ipc-pause-received");
    pause();
    console.timeEnd("ipc-pause-received");
  });

  ipcMain.on("player:resume", () => {
    resume();
  });

  ipcMain.on("player:stop", () => {
    stop();
  });

  ipcMain.handle("player:seek", (_event, position: number) => {
    seek(position);
  });

  ipcMain.handle("player:setVolume", (_event, volume: number) => {
    setVolume(volume);
  });

  ipcMain.handle("player:setDevice", (_event, _deviceId: string) => {
    // Device selection would require platform-specific implementation
    console.log("Device selection not fully implemented");
  });

  ipcMain.handle("player:getDevices", async () => {
    return getAudioDevices();
  });

  ipcMain.handle(
    "player:setReplayGain",
    (_event, enabled: boolean, preamp: number) => {
      setReplayGain(enabled, preamp);
    },
  );

  // Library handlers
  ipcMain.handle("library:scanFolder", async (_event, folderPath: string) => {
    await scanFolder(folderPath);
  });

  ipcMain.handle("library:getTracks", (_event, filters) => {
    return getAllTracks(filters);
  });

  ipcMain.handle("library:getAlbums", () => {
    return getAlbums();
  });

  ipcMain.handle("library:getArtists", () => {
    return getArtists();
  });

  ipcMain.handle("library:getGenres", () => {
    return getGenres();
  });

  ipcMain.handle("library:search", (_event, query: string) => {
    return searchTracks(query);
  });

  ipcMain.handle("library:getRecent", (_event, limit?: number) => {
    return getRecentTracks(limit);
  });

  ipcMain.handle(
    "library:addWatchFolder",
    async (_event, folderPath: string) => {
      await addWatchFolder(folderPath);
    },
  );

  ipcMain.handle(
    "library:removeWatchFolder",
    async (_event, folderPath: string) => {
      await removeWatchFolder(folderPath);
    },
  );

  ipcMain.handle("library:getWatchFolders", () => {
    return getWatchFolders();
  });

  ipcMain.handle("library:updatePlayCount", (_event, trackId: string) => {
    dbUpdatePlayCount(trackId);
  });

  // Metadata handlers
  ipcMain.handle("metadata:getTags", async (_event, filePath: string) => {
    return parseMetadata(filePath);
  });

  ipcMain.handle(
    "metadata:writeTags",
    async (_event, filePath: string, tags) => {
      await writeMetadata(filePath, tags);
    },
  );

  ipcMain.handle("metadata:getCoverArt", async (_event, filePath: string) => {
    return getCoverArt(filePath);
  });

  // Playlist handlers
  ipcMain.handle("playlists:getAll", () => {
    return getPlaylists();
  });

  ipcMain.handle("playlists:getById", (_event, id: string) => {
    return getPlaylistTracks(id);
  });

  ipcMain.handle("playlists:create", (_event, name: string) => {
    return createPlaylist(name);
  });

  ipcMain.handle("playlists:delete", (_event, id: string) => {
    deletePlaylist(id);
  });

  ipcMain.handle(
    "playlists:addTrack",
    (_event, playlistId: string, trackId: string) => {
      addTrackToPlaylist(playlistId, trackId);
    },
  );

  ipcMain.handle(
    "playlists:removeTrack",
    (_event, playlistId: string, trackId: string) => {
      removeTrackFromPlaylist(playlistId, trackId);
    },
  );

  ipcMain.handle(
    "playlists:reorderTrack",
    (_event, playlistId: string, fromIndex: number, toIndex: number) => {
      // Reordering would require updating positions for all affected tracks
      console.log("Reorder not implemented:", playlistId, fromIndex, toIndex);
    },
  );

  // Settings handlers
  ipcMain.handle("settings:get", () => {
    return {
      watchFolders: getWatchFolders(),
      outputDevice: getSetting("outputDevice", "default"),
      volume: parseFloat(getSetting("volume", "1.0")),
      replayGainEnabled: getSetting("replayGainEnabled", "true") === "true",
      replayGainPreamp: parseFloat(getSetting("replayGainPreamp", "0")),
      theme: getSetting("theme", "dark"),
      libraryView: getSetting("libraryView", "list"),
    };
  });

  ipcMain.handle("settings:set", (_event, settings) => {
    if (settings.watchFolders !== undefined) {
      // Handle watch folders separately
    }
    if (settings.outputDevice !== undefined) {
      setSetting("outputDevice", settings.outputDevice);
    }
    if (settings.volume !== undefined) {
      setSetting("volume", settings.volume.toString());
    }
    if (settings.replayGainEnabled !== undefined) {
      setSetting("replayGainEnabled", settings.replayGainEnabled.toString());
    }
    if (settings.replayGainPreamp !== undefined) {
      setSetting("replayGainPreamp", settings.replayGainPreamp.toString());
    }
    if (settings.theme !== undefined) {
      setSetting("theme", settings.theme);
    }
    if (settings.libraryView !== undefined) {
      setSetting("libraryView", settings.libraryView);
    }
  });

  // Dialog handlers
  ipcMain.handle("dialog:selectFolder", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return result.filePaths[0];
  });

  // Initialize watcher on startup
  startWatching().catch(console.error);

  console.log("IPC handlers registered");
}
