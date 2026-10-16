/**
 * Number codes such as `482913`, for sharing a script now and joining a live room later.
 * Trevor (2026-10-16): six digits are easier than word codes; phones show a number pad
 * for them. Leading zeros count, so a code is always exactly `length` digits.
 */

/** Fills `values` with random numbers; injectable so tests are deterministic. */
export type RandomUint32 = (values: Uint32Array<ArrayBuffer>) => Uint32Array<ArrayBuffer>;

const cryptoUint32: RandomUint32 = (values) => crypto.getRandomValues(values);

/** Bits of randomness in a code of `length` digits (about 3.3 per digit). */
export function digitCodeBits(length: number): number {
	return length * Math.log2(10);
}

/**
 * Makes a random code of `length` digits (at most 9) from the platform's CSPRNG. Values
 * that would favour low codes are drawn again, so every code is equally likely.
 */
export function makeDigitCode(length: number, random: RandomUint32 = cryptoUint32): string {
	const size = 10 ** length;
	const limit = Math.floor(2 ** 32 / size) * size;
	const value = new Uint32Array(1);
	do random(value);
	while (value[0] >= limit);
	return String(value[0] % size).padStart(length, '0');
}

/**
 * The canonical form of a typed or pasted code, or null unless it is exactly `length`
 * digits. Spaces, hyphens and dots between digits are ignored ("482 913" is fine).
 */
export function normaliseDigitCode(input: string, length: number): string | null {
	const digits = input.replace(/[\s.-]/g, '');
	return new RegExp(`^\\d{${length}}$`).test(digits) ? digits : null;
}

/** For reading aloud and showing: "482 913". */
export function formatDigitCode(code: string): string {
	return code.length === 6 ? `${code.slice(0, 3)} ${code.slice(3)}` : code;
}
