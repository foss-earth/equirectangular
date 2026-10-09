# Native input lifetime

Status: source prepared on 2026-10-09. All new checks, installed consumers and
backend qualification remain unrun. No current app has adopted these bytes.

The host supplies the existing image broker, operation scope and uploader. Its
upload promise must settle only when that operation has stopped reading supplied
bitmaps, including rejection. Cancellation ends publication immediately; it does
not prove that a queued or submitted native operation has stopped reading pixels.

`loadEquirect` uses `HeldDecodedImage.retain?()` from the public Images browser
contract. The actual common decoder retains the live bitmap and its original
decoded reservation even when its owning scope closes.

The loader acquires the real input hold before invoking the upload callback. It
keeps that hold through upload settlement, readiness and disposal of any stale
texture. It then requests source closure and releases the input hold. A late
texture is disposed before the last input hold is released. Successful cleanup
also rechecks the operation generation before returning a visible source.

Input holds and decoded charges are retained if an uploader never settles. A
host that rejects on cancellation while its native work continues violates the
upload contract; these leaves cannot infer native completion or supply a second
GPU scheduler. Upload/staging completion tickets remain the Renderer owner's
responsibility and are separate from bitmap lifetime.

Each release is idempotent. Cleanup attempts every owned texture, face and input
hold, even when a disposer throws. Errors retain the primary operation failure,
then output disposal errors, then input disposal errors. Partial cube input-hold
acquisition releases every previously acquired hold before reporting failure.

Legacy injected decoders without `retain` retain their existing API and behavior.
Their cancellation lifetime is explicitly unqualified: the loader cannot stop
an unrelated scope from closing a foreign bitmap. Supply the actual common
decoder or an equally reliable host implementation to use nonabortable uploads.

The actual common-service cases in `tests/common-services.test.ts` exercise scope
cancellation, broker invalidation/disposal and synchronous cancellation inside
the upload callback, with both late upload resolution and rejection. Throwing
texture/bitmap disposers cover all-attempt cleanup and error order. The installed public fixture
`fixtures/installed-consumer.mjs` uses actual Images transport/decode/accounting;
its original legacy mock-uploader behavior remains covered. Public declaration
composition is expressed in `tests/minimal-consumer.ts`.
These are source fixtures, not successful tests or backend evidence.

Original face order, representation geometry, GPU estimates, readiness,
replacement-overlap acknowledgement, source attribution and preparation remain
unchanged. There is one host renderer and resource broker. Rolling back keeps the
canonical original app and all prior receipts; no app source has been removed.

YOU CANNOT HAVE AI AS A CO-AUTHOR, OR YOUR CONTRIBUTIONS WILL BE REJECTED.
