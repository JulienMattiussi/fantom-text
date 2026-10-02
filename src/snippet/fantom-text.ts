/**
 * fantom-text: a tiny embeddable, zero-dependency "ghost text" toy. The text
 * is hidden in black/white noise and only visible while it moves.
 *
 * Usage (in any remote HTML page):
 *
 *   <div data-fantom-text data-text="BOO"></div>
 *   <script src="https://<host>/fantom-text.js"></script>
 *
 * The element may itself be a <canvas>; otherwise one is created inside it.
 * Attributes and options are documented in the README.
 *
 * Imperative API (exposed on window.FantomText):
 *   - scan()               : re-scan the DOM for new [data-fantom-text] nodes
 *   - mount(el, options?)  : mount explicitly on an element
 */

import {
  createPovText,
  DEFAULT_TEXT,
  type PovBackground,
  type PovController,
  type PovMode,
  type PovOptions,
} from "./pov";

const DEFAULT_WIDTH = 640;
const DEFAULT_HEIGHT = 320;

export type MountOptions = PovOptions & {
  width?: number;
  height?: number;
};

export type Instance = {
  element: HTMLElement;
  canvas: HTMLCanvasElement;
  controller: PovController;
  setText: (text: string) => void;
  destroy: () => void;
};

type FantomTextApi = {
  mount: (el: HTMLElement, options?: MountOptions) => Instance;
  scan: () => void;
};

declare global {
  interface Window {
    FantomText?: FantomTextApi;
  }
}

const MODES: readonly PovMode[] = ["outline", "fill"];
const BACKGROUNDS: readonly PovBackground[] = ["static", "oscillate"];

const mounted = new WeakMap<HTMLElement, Instance>();

function pick<T extends string>(
  value: string | null,
  allowed: readonly T[],
): T | undefined {
  return allowed.find((v) => v === value);
}

function positiveInt(value: string | null): number | undefined {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

type ResolvedOptions = MountOptions & {
  text: string;
  width: number;
  height: number;
};

function resolveOptions(
  el: HTMLElement,
  options: MountOptions,
): ResolvedOptions {
  return {
    ...options,
    text: options.text ?? el.getAttribute("data-text") ?? DEFAULT_TEXT,
    mode: options.mode ?? pick(el.getAttribute("data-mode"), MODES),
    background:
      options.background ??
      pick(el.getAttribute("data-background"), BACKGROUNDS),
    width:
      options.width ??
      positiveInt(el.getAttribute("data-width")) ??
      DEFAULT_WIDTH,
    height:
      options.height ??
      positiveInt(el.getAttribute("data-height")) ??
      DEFAULT_HEIGHT,
  };
}

export function mount(el: HTMLElement, options: MountOptions = {}): Instance {
  const existing = mounted.get(el);
  if (existing) return existing;

  const opts = resolveOptions(el, options);
  const ownsCanvas = !(el instanceof HTMLCanvasElement);
  const canvas = ownsCanvas ? document.createElement("canvas") : el;
  if (ownsCanvas) {
    canvas.style.display = "block";
    canvas.style.maxWidth = "100%";
    // Keep the aspect ratio when max-width shrinks it on narrow screens.
    canvas.style.height = "auto";
    el.appendChild(canvas);
  }
  canvas.width = opts.width;
  canvas.height = opts.height;
  // The text is invisible on any still frame, so expose it to assistive tech.
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", opts.text);

  const controller = createPovText(canvas, opts);

  function setText(text: string): void {
    canvas.setAttribute("aria-label", text);
    controller.setText(text);
  }

  const instance: Instance = {
    element: el,
    canvas,
    controller,
    setText,
    destroy() {
      controller.destroy();
      if (ownsCanvas) canvas.remove();
      else {
        canvas.removeAttribute("role");
        canvas.removeAttribute("aria-label");
      }
      mounted.delete(el);
    },
  };

  mounted.set(el, instance);
  return instance;
}

export function scan(): void {
  document.querySelectorAll<HTMLElement>("[data-fantom-text]").forEach((el) => {
    if (!mounted.has(el)) mount(el);
  });
}

if (!window.FantomText) {
  window.FantomText = { mount, scan };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan, { once: true });
  } else {
    scan();
  }
}
