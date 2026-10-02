import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mount, scan } from "../src/snippet/fantom-text";

// jsdom has no canvas backend: stub just enough of the 2d context for the
// engine to build its mask and render.
function fakeContext(): unknown {
  return {
    fillRect: vi.fn(),
    fillText: vi.fn(),
    drawImage: vi.fn(),
    putImageData: vi.fn(),
    measureText: () => ({ width: 40 }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
    createImageData: (w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
    }),
  };
}

describe("mount", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(
      () => fakeContext() as CanvasRenderingContext2D,
    );
    vi.stubGlobal("requestAnimationFrame", () => 1);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates a sized, labelled canvas inside a container", () => {
    const div = document.createElement("div");
    div.setAttribute("data-text", "BOO");
    div.setAttribute("data-width", "200");
    div.setAttribute("data-height", "100");
    document.body.appendChild(div);

    const instance = mount(div);
    const canvas = div.querySelector("canvas");
    expect(canvas).toBe(instance.canvas);
    expect(canvas?.width).toBe(200);
    expect(canvas?.height).toBe(100);
    expect(canvas?.getAttribute("role")).toBe("img");
    expect(canvas?.getAttribute("aria-label")).toBe("BOO");
    expect(instance.controller.running()).toBe(true);
  });

  it("falls back to defaults on missing or invalid attributes", () => {
    const div = document.createElement("div");
    div.setAttribute("data-width", "-3");
    const instance = mount(div);
    expect(instance.canvas.width).toBe(640);
    expect(instance.canvas.height).toBe(320);
    expect(instance.canvas.getAttribute("aria-label")).toBe("FANTOM");
  });

  it("lets options override attributes", () => {
    const div = document.createElement("div");
    div.setAttribute("data-text", "BOO");
    const instance = mount(div, { text: "HELLO" });
    expect(instance.canvas.getAttribute("aria-label")).toBe("HELLO");
  });

  it("renders directly into a host canvas", () => {
    const canvas = document.createElement("canvas");
    const instance = mount(canvas);
    expect(instance.canvas).toBe(canvas);
    expect(canvas.children.length).toBe(0);
  });

  it("is idempotent per element", () => {
    const div = document.createElement("div");
    expect(mount(div)).toBe(mount(div));
    expect(div.querySelectorAll("canvas").length).toBe(1);
  });

  it("keeps the accessible label in sync with setText", () => {
    const instance = mount(document.createElement("div"));
    instance.setText("NEW");
    expect(instance.canvas.getAttribute("aria-label")).toBe("NEW");
  });

  it("stops and cleans up on destroy, and can remount", () => {
    const div = document.createElement("div");
    const first = mount(div);
    first.destroy();
    expect(first.controller.running()).toBe(false);
    expect(div.querySelector("canvas")).toBeNull();
    expect(mount(div)).not.toBe(first);
  });

  it("scan mounts every [data-fantom-text] node once", () => {
    document.body.innerHTML =
      "<div data-fantom-text></div><div data-fantom-text></div>";
    scan();
    scan();
    expect(document.querySelectorAll("canvas").length).toBe(2);
  });
});
