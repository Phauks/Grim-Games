/**
 * The largest scale from `min` to `max` at which `fits` still holds, found by halving the
 * range `steps` times. `fits` is assumed to hold below a size and fail above it, as text that
 * grows until it would run out of its box does. Returns `min` when even that does not fit.
 */
export function largestFit(
	fits: (scale: number) => boolean,
	{ min, max, steps = 12 }: { min: number; max: number; steps?: number }
): number {
	if (!fits(min)) return min;
	if (fits(max)) return max;
	let low = min;
	let high = max;
	for (let i = 0; i < steps; i++) {
		const middle = (low + high) / 2;
		if (fits(middle)) low = middle;
		else high = middle;
	}
	return low;
}
