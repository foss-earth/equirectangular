import { describe, expect, it, vi } from "vitest";
import { createImageSessionBroker } from "@foss-earth/images";
import type { ImageTextureUploader, ImageUploadRequest, UploadedImageTexture } from "@foss-earth/renderer/babylon";
import { createEquirectUploadAdapter } from "../src/browser/babylon.js";

describe("one supplied uploader and broker", () => {
  it("preserves representation conventions and submitted charges through CPU cancellation", async () => {
    const broker = createImageSessionBroker({ pools: { encoded: 100, decoded: 100, sourceGpu: 1000, uploadOutstanding: 100, overlap: 1000 }, requests: 1, decodes: 1 });
    const scope = broker.scope();
    let request: ImageUploadRequest | undefined;
    const complete: (() => void)[] = [];
    const texture: UploadedImageTexture = { kind: "2d", width: 4, height: 4, levels: 1, gpuBytes: 64, texture: {} as UploadedImageTexture["texture"], complete: true, dispose: vi.fn() };
    const uploader: ImageTextureUploader = {
      async upload(input) {
        request = input; input.signal.throwIfAborted();
        const ticket = input.reserveUpload(32, "fixture rows");
        const strip = input.reserveDecodedStaging(16, "fixture strip");
        complete.push(() => { ticket.release(); strip.release(); });
        return texture;
      }, pump: () => 0, busy: () => false, setLimits() {}, stats: () => ({ queuedJobs: 0, outstandingBytes: 0, lastFrameBytes: 0, uploadedBytes: 0 }), cancelAll() {},
    };
    const pixels = { width: 8, height: 4 } as ImageBitmap;
    const upload = createEquirectUploadAdapter(uploader, broker, scope);
    expect(await upload(pixels, "fixture")).toBe(texture);
    expect(request!.kind).toBe("2d"); expect(request!.images).toEqual([pixels]);
    scope.dispose();
    expect(broker.pools.stats().uploadOutstanding.reserved).toBe(32);
    expect(broker.pools.stats().decoded.reserved).toBe(16);
    complete[0](); complete[0]();
    expect(broker.pools.live()).toHaveLength(0); broker.dispose();
  });
});
