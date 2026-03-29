<script setup lang="ts">
import { computed } from "vue";
import { usePlayerStore } from "../../stores/player";

const player = usePlayerStore();

const repeatIcons = {
  none: "🔁",
  one: "🔂",
  all: "🔁",
};

function handleSeek(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  player.seek(value);
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  const value = parseFloat(target.value);
  player.setVolume(value);
}
</script>

<template>
  <div
    class="flex items-center gap-4 px-4 py-3 bg-neutral-900 border-t border-neutral-800"
  >
    <!-- Track Info -->
    <div class="flex items-center gap-3 w-64 flex-shrink-0">
      <div
        class="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center text-2xl flex-shrink-0"
      >
        🎵
      </div>
      <div class="min-w-0">
        <div class="font-medium truncate">
          {{ player.currentTrack?.title || "No track playing" }}
        </div>
        <div class="text-sm text-neutral-400 truncate">
          {{ player.currentTrack?.artist || "-" }}
        </div>
      </div>
    </div>

    <!-- Main Controls -->
    <div class="flex-1 flex flex-col items-center gap-1">
      <div class="flex items-center gap-4">
        <button
          class="p-1 text-neutral-400 hover:text-white transition-colors"
          :class="{ 'text-blue-400': player.shuffle }"
          @click="player.toggleShuffle"
        >
          🔀
        </button>

        <button
          class="p-2 hover:bg-neutral-800 rounded-full transition-colors"
          @click="player.previous"
        >
          ⏮
        </button>

        <button
          v-if="player.isPlaying"
          class="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
          @click="
            () => {
              console.log('BUTTON CLICK');
              player.pause();
            }
          "
        >
          ⏸
        </button>
        <button
          v-else
          class="p-3 bg-white text-black rounded-full hover:scale-105 transition-transform"
          :disabled="!player.hasTrack"
          @click="player.hasTrack ? player.play() : null"
        >
          ▶
        </button>

        <button
          class="p-2 hover:bg-neutral-800 rounded-full transition-colors"
          @click="player.next"
        >
          ⏭
        </button>

        <button
          class="p-1 text-neutral-400 hover:text-white transition-colors"
          :class="{ 'text-blue-400': player.repeat !== 'none' }"
          @click="player.toggleRepeat"
        >
          {{ repeatIcons[player.repeat] }}
        </button>
      </div>

      <!-- Progress Bar -->
      <div class="flex items-center gap-2 w-full max-w-xl">
        <span class="text-xs text-neutral-400 w-10 text-right">
          {{ player.formattedPosition }}
        </span>
        <input
          type="range"
          min="0"
          :max="player.duration || 100"
          :value="player.currentPosition"
          class="flex-1 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
          @input="handleSeek"
        />
        <span class="text-xs text-neutral-400 w-10">
          {{ player.formattedDuration }}
        </span>
      </div>
    </div>

    <!-- Volume Control -->
    <div class="flex items-center gap-2 w-40 flex-shrink-0">
      <button
        class="p-1 text-neutral-400 hover:text-white transition-colors"
        @click="player.setVolume(player.volume > 0 ? 0 : 1)"
      >
        {{ player.volume === 0 ? "🔇" : player.volume < 0.5 ? "🔉" : "🔊" }}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        :value="player.volume"
        class="flex-1 h-1 bg-neutral-700 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
        @input="handleVolumeChange"
      />
    </div>
  </div>
</template>
