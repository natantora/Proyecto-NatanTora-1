const DEFAULT_ROW_TOLERANCE = 14;

/**
 * Ordena elementos por filas visuales: de arriba hacia abajo y, dentro de
 * cada fila, de izquierda a derecha. La tolerancia evita que pequeños
 * desajustes al arrastrar una silla creen filas distintas.
 *
 * @template {{ id?: string, x: number, y: number, label?: string | null }} T
 * @param {T[]} seats
 * @param {number} [rowTolerance]
 * @returns {T[]}
 */
export function seatsInVisualOrder(seats, rowTolerance = DEFAULT_ROW_TOLERANCE) {
  const sorted = [...seats].sort((a, b) =>
    a.y - b.y || a.x - b.x || String(a.id ?? a.label ?? "").localeCompare(String(b.id ?? b.label ?? "")),
  );

  /** @type {{ centerY: number, seats: T[] }[]} */
  const rows = [];
  for (const seat of sorted) {
    const row = rows.at(-1);
    if (!row || Math.abs(seat.y - row.centerY) > rowTolerance) {
      rows.push({ centerY: seat.y, seats: [seat] });
      continue;
    }

    row.seats.push(seat);
    row.centerY = row.seats.reduce((sum, item) => sum + item.y, 0) / row.seats.length;
  }

  return rows.flatMap((row) =>
    row.seats.sort((a, b) =>
      a.x - b.x || a.y - b.y || String(a.id ?? a.label ?? "").localeCompare(String(b.id ?? b.label ?? "")),
    ),
  );
}

/**
 * Cambia únicamente las etiquetas. No altera posición, rotación ni IDs.
 *
 * @template {{ id?: string, x: number, y: number, label?: string | null }} T
 * @param {T[]} seats
 * @param {number} [rowTolerance]
 * @returns {(T & { label: string })[]}
 */
export function renumberSeatsByVisualOrder(seats, rowTolerance = DEFAULT_ROW_TOLERANCE) {
  const labels = new Map(
    seatsInVisualOrder(seats, rowTolerance).map((seat, index) => [seat, String(index + 1)]),
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
