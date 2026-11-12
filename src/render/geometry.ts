// Coordinate space 144x144, centre (72,72). Fraction 0 = 12 o'clock, clockwise.

/** Round to at most 2 decimals (short, stable strings). */
export function r2(n: number): number {
	return Math.round(n * 100) / 100 + 0; // + 0 normalizes -0
}

export function polar(r: number, frac: number): [number, number] {
	const a = frac * Math.PI * 2;
	return [72 + r * Math.sin(a), 72 - r * Math.cos(a)];
}

/** Clockwise arc path from f0 to f1. "" if (almost) empty, full circle from >= 0.9995. */
export function arcPath(r: number, f0: number, f1: number): string {
	const d = f1 - f0;
	if (d <= 0.0005) return "";
	if (d >= 0.9995) {
		return `M72 ${r2(72 - r)}A${r2(r)} ${r2(r)} 0 1 1 72 ${r2(72 + r)}A${r2(r)} ${r2(r)} 0 1 1 72 ${r2(72 - r)}`;
	}
	const [x0, y0] = polar(r, f0);
	const [x1, y1] = polar(r, f1);
	return `M${r2(x0)} ${r2(y0)}A${r2(r)} ${r2(r)} 0 ${d > 0.5 ? 1 : 0} 1 ${r2(x1)} ${r2(y1)}`;
}
