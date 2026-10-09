import { describe, expect, it } from "vitest";
import { equirectDirection, equirectCoordinates } from "./core.js";
import { validateEquirectRepresentation } from "./representation.js";
import { sampleEquirect, equirectPyramid, cubePreparationPlan } from "./preparation.js";

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
