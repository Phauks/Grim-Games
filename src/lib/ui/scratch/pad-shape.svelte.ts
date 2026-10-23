/**
 * The shape of a scratch pad on this screen (width / height), remembered on this device so
 * the list previews take the same shape: tall on a phone, wide on a desktop (Trevor,
 * 2026-10-23: a pad traced on a desktop showed as a small band in a tall preview). Until a
 * pad has been opened here, a phone's shape.
 */
import { readStored, writeStored } from '#lib/ui/stored.ts';

const KEY = 'grim-games:scratch-pad-shape';
const PHONE = 3 / 4;
/** Narrower or wider than any real screen's pad; a damaged value falls back to a phone's. */
const MIN = 0.3;
const MAX = 4;

function parse(raw: unknown): number {
	return typeof raw === 'number' && raw >= MIN && raw <= MAX ? raw : PHONE;
}

export const padShape = $state({ ratio: parse(readStored(KEY)) });

/** Called with the pad's size each time it is laid out. */
export function rememberPadShape(width: number, height: number) {
	if (!width || !height) return;
	const ratio = Math.min(MAX, Math.max(MIN, Math.round((width / height) * 100) / 100));
	if (ratio === padShape.ratio) return;
	padShape.ratio = ratio;
	writeStored(KEY, ratio);
}
