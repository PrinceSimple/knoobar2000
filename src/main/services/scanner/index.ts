import chokidar from 'chokidar'
import { app, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { parseMetadata, isSupportedFormat } from '../metadata'
import {
  insertTrack,
  getTrackByPath,
  deleteTrack,
  addWatchFolder as dbAddWatchFolder,
  removeWatchFolder as dbRemoveWatchFolder,
  getWatchFolders
} from '../database'

let watcher: chokidar.FSWatcher | null = null
let isScanning = false

const SCAN_BATCH_SIZE = 50

export async function scanFolder(folderPath: string): Promise<void> {
  if (isScanning) {
    console.log('Scan already in progress')
    return
  }

  isScanning = true

  try {
    const files = await getAudioFiles(folderPath)
    const total = files.length
    let current = 0

    console.log(`Found ${total} audio files to scan`)

    for (let i = 0; i < files.length; i += SCAN_BATCH_SIZE) {
      const batch = files.slice(i, i + SCAN_BATCH_SIZE)

      await Promise.all(
        batch.map(async (filePath) => {
          try {
            const existing = getTrackByPath(filePath)
            if (existing) {
              current++
              broadcastScanProgress(current, total, filePath)
              return
            }

            const metadata = await parseMetadata(filePath)
            const stats = fs.statSync(filePath)
            metadata.fileSize = stats.size

            insertTrack({
              filePath,
              ...metadata
            })

            current++
            broadcastScanProgress(current, total, filePath)
          } catch (error) {
            console.error(`Error scanning ${filePath}:`, error)
            current++
            broadcastScanProgress(current, total, filePath)
          }
        })
      )

      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    dbAddWatchFolder(folderPath)
    await startWatching()
    broadcastLibraryUpdate()

    console.log(`Scan complete: ${total} files processed`)
  } finally {
    isScanning = false
  }
}

async function getAudioFiles(dirPath: string): Promise<string[]> {
  const audioFiles: string[] = []

  async function walkDir(currentPath: string): Promise<void> {
    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true })

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name)

        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walkDir(fullPath)
        } else if (entry.isFile() && isSupportedFormat(fullPath)) {
          audioFiles.push(fullPath)
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${currentPath}:`, error)
    }
  }

  await walkDir(dirPath)
  return audioFiles
}

export async function startWatching(): Promise<void> {
  const folders = getWatchFolders()

  if (folders.length === 0) {
    return
  }

  if (watcher) {
    await watcher.close()
  }

  watcher = chokidar.watch(folders, {
    persistent: true,
    ignoreInitial: true,
    depth: 99,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  })

  watcher.on('add', async (filePath) => {
    if (!isSupportedFormat(filePath)) return

    try {
      const existing = getTrackByPath(filePath)
      if (existing) return

      const metadata = await parseMetadata(filePath)
      const stats = fs.statSync(filePath)
      metadata.fileSize = stats.size

      insertTrack({
        filePath,
        ...metadata
      })

      broadcastLibraryUpdate()
      console.log(`Added: ${filePath}`)
    } catch (error) {
      console.error(`Error adding file ${filePath}:`, error)
    }
  })

  watcher.on('unlink', (filePath) => {
    const existing = getTrackByPath(filePath)
    if (existing) {
      deleteTrack(existing.id)
      broadcastLibraryUpdate()
      console.log(`Removed: ${filePath}`)
    }
  })

  watcher.on('error', (error) => {
    console.error('Watcher error:', error)
  })

  console.log(`Watching ${folders.length} folders`)
}

export async function stopWatching(): Promise<void> {
  if (watcher) {
    await watcher.close()
    watcher = null
  }
}

export async function addWatchFolder(folderPath: string): Promise<void> {
  dbAddWatchFolder(folderPath)
  await startWatching()
}

export async function removeWatchFolder(folderPath: string): Promise<void> {
  dbRemoveWatchFolder(folderPath)
  await startWatching()
}

function broadcastScanProgress(current: number, total: number, currentFile: string): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach((win) => {
    win.webContents.send('library:scanProgress', { current, total, currentFile })
  })
}

function broadcastLibraryUpdate(): void {
  const windows = BrowserWindow.getAllWindows()
  windows.forEach((win) => {
    win.webContents.send('library:update')
  })
}
