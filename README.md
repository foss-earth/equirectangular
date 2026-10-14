# @foss-earth/sphere-equirectangular

Full 2:1 equirectangular sphere support for FOSS Earth: representation
records, angular coordinates, seam and pole filtering, area-average prefilters,
source-sampling plans, GPano coverage checks, the cardinal reference sphere and
shader sampling fragments.

Its browser loader works with the host's shared image broker, operation scope,
acquisition and decode service, uploader and renderer readiness. The package
creates no device, scene, scheduler, cache, viewer or geographic engine.

## What this repository owns

- Equirectangular records, coordinates, preparation and shaders: this package.
- Common codecs, color conversion and EXIF orientation:
  [images](https://github.com/foss-earth/images).
- Target cube structure: [sphere-cubemap](https://github.com/foss-earth/sphere-cubemap).
- The optional Babylon adapter uses [renderer](https://github.com/foss-earth/renderer).

## Exports

`.`, `./core`, `./preparation`, `./browser`, `./babylon`, `./shaders`,
`./schema.json` and `./package.json`.

[Public contracts](docs/public-contracts.md) describe units, filtering and
lifecycle. [Native input lifetime](docs/native-input-lifetime.md) describes how
decoded inputs and sheet-crop face sources keep their pixels alive across awaited
host uploads and stale texture cleanup, and how that stays compatible with the
older behavior.

## Using the loader

Loader callers provide a dedicated operation scope and must acknowledge a
completed visibility swap with `settleReplacement()`.

## Dependencies

- `@foss-earth/images` is a runtime dependency.
- `@foss-earth/renderer` is an optional peer, used by the Babylon adapter.
- `@foss-earth/sphere-cubemap` is a development dependency only. One preparation test
  uses its public API; production code does not import it.

## Earlier package name

This package was named `@foss-earth/equirectangular`. Nothing is published under that name
any more: consumers import `@foss-earth/sphere-equirectangular`. Records and documents did
not change: the `equirectangular` projection, the schema `$id` and media URLs are as before. The
repository keeps the name `equirectangular` until it is renamed on the host.

## Development

The package depends on other `@foss-earth/*` libraries by versions that are not
published, so its own `npm install`, tests and build don't work on their own yet.
Develop it through the app, which uses libraries straight from their checkouts
(see [app, Local source](https://github.com/foss-earth/app#local-source)).

The scripts in `package.json` are `build`, `typecheck`, `lint`, `test` and
`typecheck:consumer`. Tests are in [tests](tests).

## Project policies

- [Code of conduct](https://github.com/foss-earth/.github/blob/main/CODE_OF_CONDUCT.md)
- [Contributing](https://github.com/foss-earth/.github/blob/main/CONTRIBUTING.md)
- [AGPL-3.0 license](LICENSE)
- [Security](https://github.com/foss-earth/.github/blob/main/SECURITY.md)
