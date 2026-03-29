import { basename, extname } from 'path'

export interface AudioMetadata {
  title: string
  artist: string
  album: string
  albumArtist: string
  year: number
  trackNumber: number
  discNumber: number
  genre: string
  duration: number
  bitrate: number
  sampleRate: number
  channels: number
  codec: string
  format: string
  replayGainTrack: number
  replayGainAlbum: number
  fileSize: number
}

async function getMusicMetadata() {
  const mm = await import('music-metadata')
  return mm.parseFile
}

export async function parseMetadata(filePath: string): Promise<AudioMetadata> {
  const parseFile = await getMusicMetadata()
  const metadata = await parseFile(filePath)
  const format = metadata.format
  const common = metadata.common

  const formatExt = extname(filePath).toLowerCase().replace('.', '').toUpperCase()

  return {
    title: common.title || basename(filePath, extname(filePath)),
    artist: common.artist || 'Unknown Artist',
    album: common.album || 'Unknown Album',
    albumArtist: common.albumartist || common.artist || 'Unknown Artist',
    year: common.year || 0,
    trackNumber: common.track?.no || 0,
    discNumber: common.disk?.no || 1,
    genre: common.genre?.[0] || '',
    duration: format.duration || 0,
    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : 0,
    sampleRate: format.sampleRate || 0,
    channels: format.numberOfChannels || 2,
    codec: format.codec || formatExt,
    format: formatExt,
    replayGainTrack: (metadata.native?.['ReplayGain Track Gain']?.[0]?.value as number) || 0,
    replayGainAlbum: (metadata.native?.['ReplayGain Album Gain']?.[0]?.value as number) || 0,
    fileSize: 0
  }
}

export async function getCoverArt(filePath: string): Promise<string | null> {
  try {
    const parseFile = await getMusicMetadata()
    const metadata = await parseFile(filePath)
    const pictures = metadata.common.picture

    if (pictures && pictures.length > 0) {
      const picture = pictures[0]
      const base64 = Buffer.from(picture.data).toString('base64')
      return `data:${picture.format};base64,${base64}`
    }
  } catch (error) {
    console.error('Error getting cover art:', error)
  }
  return null
}

export async function writeMetadata(
  filePath: string,
  tags: {
    title?: string
    artist?: string
    album?: string
    albumArtist?: string
    year?: number
    track?: number
    disc?: number
    genre?: string
    comment?: string
    lyrics?: string
  }
): Promise<void> {
  const ext = extname(filePath).toLowerCase()

  if (ext === '.mp3') {
    await writeMp3Tags(filePath, tags)
  } else if (ext === '.flac') {
    await writeFlacTags(filePath, tags)
  } else {
    console.warn(`Writing tags not supported for format: ${ext}`)
  }
}

async function writeMp3Tags(
  filePath: string,
  tags: {
    title?: string
    artist?: string
    album?: string
    albumArtist?: string
    year?: number
    track?: number
    disc?: number
    genre?: string
    comment?: string
    lyrics?: string
  }
): Promise<void> {
  const NodeID3 = await import('node-id3')
  const NodeID3Module = NodeID3.default || NodeID3

  const existingTags = NodeID3Module.read(filePath) || {}

  const updateTags: Record<string, string | number> = {}

  if (tags.title !== undefined) updateTags.title = tags.title
  if (tags.artist !== undefined) updateTags.artist = tags.artist
  if (tags.album !== undefined) updateTags.album = tags.album
  if (tags.year !== undefined) updateTags.year = tags.year
  if (tags.genre !== undefined) updateTags.genre = tags.genre
  if (tags.comment !== undefined) updateTags.comment = tags.comment
  if (tags.lyrics !== undefined) updateTags.lyrics = tags.lyrics

  if (tags.track !== undefined) {
    updateTags.trackNumber = tags.track
  }

  if (tags.albumArtist !== undefined || tags.artist !== undefined) {
    const TPE2 = tags.albumArtist || tags.artist || ''
    Object.assign(updateTags, { TPE2 })
  }

  const finalTags = { ...existingTags, ...updateTags }
  NodeID3Module.write(filePath, finalTags)
}

async function writeFlacTags(
  filePath: string,
  tags: {
    title?: string
    artist?: string
    album?: string
    albumArtist?: string
    year?: number
    track?: number
    disc?: number
    genre?: string
  }
): Promise<void> {
  const { exec } = await import('child_process')
  const { promisify } = await import('util')
  const execAsync = promisify(exec)

  const tagArgs: string[] = []

  if (tags.title !== undefined) tagArgs.push('-T', `TITLE=${tags.title}`)
  if (tags.artist !== undefined) tagArgs.push('-T', `ARTIST=${tags.artist}`)
  if (tags.album !== undefined) tagArgs.push('-T', `ALBUM=${tags.album}`)
  if (tags.year !== undefined) tagArgs.push('-T', `DATE=${tags.year}`)
  if (tags.track !== undefined) tagArgs.push('-T', `TRACKNUMBER=${tags.track}`)
  if (tags.disc !== undefined) tagArgs.push('-T', `DISCNUMBER=${tags.disc}`)
  if (tags.genre !== undefined) tagArgs.push('-T', `GENRE=${tags.genre}`)
  if (tags.albumArtist !== undefined) tagArgs.push('-T', `ALBUMARTIST=${tags.albumArtist}`)

  if (tagArgs.length > 0) {
    try {
      await execAsync(`metaflac --remove-all-tags "${filePath}"`)
      await execAsync(`metaflac ${tagArgs.join(' ')} "${filePath}"`)
    } catch (error) {
      console.error('Error writing FLAC tags:', error)
      throw error
    }
  }
}

export const SUPPORTED_FORMATS = [
  '.mp3',
  '.flac',
  '.ogg',
  '.wma',
  '.wav',
  '.aac',
  '.m4a',
  '.opus',
  '.dsf',
  '.dff',
  '.wv',
  '.ape',
  '.tta',
  '.tak',
  '.mka'
]

export function isSupportedFormat(filePath: string): boolean {
  const ext = extname(filePath).toLowerCase()
  return SUPPORTED_FORMATS.includes(ext)
}
