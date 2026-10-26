/**
 * Animated QR codes (offline games, Trevor 2026-10-26): text too long for one code the phone
 * camera reads well is cut into frames shown one after another, and the reading phone
 * collects them in any order until it has every one. Each frame says which text it belongs
 * to, so frames of another code seen in passing are not mixed in.
 *
 * A frame reads `GB1:<id>:<index>:<total>:<part>`, index counting from 1.
 */

export const QR_FRAME_PREFIX = 'GB1';
/** Characters of the text per frame: a small code, quick to read off another phone's screen. */
export const QR_FRAME_CHARS = 600;
/** More frames than this take too long to read; the text is refused instead. */
export const MAX_QR_FRAMES = 60;

/** A short id for a text (FNV-1a, base 36), so a frame can say which text it is part of. */
export function qrTextId(text: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(36);
}

/** The frames for `text`, or null when it needs more than `MAX_QR_FRAMES`. */
export function qrFrames(text: string, size = QR_FRAME_CHARS): string[] | null {
	const total = Math.max(1, Math.ceil(text.length / size));
	if (total > MAX_QR_FRAMES) return null;
	const id = qrTextId(text);
	return Array.from(
		{ length: total },
		(_, i) => `${QR_FRAME_PREFIX}:${id}:${i + 1}:${total}:${text.slice(i * size, (i + 1) * size)}`
	);
}

export interface QrFrame {
	id: string;
	/** From 1. */
	index: number;
	total: number;
	part: string;
}

const FRAME = /^GB1:([0-9a-z]{1,7}):(\d{1,3}):(\d{1,3}):([\s\S]*)$/;

/** A frame made by `qrFrames`, or null for any other text. */
export function parseQrFrame(text: string): QrFrame | null {
	const match = FRAME.exec(text);
	if (!match) return null;
	const index = Number(match[2]);
	const total = Number(match[3]);
	if (total < 1 || total > MAX_QR_FRAMES || index < 1 || index > total) return null;
	return { id: match[1], index, total, part: match[4] };
}

/** What reading one more code did. */
export type QrFrameRead =
	{ kind: 'frame'; read: number; total: number } | { kind: 'done'; text: string };

/** Collects the frames of one text as the camera reads them, in any order. */
export class QrFrameCollector {
	#id: string | undefined;
	#parts: (string | undefined)[] = [];

	/** Adds a code the camera read; null when it is not a frame. */
	add(text: string): QrFrameRead | null {
		const frame = parseQrFrame(text);
		if (!frame) return null;
		// Another text's frame: start again on that one.
		if (frame.id !== this.#id || frame.total !== this.#parts.length) {
			this.#id = frame.id;
			this.#parts = Array.from({ length: frame.total }, () => undefined);
		}
		this.#parts[frame.index - 1] = frame.part;
		const read = this.#parts.filter((part) => part !== undefined).length;
		if (read < frame.total) return { kind: 'frame', read, total: frame.total };
		const whole = this.#parts.join('');
		this.#id = undefined;
		this.#parts = [];
		// A damaged frame that still parsed: start again rather than load a broken text.
		if (qrTextId(whole) !== frame.id) return { kind: 'frame', read: 0, total: frame.total };
		return { kind: 'done', text: whole };
	}
}
