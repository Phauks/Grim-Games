/**
 * Reads a PDF of a script sheet on the device (Trevor, 2026-11-05: a PDF given to Take a
 * Photo did nothing). pdf.js (Apache-2.0) runs from our own `/ocr/` files, beside the photo
 * reader's (vite.config.ts `ocrFiles`), so nothing leaves the phone. A PDF saved from a
 * script maker carries its text, used as it is; a scanned one is read like a photo.
 */
import { pdfLines, type PdfText } from '#lib/core/photo/pdf-lines.ts';
import type { PhotoLine } from '#lib/core/photo/script-photo.ts';

/** Pages read from one file: a script is one or two sides, so more is not a script sheet. */
const MAX_PAGES = 4;
/** Pages are drawn this wide on their long side, as photos are shrunk to (photo-reader.ts). */
const LONG_SIDE = 2400;
/** Fewer letters than this on a page means it is a scan, read from its picture. */
const SCANNED = 20;

/** One page: drawn, for its QR code and a scan's text, and its own text when it has some. */
export interface PdfPage {
	canvas: HTMLCanvasElement;
	lines?: PhotoLine[];
}

type PdfJs = typeof import('pdfjs-dist');

/** Whether a picked file is a PDF rather than a photo. */
export function isPdf(file: Blob): boolean {
	return file.type === 'application/pdf' || (file instanceof File && /\.pdf$/i.test(file.name));
}

export async function readPdfPages(file: Blob): Promise<PdfPage[]> {
	const base = new URL('/ocr', location.origin).href;
	// Served from /ocr/ rather than bundled, so it is only downloaded when a PDF is read.
	const pdfjs = (await import(/* @vite-ignore */ `${base}/pdf.min.js`)) as PdfJs;
	pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdf.worker.min.js`;
	const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
	const doc = await task.promise;
	try {
		const pages: PdfPage[] = [];
		for (let n = 1; n <= Math.min(doc.numPages, MAX_PAGES); n++) {
			const page = await doc.getPage(n);
			const flat = page.getViewport({ scale: 1 });
			const viewport = page.getViewport({
				scale: LONG_SIDE / Math.max(flat.width, flat.height)
			});
			const canvas = document.createElement('canvas');
			canvas.width = Math.round(viewport.width);
			canvas.height = Math.round(viewport.height);
			await page.render({ canvas, viewport }).promise;
			const content = await page.getTextContent();
			const items: PdfText[] = content.items.flatMap((item) =>
				'str' in item
					? [
							{
								text: item.str,
								x: item.transform[4],
								y: item.transform[5],
								width: item.width,
								height: item.height || Math.hypot(item.transform[2], item.transform[3])
							}
						]
					: []
			);
			const letters = items.reduce((sum, i) => sum + i.text.replace(/\W/g, '').length, 0);
			pages.push({ canvas, lines: letters >= SCANNED ? pdfLines(items) : undefined });
			page.cleanup();
		}
		return pages;
	} finally {
		await task.destroy();
	}
}
