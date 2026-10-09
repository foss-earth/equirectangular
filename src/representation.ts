import { ImageRecordChecker, checkImageRepresentationBase, resolveImageUrl, rgba8Bytes, type ImageRepresentation, type RepresentationHooks, type RepresentationValidation, type ImageEstimate } from "@foss-earth/images";
export interface EquirectRepresentationRecord extends ImageRepresentation {
  projection: "equirectangular";
  width: number;
  height: number;
  url: string;
}
export function validateEquirectRepresentation(value: unknown, context: { path: string; baseUrl: string | null }): RepresentationValidation<EquirectRepresentationRecord> {
  const checker = new ImageRecordChecker();
  const { path } = context;
  const record = checker.record(value, path);
  if (!record) return { ok: false, errors: checker.errors };
  checker.keys(record, path, ["id", "role", "projection", "mimeType", "encodedBytes", "extensions", "width", "height", "url"]);
  checker.oneOf(record.projection, `${path}.projection`, ["equirectangular"]);
  const common = checkImageRepresentationBase(checker, record, path);
  const width = checker.positiveInteger(record.width, `${path}.width`);
  const height = checker.positiveInteger(record.height, `${path}.height`);
  if (width !== null && height !== null && width !== 2 * height) checker.fail(`${path}.width`, "must be twice the height: a full 2:1 equirectangular image");
  let base: URL | null = null;
  try { base = context.baseUrl === null ? null : new URL(context.baseUrl); }
  catch { checker.fail(path, "base URL must be absolute"); }
  const url = resolveImageUrl(checker, record.url, `${path}.url`, base);
  if (!common || !width || !height || !url || checker.errors.length) return { ok: false, errors: checker.errors };
  return { ok: true, representation: { ...common, projection: "equirectangular", width, height, url }, warnings: checker.warnings };
}
export function estimateEquirect(record: EquirectRepresentationRecord, context: { maxTextureSide: number }): ImageEstimate {
  if (record.width > context.maxTextureSide) throw new RangeError("Equirectangular image exceeds the supplied device texture limit.");
  const decoded = 4 * record.width * record.height;
  return { encoded: record.encodedBytes, decoded, sourceGpu: rgba8Bytes(record.width, record.height), uploadOutstanding: decoded };
}
export const equirectRepresentation: RepresentationHooks<EquirectRepresentationRecord> = {
  projection: "equirectangular", validate: validateEquirectRepresentation,
  files: record => [{ url: record.url, mimeType: record.mimeType, width: record.width, height: record.height }],
  filePath: () => ".url",
  estimate: estimateEquirect,
};
