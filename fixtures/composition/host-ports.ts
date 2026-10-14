/** Application composition fixture: common cache/decode, one renderer authority. */
import type { ImageSessionBroker, ImageOperationScope } from "@foss-earth/images";
import type { ImageFileService } from "@foss-earth/images/browser";
import type { ImageTextureUploader, UploadedImageTexture } from "@foss-earth/renderer/babylon";
import { createEquirectUploadAdapter } from "@foss-earth/sphere-equirectangular/babylon";
import type { EquirectLoadPorts } from "@foss-earth/sphere-equirectangular/browser";
export function equirectHostPorts(host: {
  broker: ImageSessionBroker; scope: ImageOperationScope; files: ImageFileService;
  uploader: ImageTextureUploader; maxTextureSide: number; label: string; overlap: boolean; priority: number;
  whenReady(texture: UploadedImageTexture, signal: AbortSignal): Promise<void>;
}): EquirectLoadPorts<UploadedImageTexture> {
  return {
    broker: host.broker, scope: host.scope, maxTextureSide: host.maxTextureSide, label: host.label, overlap: host.overlap,
    obtain: (file, bytes) => host.files.obtain(file, bytes, host.scope, undefined, host.priority),
    decode: (file, declared) => host.files.decode(file, declared, host.scope, host.priority),
    uploadEquirect: createEquirectUploadAdapter(host.uploader, host.broker, host.scope), whenReady: host.whenReady,
  };
}
