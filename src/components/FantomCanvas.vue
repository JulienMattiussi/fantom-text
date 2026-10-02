<script setup lang="ts">
// Mounts the real bundled snippet (window.FantomText, loaded by index.html)
// so the demo dogfoods exactly what host pages get.
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from "vue";
import type { Instance, MountOptions } from "../snippet/fantom-text";

const props = defineProps<{ options: MountOptions }>();

const host = useTemplateRef<HTMLDivElement>("host");
const running = ref(false);
let instance: Instance | null = null;

function build(): void {
  const el = host.value;
  const api = window.FantomText;
  if (!el || !api) return;
  instance?.destroy();
  instance = api.mount(el, props.options);
  sync();
}

function sync(): void {
  running.value = instance?.controller.running() ?? false;
}

function toggle(): void {
  instance?.controller.toggle();
  sync();
}

onMounted(build);

// Text changes are cheap (no rebuild); anything else recreates the engine.
watch(
  () => props.options.text,
  (text) => instance?.setText(text ?? ""),
);
watch(() => JSON.stringify({ ...props.options, text: undefined }), build);

onBeforeUnmount(() => instance?.destroy());

defineExpose({ toggle, running });
</script>

<template>
  <div ref="host" class="fantom" @click="sync"></div>
</template>

<style scoped>
.fantom :deep(canvas) {
  width: 100%;
  border-radius: 12px;
  border: 1px solid var(--border);
  cursor: pointer;
  image-rendering: pixelated;
}
</style>
