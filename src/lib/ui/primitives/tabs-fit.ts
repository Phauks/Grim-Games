/**
 * How many tabs, in order, fit on one row `room` wide. When they don't all fit, the row
 * also keeps room for the ⋯ button (`more` wide) that holds the rest. Always at least one.
 */
export function fitTabs(
	widths: readonly number[],
	room: number,
	gap: number,
	more: number
): number {
	const total = (count: number) =>
		widths.slice(0, count).reduce((sum, width) => sum + width, 0) + gap * Math.max(0, count - 1);
	if (total(widths.length) <= room) return widths.length;
	let count = widths.length - 1;
	while (count > 1 && total(count) + gap + more > room) count--;
	return Math.max(1, count);
}
