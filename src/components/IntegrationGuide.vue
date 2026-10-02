<script setup lang="ts">
import { REPO_URL, SITE_URL } from "../site";

// Split so the SFC parser does not see a closing script tag here.
const CLOSE_SCRIPT = "</" + "script>";
const snippetExample = `<div data-fantom-text data-text="BOUH"></div>
<script src="${SITE_URL}/fantom-text.js">${CLOSE_SCRIPT}`;
</script>

<template>
  <section id="integration" class="card howto">
    <h2>Comment l'intégrer</h2>
    <p>
      Pour faire apparaître un fantôme dans n'importe quelle page web, collez
      ces deux lignes :
    </p>
    <pre><code>{{ snippetExample }}</code></pre>
    <p>
      Attributs supportés sur le conteneur (qui peut être un
      <code>&lt;canvas&gt;</code>) :
    </p>
    <ul>
      <li>
        <code>data-text</code> : le texte caché. Défaut <code>FANTOM</code>.
      </li>
      <li>
        <code>data-background</code> : <code>static</code> ou
        <code>oscillate</code>. Défaut <code>static</code>.
      </li>
      <li>
        <code>data-mode</code> : <code>outline</code> ou <code>fill</code> (fond
        statique uniquement). Défaut <code>outline</code>.
      </li>
      <li>
        <code>data-width</code> / <code>data-height</code> : taille du canevas
        en pixels. Défaut <code>640</code> x <code>320</code>.
      </li>
    </ul>
    <p>
      Pour aller plus loin, <code>window.FantomText.mount(el, options)</code>
      expose tous les réglages du moteur. Détails dans le
      <a
        class="link"
        :href="REPO_URL + '#readme'"
        target="_blank"
        rel="noopener noreferrer"
        >README</a
      >.
    </p>
  </section>
</template>

<style scoped>
.howto {
  align-items: stretch;
  line-height: 1.6;
}

.howto h2 {
  text-align: center;
}

.howto p,
.howto ul {
  margin: 0;
}

pre {
  margin: 0;
  padding: 16px 20px;
  overflow-x: auto;
  font-size: 0.9rem;
  line-height: 1.5;
  color: #f3f1f8;
  background: #0e0d14;
  border-radius: 8px;
}

p code,
li code {
  padding: 1px 6px;
  background: var(--bg);
  border-radius: 4px;
}
</style>
