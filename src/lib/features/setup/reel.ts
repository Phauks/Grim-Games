/**
 * A slot machine reel's ticks (Trevor, 2026-10-22): `onTick` gets each item the reel passes,
 * slowing like a real reel, then `onStop` runs after about `duration` milliseconds. Returns a
 * function that stops it early. Purely visual: it never decides what the reel lands on.
 */
export function spinReel<T>(
	items: readonly T[],
	onTick: (item: T) => void,
	onStop: () => void,
	duration = 1800
): () => void {
	const timers: ReturnType<typeof setTimeout>[] = [];
	let at = 0;
	let step = 50;
	let i = Math.floor(Math.random() * items.length);
	onTick(items[i]);
	while (at < duration) {
		at += step;
		step *= 1.12;
		i = (i + 1) % items.length;
		const next = items[i];
		timers.push(setTimeout(() => onTick(next), at));
	}
	timers.push(setTimeout(onStop, at + step));
	return () => {
		for (const timer of timers) clearTimeout(timer);
	};
}

/** Whether reels should spin at all: not for someone who asked for reduced motion. */
export const reelsMove = (): boolean => !matchMedia('(prefers-reduced-motion: reduce)').matches;
