export type { TileFace } from '#lib/ui/preferences.ts';
import type { TileFace } from '#lib/ui/preferences.ts';

/** A, B … Z, then AA, AB …: the letter label for the 1-based tile `number`. */
export function tileLetters(number: number): string {
	let n = number;
	let out = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		out = String.fromCharCode(65 + rem) + out;
		n = Math.floor((n - 1) / 26);
	}
	return out;
}

/** What a face-down tile shows, by the Storyteller's setting. */
export function tileLabel(number: number, face: TileFace): string {
	return face === 'letters' ? tileLetters(number) : String(number);
}
