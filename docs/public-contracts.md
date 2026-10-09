# Public contracts

## Pure entries

The root exports `./core`, representation records,
`validateEquirectRepresentation`, `equirectRepresentation`, `estimateEquirect` and
preparation. Pure entries import only public images contracts/math. They initialize
no browser or renderer.

`EquirectRepresentationRecord` preserves `projection: "equirectangular"`,
positive integer `width`/`height` in texels, full `width === 2 * height`, one URL,
MIME type, total encoded bytes, role/id and opaque namespaced extensions.
Validation resolves URLs against the supplied final manifest URL.
`equirectRepresentation.files(record)` preserves its single common `ImageFile`
shape; `filePath(record,file,enumerationIndex)` returns the original `.url`
diagnostic address. The schema fragment is exported at `./schema.json`.

`equirectDirection(u,v)` and `equirectCoordinates(direction)` preserve image-local
X east, Y north and Z up: north at `(0.5,0.5)`, east at `(0.75,0.5)`, the top pole
at `v=0` and bottom pole at `v=1`. UV coordinates are normalized top-left image
coordinates. `immersionEquirectWidth` consumes viewport pixels, vertical FOV in
radians and texels-per-pixel and returns source width in texels.

`estimateEquirect(record,{maxTextureSide})` returns byte costs for encoded input,
RGBA decoded pixels, the complete source mip chain and upload staging.
`maxTextureSide` is the actual host device limit in texels; the host's shared
images pools decide admission.

## Preparation and shader fragments

`./preparation` accepts already oriented linear RGB `LinearImage` data. It exports
`equirectPyramid(image,minWidth=64)` using the original area-average halvings,
`sampleEquirect(level,u,v,out)` with longitude wrap and latitude clamp,
`equirectUv(x,y,z)` and `createEquirectSourceSampler(pyramid)`. The common sampler's
angular footprint is in radians and selects the retained area-average level;
sampling adds no EXIF rotation or color conversion.

`cubePreparationPlan(pyramid,faceSize)` retains the original source-side prefilter
and two/three samples-per-axis decision while returning a common `ImageSamplingPlan`.
It imports no cube structure. A consumer combines this plan with the cubemap
owner's public `renderCubeFace`; the retained mixed preparation test does exactly
that. `faceSize` is target texels and the returned footprint is radians.

`validatePreparationCoverage({width,height},gpano)` preserves full 2:1 coverage,
explicit cropped GPano rejection and projection rejection. Common images/node
owns `readGPano`, codecs and metadata parsing. Common images color operations
apply EXIF orientation once, refuse unsupported color/alpha, convert to linear
RGB for resampling and encode to sRGB once. This package does not infer survey
pose or transform image-local attitude into geographic ENU.

`makeCardinalPanorama(width=2048)` retains the original RGB reference image with
N/E/S/W lettering, 30-degree grid and polar details. The test oracle is an exact
immutable original function slice; tests compare the output bytes at three widths.

`./shaders` exports `EQUIRECT_UV_WGSL`, `EQUIRECT_SAMPLE_WGSL`,
`EQUIRECT_UV_GLSL`, `EQUIRECT_UV_UNIT_GLSL` and `EQUIRECT_SAMPLE_GLSL`.
The GLSL UV wrapper depends on the unit fragment and should follow it. WGSL and
GLSL gradient sampling retain the longitude seam correction. WebGL 1 without
`EXT_shader_texture_lod` retains the original implicit-gradient fallback, which
can be softer at the seam. These fragments allocate no material or device.

## Browser and optional renderer adapter

`loadEquirect(record,EquirectLoadPorts<T>)` reserves source GPU capacity before
acquisition, releases encoded input after decode, uploads/adopts one texture,
waits for host readiness and closes decoded pixels. Nonabortable late acquisition,
decode and upload results are released or disposed after cancellation. Cleanup
continues if a prior body/pixel/resource cleanup throws. A failed cleanup after
readiness ends the adopted GPU scope and rejects the load.

`EquirectLoadPorts<T>` extends public `@foss-earth/images/browser`
`WholeImagePorts<T>`. Required ports are one broker, one dedicated operation
scope, actual device texture limit, encoded acquisition, decoded pixel acquisition,
`uploadEquirect(image,label)` and `whenReady(texture,signal)`. The host supplies
`label` and replacement `overlap` policy. Common `createImageFileService` handles
cache, bounded transport, headers and decode.
[The host-port fixture](../fixtures/composition/host-ports.ts) binds those exact
public services without creating another renderer or session.

The returned `LoadedWholeImage<T>` contains `texture`, byte `estimate`,
`settleReplacement()` and idempotent `dispose()`. Loading/renderer readiness does
not acknowledge the visibility swap. The host shows incoming content and removes
outgoing content in one task, disposes its outgoing source reference, then calls
`settleReplacement()`. A shared `createImageSourceCache` may hold this result by
`imageSourceKey({id,revision},representation)`; the package creates no private cache.

`./babylon` exports `createEquirectUploadAdapter(uploader,broker,scope)` and
consumes the optional renderer's public `ImageTextureUploader`. It supplies a
single 2D image and requests upload/staging grants from the same broker. Submitted
grants remain charged after CPU cancellation until the renderer observes device
completion or actual device loss. The host pumps its one uploader on its existing
frame authority and supplies its existing scene/device/render scheduler.

## Compatibility and outstanding admission

Version-1 full-image records, angular conventions, filtering and file shapes remain
compatible. Consumer composition must supply the extracted services/ports.
Source/tests/fixtures are prepared, not executed. Native GPU execution, preparation
CLI composition in the scene owner, complete app adoption, accepted archive pins,
clean lineage, lockfile, pinned common CI caller/policy conformance and actual
remote admission settings remain primary/coordinator work. Docs-only metadata
changes must still run common metadata conformance once its shared pin is wired.
