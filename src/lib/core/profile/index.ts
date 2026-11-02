/**
 * What a player says about themselves on their profile (Trevor, 2026-11-01): their tag-line
 * and any details they add, such as "Favorite script". All optional: a profile with none shows
 * no rows for them. Sent with their avatar and laurel when they join a room, so the Storyteller
 * and the town see them on the player's profile.
 */

/** One detail a player adds to their profile: a label and their own words. */
export interface ProfileDetail {
	label: string;
	text: string;
}

/** The words a player shares on their profile; each part is left out when they wrote none. */
export interface ProfileWords {
	tagline?: string;
	details?: ProfileDetail[];
}

/** The longest tag-line kept. */
export const MAX_TAGLINE = 200;
/** The most details a profile holds. */
export const MAX_DETAILS = 8;
export const MAX_DETAIL_LABEL = 30;
export const MAX_DETAIL_TEXT = 60;

/**
 * Suggested labels for a new detail (Trevor, 2026-11-01: "Favorite Script", "Favorite
 * Character Type", etc.); a player may write their own instead.
 */
export const DETAIL_SUGGESTIONS = [
	'Favorite script',
	'Favorite character',
	'Favorite character type',
	'Home group',
	'Playing since'
] as const;

/** One line of text, trimmed, with runs of spaces and line breaks made one space. */
function line(raw: unknown, max: number): string | undefined {
	if (typeof raw !== 'string') return undefined;
	const text = raw.replace(/\s+/g, ' ').trim().slice(0, max).trim();
	return text || undefined;
}

export function parseTagline(raw: unknown): string | undefined {
	return line(raw, MAX_TAGLINE);
}

/** Details as kept or sent; any without both a label and text is dropped, and extras past the limit. */
export function parseDetails(raw: unknown): ProfileDetail[] | undefined {
	if (!Array.isArray(raw)) return undefined;
	const details: ProfileDetail[] = [];
	for (const item of raw) {
		if (details.length >= MAX_DETAILS) break;
		if (typeof item !== 'object' || item === null) continue;
		const { label: rawLabel, text: rawText } = item as Record<string, unknown>;
		const label = line(rawLabel, MAX_DETAIL_LABEL);
		const text = line(rawText, MAX_DETAIL_TEXT);
		if (label && text) details.push({ label, text });
	}
	return details.length ? details : undefined;
}

/** A tag-line and details, from anything sent; unknown or empty parts are left out. */
export function parseProfileWords(raw: { tagline?: unknown; details?: unknown }): ProfileWords {
	const tagline = parseTagline(raw.tagline);
	const details = parseDetails(raw.details);
	return { ...(tagline ? { tagline } : {}), ...(details ? { details } : {}) };
}

/** Whether two sets of details say the same, in the same order. */
export function sameDetails(
	a: readonly ProfileDetail[] | undefined,
	b: readonly ProfileDetail[] | undefined
): boolean {
	if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
	return (a ?? []).every((d, i) => d.label === b?.[i]?.label && d.text === b[i]?.text);
}
