const DEFAULT_COLUMN_TOLERANCE = 14;

/**
 * Ordena elementos por columnas visuales: desde la derecha hacia la
 * izquierda y, dentro de cada columna, de arriba hacia abajo. La tolerancia
 * evita que pequeños desajustes al arrastrar una silla creen columnas
 * distintas.
 *
 * @template {{ id?: string, x: number, y: number, label?: string | null }} T
 * @param {T[]} seats
 * @param {number} [columnTolerance]
 * @returns {T[]}
 */
export function seatsInVisualOrder(seats, columnTolerance = DEFAULT_COLUMN_TOLERANCE) {
  const sorted = [...seats].sort((a, b) =>
    b.x - a.x || a.y - b.y || String(a.id ?? a.label ?? "").localeCompare(String(b.id ?? b.label ?? "")),
  );

  /** @type {{ centerX: number, seats: T[] }[]} */
  const columns = [];
  for (const seat of sorted) {
    const column = columns.at(-1);
    if (!column || Math.abs(seat.x - column.centerX) > columnTolerance) {
      columns.push({ centerX: seat.x, seats: [seat] });
      continue;
    }

    column.seats.push(seat);
    column.centerX = column.seats.reduce((sum, item) => sum + item.x, 0) / column.seats.length;
  }

  return columns.flatMap((column) =>
    column.seats.sort((a, b) =>
      a.y - b.y || b.x - a.x || String(a.id ?? a.label ?? "").localeCompare(String(b.id ?? b.label ?? "")),
    ),
  );
}

/**
 * Cambia únicamente las etiquetas. No altera posición, rotación ni IDs.
 *
 * @template {{ id?: string, x: number, y: number, label?: string | null }} T
 * @param {T[]} seats
 * @param {number} [columnTolerance]
 * @returns {(T & { label: string })[]}
 */
export function renumberSeatsByVisualOrder(seats, columnTolerance = DEFAULT_COLUMN_TOLERANCE) {
  const labels = new Map(
    seatsInVisualOrder(seats, columnTolerance).map((seat, index) => [seat, String(index + 1)]),
  );
  return seats.map((seat) => ({ ...seat, label: labels.get(seat) }));
}

/**
 * @param {{ label?: string | null }[]} seats
 */
export function nextNumericSeatLabel(seats) {
  const largest = seats.reduce((max, seat) => {
    const value = Number(seat.label);
    return Number.isInteger(value) && value > max ? value : max;
  }, 0);
  return String(largest + 1);
}
