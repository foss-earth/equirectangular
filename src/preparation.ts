import { resizeArea, type LinearImage, type ImageSamplingPlan, type SourceSampler } from "@foss-earth/images";

/**
 * `cubePreparationPlan` puts the level it samples on its sampler under this key.
 * Cubemap and tiled-cubemap read it and run the same sampling in one loop; a
 * sampler without the key is read one direction at a time. The key is not part
 * of `SourceSampler`.
 */
const CUBE_PREPARATION_LEVEL = Symbol.for("foss-earth.equirectangular.cubePreparationLevel");

/** Halvings of an equirectangular image down to 64 wide: area averages, so each level is a correct prefilter. */
export function equirectPyramid(image: LinearImage, minWidth = 64): readonly LinearImage[] {
  if (!Number.isSafeInteger(minWidth) || minWidth < 1) throw new RangeError("Minimum pyramid width must be a positive integer.");
  const levels = [image];
  while (levels.at(-1)!.width > minWidth && levels.at(-1)!.height > 1) {
    const last = levels.at(-1)!;
    levels.push(resizeArea(last, Math.max(1, Math.floor(last.width / 2)), Math.max(1, Math.floor(last.height / 2))));
  }
  return levels;
}

/** Bilinear sample with longitude wrapping and latitude clamped. */
export function sampleEquirect(level: LinearImage, u: number, v: number, out: Float32Array | Float64Array | number[]): void {
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

/** Math.hypot(x, y, z) as V8 14.6 computes it for three numbers (math.tq, FastMathHypot). */
function hypot3(x: number, y: number, z: number): number {
  const a = Math.abs(x), b = Math.abs(y), c = Math.abs(z);
  if (a === Infinity || b === Infinity || c === Infinity) return Infinity;
  const max = Math.max(Math.max(a, b), c);
  if (Number.isNaN(max)) return NaN;
  if (max === 0) return 0;
  const powerA = (a / max) * (a / max);
  const powerB = (b / max) * (b / max);
  const compensation = (powerA + powerB) - powerA - powerB;
  const powerC = (c / max) * (c / max) - compensation;
  return Math.sqrt(powerA + powerB + powerC) * max;
}

export function equirectUv(x: number, y: number, z: number): readonly [number, number] {
  const n = hypot3(x, y, z);
  return [0.5 + Math.atan2(x, y) / (2 * Math.PI), 0.5 - Math.asin(Math.max(-1, Math.min(1, z / n))) / Math.PI];
}

function sampleDirection(level: LinearImage, x: number, y: number, z: number, out: Float32Array | Float64Array | number[]): void {
  const n = hypot3(x, y, z);
  sampleEquirect(level, 0.5 + Math.atan2(x, y) / (2 * Math.PI), 0.5 - Math.asin(Math.max(-1, Math.min(1, z / n))) / Math.PI, out);
}

/** A common linear-light sampler over already oriented full-sphere pixels.
 * The angular footprint chooses the retained area-average prefilter level.
 * EXIF and codecs belong to images; no second orientation is applied here. */
export function createEquirectSourceSampler(pyramid: readonly LinearImage[]): SourceSampler {
  if (!pyramid.length || pyramid.some(level => !Number.isSafeInteger(level.width) || !Number.isSafeInteger(level.height) || level.width < 1 || level.height < 1 || level.data.length !== level.width * level.height * 3)) throw new RangeError("A source sampler needs a nonempty linear RGB pyramid.");
  return {
    sample(direction, footprintRadians, out) {
      if (!Number.isFinite(footprintRadians) || footprintRadians < 0) throw new RangeError("Angular footprint must be finite nonnegative radians.");
      const ratio = pyramid[0].width * footprintRadians / (2 * Math.PI);
      const level = Math.max(0, Math.min(pyramid.length - 1, Math.floor(Math.log2(Math.max(1, ratio)))));
      sampleDirection(pyramid[level], direction[0], direction[1], direction[2], out);
    },
  };
}

/**
 * Source planning preserves the original preparation prefilter and 2/3 grid.
 * A face spans a quarter turn; this function has no target-format dependency.
 */
export function cubePreparationPlan(pyramid: readonly LinearImage[], faceSize: number): ImageSamplingPlan {
  if (!pyramid.length || !Number.isSafeInteger(faceSize) || faceSize < 1) throw new RangeError("Preparation needs a pyramid and positive face size.");
  const ratio = pyramid[0].width / 4 / faceSize;
  const level = Math.max(0, Math.min(pyramid.length - 1, Math.floor(Math.log2(Math.max(1, ratio)))));
  const source = pyramid[level];
  const residual = source.width / 4 / faceSize;
  const sampler: SourceSampler = {
    sample(direction, _footprintRadians, out) {
      sampleDirection(source, direction[0], direction[1], direction[2], out);
    },
  };
  Object.defineProperty(sampler, CUBE_PREPARATION_LEVEL, { value: source });
  return {
    samplesPerAxis: residual > 1.5 ? 3 : 2,
    footprintRadians: Math.PI / (2 * faceSize),
    source: sampler,
  };
}

export { makeCardinalPanorama } from "./cardinal.js";

/** Original version-1 preparation eligibility, including explicit GPano crops. */
export function validatePreparationCoverage(image: { width: number; height: number }, gpano: Record<string, string | number> | null): void {
  if (image.width !== 2 * image.height) throw new Error(`the input is ${image.width}×${image.height}; version 1 needs a full 2:1 equirectangular image`);
  if (!gpano) return;
  const full = gpano.FullPanoWidthPixels, cropped = gpano.CroppedAreaImageWidthPixels;
  const fullHeight = gpano.FullPanoHeightPixels, croppedHeight = gpano.CroppedAreaImageHeightPixels;
  if ((typeof full === "number" && typeof cropped === "number" && cropped < full)
    || (typeof fullHeight === "number" && typeof croppedHeight === "number" && croppedHeight < fullHeight)) {
    throw new Error("GPano says the input is cropped; version 1 accepts only full panoramas");
  }
  if (gpano.ProjectionType && gpano.ProjectionType !== "equirectangular") throw new Error(`GPano projection ${gpano.ProjectionType} is not equirectangular`);
}
