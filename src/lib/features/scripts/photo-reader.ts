/**
 * Reads the text of a photo on the device itself (plan M54, Trevor 2026-11-05: "build it into
 * the app for local analysis"): no photo leaves the phone. Tesseract.js (Apache-2.0) runs in a
 * Web Worker from our own `/ocr/` files (vite.config.ts `ocrFiles`), loaded the first time a
 * photo is read and kept by the service worker after that, so it works offline from then on.
 */
import type { PhotoLine } from '#lib/core/photo/script-photo.ts';

/** Photos are shrunk to this long side first: phone photos are far larger than reading needs. */
const LONG_SIDE = 2400;
/** Tesseract's LSTM-only engine, the one whose files we serve (its `OEM.LSTM_ONLY`). */
const LSTM_ONLY = 1;

/** The photo drawn at most `LONG_SIDE` on its long side, the right way up. */
export async function photoCanvas(photo: Blob): Promise<HTMLCanvasElement> {
	const bitmap = await createImageBitmap(photo);
	const scale = Math.min(1, LONG_SIDE / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(bitmap.width * scale);
	canvas.height = Math.round(bitmap.height * scale);
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();
	return canvas;
}

/**
 * The photo's lines of text, top to bottom, with each line's height. `onProgress` hears how
 * far it has got, 0 to 1 (loading the reader, then reading); `log` hears each step the
 * reader takes, for the import log.
 */
export async function readPhotoLines(
	photo: HTMLCanvasElement,
	onProgress?: (share: number) => void,
	log?: (text: string) => void
): Promise<PhotoLine[]> {
	let lastStatus = '';
	let lastQuarter = -1;
	const { createWorker } = await import('tesseract.js');
	const base = new URL('/ocr', location.origin).href;
	const worker = await createWorker('eng', LSTM_ONLY, {
		workerPath: `${base}/worker.min.js`,
		corePath: base,
		langPath: base,
		workerBlobURL: false,
		// The service worker keeps the files; a second copy in IndexedDB would double the space.
		cacheMethod: 'none',
		logger: (m: { status: string; progress: number }) => {
			// Each step once as it starts, then reading in quarters.
			const quarter = Math.floor(m.progress * 4);
			if (m.status !== lastStatus || (m.status === 'recognizing text' && quarter > lastQuarter)) {
				log?.(`Text reader: ${m.status} ${Math.round(m.progress * 100)}%`);
				lastStatus = m.status;
				lastQuarter = quarter;
			}
			const loading = m.status !== 'recognizing text';
			onProgress?.(loading ? m.progress * 0.3 : 0.3 + m.progress * 0.7);
		}
	});
	try {
		const { data } = await worker.recognize(photo, {}, { blocks: true });
		log?.(`Text reader: done, ${Math.round(data.confidence)}% confident overall`);
		return (data.blocks ?? []).flatMap((block) =>
			block.paragraphs.flatMap((paragraph) =>
				paragraph.lines.map((line) => ({
					text: line.text.trim(),
					height: line.bbox.y1 - line.bbox.y0,
					confidence: line.confidence
				}))
			)
		);
	} finally {
		await worker.terminate();
	}
}
