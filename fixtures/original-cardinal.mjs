/** Immutable cardinal fixture slice, original Earth 90e23b3. Test oracle only. */
// Stroke letters on a unit box, x right and y up, as seen from inside the sphere.
const LETTERS = {
  N: [[[0, 0], [0, 1], [0.7, 0], [0.7, 1]]],
  E: [[[0.7, 1], [0, 1], [0, 0], [0.7, 0]], [[0, 0.5], [0.55, 0.5]]],
  S: [[[0.7, 0.9], [0.55, 1], [0.15, 1], [0, 0.85], [0, 0.62], [0.15, 0.5], [0.55, 0.5], [0.7, 0.38], [0.7, 0.15], [0.55, 0], [0.15, 0], [0, 0.1]]],
  W: [[[0, 1], [0.18, 0], [0.35, 0.6], [0.52, 0], [0.7, 1]]],
};
const LETTER_COLOURS = { N: [230, 57, 70], E: [255, 209, 102], S: [72, 202, 228], W: [239, 131, 255] };

function segmentDistance(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / (ab[0] ** 2 + ab[1] ** 2)));
  return Math.hypot(p[0] - a[0] - t * ab[0], p[1] - a[1] - t * ab[1]);
}

/**
 * The reference renderer's synthetic sphere: sky and ground, a 30° grid,
 * polar details, and the letters N, E, S and W on the horizon, which read
 * backwards wherever a mapping mirrors the image.
 */
export function makeCardinalSphere(width = 2048, height = width / 2) {
  const rgb = Buffer.alloc(width * height * 3);
  const letters = [["N", 0], ["E", 90], ["S", 180], ["W", 270]];
  const letterSizeDeg = 16;
  for (let y = 0; y < height; y++) {
    const pitch = (0.5 - (y + 0.5) / height) * 180;
    for (let x = 0; x < width; x++) {
      const heading = ((x + 0.5) / width - 0.5) * 360;
      let colour;
      if (pitch >= 0) {
        const t = pitch / 90;
        colour = [150 - 110 * t, 190 - 120 * t, 235 - 60 * t];
      } else {
        const t = -pitch / 90;
        colour = [110 - 60 * t, 135 - 85 * t, 70 - 40 * t];
        if (pitch < -60 && (Math.floor(heading / 15) + Math.floor(pitch / 5)) % 2 === 0) colour = colour.map(c => c * 0.75);
      }
      if (pitch > 70 && Math.abs(((heading + 360) % 45) - 22.5) > 20) colour = [250, 250, 250];
      const gridHeading = Math.abs(((heading + 360) % 30) - 15);
      const gridPitch = Math.abs(((pitch + 180) % 30) - 15);
      if (gridHeading > 14.6 || gridPitch > 14.6) colour = colour.map(c => c * 0.55);
      if (Math.abs(pitch) < 0.35) colour = [255, 255, 255];
      for (const [name, centre] of letters) {
        let dh = heading - centre;
        dh = ((dh + 540) % 360) - 180;
        const lx = dh / letterSizeDeg + 0.35;
        const ly = (pitch - 4) / letterSizeDeg;
        if (lx < -0.2 || lx > 1 || ly < -0.2 || ly > 1.2) continue;
        let best = Infinity;
        for (const stroke of LETTERS[name]) {
          for (let i = 0; i + 1 < stroke.length; i++) best = Math.min(best, segmentDistance([lx, ly], stroke[i], stroke[i + 1]));
        }
        if (best < 0.075) colour = LETTER_COLOURS[name];
        else if (best < 0.11) colour = [20, 20, 20];
      }
      rgb.set(colour.map(c => Math.max(0, Math.min(255, Math.round(c)))), (y * width + x) * 3);
    }
  }
  return { width, height, rgb };
}
