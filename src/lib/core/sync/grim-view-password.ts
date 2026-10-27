/**
 * Grim view's password (Trevor, 2026-10-26: "access password locked by storyteller instead,
 * and default to a new password per game (that can be customizable)"). The app makes one for
 * each game; the Storyteller reads it out or types their own.
 */
export const GRIM_VIEW_PASSWORD_LENGTH = 6;

/** Letters and digits that can't be mistaken for one another when read aloud or typed. */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

/** Makes a new password. `random` is injectable so tests are deterministic. */
export function newGrimViewPassword(random: () => number = secureRandom): string {
	let password = '';
	for (let i = 0; i < GRIM_VIEW_PASSWORD_LENGTH; i++)
		password += ALPHABET[Math.floor(random() * ALPHABET.length)];
	return password;
}

function secureRandom(): number {
	const [value] = crypto.getRandomValues(new Uint32Array(1));
	return value / 2 ** 32;
}
