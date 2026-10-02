<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import FantomCanvas from "./FantomCanvas.vue";
import type { PovBackground, PovMode } from "../snippet/pov";

const text = ref("FANTOM");
const mode = ref<PovMode>("outline");
const background = ref<PovBackground>("static");
const stepMs = ref(55);
const oscAmplitude = ref(4);
const speed = ref(1.4);

const options = computed(() => ({
  text: text.value,
  mode: mode.value,
  background: background.value,
  stepMs: stepMs.value,
  oscAmplitude: oscAmplitude.value,
  speed: speed.value,
}));

const canvas = useTemplateRef<InstanceType<typeof FantomCanvas>>("canvas");
</script>

<template>
  <section id="atelier" class="card">
    <h2>Atelier</h2>
    <FantomCanvas ref="canvas" class="stage" :options="options" />
    <p class="note">Cliquez sur l'image pour la figer ou la relancer.</p>

    <div class="controls">
      <label class="field">
        <span>Texte</span>
        <input v-model="text" type="text" maxlength="12" />
      </label>

      <label class="field">
        <span>Fond</span>
        <select v-model="background">
          <option value="static">Statique</option>
          <option value="oscillate">Oscillant</option>
        </select>
      </label>

      <template v-if="background === 'static'">
        <label class="field">
          <span>Rendu</span>
          <select v-model="mode">
            <option value="outline">Contour</option>
            <option value="fill">Plein</option>
          </select>
        </label>

        <label class="field">
          <span>Vitesse du texte : {{ speed }} px</span>
          <input
            v-model.number="speed"
            type="range"
            min="0.4"
            max="4"
            step="0.2"
          />
        </label>
      </template>

      <template v-else>
        <label class="field">
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

        <label class="field">
          <span>Amplitude : {{ oscAmplitude }} cell</span>
          <input
            v-model.number="oscAmplitude"
            type="range"
            min="1"
            max="10"
            step="1"
          />
        </label>
      </template>

      <button type="button" class="toggle" @click="canvas?.toggle()">
        {{ canvas?.running ? "Figer" : "Relancer" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: center;
  gap: 16px;
  margin-top: 8px;
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
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.toggle {
  padding: 9px 18px;
  font: inherit;
  font-weight: 600;
  color: var(--accent-fg);
  background: var(--accent);
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
</style>
