import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database | null = null

export interface Track {
  id: string
  filePath: string
  title: string
  artist: string
  album: string
  albumArtist: string
  year: number
  trackNumber: number
  discNumber: number
  genre: string
  format: string
  duration: number
  bitrate: number
  sampleRate: number
  channels: number
  codec: string
  replayGainTrack: number
  replayGainAlbum: number
  playCount: number
  lastPlayed: string | null
  dateAdded: string
  fileSize: number
}

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

export interface PlaylistTrack {
  trackId: string
  position: number
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'music.db')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')

  createTables()
  console.log('Database initialized at:', dbPath)
}

function createTables(): void {
  if (!db) return

  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      filePath TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      artist TEXT DEFAULT '',
      album TEXT DEFAULT '',
      albumArtist TEXT DEFAULT '',
      year INTEGER DEFAULT 0,
      trackNumber INTEGER DEFAULT 0,
      discNumber INTEGER DEFAULT 1,
      genre TEXT DEFAULT '',
      format TEXT NOT NULL,
      duration REAL DEFAULT 0,
      bitrate INTEGER DEFAULT 0,
      sampleRate INTEGER DEFAULT 0,
      channels INTEGER DEFAULT 2,
      codec TEXT DEFAULT '',
      replayGainTrack REAL DEFAULT 0,
      replayGainAlbum REAL DEFAULT 0,
      playCount INTEGER DEFAULT 0,
      lastPlayed TEXT,
      dateAdded TEXT NOT NULL,
      fileSize INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlist_tracks (
      playlistId TEXT NOT NULL,
      trackId TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlistId, trackId),
      FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (trackId) REFERENCES tracks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watch_folders (
      path TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album);
    CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre);
    CREATE INDEX IF NOT EXISTS idx_tracks_format ON tracks(format);
    CREATE INDEX IF NOT EXISTS idx_tracks_dateAdded ON tracks(dateAdded);
  `)
}

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function insertTrack(track: {
  filePath: string
  title: string
  artist?: string
  album?: string
  albumArtist?: string
  year?: number
  trackNumber?: number
  discNumber?: number
  genre?: string
  format: string
  duration?: number
  bitrate?: number
  sampleRate?: number
  channels?: number
  codec?: string
  replayGainTrack?: number
  replayGainAlbum?: number
  playCount?: number
  lastPlayed?: string | null
  fileSize?: number
}): Track {
  const db = getDb()
  const id = uuidv4()
  const dateAdded = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO tracks (
      id, filePath, title, artist, album, albumArtist, year, trackNumber, discNumber,
      genre, format, duration, bitrate, sampleRate, channels, codec,
      replayGainTrack, replayGainAlbum, playCount, lastPlayed, dateAdded, fileSize
    ) VALUES (
      @id, @filePath, @title, @artist, @album, @albumArtist, @year, @trackNumber, @discNumber,
      @genre, @format, @duration, @bitrate, @sampleRate, @channels, @codec,
      @replayGainTrack, @replayGainAlbum, @playCount, @lastPlayed, @dateAdded, @fileSize
    )
  `)

  stmt.run({
    id,
    dateAdded,
    playCount: 0,
    lastPlayed: null,
    ...track
  })
  return {
    id,
    dateAdded,
    playCount: 0,
    lastPlayed: null,
    ...track
  } as Track
}

export function getAllTracks(filters?: {
  artist?: string
  album?: string
  genre?: string
  format?: string
  limit?: number
  offset?: number
}): Track[] {
  const db = getDb()
  let query = 'SELECT * FROM tracks WHERE 1=1'
  const params: Record<string, unknown> = {}

  if (filters?.artist) {
    query += ' AND artist = @artist'
    params.artist = filters.artist
  }
  if (filters?.album) {
    query += ' AND album = @album'
    params.album = filters.album
  }
  if (filters?.genre) {
    query += ' AND genre = @genre'
    params.genre = filters.genre
  }
  if (filters?.format) {
    query += ' AND format = @format'
    params.format = filters.format
  }

  query += ' ORDER BY artist, album, discNumber, trackNumber'

  if (filters?.limit) {
    query += ' LIMIT @limit'
    params.limit = filters.limit
  }
  if (filters?.offset) {
    query += ' OFFSET @offset'
    params.offset = filters.offset
  }

  return db.prepare(query).all(params) as Track[]
}

export function getTrackById(id: string): Track | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as Track | undefined
}

export function getTrackByPath(filePath: string): Track | undefined {
  const db = getDb()
  return db.prepare('SELECT * FROM tracks WHERE filePath = ?').get(filePath) as Track | undefined
}

export function deleteTrack(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM tracks WHERE id = ?').run(id)
}

export function updatePlayCount(id: string): void {
  const db = getDb()
  db.prepare(`
    UPDATE tracks 
    SET playCount = playCount + 1, lastPlayed = @lastPlayed 
    WHERE id = @id
  `).run({ id, lastPlayed: new Date().toISOString() })
}

