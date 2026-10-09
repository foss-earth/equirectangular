import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { createImageSessionBroker } from "@foss-earth/images";
import { createImageFileService } from "@foss-earth/images/browser";
import { encodePng } from "@foss-earth/images/node";
import { equirectRepresentation } from "@foss-earth/equirectangular";
import { loadEquirect } from "@foss-earth/equirectangular/browser";
import { createEquirectUploadAdapter } from "@foss-earth/equirectangular/babylon";
import { cubePreparationPlan, equirectPyramid, makeCardinalPanorama } from "@foss-earth/equirectangular/preparation";
import { renderCubeFace } from "@foss-earth/cubemap/preparation";
const require = createRequire(import.meta.url);
assert.ok(JSON.parse(readFileSync(require.resolve("@foss-earth/equirectangular/schema.json"), "utf8")));
assert.equal(JSON.parse(readFileSync(require.resolve("@foss-earth/equirectangular/package.json"), "utf8")).version, "0.1.0");
const record = { id: "fixture", role: "immersion", projection: "equirectangular", mimeType: "image/png", encodedBytes: 1, width: 8, height: 4, url: "https://example.invalid/full.png" };
const paths = [...equirectRepresentation.files(record)].map((file, index) => equirectRepresentation.filePath(record, file, index));
assert.deepEqual(paths, [".url"]);
const broker = createImageSessionBroker({ pools: { encoded: 10000, decoded: 10000, sourceGpu: 10000, uploadOutstanding: 10000, overlap: 10000 }, requests: 6, decodes: 1 });
const scope = broker.scope();
let disposed = 0, uploaded = [];
const complete = [];
const uploader = {
  async upload(request) {
    request.signal.throwIfAborted(); uploaded = [...request.images];
    const ticket = request.reserveUpload(4, "physical completion fixture");
    complete.push(() => ticket.release());
    return { kind: request.kind, width: request.images[0].width, height: request.images[0].height, levels: 1, gpuBytes: 4, texture: {}, complete: true, dispose() { disposed++; } };
  },
};
const ports = { broker, scope, label: "fixture", overlap: true, maxTextureSide: 4096,
  async obtain(file) {
    const held = scope.reserve("encoded", 1, "fixture encoded");
    return { bytes: new Uint8Array([1]), contentType: file.mimeType, label: file.url.split("/").at(-1).split(".")[0], release: () => held.release() };
  },
  async decode(body, file) {
    const held = scope.reserve("decoded", file.width * file.height * 4, "fixture pixels");
    return { image: { width: file.width, height: file.height, label: body.label }, close: () => held.release() };
  },
  uploadEquirect: createEquirectUploadAdapter(uploader, broker, scope),
  whenReady: async (_texture, signal) => signal.throwIfAborted(),
};
const loaded = await loadEquirect(record, ports);
assert.equal(uploaded.length, 1);
assert.ok(broker.pools.stats().overlap.reserved > 0);
loaded.settleReplacement(); assert.equal(broker.pools.stats().overlap.reserved, 0);
loaded.dispose(); loaded.dispose(); assert.equal(disposed, 1);
assert.equal(broker.pools.stats().uploadOutstanding.reserved, 4);
for (const finish of complete) { finish(); finish(); }
assert.equal(broker.pools.live().length, 0); broker.dispose();
assert.equal(makeCardinalPanorama(8).rgb.length, 8 * 4 * 3);
const pyramid = equirectPyramid({ width: 8, height: 4, data: new Float32Array(96).fill(0.5) });
assert.deepEqual([...renderCubeFace(cubePreparationPlan(pyramid, 2), "px", 2).data.slice(0, 3)], [0.5, 0.5, 0.5]);
await assert.rejects(import(pathToFileURL(process.env.OWNER_OUTSIDE_CONTROL).href), /OUTSIDE_ISOLATED_WORKSPACE/);
console.log("Public lifecycle, conventions, preparation, schemas and strict workspace negative control passed with one mock host uploader.");

// Actual installed common services: cancellation during the supplied native
// upload callback must retain inputs until late texture disposal finishes.
const nativeBytes = encodePng({ width: 8, height: 4, rgb: new Uint8Array(8 * 4 * 3).fill(80) });
const nativeBroker = createImageSessionBroker({ pools: { encoded: 100000, decoded: 100000, sourceGpu: 100000, uploadOutstanding: 100000, overlap: 100000 }, requests: 6, decodes: 1 });
const nativeScope = nativeBroker.scope();
let nativeClosed = 0, nativeDisposed = 0, nativeReady = 0, nativeResolve;
let nativeBegan;
const nativeStarted = new Promise(resolve => { nativeBegan = resolve; });
const nativeCompletion = new Promise(resolve => { nativeResolve = resolve; });
const nativeCommon = createImageFileService({ broker: nativeBroker, priority: () => 1, limits: () => ({ responseBytes: 100000, timeoutMs: 1000 }),
  fetch: async () => new Response(nativeBytes, { headers: { "content-type": "image/png" } }),
  decode: async () => ({ width: 8, height: 4, close() { nativeClosed++; throw new Error("native input cleanup"); } }) });
const nativeRecord = { ...record, encodedBytes: nativeBytes.length };
const nativeWork = loadEquirect(nativeRecord, { broker: nativeBroker, scope: nativeScope, label: "actual common native input fixture", maxTextureSide: 4096,
  obtain: (file, size) => nativeCommon.obtain(file, size, nativeScope), decode: (body, file) => nativeCommon.decode(body, file, nativeScope),
  uploadEquirect() {
    nativeScope.dispose();
    assert.equal(nativeClosed, 0); assert.equal(nativeBroker.pools.stats().decoded.reserved, 1 * 8 * 4 * 4);
    nativeBegan(); return nativeCompletion;
  }, whenReady: async () => { nativeReady++; } });
const nativeFailure = nativeWork.catch(error => error);
await nativeStarted;
nativeResolve({ dispose() {
  nativeDisposed++; assert.equal(nativeClosed, 0); assert.equal(nativeBroker.pools.stats().decoded.reserved, 1 * 8 * 4 * 4);
  throw new Error("native output cleanup");
} });
const nativeError = await nativeFailure;
const nativeMessages = error => error instanceof AggregateError ? error.errors.flatMap(nativeMessages) : error.message;
assert.deepEqual(nativeMessages(nativeError), ["The image operation ended.", "native output cleanup", ...Array(1).fill("native input cleanup")]);
assert.equal(nativeClosed, 1); assert.equal(nativeDisposed, 1); assert.equal(nativeReady, 0);
assert.deepEqual(nativeBroker.pools.live(), []); nativeScope.dispose(); nativeBroker.dispose(); assert.equal(nativeClosed, 1);
console.log("Actual common decoded sources retained through callback cancellation and late output cleanup.");
