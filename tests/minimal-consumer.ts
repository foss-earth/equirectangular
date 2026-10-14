import type { RepresentationHooks } from "@foss-earth/images";
import { equirectRepresentation } from "@foss-earth/sphere-equirectangular";
import type { EquirectLoadPorts } from "@foss-earth/sphere-equirectangular/browser";
import type { HeldDecodedImage, WholeImageTexture } from "@foss-earth/images/browser";
const hooks: RepresentationHooks = equirectRepresentation;
console.log(hooks.projection);
/** Public optional native-input hold; no source/deep import or second broker. */
export function retainDecodedInput(image: HeldDecodedImage): (() => void) | null { return image.retain?.() ?? null; }
export type EquirectHostUpload = EquirectLoadPorts<WholeImageTexture>["uploadEquirect"];
