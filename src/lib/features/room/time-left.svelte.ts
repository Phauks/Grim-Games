/**
 * A countdown to `endsAt` on this device's clock, ticking each second while there is one:
 * the script vote's time limit, room transfer's code, and the minute players may see their
 * characters all count down with it.
 */
export function timeLeft(endsAt: () => number | undefined) {
	let now = $state(Date.now());
	$effect(() => {
		if (endsAt() === undefined) return;
		now = Date.now();
		const timer = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(timer);
	});
	return {
		/** Milliseconds left, 0 once it's up, or none without an end. */
		get ms() {
			const end = endsAt();
			return end === undefined ? undefined : Math.max(0, end - now);
		}
	};
}

/** "4:52": minutes and seconds left, rounded up. */
export function clock(ms: number): string {
	const seconds = Math.ceil(ms / 1000);
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