export function getAlbums(): Album[] {
  const db = getDb()
  return db.prepare(`
    SELECT 
      album || '|' || albumArtist as id,
      album as name,
      albumArtist as artist,
      MAX(year) as year,
      COUNT(*) as trackCount,
      NULL as coverPath
    FROM tracks 
    WHERE album != ''
    GROUP BY album, albumArtist
    ORDER BY artist, year DESC, album
  `).all() as Album[]
}

export function getArtists(): Artist[] {
  const db = getDb()
  return db.prepare(`
    SELECT 
      artist as id,
      artist as name,
      COUNT(DISTINCT album) as albumCount,
      COUNT(*) as trackCount
    FROM tracks 
    WHERE artist != ''
    GROUP BY artist
    ORDER BY artist
  `).all() as Artist[]
}

export function getGenres(): string[] {
  const db = getDb()
  const results = db.prepare(`
    SELECT DISTINCT genre FROM tracks WHERE genre != '' ORDER BY genre
  `).all() as { genre: string }[]
  return results.map((r) => r.genre)
}

export function searchTracks(query: string): Track[] {
  const db = getDb()
  const searchTerm = `%${query}%`
  return db.prepare(`
    SELECT * FROM tracks 
    WHERE title LIKE @query 
       OR artist LIKE @query 
       OR album LIKE @query 
       OR genre LIKE @query
    ORDER BY 
      CASE 
        WHEN title LIKE @exactQuery THEN 0
        WHEN artist LIKE @exactQuery THEN 1
        WHEN album LIKE @exactQuery THEN 2
        ELSE 3
      END,
      artist, album, trackNumber
    LIMIT 100
  `).all({ query: searchTerm, exactQuery: `${query}%` }) as Track[]
}

export function getRecentTracks(limit = 50): Track[] {
  const db = getDb()
  return db.prepare(`
    SELECT * FROM tracks 
    ORDER BY dateAdded DESC 
    LIMIT ?
  `).all(limit) as Track[]
}

export function getPlaylists(): Playlist[] {
  const db = getDb()
  return db.prepare(`
    SELECT p.*, COUNT(pt.trackId) as trackCount
    FROM playlists p
    LEFT JOIN playlist_tracks pt ON p.id = pt.playlistId
    GROUP BY p.id
    ORDER BY p.updatedAt DESC
  `).all() as Playlist[]
}

export function getPlaylistTracks(playlistId: string): Track[] {
  const db = getDb()
  return db.prepare(`
    SELECT t.* FROM tracks t
    JOIN playlist_tracks pt ON t.id = pt.trackId
    WHERE pt.playlistId = ?
    ORDER BY pt.position
  `).all(playlistId) as Track[]
}

export function createPlaylist(name: string): Playlist {
  const db = getDb()
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare(`
    INSERT INTO playlists (id, name, createdAt, updatedAt) VALUES (?, ?, ?, ?)
  `).run(id, name, now, now)
  return { id, name, createdAt: now, updatedAt: now, trackCount: 0 }
}

export function deletePlaylist(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM playlists WHERE id = ?').run(id)
}

export function addTrackToPlaylist(playlistId: string, trackId: string): void {
  const db = getDb()
  const maxPos = db.prepare(`
    SELECT COALESCE(MAX(position), -1) as pos FROM playlist_tracks WHERE playlistId = ?
  `).get(playlistId) as { pos: number }

  db.prepare(`
    INSERT OR IGNORE INTO playlist_tracks (playlistId, trackId, position) VALUES (?, ?, ?)
  `).run(playlistId, trackId, maxPos.pos + 1)

  db.prepare(`
    UPDATE playlists SET updatedAt = ? WHERE id = ?
  `).run(new Date().toISOString(), playlistId)
}

export function removeTrackFromPlaylist(playlistId: string, trackId: string): void {
  const db = getDb()
  db.prepare(`
    DELETE FROM playlist_tracks WHERE playlistId = ? AND trackId = ?
  `).run(playlistId, trackId)
}

export function getWatchFolders(): string[] {
  const db = getDb()
  const results = db.prepare(`
    SELECT path FROM watch_folders WHERE enabled = 1
  `).all() as { path: string }[]
  return results.map((r) => r.path)
}

export function addWatchFolder(path: string): void {
  const db = getDb()
  db.prepare(`
    INSERT OR REPLACE INTO watch_folders (path, enabled) VALUES (?, 1)
  `).run(path)
}

export function removeWatchFolder(path: string): void {
  const db = getDb()
  db.prepare('DELETE FROM watch_folders WHERE path = ?').run(path)
}

export function getSetting(key: string, defaultValue = ''): string {
  const db = getDb()
  const result = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return result?.value ?? defaultValue
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value)
}
