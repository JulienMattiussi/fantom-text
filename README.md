<p align="center">
  <strong>fantom-text 👻</strong>
</p>

<p align="center">
  A tiny embeddable, zero-dependency ghost text toy in vanilla TypeScript:
  text hidden in noise, visible only while it moves.
</p>

---

## What is this

A canvas fills with black/white noise. Somewhere in it, a text drifts: you
can read it as long as it moves, but any single frozen frame is pure noise.
Pause it and the text vanishes. Concept adapted from
[optical.toys "POV static cube"](https://optical.toys/persistance-of-vision-static-cube/).

It ships as a single-file JavaScript snippet (zero dependencies) you can drop
on any page, plus a small Vue demo page with live controls.

## Usage

Drop these two lines into any HTML page:

```html
<div data-fantom-text data-text="BOO"></div>
<script src="https://<host>/fantom-text.js"></script>
```

Supported attributes on the element (which may itself be a `<canvas>`):

| Attribute         | Description                                   | Default   |
| ----------------- | --------------------------------------------- | --------- |
| `data-text`       | The hidden text.                              | `FANTOM`  |
| `data-mode`       | `outline` or `fill` (static background only). | `outline` |
| `data-background` | `static`, `dynamic` or `oscillate`.           | `static`  |
| `data-width`      | Canvas width in pixels.                       | `640`     |
| `data-height`     | Canvas height in pixels.                      | `320`     |

Click the canvas to freeze / resume the motion.

### Imperative API

Exposed on `window.FantomText`:

- `scan()` : re-scan the DOM for new `[data-fantom-text]` nodes.
- `mount(el, options?)` : mount explicitly. Options mirror the attributes
  (`text`, `mode`, `background`, `width`, `height`) plus engine tuning
  (`cellSize`, `fontSize`, `fontFamily`, `speed`, `rotationSpeed`,
  `maxRotation`, `flowSpeed`, `oscAmplitude`, `stepMs`, `pauseOnClick`, `rng`).

`mount` returns `{ element, canvas, controller, setText, destroy }`, where
`controller` exposes `start`, `stop`, `toggle` and `running`.

## Development

Requires Node 24 (pinned in `.nvmrc`, run `nvm use`).

```bash
make install   # install dependencies
make dev       # Vite dev server + esbuild watch  (http://localhost:3108)
make check     # lint + typecheck + format-check + tests
make build     # snippet + demo into dist/
```

## License

MIT
