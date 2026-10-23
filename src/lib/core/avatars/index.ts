/**
 * Player avatars (plan R6, Trevor 2026-10-22: "avatar is default"): the picture a player
 * picks on their phone for their own seat token. Our own set, never Blood on the Clocktower
 * art or marks: each one is a Phosphor icon (MIT), named by its Phosphor name, drawn on the
 * token's face. None of them is a mark the game uses (night, day, dead, ghost vote).
 */
export const AVATAR_IDS = [
	'cat',
	'dog',
	'bird',
	'fish',
	'horse',
	'rabbit',
	'butterfly',
	'bug',
	'cow',
	'paw-print',
	'cactus',
	'flower-tulip',
	'tree-evergreen',
	'plant',
	'star',
	'crown',
	'anchor',
	'key',
	'bell',
	'feather',
	'rocket',
	'sailboat',
	'guitar',
	'music-notes',
	'coffee',
	'pizza',
	'cake',
	'mountains',
	'snowflake',
	'lightning',
	'planet',
	'compass',
	'lighthouse',
	'castle-turret',
	'dice-five',
	'campfire'
] as const;

export type AvatarId = (typeof AVATAR_IDS)[number];

const KNOWN = new Set<string>(AVATAR_IDS);

/** The avatar a stored or sent value names, or undefined for anything else. */
export function parseAvatarId(raw: unknown): AvatarId | undefined {
	return typeof raw === 'string' && KNOWN.has(raw) ? (raw as AvatarId) : undefined;
}
