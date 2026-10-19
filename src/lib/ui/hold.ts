/**
 * A press held still on a button (Trevor, 2026-10-19: "allow holding on to timer to reset
 * time"). Pointer Events, touch first: the hold fires after `HOLD_MS` if the finger has not
 * wandered, and then the press's own click is swallowed so the button's tap action does not
 * also run. The long-press menu a phone would show is suppressed. Use as an attachment:
 * `<button {@attach hold(() => …)}>`.
 */
export const HOLD_MS = 500;
/** How far the pointer may wander before the press counts as a scroll. */
const SLOP_PX = 10; // px-ok: pointer distance, not layout

export function hold(onHold: () => void) {
	return (node: HTMLElement) => {
		let timer: ReturnType<typeof setTimeout> | undefined;
		let start: { x: number; y: number } | undefined;
		let held = false;
		const cancel = () => {
			clearTimeout(timer);
			timer = undefined;
			start = undefined;
		};
		const down = (event: PointerEvent) => {
			if (event.button !== 0) return;
			held = false;
			start = { x: event.clientX, y: event.clientY };
			timer = setTimeout(() => {
				timer = undefined;
				held = true;
				onHold();
			}, HOLD_MS);
		};
		const move = (event: PointerEvent) => {
			if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > SLOP_PX) cancel();
		};
		const click = (event: MouseEvent) => {
			if (!held) return;
			held = false;
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		const menu = (event: Event) => event.preventDefault();
		node.addEventListener('pointerdown', down);
		node.addEventListener('pointermove', move);
		node.addEventListener('pointerup', cancel);
		node.addEventListener('pointercancel', cancel);
		node.addEventListener('pointerleave', cancel);
		node.addEventListener('click', click, true);
		node.addEventListener('contextmenu', menu);
		return () => {
			cancel();
			node.removeEventListener('pointerdown', down);
			node.removeEventListener('pointermove', move);
			node.removeEventListener('pointerup', cancel);
			node.removeEventListener('pointercancel', cancel);
			node.removeEventListener('pointerleave', cancel);
			node.removeEventListener('click', click, true);
			node.removeEventListener('contextmenu', menu);
		};
	};
}
