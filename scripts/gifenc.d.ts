// Minimal typings for the subset of gifenc used by build-preview.ts.
declare module "gifenc" {
  type FrameOptions = {
    palette?: number[][];
    delay?: number;
    transparent?: boolean;
    transparentIndex?: number;
    dispose?: number;
  };
  type Encoder = {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: FrameOptions,
    ) => void;
    finish: () => void;
    bytes: () => Uint8Array;
  };
  const gifenc: { GIFEncoder: () => Encoder };
  export default gifenc;
}
