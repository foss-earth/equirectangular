import { describe, expect, it } from "vitest";
import { createImageSessionBroker } from "@foss-earth/images";
import { createImageFileService, type WholeImageTexture } from "@foss-earth/images/browser";
import { encodePng } from "@foss-earth/images/node";
import { loadEquirect, type EquirectLoadPorts } from "../src/browser/index.js";
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  return { promise: new Promise<T>((a, b) => { resolve = a; reject = b; }), resolve, reject };
}
const messages = (error: unknown): string[] => error instanceof AggregateError
  ? error.errors.flatMap(messages) : error instanceof Error ? [error.message] : [String(error)];

describe("actual common decoded input remains held through host upload", () => {
  async function pendingUpload(end: "scope" | "invalidate" | "dispose" | "callback", completion: "resolve" | "reject", throwingCleanup = false) {
    const width = 8, height = 4, count = 1;
    const bytes = encodePng({ width, height, rgb: new Uint8Array(width * height * 3).fill(20) });
    const broker = createImageSessionBroker({ requests: 6, decodes: 1, pools: { encoded: 100_000, decoded: 100_000, sourceGpu: 100_000, uploadOutstanding: 100_000, overlap: 100_000 } });
    const scope = broker.scope();
    const events: { resource: string; decoded: number; closed: number }[] = [];
    let closed = 0, disposed = 0, readiness = 0;
    const images: ImageBitmap[] = [];
    const common = createImageFileService({ broker, priority: () => 1, limits: () => ({ responseBytes: 100_000, timeoutMs: 1000 }),
      fetch: async () => new Response(bytes as BodyInit, { headers: { "content-type": "image/png" } }),
      decode: async () => {
        const image = { width, height, close() { closed += 1; events.push({ resource: "input", decoded: broker.pools.stats().decoded.reserved, closed }); if (throwingCleanup) throw new Error("input cleanup"); } } as ImageBitmap;
        images.push(image); return image;
      } });
    const native = deferred<WholeImageTexture>(); let began!: () => void;
    const started = new Promise<void>(resolve => { began = resolve; });
    const ports: EquirectLoadPorts<WholeImageTexture> = { broker, scope, label: "pending native upload", maxTextureSide: 4096, overlap: true,
      obtain: (file, size) => common.obtain(file, size, scope), decode: (body, file) => common.decode(body, file, scope),
      uploadEquirect: input => { expect(input).toBe(images[0]); if (end === "callback") { scope.dispose(); expect(closed).toBe(0); expect(broker.pools.stats().decoded.reserved).toBe(count * width * height * 4); } began(); return native.promise; },
      whenReady: async (_texture, signal) => { readiness += 1; signal.throwIfAborted(); } };
    const record = { id: "pending", role: "immersion" as const, projection: "equirectangular" as const, mimeType: "image/png" as const, encodedBytes: bytes.length, width, height, url: "https://example.invalid/pending.png" };
    const work = loadEquirect(record, ports);
    const failure = work.catch((error: unknown) => error);
    await started;
    const decodedBytes = count * width * height * 4;
    if (end === "scope") scope.dispose(); else if (end === "invalidate") broker.invalidate(); else if (end === "dispose") broker.dispose();
    expect(closed).toBe(0); expect(broker.pools.stats().decoded.reserved).toBe(decodedBytes);
    expect(broker.pools.stats().encoded.reserved).toBe(0);
    if (completion === "reject") native.reject(new Error("native upload failed"));
    else native.resolve({ dispose() {
      disposed += 1; events.push({ resource: "output", decoded: broker.pools.stats().decoded.reserved, closed });
      if (throwingCleanup) throw new Error("output cleanup");
    } });
    const error = await failure;
    expect(error).toBeInstanceOf(Error); expect(readiness).toBe(0);
    expect(disposed).toBe(completion === "resolve" ? 1 : 0);
    expect(closed).toBe(count); expect(broker.pools.live()).toEqual([]);
    if (completion === "resolve") expect(events[0]).toEqual({ resource: "output", decoded: decodedBytes, closed: 0 });
    if (throwingCleanup) {
      const failures = messages(error);
      expect(failures[0]).toBe(completion === "resolve" ? "The image operation ended." : "native upload failed");
      if (completion === "resolve") expect(failures[1]).toBe("output cleanup");
      expect(failures.slice(completion === "resolve" ? 2 : 1)).toEqual(Array(count).fill("input cleanup"));
    }
    scope.dispose(); broker.dispose(); expect(closed).toBe(count); expect(disposed).toBe(completion === "resolve" ? 1 : 0);
  }
  for (const end of ["scope", "invalidate", "dispose", "callback"] as const) for (const completion of ["resolve", "reject"] as const) {
    it(`${end}: holds bitmap and decoded charge until upload ${completion} and disposes late output first`, () => pendingUpload(end, completion));
  }
  for (const completion of ["resolve", "reject"] as const) {
    it(`attempts every cleanup and retains ordered errors after upload ${completion}`, () => pendingUpload("dispose", completion, true));
  }
});
