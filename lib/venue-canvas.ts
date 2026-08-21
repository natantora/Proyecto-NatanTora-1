export const CANVAS_W = 1000;
export const CANVAS_H = 650;

export const GRID_SNAP = 5;
export const NEIGHBOR_SNAP = 6;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SNAP) * GRID_SNAP;
}
