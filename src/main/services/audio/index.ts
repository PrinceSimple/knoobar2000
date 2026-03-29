import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import { Writable } from "stream";
import { app, BrowserWindow } from "electron";
import { join } from "path";
import * as fs from "fs";
import Speaker from "speaker";
import { getSetting } from "../database";

interface PlaybackState {
  status: "playing" | "paused" | "stopped";
  filePath: string;
  duration: number;
  format: string;
}

interface TimeUpdate {
  position: number;
  duration: number;
}

interface AudioFormat {
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

interface TrackMetadata {
  duration: number;
  sampleRate: number;
  channels: number;
  bitDepth: number;
}

let currentProcess: ChildProcessWithoutNullStreams | null = null;
let currentSpeaker: (Speaker & Writable) | null = null;
let currentFile: string | null = null;
let playbackDuration = 0;
let isPaused = false;
let isStopped = false;
let volume = 1.0;
let currentPosition = 0;
let timeUpdateInterval: NodeJS.Timeout | null = null;
let audioFormat: AudioFormat = { sampleRate: 44100, channels: 2, bitDepth: 16 };

const metadataCache = new Map<string, TrackMetadata>();

const ffmpegPath = app.isPackaged
  ? join(process.resourcesPath, "ffmpeg", "ffmpeg.exe")
  : "ffmpeg";

const ffprobePath = app.isPackaged
  ? join(process.resourcesPath, "ffmpeg", "ffprobe.exe")
  : "ffprobe";

export async function initAudioService(): Promise<void> {
  volume = parseFloat(getSetting("volume", "1.0"));
  console.log("Audio service initialized");
}

async function getMetadata(filePath: string): Promise<TrackMetadata> {
  if (metadataCache.has(filePath)) {
    return metadataCache.get(filePath)!;
  }

  return new Promise((resolve) => {
    const args = [
      "-v",
      "quiet",
      "-print_format",
      "json",
      "-show_format",
      "-show_streams",
      "-select_streams",
      "a",
      filePath,
    ];

    const proc = spawn(ffprobePath, args);
    let output = "";

    proc.stdout.on("data", (data) => {
      output += data.toString();
    });

    proc.on("close", () => {
      try {
        const data = JSON.parse(output);
        const format = data.format || {};
        const stream = data.streams?.[0];

        const metadata: TrackMetadata = {
          duration: parseFloat(format.duration) || 0,
          sampleRate: stream ? parseInt(stream.sample_rate) || 44100 : 44100,
          channels: stream ? stream.channels || 2 : 2,
          bitDepth: stream?.bits_per_raw_sample
            ? parseInt(stream.bits_per_raw_sample)
            : 16,
        };

        metadataCache.set(filePath, metadata);
        resolve(metadata);
      } catch {
        const defaultMeta: TrackMetadata = {
          duration: 0,
          sampleRate: 44100,
          channels: 2,
          bitDepth: 16,
        };
        metadataCache.set(filePath, defaultMeta);
        resolve(defaultMeta);
      }
    });

    proc.on("error", () => {
      const defaultMeta: TrackMetadata = {
        duration: 0,
        sampleRate: 44100,
        channels: 2,
        bitDepth: 16,
      };
      metadataCache.set(filePath, defaultMeta);
      resolve(defaultMeta);
    });
  });
}

function createSpeaker(): Speaker {
  const speaker = new Speaker({
    channels: audioFormat.channels,
    bitDepth: audioFormat.bitDepth,
    sampleRate: audioFormat.sampleRate,
    highWaterMark: 0,
  } as any);

  speaker.on("error", (err: { code?: string; message: string }) => {
    if (!isStopped && err.code !== "ERR_STREAM_WRITE_AFTER_END") {
      console.error("Speaker error:", err.message);
    }
  });

  return speaker;
}

function cleanup(): void {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }

  if (currentSpeaker) {
    try {
      currentSpeaker.destroy();
    } catch {
      /* ignore */
    }
    currentSpeaker = null;
  }

