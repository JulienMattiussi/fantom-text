<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import {
  createPovText,
  type PovBackground,
  type PovController,
  type PovMode,
} from "./snippet/pov";

const canvasRef = useTemplateRef<HTMLCanvasElement>("canvas");

const text = ref("FANTOM");
const mode = ref<PovMode>("outline");
const background = ref<PovBackground>("static");
const stepMs = ref(55);
const flowSpeed = ref(1);
const oscAmplitude = ref(4);
const speed = ref(1.4);
const running = ref(true);

let engine: PovController | null = null;

function build(): void {
  const canvas = canvasRef.value;
  if (!canvas) return;
  engine?.destroy();
  engine = createPovText(canvas, {
    text: text.value,
    mode: mode.value,
    background: background.value,
    stepMs: stepMs.value,
    flowSpeed: flowSpeed.value,
    oscAmplitude: oscAmplitude.value,
    speed: speed.value,
    pauseOnClick: true,
  });
  running.value = engine.running();
}

onMounted(build);

watch(text, (value) => engine?.setText(value));

// Changing any of these needs a full rebuild, so recreate.
watch([mode, background, stepMs, flowSpeed, oscAmplitude, speed], build);

function toggle(): void {
  engine?.toggle();
  running.value = engine?.running() ?? false;
}

onBeforeUnmount(() => engine?.destroy());
</script>

<template>
  <main class="page">
    <header class="hero">
      <h1>fantom-text 👻</h1>
      <p class="tagline">
        Un texte fantome : il n'existe que lorsqu'il bouge. Fige-le et il
        disparait dans le bruit.
      </p>
    </header>

    <section class="stage">
      <canvas ref="canvas" width="640" height="320" class="pov"></canvas>
      <p class="hint">
        Cliquez sur l'image (ou le bouton) pour figer / relancer.
      </p>
    </section>

    <section class="controls">
      <label class="field">
        <span>Texte</span>
        <input v-model="text" type="text" maxlength="12" />
      </label>

      <label class="field">
        <span>Rendu</span>
        <select v-model="mode" :disabled="background !== 'static'">
          <option value="outline">Contour</option>
          <option value="fill">Plein</option>
        </select>
      </label>

      <label class="field">
        <span>Fond</span>
        <select v-model="background">
          <option value="static">Statique</option>
          <option value="dynamic">Dynamique</option>
          <option value="oscillate">Oscillant</option>
        </select>
      </label>

      <label v-if="background !== 'static'" class="field">
        <span
          >Lenteur du fond : {{ stepMs === 0 ? "max" : stepMs + " ms" }}</span
        >
        <input
          v-model.number="stepMs"
          type="range"
          min="0"
          max="160"
          step="1"
        />
      </label>

      <label v-if="background === 'dynamic'" class="field">
        <span>Vitesse du texte : {{ flowSpeed }} cell/tick</span>
        <input
          v-model.number="flowSpeed"
          type="range"
          min="1"
          max="6"
          step="1"
        />
      </label>

      <label v-if="background === 'oscillate'" class="field">
        <span>Amplitude : {{ oscAmplitude }} cell</span>
        <input
          v-model.number="oscAmplitude"
          type="range"
          min="1"
          max="10"
          step="1"
        />
      </label>

      <label v-if="background === 'static'" class="field">
        <span>Vitesse du texte : {{ speed }} px</span>
        <input
          v-model.number="speed"
          type="range"
          min="0.4"
          max="4"
          step="0.2"
        />
      </label>

      <button type="button" class="toggle" @click="toggle">
        {{ running ? "Figer" : "Relancer" }}
      </button>
    </section>
  </main>
</template>

<style scoped>
.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}
.hero h1 {
  margin: 0 0 8px;
  font-size: 2rem;
}
.tagline {
  margin: 0;
  color: var(--muted);
}
.stage {
  margin-top: 32px;
}
.pov {
  display: block;
  width: 100%;
  height: auto;
  max-width: 640px;
  border: 1px solid var(--border);
  border-radius: 10px;
  cursor: pointer;
  image-rendering: pixelated;
}
.hint {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: var(--muted);
}
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 16px;
  margin-top: 24px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 0.85rem;
  color: var(--muted);
}
.field input,
.field select {
  padding: 8px 10px;
  font: inherit;
  color: var(--fg);
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}
.toggle {
  padding: 9px 18px;
  font: inherit;
  color: #fff;
  background: #6b4de6;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>
