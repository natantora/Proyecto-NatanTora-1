// Coordenadas extraidas del archivo MidrashPlazaPolanco2026.pdf.
// El PDF mide 1224 x 792 puntos y se muestra dentro de un lienzo de 1000 x 650.
// Este mapa es independiente del plano que se construye en el editor.

const PDF_W = 1224;
const PDF_H = 792;
const CANVAS_W = 1000;
const CANVAS_H = 650;

/** @param {number} value */
const canvasX = (value) => Number(((value / PDF_W) * CANVAS_W).toFixed(2));
/** @param {number} value */
const canvasY = (value) => Number(((value / PDF_H) * CANVAS_H).toFixed(2));

/** @type {Array<[number, number]>} */
const mainRoom = [
  [403, 308.5], [100, 251.5], [203, 233], [429, 463], [100, 449.5], [399, 192], [100, 278.5], [100, 422.5],
  [403, 335.5], [339, 314], [230, 446], [426, 192], [215, 416], [286, 416], [363, 314], [191, 416],
  [262, 416], [244, 314], [333, 416], [455, 463], [268, 314], [589, 192], [229, 233], [215, 314],
  [203, 275], [480, 246], [204, 446], [277, 233], [588, 246], [357, 416], [400, 249], [303, 233],
  [239, 416], [507, 192], [479, 192], [309, 416], [506, 246], [376, 463], [192, 314], [228, 492],
  [425, 249], [273, 463], [291, 314], [203, 492], [319, 463], [562, 192], [401, 416], [561, 246],
  [353, 463], [228, 275], [278, 275], [460, 335.5], [460, 308.5], [157, 252.5], [555, 393.5], [303, 275],
  [555, 419.5], [157, 277.5], [157, 448.5], [296, 463], [157, 422.5], [403, 463.5], [364, 234], [338, 234],
];

/** @type {Array<[number, number]>} */
const centralRoom = [
  ...[261.5, 284.5, 306.5, 351.5, 374.5, 396.5, 419.5, 442.5].map((y) => [632, y]),
  ...[261.5, 284.5, 306.5, 351.5, 374.5, 396.5, 419.5, 442.5].map((y) => [677.5, y]),
  ...[216, 238, 261, 284, 307, 329, 352, 374, 397, 419, 442].map((y) => [717, y]),
  [669, 201.5], [667, 238.5], [615, 278.5],
];

/** @type {Array<{x: number, rows: number[]}>} */
const benchColumns = [
  { x: 767.1, rows: [201.4, 220, 238.7, 257.4, 276.1, 294.8, 313.4, 332.1, 350.9, 369.6, 388.2, 406.9] },
  { x: 806.4, rows: [201.4, 220, 238.7, 257.4, 276.1, 294.8, 313.4, 332.1, 350.9, 369.6, 388.2, 406.9, 425.6] },
  { x: 845.6, rows: [201.4, 220, 238.7, 257.4, 276.1, 294.8, 313.4, 332.1, 369.6, 388.2, 406.9, 425.6] },
  { x: 884.9, rows: [201.4, 220, 238.7, 257.4, 276.1, 294.8, 313.4, 332.1, 369.6, 388.2, 406.9, 425.6] },
  { x: 924.1, rows: [236.8, 255.5, 274.2, 292.9, 311.6, 330.3, 367.7, 386.3, 405, 423.8] },
  { x: 963.3, rows: [236.8, 255.5, 274.2, 292.9, 311.6, 330.3, 367.7, 386.3, 405, 423.8] },
];

const benches = benchColumns.flatMap(({ x, rows }) => rows.map((y) => /** @type {[number, number]} */ ([x, y])));

const sideColumns = [1002.5, 1042, 1081, 1120.5, 1160];
const sideRows = [236.5, 255, 274, 292.5, 311, 330, 367, 386, 404.5, 423.5];
/** @type {Array<[number, number]>} */
const sideRoom = sideRows.flatMap((y) => sideColumns.map((x) => [x, y]));
sideRoom.push([1160, 348.5]);

const sections = [
  { prefix: "M", points: mainRoom },
  { prefix: "C", points: centralRoom },
  { prefix: "B", points: benches },
  { prefix: "S", points: sideRoom },
];

export const ARCHITECTURAL_SEATS = sections.flatMap(({ prefix, points }) =>
  points.toSorted((a, b) => a[1] - b[1] || a[0] - b[0]).map(([x, y], index) => ({
    x: canvasX(x),
    y: canvasY(y),
    rotation: 0,
    label: `${prefix}${String(index + 1).padStart(2, "0")}`,
  })),
);
