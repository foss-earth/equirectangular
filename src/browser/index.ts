import type { EncodedImageFile, HeldDecodedImage, WholeImagePorts, WholeImageTexture, LoadedWholeImage } from "@foss-earth/images/browser";
import { equirectRepresentation, estimateEquirect, type EquirectRepresentationRecord } from "../representation.js";
export interface EquirectLoadPorts<T extends WholeImageTexture> extends WholeImagePorts<T> {
  /** Settles only after the supplied uploader has stopped reading the bitmap.
   * The common decoder's retain holds pixels through settlement and stale-output
   * cleanup. Legacy decoders without retain keep their historical, unqualified lifetime. */
  uploadEquirect(image: ImageBitmap, label: string): Promise<T>;
  label: string;
}
export async function loadEquirect<T extends WholeImageTexture>(record: EquirectRepresentationRecord, ports: EquirectLoadPorts<T>): Promise<LoadedWholeImage<T>> {
  const { scope } = ports;
  const declared = Array.from(equirectRepresentation.files(record))[0];
  let encoded: EncodedImageFile | undefined;
  let decoded: HeldDecodedImage | undefined;
  let releaseInput: (() => void) | undefined;
  let unownedTexture: T | undefined;
  let loaded: LoadedWholeImage<T> | undefined;
  const failures: unknown[] = [];
  const outputFailures: unknown[] = [];
  const inputFailures: unknown[] = [];
  function requireCurrent(): void {
    scope.signal.throwIfAborted();
    if (!scope.isCurrent()) throw new Error("Stale equirectangular upload.");
  }
  function endOutput(): void {
    const texture = unownedTexture; unownedTexture = undefined;
    try { texture?.dispose(); } catch (cleanup) { outputFailures.push(cleanup); }
    try { scope.dispose(); } catch (cleanup) { outputFailures.push(cleanup); }
  }
  try {
    requireCurrent();
    const estimate = estimateEquirect(record, ports);
    const gpu = scope.reserve("sourceGpu", estimate.sourceGpu, ports.label, { overlap: ports.overlap });
    encoded = await ports.obtain(declared, record.encodedBytes);
    requireCurrent();
    decoded = await ports.decode(encoded, declared);
    requireCurrent();
    const body = encoded;
    encoded = undefined;
    body.release();
    requireCurrent();
    // Acquire before invoking the host: it can synchronously end the scope or
    // enqueue work that still reads pixels after cancellation.
    releaseInput = decoded.retain?.();
    requireCurrent();
    unownedTexture = await ports.uploadEquirect(decoded.image, ports.label);
    requireCurrent();
    const texture = unownedTexture; unownedTexture = undefined;
    if (!scope.adopt(texture)) { scope.signal.throwIfAborted(); throw new Error("Stale equirectangular upload."); }
    await ports.whenReady(texture, scope.signal);
    requireCurrent();
    loaded = { texture, estimate, settleReplacement: () => gpu.settle(), dispose: () => scope.dispose() };
  } catch (error) { failures.push(error); }
  if (failures.length) endOutput();
  try { encoded?.release(); } catch (cleanup) { inputFailures.push(cleanup); }
  try { decoded?.close(); } catch (cleanup) { inputFailures.push(cleanup); }
  // A stale texture disposer has already run while its native input was held.
  try { releaseInput?.(); } catch (cleanup) { inputFailures.push(cleanup); }
  if (!failures.length && !inputFailures.length) {
    try { requireCurrent(); } catch (error) { failures.push(error); }
  }
  if (failures.length || inputFailures.length) endOutput();
  const errors = [...failures, ...outputFailures, ...inputFailures];
  if (errors.length) throw errors.length === 1 ? errors[0] : new AggregateError(errors, "Equirectangular loading and cleanup failed.");
  return loaded!;
}
