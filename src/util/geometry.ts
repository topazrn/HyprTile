export interface IPoint {
  x: number;
  y: number;
}
/**
 * Represents the geometric properties of a window or a screen region.
 */

export interface IGeometry extends IPoint {
  width: number;
  height: number;
}
/**
 * Determines if a given point (cursorX, cursorY) is within the bounds of a geometry.
 */

export function isPointInGeometry(
  x: number,
  y: number,
  geometry: IGeometry,
): boolean {
  return (
    x >= geometry.x &&
    x < geometry.x + geometry.width &&
    y >= geometry.y &&
    y < geometry.y + geometry.height
  );
}
