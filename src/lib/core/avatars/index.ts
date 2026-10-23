/**
 * Player avatars (plan R6, Trevor 2026-10-22: "avatar is default"): what a player puts on
 * their own seat token from their phone. For now only their initials on the token's face
 * (Trevor, 2026-10-23: "Initials for now", until the app has a drawn set of its own). Never
 * Blood on the Clocktower art or marks. A drawn set would add more ids here.
 */
export const AVATAR_IDS = ['initials'] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

const KNOWN = new Set<string>(AVATAR_IDS);

/**
 * The avatar a stored or sent value names, or undefined for anything else. That includes the
 * pictures an earlier beta build offered ("cat", "rocket"), which the seat then drops.
 */
export function parseAvatarId(raw: unknown): AvatarId | undefined {
	return typeof raw === 'string' && KNOWN.has(raw) ? (raw as AvatarId) : undefined;
}

/**
 * A player's initials: the first letter of their first and last words, upper case, so
 * "Alex" is "A" and "Mary Ann Lee" is "ML". Letters are whole characters, so an accented
 * letter or an emoji stays in one piece. Empty when the name has none.
 */
export function initialsOf(name: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	const first = (word: string | undefined) => (word ? [...word][0].toLocaleUpperCase() : '');
	if (words.length === 0) return '';
	return words.length === 1 ? first(words[0]) : first(words[0]) + first(words.at(-1));
}
