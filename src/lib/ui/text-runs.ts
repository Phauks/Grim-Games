import type { PdfTextRun } from '#lib/core/print/image-pdf.ts';

/**
 * The words drawn inside `element`, as runs (one per line of each text node), measured from
 * its top left in millimetres: the text layer of a PDF made from a picture of it
 * (image-pdf.ts). `mmPerPx` turns the screen's measure into the paper's.
 */
export function textRuns(element: HTMLElement, mmPerPx: number): PdfTextRun[] {
	const origin = element.getBoundingClientRect();
	const runs: PdfTextRun[] = [];
	const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const text = node.textContent ?? '';
		const parent = node.parentElement;
		if (!text.trim() || !parent || parent.closest('[aria-hidden="true"]')) continue;
		let run: { start: number; end: number; rect: DOMRect } | undefined;
		const close = () => {
			if (!run) return;
			const { rect } = run;
			runs.push({
				text: text.slice(run.start, run.end),
				x: (rect.left - origin.left) * mmPerPx,
				y: (rect.top - origin.top) * mmPerPx,
				width: rect.width * mmPerPx,
				height: rect.height * mmPerPx
			});
			run = undefined;
		};
		// Word by word, so a line break inside the node starts a new run.
		for (const word of text.matchAll(/\S+/g)) {
			range.setStart(node, word.index);
			range.setEnd(node, word.index + word[0].length);
			const rect = range.getBoundingClientRect();
			if (rect.width === 0 || rect.height === 0) continue;
			const sameLine = run && Math.abs(rect.top - run.rect.top) < rect.height / 2;
			if (run && sameLine) {
				const left = Math.min(run.rect.left, rect.left);
				const top = Math.min(run.rect.top, rect.top);
				run.rect = new DOMRect(
					left,
					top,
					Math.max(run.rect.right, rect.right) - left,
					Math.max(run.rect.bottom, rect.bottom) - top
				);
				run.end = word.index + word[0].length;
			} else {
				close();
				run = { start: word.index, end: word.index + word[0].length, rect };
			}
		}
		close();
	}
	return runs;
}
