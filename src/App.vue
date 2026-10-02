<script setup lang="ts">
import FantomCanvas from "./components/FantomCanvas.vue";
import IntegrationGuide from "./components/IntegrationGuide.vue";
import WorkshopPanel from "./components/WorkshopPanel.vue";
import { REPO_URL } from "./site";

const gallery = [
  {
    title: "Fond statique",
    text: "BOUH",
    background: "static" as const,
    note: "Le bruit est fixe : seules les cellules sous le contour du texte s'inversent.",
  },
  {
    title: "Fond oscillant",
    text: "COUCOU",
    background: "oscillate" as const,
    note: "Le fond ondule à l'horizontale, le texte à la verticale.",
  },
];
</script>

<template>
  <main class="demo">
    <header>
      <img class="logo" src="/favicon.svg" alt="" aria-hidden="true" />
      <h1><span>fantom</span><span class="accent">text</span></h1>
      <p>
        Un texte caché dans le bruit, lisible uniquement tant qu'il bouge. Figez
        l'image : il disparaît. Un petit widget à déposer sur n'importe quelle
        page web.
      </p>
      <p class="cta">
        <a href="#integration" class="cta-button">Comment l'intégrer →</a>
        <a href="#atelier" class="link">Jouer avec les réglages</a>
      </p>
    </header>

    <section v-for="item in gallery" :key="item.title">
      <h2>{{ item.title }}</h2>
      <FantomCanvas
        class="stage"
        :options="{
          text: item.text,
          background: item.background,
          width: 480,
          height: 240,
          fontSize: 100,
        }"
      />
      <p class="note">{{ item.note }}</p>
    </section>

    <WorkshopPanel />

    <IntegrationGuide />

    <footer class="footer">
      With <span aria-label="love">❤️</span> by
      <a class="link" :href="REPO_URL" target="_blank" rel="noopener noreferrer"
        >YavaDeus</a
      >
      · © {{ new Date().getFullYear() }}
    </footer>
  </main>
</template>

<style scoped>
.demo {
  max-width: 760px;
  margin: 0 auto;
  padding: 48px 24px 96px;
}

header {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 56px;
  text-align: center;
}

.logo {
  display: block;
  width: clamp(72px, 14vw, 104px);
  height: auto;
  margin-bottom: 20px;
}

h1 {
  display: flex;
  flex-direction: column;
  margin: 0 0 16px;
  font-size: clamp(2.75rem, 9vw, 4.75rem);
  line-height: 0.95;
  letter-spacing: -0.04em;
}

.accent {
  color: var(--accent);
}

header p {
  max-width: 540px;
  margin: 0 auto;
  line-height: 1.55;
  color: var(--muted);
}

header .cta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
}

.cta-button {
  padding: 9px 20px;
  font-weight: 600;
  color: var(--accent-fg);
  text-decoration: none;
  background: var(--accent);
  border-radius: 999px;
  transition: transform 0.15s ease;
}

.cta-button:hover {
  transform: translateY(-1px);
}

.footer {
  margin-top: 64px;
  padding-top: 24px;
  font-size: 0.875rem;
  color: var(--muted);
  text-align: center;
  border-top: 1px solid var(--border);
}

@media (max-width: 640px) {
  .demo {
    padding: 32px 16px 64px;
  }
}
</style>
