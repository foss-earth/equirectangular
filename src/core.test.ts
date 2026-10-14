import { describe, expect, it } from "vitest";
import { equirectDirection, equirectCoordinates } from "./core.js";
import { validateEquirectRepresentation } from "./representation.js";
import { sampleEquirect, equirectPyramid, equirectUv, cubePreparationPlan, createEquirectSourceSampler } from "./preparation.js";
import type { LinearImage } from "@foss-earth/images";

/** The channel loop sampleEquirect used to run, kept here so the written-out form has to match it. */
function referenceSample(level: LinearImage, u: number, v: number, out: number[]): void {
  const { width, height, data } = level;
  const fx = u * width - 0.5;
  const fy = Math.min(height - 1, Math.max(0, v * height - 0.5));
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const y1 = Math.min(height - 1, y0 + 1);
  const xa = ((x0 % width) + width) % width, xb = (xa + 1) % width;
  for (let c = 0; c < 3; c++) {
    const top = data[(y0 * width + xa) * 3 + c] * (1 - tx) + data[(y0 * width + xb) * 3 + c] * tx;
    const bottom = data[(y1 * width + xa) * 3 + c] * (1 - tx) + data[(y1 * width + xb) * 3 + c] * tx;
    out[c] = top * (1 - ty) + bottom * ty;
  }
}

function sameBytes(actual: readonly number[], expected: readonly number[]): boolean {
  if (actual.length !== expected.length) return false;
  const a = new Float64Array(actual), b = new Float64Array(expected);
  const ua = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), ub = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < ua.length; i++) if (ua[i] !== ub[i]) return false;
  return true;
}

describe("whole equirectangular source", () => {
  it("preserves cardinal conventions and both poles", () => {
    expect(equirectDirection(0.5, 0.5)).toEqual([0, 1, 0]);
    expect(equirectDirection(0.75, 0.5)[0]).toBeCloseTo(1, 12);
    expect(equirectDirection(0.5, 0)[2]).toBeCloseTo(1, 12);
    expect(equirectDirection(0.5, 1)[2]).toBeCloseTo(-1, 12);
    for (const [u, v] of [[0.1, 0.2], [0.6, 0.9], [0.99, 0.45]]) {
      const back = equirectCoordinates(equirectDirection(u, v));
      expect(back.u).toBeCloseTo(u, 12);
      expect(back.v).toBeCloseTo(v, 12);
    }
  });
  it("wraps the longitude seam and clamps latitude when filtering", () => {
    const source = { width: 4, height: 2, data: new Float32Array([1,0,0, 0,1,0, 0,0,1, 1,1,1, 0,0,0, 0,0,0, 0,0,0, 0,0,0]) };
    const a = [0, 0, 0], b = [0, 0, 0];
    sampleEquirect(source, 0, -1, a);
    sampleEquirect(source, 1, -1, b);
    expect(a).toEqual([1, 0.5, 0.5]);
    expect(b).toEqual(a);
    sampleEquirect(source, 0, 2, b);
    expect(b).toEqual([0, 0, 0]);
  });
  it("matches the channel loop and Math.hypot, including a NaN payload", () => {
    const level = { width: 8, height: 4, data: new Float32Array(96) };
    let s = 9;
    for (let k = 0; k < level.data.length; k++) { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; level.data[k] = (s >>> 0) / 2 ** 32; }
    const bits = new Uint32Array(level.data.buffer, level.data.byteOffset, level.data.length);
    bits[3] = 0x7fc00001;
    bits[40] = 0xffc12345;
    const actual = [0, 0, 0], expected = [0, 0, 0];
    for (let v = -0.2; v <= 1.2; v += 0.07) for (let u = -1.5; u <= 2.5; u += 0.05) {
      sampleEquirect(level, u, v, actual);
      referenceSample(level, u, v, expected);
      expect(sameBytes(actual, expected), `${u},${v}`).toBe(true);
    }
    const directions = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-1, 2, -3], [1e-300, 1e-300, 1e-300], [1e308, -1e308, 1], [0, 0, 0], [Infinity, 1, -1], [NaN, 2, 3], [1, Infinity, NaN]];
    for (const [x, y, z] of directions) {
      const [u, v] = equirectUv(x, y, z);
      const n = Math.hypot(x, y, z);
      expect(Object.is(u, 0.5 + Math.atan2(x, y) / (2 * Math.PI))).toBe(true);
      expect(Object.is(v, 0.5 - Math.asin(Math.max(-1, Math.min(1, z / n))) / Math.PI)).toBe(true);
    }
  });
  it("marks only the preparation plan's level", () => {
    const pyramid = equirectPyramid({ width: 128, height: 64, data: new Float32Array(128 * 64 * 3).fill(0.5) });
    const plan = cubePreparationPlan(pyramid, 16);
    const level = (plan.source as unknown as Record<symbol, LinearImage>)[Symbol.for("foss-earth.equirectangular.cubePreparationLevel")];
    expect(level).toBe(pyramid[1]);
    const foreign = createEquirectSourceSampler(pyramid);
    expect((foreign as unknown as Record<symbol, unknown>)[Symbol.for("foss-earth.equirectangular.cubePreparationLevel")]).toBeUndefined();
    const out = [0, 0, 0], viaUv = [0, 0, 0];
    plan.source.sample([0.2, -0.4, 0.9], 99, out);
    const [u, v] = equirectUv(0.2, -0.4, 0.9);
    referenceSample(level, u, v, viaUv);
    expect(sameBytes(out, viaUv)).toBe(true);
    // A uniform image hides a wrong direction. This one does not.
    const varied = { width: 8, height: 4, data: new Float32Array(96) };
    for (let k = 0; k < varied.data.length; k++) varied.data[k] = (k * 17 % 100) / 100;
    const variedPlan = cubePreparationPlan([varied], 2);
    const out2 = [0, 0, 0], via2 = [0, 0, 0];
    variedPlan.source.sample([0.2, -0.4, 0.9], 0, out2);
    const [u2, v2] = equirectUv(0.2, -0.4, 0.9);
    referenceSample(varied, u2, v2, via2);
    expect(sameBytes(out2, via2)).toBe(true);
  });
  it("uses a source-side prefilter plan with the original 2/3 sample grid", () => {
    const pyramid = equirectPyramid({ width: 128, height: 64, data: new Float32Array(128 * 64 * 3).fill(0.5) });
    expect(pyramid.map(level => level.width)).toEqual([128, 64]);
    const plan = cubePreparationPlan(pyramid, 4);
    expect(plan.samplesPerAxis).toBe(3);
    const colour = [0, 0, 0];
    plan.source.sample([0, 1, 0], plan.footprintRadians, colour);
    expect(colour).toEqual([0.5, 0.5, 0.5]);
  });
  it("requires the full 2:1 image and safe resolved URL", () => {
    const input = { id: "immersion", role: "immersion", projection: "equirectangular", mimeType: "image/png", encodedBytes: 20, width: 8, height: 4, url: "image.png" };
    const context = { path: "$.image", baseUrl: "https://example.invalid/scenes/main.json" };
    expect(validateEquirectRepresentation(input, context).ok).toBe(true);
    expect(validateEquirectRepresentation({ ...input, width: 7 }, context).ok).toBe(false);
    expect(validateEquirectRepresentation({ ...input, url: "file:///image.png" }, context).ok).toBe(false);
  });
});
