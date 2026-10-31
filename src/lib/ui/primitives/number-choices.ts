/**
 * The numbers a NumberSelect lists (Trevor, 2026-10-30: numbers are picked from a drop-down,
 * not typed or stepped). Every whole number from `min` to `max`, or the given `values` in
 * that range; the current value is listed too when it isn't one of them, so a number saved
 * before the list changed still shows.
 */
export function numberChoices(
	min: number,
	max: number,
	current: number,
	values?: readonly number[]
): number[] {
	const listed = values
		? values.filter((n) => n >= min && n <= max)
		: Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);
	if (!listed.includes(current)) listed.push(current);
	return listed.sort((a, b) => a - b);
}