  if (currentProcess) {
    try {
      currentProcess.stdin?.destroy();
      currentProcess.stdout?.destroy();
      currentProcess.stderr?.destroy();
      currentProcess.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    currentProcess = null;
  }
}

function startPlayback(filePath: string, startPosition = 0): void {
  cleanup();

  currentProcess = spawn(
    ffmpegPath,
    [
      "-ss",
      startPosition.toString(),
      "-i",
      filePath,
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "flush_packets",
      "-flush_packets",
      "1",
      "-threads",
      "1",
      "-af",
      `volume=${volume}`,
      "-f",
      "s16le",
      "-acodec",
      "pcm_s16le",
      "-ar",
      audioFormat.sampleRate.toString(),
      "-ac",
      audioFormat.channels.toString(),
      "pipe:1",
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );

  currentSpeaker = createSpeaker();
  currentProcess.stdout?.pipe(currentSpeaker, { end: false });

  currentProcess.on("error", (error) =>
    console.error("FFmpeg error:", error.message),
  );

  currentProcess.on("exit", () => {
    if (currentSpeaker && !isStopped && !isPaused) {
      try {
        currentSpeaker.end();
      } catch {
        /* ignore */
      }
      currentSpeaker = null;
      broadcastPlaybackState({
        status: "stopped",
        filePath: "",
        duration: 0,
        format: "",
      });
    }
    currentProcess = null;
  });

  broadcastPlaybackState({
    status: "playing",
    filePath,
    duration: playbackDuration,
    format: filePath.split(".").pop()?.toUpperCase() || "UNKNOWN",
  });

  startTimeUpdates(startPosition);
}

export async function play(
  filePath: string,
  metadata?: { duration?: number; sampleRate?: number; channels?: number },
): Promise<void> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  cleanup();

  currentFile = filePath;
  isPaused = false;
  isStopped = false;

  let trackMeta: TrackMetadata | undefined;

  if (metadata?.duration) {
    trackMeta = {
      duration: metadata.duration,
      sampleRate: metadata.sampleRate || 44100,
      channels: metadata.channels || 2,
      bitDepth: 16,
    };
    metadataCache.set(filePath, trackMeta);
  }

  if (!trackMeta) {
    trackMeta = await getMetadata(filePath);
  }

  playbackDuration = trackMeta.duration;
  audioFormat = {
    sampleRate: trackMeta.sampleRate,
    channels: trackMeta.channels,
    bitDepth: trackMeta.bitDepth,
  };

  startPlayback(filePath, 0);
}

export function pause(): void {
  if (!currentProcess || isPaused || isStopped) return;

  isPaused = true;

  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
    timeUpdateInterval = null;
  }

  if (currentSpeaker) {
    try {
      currentSpeaker.destroy();
    } catch {
      /* ignore */
    }
    currentSpeaker = null;
  }

  if (currentProcess && !currentProcess.killed) {
    try {
      currentProcess.kill("SIGKILL");
    } catch {
      /* ignore */
    }
    currentProcess = null;
  }

  broadcastPlaybackState({
    status: "paused",
    filePath: currentFile || "",
    duration: playbackDuration,
    format: currentFile?.split(".").pop()?.toUpperCase() || "",
  });
}

export function resume(): void {
  if (!currentFile || !isPaused || isStopped) return;

  isPaused = false;

  if (currentSpeaker) {
    try {
      currentSpeaker.destroy();
    } catch {
      /* ignore */
    }
    currentSpeaker = null;
  }

  startPlayback(currentFile, currentPosition);
}

export function stop(): void {
  isStopped = true;
  isPaused = false;
  cleanup();
  currentFile = null;
  playbackDuration = 0;
  currentPosition = 0;

  broadcastPlaybackState({
    status: "stopped",
    filePath: "",
    duration: 0,
    format: "",
  });
}

export function seek(position: number): void {
  if (!currentFile || isStopped) return;

  const wasPaused = isPaused;
  cleanup();
  isPaused = false;
  isStopped = false;

  startPlayback(currentFile, position);
}

export function setVolume(vol: number): void {
  volume = Math.max(0, Math.min(2, vol));
  const { setSetting } = require("../database");
  setSetting("volume", volume.toString());
}

export function setReplayGain(enabled: boolean, preamp: number): void {
  const { setSetting } = require("../database");
  setSetting("replayGainEnabled", enabled.toString());
  setSetting("replayGainPreamp", preamp.toString());
}

function startTimeUpdates(startPosition: number): void {
  if (timeUpdateInterval) {
    clearInterval(timeUpdateInterval);
  }
  currentPosition = startPosition;

  timeUpdateInterval = setInterval(() => {
    if (!isPaused && !isStopped && playbackDuration > 0) {
      currentPosition += 1;
      broadcastTimeUpdate({
        position: currentPosition,
        duration: playbackDuration,
      });

      if (currentPosition >= playbackDuration) {
        stop();
      }
    }
  }, 1000);
}

function broadcastPlaybackState(state: PlaybackState): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("player:playbackState", state);
  });
}

function broadcastTimeUpdate(update: TimeUpdate): void {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send("player:timeUpdate", update);
  });
}

export async function getAudioDevices(): Promise<
  { id: string; name: string }[]
> {
  return [{ id: "default", name: "Default Output" }];
}

export function clearMetadataCache(): void {
  metadataCache.clear();
}
