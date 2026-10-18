/**
 * Drag a Library row onto a folder (Trevor, 2026-10-18: "drag and drop files around into
 * folders"). Pointer Events, touch first: on a touchscreen a press held still starts the drag,
 * so a swipe still scrolls; a mouse or pen starts it by moving. Drop targets are any element
 * with `data-drop-folder` (a folder id, or `top` for the top level). Moving without dragging
 * is always possible too: the Folder drop-down and Move.
 */

/** The top level, as a drop target's `data-drop-folder`. */
export const TOP_FOLDER = 'top';

export interface DragSource {
	/** An item's key, or a folder's id. */
	id: string;
	folder: boolean;
	/** Shown under the finger while dragging. */
	label: string;
}

export interface DragOptions {
	source: DragSource;
	/** Called on a drop; `target` is a folder id, or undefined for the top level. */
	onmove: (source: DragSource, target: string | undefined) => void;
}

/** How long a touch must stay still to start a drag, and how far it may wander first. */
const HOLD_MS = 350;
const TOUCH_SLOP = 10;
const MOUSE_START = 6;

export function dragToFolder(node: HTMLElement, initial: DragOptions) {
	let options = initial;
	let start: { x: number; y: number; id: number; touch: boolean } | undefined;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let dragging = false;
	let ghost: HTMLElement | undefined;
	let over: HTMLElement | undefined;

	const stopScroll = (e: TouchEvent) => {
		if (dragging) e.preventDefault();
	};
	// A held touch would open the browser's menu instead of dragging.
	const stopMenu = (e: Event) => {
		if (start?.touch || dragging) e.preventDefault();
	};
	const stopNativeDrag = (e: Event) => e.preventDefault();
	// The tap that ends a drag isn't also a click on the row.
	const swallowClick = (e: Event) => {
		e.preventDefault();
		e.stopPropagation();
	};

	function target(x: number, y: number): HTMLElement | undefined {
		const found = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-folder]');
		if (!found) return undefined;
		// A folder can't go into itself.
		const { source } = options;
		if (source.folder && found.dataset.dropFolder === source.id) return undefined;
		return found;
	}

	function place(x: number, y: number) {
		if (ghost) ghost.style.transform = `translate(${x}px, ${y}px)`;
		const next = target(x, y);
		if (next === over) return;
		over?.removeAttribute('data-drop-over');
		over = next;
		over?.setAttribute('data-drop-over', '');
	}

	function begin(x: number, y: number) {
		if (!start) return;
		dragging = true;
		try {
			node.setPointerCapture(start.id);
		} catch {
			// The pointer is already gone; the drag ends on the next event.
		}
		ghost = document.createElement('div');
		ghost.className = 'library-drag-ghost';
		ghost.setAttribute('aria-hidden', 'true');
		ghost.textContent = options.source.label;
		document.body.append(ghost);
		document.body.classList.add('library-dragging');
		window.addEventListener('touchmove', stopScroll, { passive: false });
		place(x, y);
	}

	function finish(drop: boolean) {
		clearTimeout(timer);
		timer = undefined;
		if (dragging) {
			const dropped = over;
			if (drop && dropped) {
				const value = dropped.dataset.dropFolder;
				options.onmove(options.source, value === TOP_FOLDER ? undefined : value);
			}
			node.addEventListener('click', swallowClick, { capture: true, once: true });
			// A drop with nothing under it leaves no click to swallow.
			setTimeout(() => node.removeEventListener('click', swallowClick, { capture: true }), 0);
		}
		over?.removeAttribute('data-drop-over');
		over = undefined;
		ghost?.remove();
		ghost = undefined;
		document.body.classList.remove('library-dragging');
		window.removeEventListener('touchmove', stopScroll);
		dragging = false;
		start = undefined;
	}

	function down(e: PointerEvent) {
		if (e.button !== 0 || !e.isPrimary) return;
		start = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' };
		if (start.touch) {
			const { clientX, clientY } = e;
			timer = setTimeout(() => begin(clientX, clientY), HOLD_MS);
		}
	}

	function move(e: PointerEvent) {
		if (!start || e.pointerId !== start.id) return;
		if (dragging) {
			place(e.clientX, e.clientY);
			return;
		}
		const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y);
		if (start.touch) {
			// Moving before the hold is up is a scroll, not a drag.
			if (moved > TOUCH_SLOP) finish(false);
		} else if (moved > MOUSE_START) {
			begin(e.clientX, e.clientY);
		}
	}

	function up(e: PointerEvent) {
		if (start && e.pointerId === start.id) finish(true);
	}

	function cancel(e: PointerEvent) {
		if (start && e.pointerId === start.id) finish(false);
	}

	node.addEventListener('pointerdown', down);
	// On the window: a mouse leaves the row before the drag starts and captures the pointer.
	window.addEventListener('pointermove', move);
	window.addEventListener('pointerup', up);
	window.addEventListener('pointercancel', cancel);
	node.addEventListener('contextmenu', stopMenu);
	// Registered from the start, so the browser lets a drag stop the page scrolling.
	node.addEventListener('touchmove', stopScroll, { passive: false });
	// The browser's own link and image dragging would fight ours.
	node.addEventListener('dragstart', stopNativeDrag);

	return {
		update(next: DragOptions) {
			options = next;
		},
		destroy() {
			finish(false);
			node.removeEventListener('pointerdown', down);
			window.removeEventListener('pointermove', move);
			window.removeEventListener('pointerup', up);
			window.removeEventListener('pointercancel', cancel);
			node.removeEventListener('contextmenu', stopMenu);
			node.removeEventListener('touchmove', stopScroll);
			node.removeEventListener('dragstart', stopNativeDrag);
		}
	};
}
