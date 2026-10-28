/**
 * Post-game feedback (Trevor, 2026-10-20): after a game, each player may rate it in half stars,
 * give the Storyteller accolades and leave a comment, with or without their name. Feedback
 * belongs to the script it was played on; only the Storyteller and signed-in players who were
 * in that game may read it. This module only shapes and checks it; carrying and storing it
 * belong to the room and the server.
 */

/** Bump with a migration when the saved shape changes: older builds may have saved feedback. */
export const FEEDBACK_VERSION = 1;

/** The accolades a player can give the Storyteller (Trevor, 2026-10-22). Labels live in i18n. */
export const ACCOLADES = [
	{ id: 'pacing', emoji: '⏱️' },
	{ id: 'fair', emoji: '⚖️' },
	{ id: 'twist', emoji: '🌀' },
	{ id: 'clear', emoji: '💡' },
	{ id: 'atmosphere', emoji: '🕯️' },
	{ id: 'setup', emoji: '🧩' },
	{ id: 'final-day', emoji: '🔥' }
] as const;

export type AccoladeId = (typeof ACCOLADES)[number]['id'];

export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 500;

export interface GameFeedback {
	version: typeof FEEDBACK_VERSION;
	/** Half stars from 0.5 to 5; none when the player didn't rate. */
	rating?: number;
	/** In `ACCOLADES` order, no repeats. */
	accolades: AccoladeId[];
	comment?: string;
	/** On by default: the room drops the sender's name and seat before passing it on. */
	anonymous: boolean;
}

const ACCOLADE_IDS: readonly string[] = ACCOLADES.map((a) => a.id);

function isAccoladeId(value: unknown): value is AccoladeId {
	return typeof value === 'string' && ACCOLADE_IDS.includes(value);
}

/** A rating the sheet can show: a half step from 0.5 to 5. */
export function isRating(value: unknown): value is number {
	return (
		typeof value === 'number' && value > 0 && value <= MAX_RATING && Number.isInteger(value * 2)
	);
}

export function emptyFeedback(): GameFeedback {
	return { version: FEEDBACK_VERSION, accolades: [], anonymous: true };
}

/** Whether there is anything worth sending: a rating, an accolade or a comment. */
export function hasFeedback(feedback: GameFeedback): boolean {
	return feedback.rating !== undefined || feedback.accolades.length > 0 || !!feedback.comment;
}

/** Adds or removes one accolade, keeping `ACCOLADES` order. */
export function toggleAccolade(feedback: GameFeedback, id: AccoladeId): GameFeedback {
	const on = new Set(feedback.accolades);
	if (on.has(id)) on.delete(id);
	else on.add(id);
	return { ...feedback, accolades: ACCOLADES.map((a) => a.id).filter((a) => on.has(a)) };
}

/**
 * Checks feedback from another device or the server, which may be from an older or newer
 * build or not ours at all. Unknown accolades are dropped, a long comment is cut and a rating
 * off the half-star scale is left out; anything that isn't feedback gives undefined.
 */
export function parseFeedback(raw: unknown): GameFeedback | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const value = raw as Record<string, unknown>;
	if (value.version !== FEEDBACK_VERSION) return undefined;
	const accolades = Array.isArray(value.accolades) ? value.accolades.filter(isAccoladeId) : [];
	const comment =
		typeof value.comment === 'string' ? value.comment.trim().slice(0, MAX_COMMENT_LENGTH) : '';
	const feedback: GameFeedback = {
		version: FEEDBACK_VERSION,
		accolades: ACCOLADES.map((a) => a.id).filter((id) => accolades.includes(id)),
		anonymous: value.anonymous !== false
	};
	if (isRating(value.rating)) feedback.rating = value.rating;
	if (comment) feedback.comment = comment;
	return feedback;
}

export interface FeedbackSummary {
	/** How many players sent feedback. */
	count: number;
	/** Average of the ratings given, to the nearest half star; none when nobody rated. */
	rating?: number;
	ratings: number;
	/** How many players gave each accolade, in `ACCOLADES` order. */
	accolades: { id: AccoladeId; count: number }[];
}

/** Totals for a game's or a script's feedback, as the Storyteller sees it. */
export function summarizeFeedback(all: readonly GameFeedback[]): FeedbackSummary {
	const rated = all.flatMap((f) => (f.rating === undefined ? [] : [f.rating]));
	const summary: FeedbackSummary = {
		count: all.length,
		ratings: rated.length,
		accolades: ACCOLADES.map(({ id }) => ({
			id,
			count: all.filter((f) => f.accolades.includes(id)).length
		}))
	};
	if (rated.length > 0) {
		const mean = rated.reduce((sum, r) => sum + r, 0) / rated.length;
		summary.rating = Math.round(mean * 2) / 2;
	}
	return summary;
}
