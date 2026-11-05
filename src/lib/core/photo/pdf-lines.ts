import type { PhotoLine } from './script-photo.ts';

/** One run of text from a PDF page, in page units with y measured up from the bottom. */
export interface PdfText {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Runs closer than this share of their height, top to bottom, are on one line. */
const SAME_ROW = 0.5;
/** A gap wider than this many text heights starts a new column: its own line. */
const COLUMN_GAP = 3;

/**
 * A PDF page's text as the lines a photo reader would give, top to bottom: runs on one row
 * are joined, and a wide gap splits a row in two, so a sheet printed in two columns gives
 * each character its own line.
 */
export function pdfLines(items: readonly PdfText[]): PhotoLine[] {
	const runs = items
		.filter((i) => i.text.trim() !== '' && i.height > 0)
		.toSorted((a, b) => b.y - a.y || a.x - b.x);
	const rows: PdfText[][] = [];
	for (const run of runs) {
		const row = rows.at(-1);
		if (row && Math.abs(row[0].y - run.y) < SAME_ROW * Math.max(row[0].height, run.height))
			row.push(run);
		else rows.push([run]);
	}
	return rows.flatMap((row) => {
		const lines: PdfText[][] = [];
		for (const run of row.toSorted((a, b) => a.x - b.x)) {
			const line = lines.at(-1);
			const last = line?.at(-1);
			if (line && last && run.x - (last.x + last.width) <= COLUMN_GAP * run.height) line.push(run);
			else lines.push([run]);
		}
		return lines.map((line) => ({
			text: line
				.map((r) => r.text.trim())
				.join(' ')
				.replace(/\s+/g, ' '),
			height: Math.max(...line.map((r) => r.height))
		}));
	});
}
