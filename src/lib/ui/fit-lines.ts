import type { Attachment } from 'svelte/attachments';

/**
 * Shrinks a box of wrapped text to its widest line. A box with a width limit wraps at the
 * limit and stays that wide, so two short lines sat in a wide band with empty space on both
 * sides (Trevor, 2026-10-23: "200% width for minions not nominated has two lines"). One line,
 * or no wrapping, is left alone. Pass what changes the text's layout (the words, sizes and
 * settings) so the box is measured again when they change; it is also measured once the
 * fonts have loaded.
 */
export function fitLines(...layout: unknown[]): Attachment<HTMLElement> {
	void layout;
	return (node) => {
		const fit = () => {
			node.style.width = '';
			const text = document.createRange();
			text.selectNodeContents(node);
			const lines = [...text.getClientRects()].filter((line) => line.width > 0);
			const box = node.getBoundingClientRect();
			if (lines.length < 2 || box.width === 0) return;
			// Screen widths to layout widths, in case anything around it is scaled.
			const scale = node.offsetWidth / box.width;
			const style = getComputedStyle(node);
			const edges =
				style.boxSizing === 'border-box'
					? parseFloat(style.paddingLeft) +
						parseFloat(style.paddingRight) +
						parseFloat(style.borderLeftWidth) +
						parseFloat(style.borderRightWidth)
					: 0;
			const widest = Math.max(...lines.map((line) => line.width)) * scale;
			// A pixel spare, so rounding never wraps a line again.
			const width = Math.ceil(widest + edges) + 1;
			if (width < node.offsetWidth) node.style.width = `${width}px`;
		};
		fit();
		let live = true;
		void document.fonts?.ready.then(() => {
			if (live) fit();
		});
		return () => {
			live = false;
			node.style.width = '';
		};
	};
}
