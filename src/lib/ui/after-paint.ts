/**
 * Runs `fn` once the browser has painted the current frame, so a tap shows its first response
 * (a dialog's frame opening) before heavy content is built. A tap whose handler builds a long
 * list at once holds the next paint for hundreds of milliseconds on a phone (the board's Script
 * button: 312 ms in Chrome's INP reading, Trevor 2026-10-31).
 *
 * requestAnimationFrame runs just before the paint; the task queued from it runs just after.
 * Returns a cancel function, for an effect's cleanup.
 */
export function afterPaint(fn: () => void): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const frame = requestAnimationFrame(() => {
		timer = setTimeout(fn, 0);
	});
	return () => {
		cancelAnimationFrame(frame);
		if (timer !== undefined) clearTimeout(timer);
	};
}
