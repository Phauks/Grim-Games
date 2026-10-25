import type { Attachment } from 'svelte/attachments';

/** The smallest share of its size the text shrinks to; below it, a word breaks after all. */
export const FIT_WORDS_MIN = 0.6;

/**
 * Shrinks a title's text until its longest word fits the room left for it, so a narrow
 * phone with a logo and buttons beside the title never breaks a word in the middle ("Troub /
 * le Brewi / ng", 2026-10-23). The text keeps its size when every word fits. It sets
 * `--fit` on the node, a share of the font size for the node's CSS to use; pass what
 * changes the text (its words) so it is measured again, as with fitLines. Measured again
 * when its row changes size and once the fonts have loaded.
 */
export function fitWords(...layout: unknown[]): Attachment<HTMLElement> {
	void layout;
	return (node) => {
		const room = node.parentElement;
		if (!room) return;
		/** How much wider the text is than what is left of its row, at its longest word. */
		const over = () => {
			// Measured at its longest word's width: a flex item set to shrink past it otherwise.
			node.style.minWidth = 'auto';
			const text = node.getBoundingClientRect();
			node.style.minWidth = '';
			const box = room.getBoundingClientRect();
			const left = box.right - parseFloat(getComputedStyle(room).paddingRight) - text.left;
			return text.width === 0 ? 1 : text.width / left;
		};
		const fit = () => {
			node.style.removeProperty('--fit');
			let share = 1;
			// The text's width follows its size, but letter spacing and rounding don't quite;
			// a step or two more settles it, a pixel spare.
			for (let step = 0; step < 4 && share > FIT_WORDS_MIN; step++) {
				const ratio = over();
				if (ratio <= 0.995) break;
				share = Math.max(FIT_WORDS_MIN, Math.floor((share / ratio) * 0.99 * 100) / 100);
				node.style.setProperty('--fit', String(share));
			}
		};
		let frame = 0;
		const later = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(fit);
		};
		fit();
		// Measured again when anything in the row changes size: the window, or a logo beside
		// the text that loads after it. Fitting again gives the same size, so this settles.
		const observer = new ResizeObserver(later);
		for (const el of [room, ...room.children]) observer.observe(el);
		let live = true;
		void document.fonts?.ready.then(() => {
			if (live) fit();
		});
		return () => {
			live = false;
			cancelAnimationFrame(frame);
			observer.disconnect();
			node.style.removeProperty('--fit');
		};
	};
}
