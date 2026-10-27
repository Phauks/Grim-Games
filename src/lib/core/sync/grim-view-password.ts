/**
 * Grim view's password (Trevor, 2026-10-26: "access password locked by storyteller instead,
 * and default to a new password per game (that can be customizable)"). The app makes one for
 * each game; the Storyteller reads it out or types their own.
 *
 * It is two words and a number, like `candle-raven-42` (Trevor, 2026-10-27: "phrases ... or at
 * least, a word-number combo so it doesn't get too long"): words are easier to read out across
 * the table and type than random letters. The words are the shared code words, so each is
 * one random byte from the platform's CSPRNG, and the number is 10 to 99 so it reads the
 * same aloud as typed (no leading zero). That is 2 × 8 + log2(90) ≈ 22.5 bits, more than the
 * six random digits (about 20 bits) NIST SP 800-63B-4 §3.1.2.1 asks of a look-up secret, and
 * the room refuses Grim view after a few wrong passwords (`MAX_VIEWER_FAILS` in
 * room-preview.ts, far under §3.2.2's 100), so guessing one online would take years.
 */
import { CODE_WORDS, isCodeWord, type RandomBytes } from '#lib/core/codes/word-code.ts';

/** Words in a made password, before its number. */
export const GRIM_VIEW_PASSWORD_WORDS = 2;

const NUMBER_MIN = 10;
const NUMBER_COUNT = 90;

/** Bits of randomness in a made password. */
export const GRIM_VIEW_PASSWORD_BITS =
	GRIM_VIEW_PASSWORD_WORDS * Math.log2(CODE_WORDS.length) + Math.log2(NUMBER_COUNT);

const cryptoBytes: RandomBytes = (bytes) => crypto.getRandomValues(bytes);

/** Makes a new password. `random` is injectable so tests are deterministic. */
export function newGrimViewPassword(random: RandomBytes = cryptoBytes): string {
	const words = Array.from(random(new Uint8Array(GRIM_VIEW_PASSWORD_WORDS)), (b) => CODE_WORDS[b]);
	return [...words, NUMBER_MIN + randomBelow(NUMBER_COUNT, random)].join('-');
}

/** A uniform number in [0, n) for n ≤ 256: bytes past the last whole multiple of n are drawn again. */
function randomBelow(n: number, random: RandomBytes): number {
	const limit = 256 - (256 % n);
	for (;;) {
		const [b] = random(new Uint8Array(1));
		if (b < limit) return b % n;
	}
}

/**
 * The password as both devices hash it. A made one is matched however it was typed or heard
 * ("Candle Raven 42", "candle-raven-42"): any case and any separators. One the Storyteller
 * chose stays exactly as typed, apart from spaces at either end.
 */
export function normaliseGrimViewPassword(input: string): string {
	const trimmed = input.trim();
	const parts = trimmed
		.toLowerCase()
		.split(/[^a-z0-9]+/)
		.filter(Boolean);
	const words = parts.slice(0, -1);
	const number = parts.at(-1) ?? '';
	const made =
		words.length === GRIM_VIEW_PASSWORD_WORDS &&
		words.every(isCodeWord) &&
		/^[1-9][0-9]$/.test(number);
	return made ? [...words, number].join('-') : trimmed;
}
