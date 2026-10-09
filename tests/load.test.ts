import { describe, expect, it, vi } from "vitest";
import { createImageSessionBroker } from "@foss-earth/images";
import type { EncodedImageFile, HeldDecodedImage, WholeImageTexture } from "@foss-earth/images/browser";
import { estimateEquirect, type EquirectRepresentationRecord } from "../src/index.js";
import { loadEquirect, type EquirectLoadPorts } from "../src/browser/index.js";
const record: EquirectRepresentationRecord = { id: "full", role: "immersion", projection: "equirectangular", mimeType: "image/png", encodedBytes: 10, width: 8, height: 4, url: "https://example.invalid/full.png" };
function fixture() {
  const broker = createImageSessionBroker({ pools: { encoded: 10000, decoded: 10000, sourceGpu: 10000, uploadOutstanding: 10000, overlap: 10000 }, requests: 1, decodes: 1 });
  const body: EncodedImageFile = { bytes: new Uint8Array([1]), contentType: "image/png", release: vi.fn() };
  const pixels: HeldDecodedImage = { image: { width: 8, height: 4 } as ImageBitmap, close: vi.fn() };
  const texture: WholeImageTexture = { dispose: vi.fn() };
  const ports: EquirectLoadPorts<WholeImageTexture> = { broker, scope: broker.scope(), maxTextureSide: 4096, overlap: true, label: "fixture",
    obtain: vi.fn(async () => body), decode: vi.fn(async () => pixels), uploadEquirect: vi.fn(async () => texture), whenReady: async (_value, signal) => signal.throwIfAborted() };
  return { broker, body, pixels, texture, ports };
}
describe("whole equirectangular lifecycle", () => {
  it("holds replacement overlap until the host visibility acknowledgement", async () => {
    const h = fixture(), loaded = await loadEquirect(record, h.ports);
    expect(h.body.release).toHaveBeenCalledOnce(); expect(h.pixels.close).toHaveBeenCalledOnce();
    expect(h.broker.pools.stats().overlap.reserved).toBe(estimateEquirect(record, h.ports).sourceGpu);
    loaded.settleReplacement(); loaded.settleReplacement();
    expect(h.broker.pools.stats().overlap.reserved).toBe(0);
    expect(h.broker.pools.stats().sourceGpu.reserved).toBeGreaterThan(0);
    loaded.dispose(); loaded.dispose();
    expect(h.texture.dispose).toHaveBeenCalledOnce(); expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
  it("rejects GPU capacity before downloading or decoding", async () => {
    const h = fixture();
    h.broker.setLimits({ pools: { encoded: 10000, decoded: 10000, sourceGpu: 0, uploadOutstanding: 10000, overlap: 0 }, requests: 1, decodes: 1 });
    await expect(loadEquirect(record, h.ports)).rejects.toThrow(/sourceGpu/);
    expect(h.ports.obtain).not.toHaveBeenCalled(); expect(h.ports.decode).not.toHaveBeenCalled(); h.broker.dispose();
  });
  it("releases an acquisition arriving after source replacement without decoding", async () => {
    const h = fixture(); let arrive!: (body: EncodedImageFile) => void;
    h.ports.obtain = () => new Promise(resolve => { arrive = resolve; });
    const pending = loadEquirect(record, h.ports), rejected = expect(pending).rejects.toThrow();
    h.ports.scope.dispose(); arrive(h.body); await rejected;
    expect(h.body.release).toHaveBeenCalledOnce(); expect(h.ports.decode).not.toHaveBeenCalled();
    expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
  it("closes nonabortable decode pixels after source replacement", async () => {
    const h = fixture(); let arrive!: (pixels: HeldDecodedImage) => void;
    h.ports.decode = vi.fn(() => new Promise(resolve => { arrive = resolve; }));
    const pending = loadEquirect(record, h.ports), rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(h.ports.decode).toHaveBeenCalledOnce());
    h.ports.scope.dispose(); arrive(h.pixels); await rejected;
    expect(h.body.release).toHaveBeenCalledOnce(); expect(h.pixels.close).toHaveBeenCalledOnce();
    expect(h.ports.uploadEquirect).not.toHaveBeenCalled(); h.broker.dispose();
  });
  it("disposes an upload arriving after replacement without publishing it", async () => {
    const h = fixture(); let arrive!: (texture: WholeImageTexture) => void;
    h.ports.uploadEquirect = vi.fn(() => new Promise(resolve => { arrive = resolve; }));
    const pending = loadEquirect(record, h.ports), rejected = expect(pending).rejects.toThrow();
    await vi.waitFor(() => expect(h.ports.uploadEquirect).toHaveBeenCalledOnce());
    h.ports.scope.dispose(); arrive(h.texture); await rejected;
    expect(h.texture.dispose).toHaveBeenCalledOnce(); expect(h.pixels.close).toHaveBeenCalledOnce();
    expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
  it("ends an adopted texture if source close fails after readiness", async () => {
    const h = fixture(); h.pixels.close = vi.fn(() => { throw new Error("pixel cleanup"); });
    await expect(loadEquirect(record, h.ports)).rejects.toThrow("pixel cleanup");
    expect(h.texture.dispose).toHaveBeenCalledOnce(); expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
  it("attempts decoded cleanup and releases scope budgets even when encoded release throws", async () => {
    const h = fixture(); h.body.release = vi.fn(() => { throw new Error("body cleanup"); });
    await expect(loadEquirect(record, h.ports)).rejects.toThrow("body cleanup");
    expect(h.body.release).toHaveBeenCalledOnce(); expect(h.pixels.close).toHaveBeenCalledOnce();
    expect(h.ports.uploadEquirect).not.toHaveBeenCalled(); expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
  it("disposes failed renderer readiness and retains the causal error", async () => {
    const h = fixture(); h.ports.whenReady = async () => { throw new Error("renderer not ready"); };
    await expect(loadEquirect(record, h.ports)).rejects.toThrow("renderer not ready");
    expect(h.texture.dispose).toHaveBeenCalledOnce(); expect(h.pixels.close).toHaveBeenCalledOnce();
    expect(h.broker.pools.live()).toHaveLength(0); h.broker.dispose();
  });
});
