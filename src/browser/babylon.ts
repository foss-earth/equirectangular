import type { ImageSessionBroker, ImageOperationScope } from "@foss-earth/images";
import type { ImageTextureUploader, UploadedImageTexture } from "@foss-earth/renderer/babylon";

/** Representation adapter uses the same generic queue as cubes and tile work. */
export function createEquirectUploadAdapter(uploader: ImageTextureUploader, broker: ImageSessionBroker, scope: ImageOperationScope): (image: ImageBitmap, label: string) => Promise<UploadedImageTexture> {
  return (image, label) => uploader.upload({
    kind: "2d", images: [image], label, signal: scope.signal,
    reserveUpload(bytes, ticketLabel) {
      const result = broker.pools.reserve("uploadOutstanding", bytes, ticketLabel);
      if (!result.ok) throw new Error(result.reason);
      return result.reservation;
    },
    reserveDecodedStaging(bytes, ticketLabel) {
      const result = broker.pools.reserve("decoded", bytes, ticketLabel);
      if (!result.ok) throw new Error(result.reason);
      return result.reservation;
    },
  });
}
