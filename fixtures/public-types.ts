import type { RepresentationHooks, SourceSampler, ImageIdentity } from "@foss-earth/images";
import { createImageSourceCache, imageSourceKey } from "@foss-earth/images";
import { createImageFileService } from "@foss-earth/images/browser";
import type { ImageTextureUploader, UploadedImageTexture } from "@foss-earth/renderer/babylon";
import { equirectRepresentation, type EquirectRepresentationRecord } from "@foss-earth/sphere-equirectangular";
import { loadEquirect, type EquirectLoadPorts } from "@foss-earth/sphere-equirectangular/browser";
import { createEquirectUploadAdapter } from "@foss-earth/sphere-equirectangular/babylon";
import * as preparation from "@foss-earth/sphere-equirectangular/preparation";
import * as shaders from "@foss-earth/sphere-equirectangular/shaders";
const hooks: RepresentationHooks<EquirectRepresentationRecord> = equirectRepresentation;
const source: SourceSampler = { sample(_direction, _footprint, out) { out[0] = 0.5; out[1] = 0.5; out[2] = 0.5; } };
const consume = (ports: EquirectLoadPorts<UploadedImageTexture>, record: EquirectRepresentationRecord, uploader: ImageTextureUploader, asset: ImageIdentity) => {
  const cache = createImageSourceCache<Awaited<ReturnType<typeof loadEquirect<UploadedImageTexture>>>>({ broker: ports.broker, keptGpuBytes: 0, gpuBytes: value => value.estimate.sourceGpu });
  const key = imageSourceKey(asset, record);
  return { key, cache, upload: createEquirectUploadAdapter(uploader, ports.broker, ports.scope), loading: loadEquirect(record, ports) };
};
void [hooks, source, consume, createImageFileService, preparation, shaders];
