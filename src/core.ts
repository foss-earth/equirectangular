import { normalize, type Vec3 } from "@foss-earth/images";

/** The equirectangular direction of normalized image coordinates, u right and v down, centre forward. */
export function equirectDirection(u: number, v: number): Vec3 {
  const theta = 2 * Math.PI * (u - 0.5);
  const phi = Math.PI * (0.5 - v);
  return [Math.sin(theta) * Math.cos(phi), Math.cos(theta) * Math.cos(phi), Math.sin(phi)];
}

export function equirectCoordinates(direction: Vec3): { u: number; v: number } {
  const d = normalize(direction);
  return { u: 0.5 + Math.atan2(d[0], d[1]) / (2 * Math.PI), v: 0.5 - Math.asin(Math.max(-1, Math.min(1, d[2]))) / Math.PI };
}

/** Equirectangular width for the same centre density: 2π texels per radian of the view's centre. */
export function immersionEquirectWidth(viewportHeightPx: number, verticalFovRad: number, texelsPerPixel: number): number {
  return Math.PI * viewportHeightPx / Math.tan(verticalFovRad / 2) * texelsPerPixel;
}

