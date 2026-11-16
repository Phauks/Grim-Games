/**
 * A script's public rating (Trevor, 2026-11-16: public script ratings, picked over keeping
 * feedback private only): each game adds its players' ratings and accolade counts, never a
 * comment, a name or an account. A script is known by its name and author, as History groups
 * scripts, so every copy of it shares one rating.
 */
import { sha256Hex } from '#lib/core/codes/hash.ts';
import { ACCOLADES, MAX_RATING, isRating, type AccoladeId, type GameFeedback } from './feedback.ts';

/** One game's part of its script's rating. */
export interface GameTally {
	/** How many players rated it, and their stars added up. */
	ratings: number;
	ratingSum: number;
	/** How many players gave each accolade; none given are left out. */
	accolades: Partial<Record<AccoladeId, number>>;
}

/** A script's rating over every game counted. */
export interface ScriptRating {
	games: number;
	ratings: number;
	/** The average to the half star, when anyone rated it. */
	rating?: number;
	/** Each accolade given, most given first. */
	accolades: { id: AccoladeId; count: number }[];
}

/** Players at most in one game, so a tally can't be inflated. */
const MAX_PLAYERS = 30;

const normalise = (text: string | undefined): string =>
	(text ?? '').normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');

/** The script's id in the ratings store: a hash of its name and author, so neither is sent. */
export function scriptRatingId(name: string, author: string | undefined): Promise<string> {
	return sha256Hex(`${normalise(name)}\n${normalise(author)}`);
}

export const SCRIPT_RATING_ID = /^[0-9a-f]{64}$/;

/** What `feedback` adds to its script's rating; undefined when it adds nothing. */
export function gameTally(feedback: readonly GameFeedback[]): GameTally | undefined {
	const counted = feedback.slice(0, MAX_PLAYERS);
	const rated = counted.flatMap((f) => (f.rating === undefined ? [] : [f.rating]));
	const accolades: Partial<Record<AccoladeId, number>> = {};
	for (const { id } of ACCOLADES) {
		const count = counted.filter((f) => f.accolades.includes(id)).length;
		if (count > 0) accolades[id] = count;
	}
	if (rated.length === 0 && Object.keys(accolades).length === 0) return undefined;
	return { ratings: rated.length, ratingSum: rated.reduce((a, b) => a + b, 0), accolades };
}

const count = (value: unknown): value is number =>
	typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_PLAYERS;

/** A tally as it arrived, checked; undefined when it isn't one. */
export function parseGameTally(raw: unknown): GameTally | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const value = raw as Record<string, unknown>;
	if (!count(value.ratings) || typeof value.ratingSum !== 'number') return undefined;
	if (value.ratingSum < 0 || value.ratingSum > value.ratings * MAX_RATING) return undefined;
	if (value.ratings === 0 && value.ratingSum !== 0) return undefined;
	if (value.ratingSum < value.ratings * 0.5 || !Number.isInteger(value.ratingSum * 2))
		return undefined;
	const accolades: Partial<Record<AccoladeId, number>> = {};
	const given = value.accolades;
	if (typeof given !== 'object' || given === null) return undefined;
	for (const { id } of ACCOLADES) {
		const n = (given as Record<string, unknown>)[id];
		if (n === undefined) continue;
		if (!count(n) || n === 0) return undefined;
		accolades[id] = n;
	}
	return { ratings: value.ratings, ratingSum: value.ratingSum, accolades };
}

/** The games' tallies as one rating. */
export function combineTallies(tallies: readonly GameTally[]): ScriptRating {
	const ratings = tallies.reduce((n, t) => n + t.ratings, 0);
	const sum = tallies.reduce((n, t) => n + t.ratingSum, 0);
	const accolades = ACCOLADES.map(({ id }) => ({
		id,
		count: tallies.reduce((n, t) => n + (t.accolades[id] ?? 0), 0)
	}))
		.filter((a) => a.count > 0)
		.sort((a, b) => b.count - a.count);
	const rating: ScriptRating = { games: tallies.length, ratings, accolades };
	if (ratings > 0) rating.rating = Math.round((sum / ratings) * 2) / 2;
	return rating;
}

/** A rating as the server sent it, checked; undefined when it isn't one. */
export function parseScriptRating(raw: unknown): ScriptRating | undefined {
	if (typeof raw !== 'object' || raw === null) return undefined;
	const value = raw as Record<string, unknown>;
	const whole = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;
	if (!whole(value.games) || !whole(value.ratings) || !Array.isArray(value.accolades))
		return undefined;
	const accolades = value.accolades.flatMap((a: unknown) => {
		const entry = a as { id?: unknown; count?: unknown } | null;
		const known = ACCOLADES.find((x) => x.id === entry?.id);
		return known && whole(entry?.count) && entry.count > 0
			? [{ id: known.id, count: entry.count }]
			: [];
	});
	const rating: ScriptRating = { games: value.games, ratings: value.ratings, accolades };
	if (value.rating !== undefined) {
		if (!isRating(value.rating)) return undefined;
		rating.rating = value.rating;
	}
	return rating;
}
