import type { Attachment } from 'svelte/attachments';

interface OneRowParts {
	/** The title, measured on one line at its full size (before fitWords shrinks it). */
	title: () => HTMLElement | null | undefined;
	/** The buttons beside it, each an icon button. */
	actions: () => HTMLElement | null | undefined;
	/** Anything else on the row with the title (the room kept for the hamburger, Close). */
	others?: () => (HTMLElement | null | undefined)[];
	/**
	 * How many buttons the row keeps room for, shown or not, so a button that appears later
	 * (Message, once the phone is in a room) never moves the title to another row.
	 */
	slots?: number;
}

/**
 * Sets `data-one-row` on the node while its title fits on one line beside its buttons, at its
 * full size; otherwise the node's CSS puts the title under them (Trevor, 2026-11-01: "if there
 * is space in the front row where there would not be reflow, we do that, otherwise, put it
 * beneath"). Decided by the row's width and the title's words alone, never by which buttons
 * happen to show, so nothing moves while a screen is in use. Measured again when the row
 * changes size, when the title or buttons change, and once the fonts have loaded.
 */
export function oneRow(parts: OneRowParts, ...layout: unknown[]): Attachment<HTMLElement> {
	void layout;
	return (node) => {
		const titleWidth = (title: HTMLElement) => {
			// Every fitWords share set inside, put back to full size for the measure.
			const fitted = [title, ...title.querySelectorAll<HTMLElement>('*')].filter((el) =>
				el.style.getPropertyValue('--fit')
			);
			const shares = fitted.map((el) => el.style.getPropertyValue('--fit'));
			for (const el of fitted) el.style.setProperty('--fit', '1');
			// Each part (a logo, the words) at its own one-line width, with the gaps between them:
			// the title's own box may stretch to fill its row.
			const children = [...title.children] as HTMLElement[];
			const pieces = children.length ? children : [title];
			const widths = pieces.map((el) => {
				const { width, whiteSpace } = el.style;
				el.style.width = 'max-content';
				el.style.whiteSpace = 'nowrap';
				const w = el.getBoundingClientRect().width;
				el.style.width = width;
				el.style.whiteSpace = whiteSpace;
				return w;
			});
			const gap = parseFloat(getComputedStyle(title).columnGap) || 0;
			const measured = widths.reduce((sum, w) => sum + w, 0) + gap * (widths.length - 1);
			fitted.forEach((el, i) => el.style.setProperty('--fit', shares[i]));
			return measured;
		};
		const actionsWidth = (actions: HTMLElement) => {
			const buttons = [...actions.children].filter(
				(el) => (el as HTMLElement).getBoundingClientRect().width > 0
			);
			const shown = actions.scrollWidth;
			if (!parts.slots || !buttons.length) return shown;
			const tap = buttons[0].getBoundingClientRect().width;
			const gap = parseFloat(getComputedStyle(actions).columnGap) || 0;
			return Math.max(shown, parts.slots * tap + (parts.slots - 1) * gap);
		};
		/** Its width on the row, measured even while hidden off it (the hamburger's room). */
		const widthOf = (el: HTMLElement) => {
			if (getComputedStyle(el).display !== 'none') return el.getBoundingClientRect().width;
			const { display } = el.style;
			el.style.display = 'block';
			const width = el.getBoundingClientRect().width;
			el.style.display = display;
			return width;
		};
		const measure = () => {
			const title = parts.title();
			const actions = parts.actions();
			if (!title || !actions) {
				delete node.dataset.oneRow;
				return;
			}
			const others = (parts.others?.() ?? []).filter((el): el is HTMLElement => !!el);
			const gap = parseFloat(getComputedStyle(node).columnGap) || 0;
			const items = [titleWidth(title), actionsWidth(actions)].concat(others.map(widthOf));
			const needed = items.reduce((sum, w) => sum + w, 0) + gap * (items.length - 1);
			const fits = needed <= node.clientWidth - 1;
			if (fits) node.dataset.oneRow = '';
			else delete node.dataset.oneRow;
		};
		let frame = 0;
		const later = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(measure);
		};
		measure();
		const resize = new ResizeObserver(later);
		resize.observe(node);
		const changes = new MutationObserver(later);
		changes.observe(node, { childList: true, subtree: true, characterData: true });
		let live = true;
		void document.fonts?.ready.then(() => {
			if (live) measure();
		});
		return () => {
			live = false;
			cancelAnimationFrame(frame);
			resize.disconnect();
			changes.disconnect();
			delete node.dataset.oneRow;
		};
	};
}
