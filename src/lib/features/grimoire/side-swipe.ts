/**
 * A clear sideways swipe by touch or pen (a fifth of the screen, mostly across), for paging
 * through steps. Mouse drags are ignored. `onSwipe` gets 1 for a swipe left (next) and -1
 * for a swipe right (back).
 */
export function sideSwipe(onSwipe: (by: 1 | -1) => void) {
	let from: { x: number; y: number; id: number } | undefined;
	return {
		start(event: PointerEvent) {
			if (event.pointerType !== 'mouse')
				from = { x: event.clientX, y: event.clientY, id: event.pointerId };
		},
		cancel() {
			from = undefined;
		},
		end(event: PointerEvent) {
			const begun = from;
			from = undefined;
			if (!begun || begun.id !== event.pointerId) return;
			const dx = event.clientX - begun.x;
			const dy = event.clientY - begun.y;
			if (Math.abs(dx) > window.innerWidth / 5 && Math.abs(dx) > 2 * Math.abs(dy))
				onSwipe(dx < 0 ? 1 : -1);
		}
	};
}
