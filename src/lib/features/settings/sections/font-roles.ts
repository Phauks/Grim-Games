import { FONT_ROLES, type FontRole } from '#lib/ui/fonts/catalogue.ts';

/**
 * Fonts set in Tokens, beside the token previews (Trevor, 2026-10-18: "they always match, so
 * lets just move them"). Each still sets the same names and reminders in text.
 */
export const TOKEN_FONT_ROLES = [
	'character',
	'reminder',
	// The player name badge's font, beside the character token preview (Trevor, 2026-10-20).
	'player'
] as const satisfies readonly FontRole[];

/** The fonts set in Text. */
export const TEXT_FONT_ROLES: readonly FontRole[] = FONT_ROLES.filter(
	(role) => !(TOKEN_FONT_ROLES as readonly FontRole[]).includes(role)
);
