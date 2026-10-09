import { describe, expect, it } from "vitest";
import { applyOrientation, dropOpaqueAlpha, toLinearImage, toSrgbImage } from "@foss-earth/images";
import { readGPano } from "@foss-earth/images/node";
import { CUBE_FACE_NAMES, SOURCE_CUBE_FACES } from "@foss-earth/cubemap/core";
import { renderCubeFace } from "@foss-earth/cubemap/preparation";
import { createEquirectSourceSampler, cubePreparationPlan, equirectPyramid, equirectUv, makeCardinalPanorama, validatePreparationCoverage } from "../src/preparation.js";
import { makeCardinalPanorama as originalCardinal } from "../fixtures/original-cardinal.mjs";

describe("retained preparation format and common source contract", () => {
  it("retains the exact original cardinal/grid/pole RGB bytes", () => {
    for (const width of [32, 128, 256]) {
      const actual = makeCardinalPanorama(width);
      const original = originalCardinal(width);
      expect(actual.width).toBe(original.width); expect(actual.height).toBe(original.height);
      expect(actual.rgb).toEqual(new Uint8Array(original.rgb));
    }
  });
  it("accepts complete GPano coverage and refuses cropped or other-projection inputs", () => {
    const cropped = readGPano('<rdf:Description GPano:ProjectionType="equirectangular" GPano:FullPanoWidthPixels="16"><GPano:CroppedAreaImageWidthPixels>8</GPano:CroppedAreaImageWidthPixels></rdf:Description>');
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, cropped)).toThrow("cropped");
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, null)).not.toThrow();
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, { ProjectionType: "equirectangular", FullPanoWidthPixels: 8, CroppedAreaImageWidthPixels: 8, FullPanoHeightPixels: 4, CroppedAreaImageHeightPixels: 4 })).not.toThrow();
    expect(() => validatePreparationCoverage({ width: 7, height: 4 }, null)).toThrow("full 2:1");
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, { FullPanoWidthPixels: 16, CroppedAreaImageWidthPixels: 8 })).toThrow("cropped");
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, { FullPanoHeightPixels: 8, CroppedAreaImageHeightPixels: 4 })).toThrow("cropped");
    expect(() => validatePreparationCoverage({ width: 8, height: 4 }, { ProjectionType: "rectilinear" })).toThrow("not equirectangular");
  });
  it("uses common orientation once and samples the displayed pixels without another rotation", () => {
    const stored = { width: 4, height: 2, rgba: new Uint8Array(Array.from({ length: 8 }, (_, i) => [i * 30, 0, 0, 255]).flat()) };
    const displayed = applyOrientation(stored, 3);
    const linear = toLinearImage(dropOpaqueAlpha(displayed));
    const sampler = createEquirectSourceSampler(equirectPyramid(linear));
    const [u, v] = [0.5 / 4, 0.5 / 2];
    const lon = (u - 0.5) * 2 * Math.PI, lat = (0.5 - v) * Math.PI;
    const out = [0, 0, 0];
    sampler.sample([Math.sin(lon) * Math.cos(lat), Math.cos(lon) * Math.cos(lat), Math.sin(lat)], 0, out);
    expect(out[0]).toBeCloseTo(linear.data[0], 6);
    expect(out[0]).toBeGreaterThan(0.5);
  });
  it("averages in linear light and performs one sRGB output conversion", () => {
    const rgb = new Uint8Array([0, 255, 0, 255, 0, 255, 0, 255].flatMap(value => [value, value, value]));
    const levels = equirectPyramid(toLinearImage({ width: 4, height: 2, rgb }), 2);
    expect([...levels[1].data]).toEqual(Array(6).fill(0.5));
    expect([...toSrgbImage(levels[1]).rgb]).toEqual(Array(6).fill(188));
  });
  it("routes the original cube preparation test through both owners' public APIs", () => {
    // Retained from scripts/lib/panoramaImage.test.mjs, without its codec,
    // tiling or private cube implementation imports.
    const width = 256, height = 128, data = new Float32Array(width * height * 3);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      data[(y * width + x) * 3] = (x + 0.5) / width;
      data[(y * width + x) * 3 + 1] = (y + 0.5) / height;
    }
    const pyramid = equirectPyramid({ width, height, data });
    for (const face of CUBE_FACE_NAMES) {
      const size = 16, out = renderCubeFace(cubePreparationPlan(pyramid, size), face, size);
      const { f, r, t } = SOURCE_CUBE_FACES[face];
      for (const [i, j] of [[8, 8], [4, 10], [12, 5]]) {
        const a = 2 * ((i + 0.5) / size) - 1, b = 1 - 2 * ((j + 0.5) / size);
        const [u, v] = equirectUv(f[0] + a * r[0] + b * t[0], f[1] + a * r[1] + b * t[1], f[2] + a * r[2] + b * t[2]);
        if (u < 0.05 || u > 0.95 || v < 0.1 || v > 0.9) continue;
        expect(out.data[(j * size + i) * 3]).toBeCloseTo(u, 1);
        expect(out.data[(j * size + i) * 3 + 1]).toBeCloseTo(v, 1);
      }
    }
  });
  it("selects the source prefilter from angular footprint without a target-format dependency", () => {
    const fine = { width: 8, height: 4, data: new Float32Array(96).fill(1) };
    const coarse = { width: 4, height: 2, data: new Float32Array(24).fill(0.25) };
    const sampler = createEquirectSourceSampler([fine, coarse]), out = [0, 0, 0];
    sampler.sample([0, 1, 0], 0, out); expect(out).toEqual([1, 1, 1]);
    sampler.sample([0, 1, 0], Math.PI / 2, out); expect(out).toEqual([0.25, 0.25, 0.25]);
  });
});
