import audioDecode from "audio-decode";
import { ref } from "vue";

export type PlaybackStatus = "playing" | "paused" | "stopped";

export interface AudioEvents {
  onTimeUpdate?: (position: number, duration: number) => void;
  onEnded?: () => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: PlaybackStatus) => void;
}

const COMMON_FORMATS = [
  ".flac",
  ".wav",
  ".mp3",
  ".aac",
  ".ogg",
  ".m4a",
  ".wma",
  ".alac",
];
const WASM_FORMATS = [".wv"];

class RendererAudioPlayer {
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private pausedAt = 0;
  private duration = 0;
  private isWasmPlaying = false;
  private volume = 1;
  private events: AudioEvents = {};
  private timeUpdateInterval: number | null = null;
  private status: PlaybackStatus = "stopped";

  init(events: AudioEvents): void {
    this.events = events;
  }

  private getFileExtension(filePath: string): string {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf("."));
    return ext;
  }

  private isCommonFormat(filePath: string): boolean {
    return COMMON_FORMATS.includes(this.getFileExtension(filePath));
  }

  private isWasmFormat(filePath: string): boolean {
    return WASM_FORMATS.includes(this.getFileExtension(filePath));
  }

  async play(filePath: string, startPosition = 0): Promise<void> {
    this.stop();

    if (this.isCommonFormat(filePath)) {
      await this.playWithHtml5Audio(filePath, startPosition);
    } else if (this.isWasmFormat(filePath)) {
      await this.playWithWasm(filePath, startPosition);
    } else {
      throw new Error(`Unsupported format: ${this.getFileExtension(filePath)}`);
    }
  }

  private async playWithHtml5Audio(
    filePath: string,
    startPosition: number,
  ): Promise<void> {
    const encodedPath = encodeURIComponent(filePath.replace(/\\/g, "/"));
    const src = `local-file://${encodedPath}`;

    this.audio = new Audio();
    this.audio.src = src;
    this.audio.volume = this.volume;

    this.audio.addEventListener("loadedmetadata", () => {
      if (this.audio) {
        this.events.onTimeUpdate?.(this.audio.currentTime, this.audio.duration);
      }
    });

    this.audio.addEventListener("timeupdate", () => {
      if (this.audio) {
        this.events.onTimeUpdate?.(this.audio.currentTime, this.audio.duration);
      }
    });

    this.audio.addEventListener("ended", () => {
      this.status = "stopped";
      this.events.onStatusChange?.("stopped");
      this.events.onEnded?.();
    });

    this.audio.addEventListener("error", (e) => {
      const error = this.audio?.error;
      this.events.onError?.(
        new Error(error?.message || "Audio playback error"),
      );
    });

    try {
      this.audio.currentTime = startPosition;
      await this.audio.play();
      this.status = "playing";
      this.events.onStatusChange?.("playing");
    } catch (err) {
      this.events.onError?.(err as Error);
    }
  }

  private async playWithWasm(
    filePath: string,
    startPosition: number,
  ): Promise<void> {
    try {
      const response = await fetch(`file://${filePath}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await audioDecode(arrayBuffer);

      this.audioContext = new AudioContext();
      this.audioBuffer = this.audioContext.createBuffer(
        (buffer as any).numberOfChannels,
        (buffer as any).length,
        (buffer as any).sampleRate,
      );

      for (
        let channel = 0;
        channel < (buffer as any).numberOfChannels;
        channel++
      ) {
        const channelData = (buffer as any).getChannelData(channel);
        this.audioBuffer.copyToChannel(channelData, channel);
      }

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.volume;
      this.gainNode.connect(this.audioContext.destination);

      this.duration = this.audioBuffer.duration;
      this.startWasmPlayback(startPosition);
    } catch (err) {
      this.events.onError?.(err as Error);
    }
  }

  private startWasmPlayback(offset: number): void {
    if (!this.audioContext || !this.audioBuffer || !this.gainNode) return;

    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.gainNode);

    this.sourceNode.onended = () => {
      if (this.isWasmPlaying) {
        this.status = "stopped";
        this.events.onStatusChange?.("stopped");
        this.events.onEnded?.();
      }
    };

    const startOffset = offset;
    this.startTime = this.audioContext.currentTime - startOffset;
    this.sourceNode.start(0, startOffset);

    this.isWasmPlaying = true;
    this.status = "playing";
    this.events.onStatusChange?.("playing");

    this.startTimeUpdateInterval();
  }

  private startTimeUpdateInterval(): void {
    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
    }

    this.timeUpdateInterval = window.setInterval(() => {
      if (this.status === "playing" && this.audioContext) {
        const currentTime = this.audioContext.currentTime - this.startTime;
        this.events.onTimeUpdate?.(currentTime, this.duration);
      }
    }, 250);
  }

  pause(): void {
    if (this.audio && this.audio.paused) {
      this.audio.pause();
      this.status = "paused";
      this.events.onStatusChange?.("paused");
    } else if (this.audio) {
      this.audio.pause();
      this.status = "paused";
      this.events.onStatusChange?.("paused");
    }

    if (this.isWasmPlaying && this.audioContext) {
      this.pausedAt = this.audioContext.currentTime - this.startTime;
      this.sourceNode?.stop();
      this.sourceNode = null;
      this.isWasmPlaying = false;
      this.status = "paused";
      this.events.onStatusChange?.("paused");

      if (this.timeUpdateInterval) {
        clearInterval(this.timeUpdateInterval);
        this.timeUpdateInterval = null;
      }
    }
  }

  resume(): void {
    if (this.audio && this.status === "paused") {
      this.audio.play();
      this.status = "playing";
      this.events.onStatusChange?.("playing");
    }

    if (this.pausedAt > 0 && this.audioBuffer && this.audioContext) {
      this.startWasmPlayback(this.pausedAt);
    }
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.src = "";
      this.audio = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch {}
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.gainNode = null;
    this.audioBuffer = null;
    this.isWasmPlaying = false;
    this.pausedAt = 0;
    this.startTime = 0;
    this.duration = 0;
    this.status = "stopped";

    if (this.timeUpdateInterval) {
      clearInterval(this.timeUpdateInterval);
      this.timeUpdateInterval = null;
    }

    this.events.onStatusChange?.("stopped");
  }

  seek(position: number): void {
    if (this.audio) {
      this.audio.currentTime = position;
      this.events.onTimeUpdate?.(position, this.audio.duration);
    }

    if (this.isWasmPlaying && this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }

    if (this.audioBuffer && this.audioContext) {
      this.startWasmPlayback(position);
    }
  }

  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));

    if (this.audio) {
      this.audio.volume = this.volume;
    }

    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  getStatus(): PlaybackStatus {
    return this.status;
  }

  getCurrentTime(): number {
    if (this.audio) {
      return this.audio.currentTime;
    }
    if (this.isWasmPlaying && this.audioContext) {
      return this.audioContext.currentTime - this.startTime;
    }
    return this.pausedAt;
  }
}

export const rendererAudioPlayer = new RendererAudioPlayer();
