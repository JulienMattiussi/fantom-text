# fantom-text - Agent File

## Description du projet

**Texte fantome** embarquable sur n'importe quelle page web via un simple
snippet : un canevas rempli de bruit noir/blanc dans lequel un texte n'est
lisible **que lorsqu'il bouge** (une image figee n'est que du bruit). Projet de
divertissement, sur le modele de
[horloge-passe-partout](../passe-partout/horloge-passe-partout).

Historique : le projet visait a l'origine un captcha ("capcha-fantom"). Une
analyse a montre qu'il etait cassable par difference de frames ; la partie
captcha a ete abandonnee, seul le generateur de texte fantome est conserve.

Le snippet est du **TypeScript vanilla, zero dependance runtime**, bundle par
esbuild en un fichier unique (`public/fantom-text.js`). Une page de
**demonstration Vue 3** expose les reglages du moteur en direct.

## Stack technique

| Outil                                          | Usage                                                        |
| ---------------------------------------------- | ------------------------------------------------------------ |
| TypeScript (vanilla)                           | Le snippet : aucune dependance runtime                       |
| esbuild                                        | Bundle le snippet en `public/fantom-text.js` (IIFE, minifie) |
| Vue 3 + Vite                                   | Page de demonstration uniquement                             |
| Vitest (jsdom)                                 | Tests unitaires (helpers purs + montage DOM)                 |
| ESLint (typescript-eslint + eslint-plugin-vue) | Linting                                                      |
| Prettier                                       | Formatage                                                    |
| vue-tsc                                        | Type-check (inclut les SFC `.vue`)                           |

## Architecture

```
src/
├── snippet/                 # LE SNIPPET : TypeScript vanilla, zero dependance
│   ├── fantom-text.ts       # Point d'entree : mount/scan, API globale window.FantomText,
│   │                        #   lecture des attributs data-*, creation du canevas, a11y
│   ├── pov.ts               # Moteur canvas : fond statique ou oscillant, boucle d'animation, controleur
│   └── geometry.ts          # Helpers PURS (zero DOM) : forme du texte, rebond, ping-pong, bruit
├── components/
│   ├── FantomCanvas.vue     # Demo : enveloppe autour de window.FantomText.mount (le vrai bundle)
│   ├── WorkshopPanel.vue    # Demo : atelier de reglages en direct
│   └── IntegrationGuide.vue # Demo : snippet a copier + attributs
├── App.vue                  # Page de demo (Vue) : en-tete, galerie des fonds, pied de page
├── site.ts                  # URLs du site et du depot (une seule source)
├── main.ts                  # Bootstrap Vue
├── index.css                # Tokens de theme (clair/sombre) + blocs partages de la demo
└── vite-env.d.ts            # Shims Vite / *.vue
scripts/                     # Generation d'assets hors ligne (Node 24, TS execute nativement)
├── build-og.ts              # og.svg + og.png (og:image) + favicon.svg
├── build-preview.ts         # Rejoue le moteur (helpers de geometry.ts) en GIF anime pour le README
├── raster.ts                # Helpers partages : RNG deterministe, masque de texte via resvg
└── gifenc.d.ts              # Typage minimal de gifenc
tests/
├── geometry.test.ts         # Helpers purs du moteur
└── mount.test.ts            # Montage DOM (jsdom, contexte 2d simule)
public/
├── fantom-text.js           # Snippet builde (gitignore, produit par esbuild)
├── og.svg / og.png          # Apercu social (genere par make build-og)
├── favicon.svg              # Icone (generee par make build-og)
├── preview.gif              # Animation du README (generee par make build-preview)
└── robots.txt / sitemap.xml # SEO
```

La page de demo charge `public/fantom-text.js` via `index.html` et passe par
`window.FantomText` : elle montre exactement ce que recoit une page hote.
URL de production supposee : `https://fantom-text.vercel.app` (`src/site.ts`,
meta OG de `index.html`, sitemap, README).

## Contraintes techniques

- **Snippet = vanilla, zero dependance runtime.** Rien dans `src/snippet/` ne
  doit importer Vue ni aucune lib. Le snippet doit tenir en un seul fichier
  autonome, inclus via `<script src>` sur une page tierce.
- **Vue est reserve a la demo.** Ne jamais faire dependre le snippet de Vue.
- **Helpers purs sans DOM** dans `geometry.ts` : testes sans navigateur et
  reutilises par les scripts d'assets (qui n'ont donc pas besoin des types DOM).
- **TypeScript strict** : `noUnusedLocals`, `noUnusedParameters`,
  `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch` actives. Ne pas les
  desactiver.
- **API globale stable** : `window.FantomText = { mount, scan }`. Auto-scan
  des `[data-fantom-text]` au chargement.
- **Accessibilite** : le texte etant invisible sur une image figee, le canevas
  porte `role="img"` et un `aria-label` synchronise avec le texte affiche.

## Regles de developpement

- **Un fichier par preoccupation** ; viser des fichiers courts.
- **Factoriser, ne pas dupliquer.** Pas de code mort (tout export utilise ou teste).
- **Commentaires utiles seulement** : le pourquoi / le non-evident, pas de
  paraphrase du code.
- **Tests** : toute la logique pure est testee ; le montage DOM est teste sur
  les interactions cles (rendu, attributs, setText, destroy, scan, a11y).

## Commandes (Makefile)

Node 24 requis (`.nvmrc`, `engines` dans `package.json`) : lancer `nvm use`.

| Commande             | Effet                                                               |
| -------------------- | ------------------------------------------------------------------- |
| `make install`       | Installe les dependances                                            |
| `make dev`           | Serveur Vite + esbuild watch sur le snippet (http://localhost:3108) |
| `make build`         | Build snippet + demo dans `dist/`                                   |
| `make build-snippet` | Build du snippet seul                                               |
| `make build-og`      | Regenere og.svg, og.png et favicon.svg                              |
| `make build-preview` | Regenere le GIF anime du README                                     |
| `make lint`          | ESLint                                                              |
| `make typecheck`     | Type-check (vue-tsc)                                                |
| `make format`        | Formate avec Prettier                                               |
| `make format-check`  | Verifie le formatage                                                |
| `make test`          | Tests unitaires (`make test-watch` en watch)                        |
| `make check`         | lint + typecheck + format-check + tests                             |

## Qualite (avant de considerer une tache terminee)

- `make check` doit passer (lint + typecheck + format-check + tests).

## Conventions globales du depot

- **Code en anglais** : commentaires, identifiants, noms de variables et de
  fonctions. Seul le contenu affiche a l'utilisateur peut etre en francais.
- **Commits** : pas de trailer `Co-Authored-By`. Auteur = le compte git de
  Julien uniquement. Vaut aussi pour les descriptions de PR.
- **Typographie** : ne jamais introduire de tiret long (em-dash ou en-dash)
  dans le code, les chaines affichees, les commentaires ou la doc. Utiliser un
  tiret ASCII, deux-points, parentheses, ou reformuler.
