import { describe, expect, it } from 'vitest';
import {
	combineTallies,
	gameTally,
	parseGameTally,
	parseScriptRating,
	scriptRatingId,
	SCRIPT_RATING_ID
} from './script-rating.ts';
import type { GameFeedback } from './feedback.ts';

const fb = (rating: number | undefined, ...accolades: GameFeedback['accolades']): GameFeedback => ({
	version: 1,
	...(rating === undefined ? {} : { rating }),
	accolades,
	comment: 'secret',
	anonymous: true
});

describe('script ratings', () => {
	it('knows a script by its name and author, however they are spaced or cased', async () => {
		const id = await scriptRatingId('Trouble Brewing', 'The Pandemonium Institute');
		expect(id).toMatch(SCRIPT_RATING_ID);
		expect(await scriptRatingId('  trouble   BREWING ', 'the pandemonium institute')).toBe(id);
		expect(await scriptRatingId('Trouble Brewing', undefined)).not.toBe(id);
	});

	it("tallies a game's ratings and accolades, never its comments", () => {
		const tally = gameTally([fb(4, 'pacing'), fb(3.5, 'pacing', 'twist'), fb(undefined)]);
		expect(tally).toEqual({ ratings: 2, ratingSum: 7.5, accolades: { pacing: 2, twist: 1 } });
		expect(JSON.stringify(tally)).not.toContain('secret');
		expect(gameTally([fb(undefined)])).toBeUndefined();
	});

	it('refuses a tally no game could give', () => {
		expect(parseGameTally({ ratings: 1, ratingSum: 4, accolades: {} })).toBeDefined();
		expect(parseGameTally({ ratings: 1, ratingSum: 6, accolades: {} })).toBeUndefined();
		expect(parseGameTally({ ratings: 0, ratingSum: 2, accolades: {} })).toBeUndefined();
		expect(parseGameTally({ ratings: 1, ratingSum: 4.2, accolades: {} })).toBeUndefined();
		expect(parseGameTally({ ratings: 999, ratingSum: 999, accolades: {} })).toBeUndefined();
		expect(parseGameTally({ ratings: 1, ratingSum: 4, accolades: { pacing: -1 } })).toBeUndefined();
		expect(parseGameTally({ ratings: 1, ratingSum: 4, accolades: { madeUp: 3 } })).toEqual({
			ratings: 1,
			ratingSum: 4,
			accolades: {}
		});
	});

	it('adds games up to the half star, most given accolade first', () => {
		const rating = combineTallies([
			{ ratings: 2, ratingSum: 7.5, accolades: { pacing: 2, twist: 1 } },
			{ ratings: 1, ratingSum: 5, accolades: { twist: 3 } }
		]);
		expect(rating).toEqual({
			games: 2,
			ratings: 3,
			rating: 4,
			accolades: [
				{ id: 'twist', count: 4 },
				{ id: 'pacing', count: 2 }
			]
		});
		expect(parseScriptRating(rating)).toEqual(rating);
		expect(combineTallies([])).toEqual({ games: 0, ratings: 0, accolades: [] });
	});
});
