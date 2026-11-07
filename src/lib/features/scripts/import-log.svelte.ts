/**
 * The step-by-step log of the last script read from a photo, a PDF or a file (Trevor,
 * 2026-11-06: "We need more verbose logging of what is happening"): the file received, the
 * text reader's progress, every line it read and how each was matched, the script it was
 * matched to, and anything that failed. Read log in the photo review shows it with Copy;
 * each step is also printed to the console under `[script-import]`.
 *
 * It stays on the device, in memory only, and is never sent with Diagnostics or a report:
 * it holds the script's own text.
 */
import type { PhotoLineTrace } from '#lib/core/photo/script-photo.ts';

export type ImportLogTone = 'step' | 'found' | 'close' | 'missed' | 'failed';

export interface ImportLogEntry {
	/** Milliseconds since the import started. */
	at: number;
	text: string;
	tone: ImportLogTone;
}

/** Entries kept for one import: a long PDF's lines fit, a runaway loop doesn't fill memory. */
const MAX_ENTRIES = 2000;

class ImportLog {
	entries = $state.raw<ImportLogEntry[]>([]);
	#started = 0;

	/** Starts a new log for one import, e.g. "Photo received". */
	start(text: string): void {
		this.#started = Date.now();
		this.entries = [];
		this.add(text);
	}

	add(text: string, tone: ImportLogTone = 'step'): void {
		if (!this.#started) this.#started = Date.now();
		if (this.entries.length >= MAX_ENTRIES) return;
		const entry = { at: Date.now() - this.#started, text, tone };
		this.entries = [...this.entries, entry];
		const print = tone === 'failed' ? console.warn : console.info;
		print(`[script-import] +${seconds(entry.at)} ${text}`);
	}

	/** The whole log as plain text, for Copy. */
	text(): string {
		return this.entries.map((e) => `+${seconds(e.at)} ${e.text}`).join('\n');
	}
}

export const importLog = new ImportLog();

function seconds(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

/** A file as the log names it: "IMG_2041.jpg, image/jpeg, 3.1 MB". */
export function describeFile(file: Blob): string {
	const name = file instanceof File ? file.name : 'Unnamed file';
	const size =
		file.size >= 1024 * 1024
			? `${(file.size / 1024 / 1024).toFixed(1)} MB`
			: `${Math.ceil(file.size / 1024)} KB`;
	return `${name}, ${file.type || 'unknown type'}, ${size}`;
}

function score(n: number): string {
	return n.toFixed(2);
}

/** One line of the reading, as the log tells it. */
export function logLine(line: PhotoLineTrace, confidence?: number): void {
	const sure = confidence === undefined ? '' : ` (read ${Math.round(confidence)}% sure)`;
	const at = `Line ${line.index + 1} "${line.text}"${sure}`;
	/* eslint-disable grim/names-as-badges -- the log is plain text to read and Copy, like a console line */
	switch (line.outcome) {
		case 'empty':
			return;
		case 'name':
			importLog.add(`${at}: ${line.name} by name, ${score(line.score)}`, 'found');
			return;
		case 'ability':
			importLog.add(`${at}: ${line.name} by ability, ${score(line.score)} of its words`, 'found');
			return;
		case 'close':
			importLog.add(`${at}: ${line.name}? close match, ${score(line.score)}`, 'close');
			return;
		case 'unmatched':
			importLog.add(
				`${at}: no character${line.nearest ? `, nearest ${line.nearest.name} ${score(line.nearest.score)}` : ''}`,
				'missed'
			);
			return;
		case 'title':
			importLog.add(`${at}: the title`);
			return;
		case 'author':
			importLog.add(`${at}: the author, ${line.author}`, 'found');
			return;
		case 'tail':
			importLog.add(`${at}: the end of an ability`);
			return;
		case 'unnamed':
			importLog.add(`${at}: names no character`);
	}
	/* eslint-enable grim/names-as-badges */
}

/** What went wrong, for the log. */
export function failureText(error: unknown): string {
	return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}
