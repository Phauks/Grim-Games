/**
 * Player avatars (plan R6, Trevor 2026-10-22: "avatar is default"): what a player puts on
 * their own seat token from their phone. For now only their initials on the token's face
 * (Trevor, 2026-10-23: "Initials for now", until the app has a drawn set of its own). Never
 * Blood on the Clocktower art or marks. A drawn set would add more ids here.
 */
export const AVATAR_IDS = ['initials'] as const;

/**
 * An avatar: initials, or a character's icon (Trevor, 2026-10-27: one avatar, the account's
 * character icon among its choices), as `character:<id>`. Seats show the icon engraved, in
 * one tone, so it never reads as the player's character (2026-10-28).
 */
export type AvatarId = (typeof AVATAR_IDS)[number] | `character:${string}`;

const KNOWN = new Set<string>(AVATAR_IDS);
const CHARACTER = /^character:([a-z0-9_-]{1,40})$/;

/** The avatar showing this character's icon. */
export function characterAvatar(characterId: string): AvatarId {
	return `character:${characterId}`;
}

/** The character whose icon an avatar shows, if it shows one. */
export function avatarCharacter(avatar: AvatarId | undefined): string | undefined {
	return avatar === undefined ? undefined : CHARACTER.exec(avatar)?.[1];
}

/**
 * The avatar a stored or sent value names, or undefined for anything else. That includes the
 * pictures an earlier beta build offered ("cat", "rocket"), which the seat then drops.
 */
export function parseAvatarId(raw: unknown): AvatarId | undefined {
	if (typeof raw !== 'string') return undefined;
	if (KNOWN.has(raw)) return raw as AvatarId;
	return CHARACTER.test(raw) ? (raw as AvatarId) : undefined;
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
